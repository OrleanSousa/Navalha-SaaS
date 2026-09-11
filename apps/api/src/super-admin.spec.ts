import { BadRequestException } from '@nestjs/common';
import { BarbershopStatus, CouponDiscountType, Prisma, SubscriptionStatus } from '@prisma/client';
import { calculateCommercialMetrics, DocumentType, SuperAdminService } from './super-admin';

describe('SuperAdminService', () => {
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
      data: { status: SubscriptionStatus.CANCELLED },
    });
    expect(tx.subscriptionHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'BARBERSHOP_STATUS_SYNCED',
        toStatus: SubscriptionStatus.CANCELLED,
      }),
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
