import { BadRequestException } from '@nestjs/common';
import { BarbershopStatus, CouponDiscountType, Prisma, SubscriptionStatus } from '@prisma/client';
import {
  buildDunningSchedule,
  calculateCommercialMetrics,
  calculateFinancialOverview,
  DocumentType,
  SuperAdminService,
} from './super-admin';

describe('SuperAdminService', () => {
  it('consolida faturamento, recebimentos e carteira por mês', () => {
    const result = calculateFinancialOverview({
      start: new Date(2026, 0, 1),
      months: 2,
      mrr: 300,
      invoices: [
        {
          status: 'PENDING',
          total: new Prisma.Decimal(100),
          discount: new Prisma.Decimal(0),
          dueDate: new Date(2026, 0, 10),
        },
        {
          status: 'OVERDUE',
          total: new Prisma.Decimal(50),
          discount: new Prisma.Decimal(0),
          dueDate: new Date(2026, 1, 10),
        },
        {
          status: 'PAID',
          total: new Prisma.Decimal(200),
          discount: new Prisma.Decimal(10),
          dueDate: new Date(2026, 1, 15),
        },
      ],
      payments: [{ amount: new Prisma.Decimal(200), paidAt: new Date(2026, 1, 16) }],
    });

    expect(result.metrics).toEqual({
      mrr: 300,
      arr: 3600,
      billedRevenue: 350,
      realizedRevenue: 200,
      outstandingAmount: 150,
      overdueAmount: 50,
      discounts: 10,
    });
    expect(result.monthly.map(({ billed, received }) => ({ billed, received }))).toEqual([
      { billed: 100, received: 0 },
      { billed: 250, received: 200 },
    ]);
    expect(result.status.PAID).toEqual({ count: 1, total: 200 });
  });

  it('monta a régua de cobrança em D-3, D0, D+3 e D+7', () => {
    const dueDate = new Date('2026-10-10T12:00:00.000Z');

    expect(buildDunningSchedule(dueDate)).toEqual([
      { sequence: 1, scheduledAt: new Date('2026-10-07T12:00:00.000Z') },
      { sequence: 2, scheduledAt: new Date('2026-10-10T12:00:00.000Z') },
      { sequence: 3, scheduledAt: new Date('2026-10-13T12:00:00.000Z') },
      { sequence: 4, scheduledAt: new Date('2026-10-17T12:00:00.000Z') },
    ]);
  });

  it('calcula ARR, churn e inadimplencia comercial', () => {
    expect(
      calculateCommercialMetrics({
        mrr: 500,
        activeSubscriptions: 8,
        cancellations: 2,
        paidRevenue: 800,
        averageTicket: 200,
        paidInvoices: 4,
        overdueAmount: 250,
        paidDueAmount: 750,
      }),
    ).toEqual({
      mrr: 500,
      arr: 6000,
      averageTicket: 200,
      paidRevenue: 800,
      paidInvoices: 4,
      churned: 2,
      churnRate: 20,
      overdueAmount: 250,
      delinquencyRate: 25,
    });
  });

  it('sincroniza o cancelamento da barbearia com a assinatura', async () => {
    const tx = {
      barbershop: { update: jest.fn().mockResolvedValue({ status: 'CANCELLED' }) },
      subscription: { update: jest.fn().mockResolvedValue({}) },
      subscriptionHistory: { create: jest.fn().mockResolvedValue({}) },
    };
    const db = {
      barbershop: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'shop-1',
          status: BarbershopStatus.ACTIVE,
          subscription: {
            id: 'subscription-1',
            planId: 'plan-1',
            status: SubscriptionStatus.ACTIVE,
          },
        }),
      },
      $transaction: jest.fn((callback) => callback(tx)),
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new SuperAdminService(db as any);

    await service.updateBarbershopStatus('shop-1', BarbershopStatus.CANCELLED, 'actor-1');

    expect(tx.subscription.update).toHaveBeenCalledWith({
      where: { id: 'subscription-1' },
      data: {
        status: SubscriptionStatus.CANCELLED,
        delinquencyStartedAt: null,
        delinquencySuspendedAt: null,
      },
    });
    expect(tx.subscriptionHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'BARBERSHOP_STATUS_SYNCED',
        toStatus: SubscriptionStatus.CANCELLED,
      }),
    });
  });

  it('suspende automaticamente uma assinatura acima do prazo de inadimplência', async () => {
    const tx = {
      subscription: { update: jest.fn().mockResolvedValue({}) },
      barbershop: { update: jest.fn().mockResolvedValue({}) },
      subscriptionHistory: { create: jest.fn().mockResolvedValue({}) },
    };
    const db = {
      subscription: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'subscription-1',
            barbershopId: 'shop-1',
            planId: 'plan-1',
            status: SubscriptionStatus.ACTIVE,
            graceEndsAt: null,
            delinquencyStartedAt: null,
            delinquencySuspendedAt: null,
            plan: { delinquencyGraceDays: 7 },
            barbershop: { status: BarbershopStatus.ACTIVE },
            invoices: [{ id: 'invoice-1', dueDate: new Date('2020-01-01T12:00:00.000Z') }],
          },
        ]),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new SuperAdminService(db as any);

    const result = await service.enforceDelinquencyRules();

    expect(result.suspended).toBe(1);
    expect(tx.subscription.update).toHaveBeenCalledWith({
      where: { id: 'subscription-1' },
      data: expect.objectContaining({
        status: SubscriptionStatus.SUSPENDED,
        delinquencyStartedAt: new Date('2020-01-01T12:00:00.000Z'),
        delinquencySuspendedAt: expect.any(Date),
      }),
    });
    expect(tx.barbershop.update).toHaveBeenCalledWith({
      where: { id: 'shop-1' },
      data: { status: BarbershopStatus.SUSPENDED },
    });
  });

  it('reativa somente uma suspensão marcada como financeira', async () => {
    const tx = {
      subscription: { update: jest.fn().mockResolvedValue({}) },
      barbershop: { update: jest.fn().mockResolvedValue({}) },
      subscriptionHistory: { create: jest.fn().mockResolvedValue({}) },
    };
    const db = {
      subscription: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'subscription-1',
            barbershopId: 'shop-1',
            planId: 'plan-1',
            status: SubscriptionStatus.SUSPENDED,
            delinquencyStartedAt: new Date('2026-09-01T12:00:00.000Z'),
            delinquencySuspendedAt: new Date('2026-09-08T12:00:00.000Z'),
            plan: { delinquencyGraceDays: 7 },
            barbershop: { status: BarbershopStatus.SUSPENDED },
            invoices: [],
          },
        ]),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new SuperAdminService(db as any);

    const result = await service.enforceDelinquencyRules();

    expect(result.reactivated).toBe(1);
    expect(tx.subscription.update).toHaveBeenCalledWith({
      where: { id: 'subscription-1' },
      data: {
        status: SubscriptionStatus.ACTIVE,
        delinquencyStartedAt: null,
        delinquencySuspendedAt: null,
      },
    });
    expect(tx.barbershop.update).toHaveBeenCalledWith({
      where: { id: 'shop-1' },
      data: { status: BarbershopStatus.ACTIVE },
    });
  });

  it('rejeita cupom percentual acima de 100', async () => {
    const service = new SuperAdminService({} as any);

    await expect(
      service.createCoupon(
        {
          code: 'EXCESSO',
          discountType: CouponDiscountType.PERCENTAGE,
          value: 101,
        },
        'actor-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('configura a cortesia a partir do vencimento futuro da assinatura', async () => {
    const expiresAt = new Date('2099-09-20T12:00:00.000Z');
    const subscription = {
      id: 'subscription-1',
      barbershopId: 'shop-1',
      planId: 'plan-1',
      status: 'ACTIVE',
      expiresAt,
    };
    const tx = {
      subscription: { update: jest.fn().mockResolvedValue({}) },
      subscriptionHistory: { create: jest.fn().mockResolvedValue({}) },
    };
    const db = {
      barbershop: { count: jest.fn().mockResolvedValue(1) },
      subscription: { findUnique: jest.fn().mockResolvedValue(subscription) },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new SuperAdminService(db as any);

    await service.configureGracePeriod('shop-1', 7, 'actor-1');

    expect(tx.subscription.update).toHaveBeenCalledWith({
      where: { id: 'subscription-1' },
      data: { graceEndsAt: new Date('2099-09-27T12:00:00.000Z') },
    });
  });

  it('soma desconto manual e percentual do cupom ao criar a fatura', async () => {
    const subscription = { id: 'subscription-1', planId: 'plan-1', status: 'ACTIVE' };
    const tx = {
      billingCoupon: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'coupon-1',
          active: true,
          validFrom: new Date('2020-01-01T00:00:00.000Z'),
          validUntil: null,
          maxRedemptions: 10,
          discountType: CouponDiscountType.PERCENTAGE,
          value: new Prisma.Decimal(10),
          _count: { redemptions: 0 },
        }),
      },
      billingCouponRedemption: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({}),
      },
      subscriptionInvoice: {
        create: jest.fn().mockResolvedValue({ id: 'invoice-1' }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'invoice-1' }),
      },
      subscriptionBillingAttempt: { createMany: jest.fn().mockResolvedValue({ count: 4 }) },
      subscription: { update: jest.fn() },
      subscriptionHistory: { create: jest.fn() },
    };
    const db = {
      subscription: { findUnique: jest.fn().mockResolvedValue(subscription) },
      $transaction: jest.fn((callback) => callback(tx)),
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new SuperAdminService(db as any);

    await service.createInvoice(
      'shop-1',
      {
        amount: 100,
        discount: 5,
        dueDate: '2099-10-01T12:00:00.000Z',
        couponCode: 'PROMO10',
      },
      'actor-1',
    );

    expect(tx.subscriptionInvoice.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: new Prisma.Decimal(100),
        discount: new Prisma.Decimal(15),
        total: new Prisma.Decimal(85),
      }),
    });
    expect(tx.billingCouponRedemption.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ discount: new Prisma.Decimal(10) }),
    });
    expect(tx.subscriptionBillingAttempt.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ invoiceId: 'invoice-1', sequence: 1 }),
        expect.objectContaining({ invoiceId: 'invoice-1', sequence: 4 }),
      ]),
    });
  });

  it('registra falha na próxima tentativa programada', async () => {
    const tx = {
      subscriptionBillingAttempt: {
        findFirst: jest.fn().mockResolvedValue({ id: 'attempt-1' }),
        update: jest.fn().mockResolvedValue({ id: 'attempt-1', status: 'FAILED' }),
      },
    };
    const db = {
      subscriptionInvoice: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'invoice-1',
          status: 'OVERDUE',
          barbershopId: 'shop-1',
        }),
      },
      $transaction: jest.fn((callback) => callback(tx)),
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new SuperAdminService(db as any);

    await service.registerBillingFailure(
      'invoice-1',
      { notes: 'Cartão recusado', attemptedAt: '2026-10-10T12:00:00.000Z' },
      'actor-1',
    );

    expect(tx.subscriptionBillingAttempt.update).toHaveBeenCalledWith({
      where: { id: 'attempt-1' },
      data: expect.objectContaining({
        status: 'FAILED',
        notes: 'Cartão recusado',
        actorId: 'actor-1',
      }),
    });
  });

  it('rejeita senhas que não coincidem antes de consultar o banco', async () => {
    const db = { plan: { findFirst: jest.fn() } };
    const service = new SuperAdminService(db as any);

    await expect(
      service.createBarbershop(
        {
          name: 'Nova Barbearia',
          ownerName: 'Proprietário',
          email: 'contato@example.com',
          documentType: DocumentType.CNPJ,
          document: '12345678000195',
          phone: '11999999999',
          planId: '82d63db5-24d2-45e8-8c19-bdb860dcc137',
          adminName: 'Administrador',
          adminEmail: 'admin@example.com',
          adminPassword: 'Senha@123',
          adminPasswordConfirmation: 'Outra@123',
        },
        'actor-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.plan.findFirst).not.toHaveBeenCalled();
  });

  it('rejeita documento incompatível com o tipo selecionado', async () => {
    const service = new SuperAdminService({} as any);

    await expect(
      service.createBarbershop(
        {
          name: 'Nova Barbearia',
          ownerName: 'Proprietário',
          email: 'contato@example.com',
          documentType: DocumentType.CPF,
          document: '12345678000195',
          phone: '11999999999',
          planId: '82d63db5-24d2-45e8-8c19-bdb860dcc137',
          adminName: 'Administrador',
          adminEmail: 'admin@example.com',
          adminPassword: 'Senha@123',
          adminPasswordConfirmation: 'Senha@123',
        },
        'actor-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
