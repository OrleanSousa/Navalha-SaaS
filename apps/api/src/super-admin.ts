import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Injectable,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  BarbershopStatus,
  BillingPaymentMethod,
  CouponDiscountType,
  InvoiceStatus,
  Prisma,
  Role,
  SubscriptionStatus,
} from '@prisma/client';
import { Type } from 'class-transformer';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsInt,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { PrismaService } from './prisma.service';
import { AuthenticatedUser, CurrentUser } from './auth-context';
import { AllowSuperAdmin, PermissionsGuard, Roles, RolesGuard } from './rbac';

const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function calculateCommercialMetrics(input: {
  mrr: number;
  activeSubscriptions: number;
  cancellations: number;
  paidRevenue: number;
  averageTicket: number;
  paidInvoices: number;
  overdueAmount: number;
  paidDueAmount: number;
}) {
  const churnBase = input.activeSubscriptions + input.cancellations;
  const billedAmount = input.overdueAmount + input.paidDueAmount;
  return {
    mrr: input.mrr,
    arr: input.mrr * 12,
    averageTicket: input.averageTicket,
    paidRevenue: input.paidRevenue,
    paidInvoices: input.paidInvoices,
    churned: input.cancellations,
    churnRate: churnBase ? Number(((input.cancellations / churnBase) * 100).toFixed(2)) : 0,
    overdueAmount: input.overdueAmount,
    delinquencyRate: billedAmount
      ? Number(((input.overdueAmount / billedAmount) * 100).toFixed(2))
      : 0,
  };
}

export enum DocumentType {
  CPF = 'CPF',
  CNPJ = 'CNPJ',
}

export class ListBarbershopsQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 10;
  @IsOptional() @IsString() search?: string;
}

export class CreateBarbershopDto {
  @IsString() @MinLength(2) name: string;
  @IsOptional()
  @IsString()
  @Matches(SLUG, { message: 'O slug deve conter apenas letras minúsculas, números e hífens' })
  slug?: string;
  @IsString() @MinLength(2) ownerName: string;
  @IsEmail() email: string;
  @IsEnum(DocumentType) documentType: DocumentType;
  @Transform(({ value }) => String(value).replace(/\D/g, ''))
  @Matches(/^(\d{11}|\d{14})$/, { message: 'Informe um CPF ou CNPJ válido' })
  document: string;
  @Transform(({ value }) => String(value).replace(/\D/g, ''))
  @Matches(/^\d{10,11}$/, { message: 'Informe um telefone com DDD' })
  phone: string;
  @IsUUID() planId: string;
  @IsString() @MinLength(2) adminName: string;
  @IsEmail() adminEmail: string;
  @IsString()
  @MinLength(8)
  @Matches(STRONG_PASSWORD, {
    message: 'A senha deve conter maiúscula, minúscula, número e símbolo',
  })
  adminPassword: string;
  @IsString() adminPasswordConfirmation: string;
}

export class UpdateBarbershopDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsString() @MinLength(2) ownerName?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsEnum(DocumentType) documentType?: DocumentType;
  @IsOptional()
  @Transform(({ value }) => String(value).replace(/\D/g, ''))
  @Matches(/^(\d{11}|\d{14})$/, { message: 'Informe um CPF ou CNPJ válido' })
  document?: string;
  @IsOptional()
  @Transform(({ value }) => String(value).replace(/\D/g, ''))
  @Matches(/^\d{10,11}$/, { message: 'Informe um telefone com DDD' })
  phone?: string;
  @IsOptional() @IsUUID() planId?: string;
}

export class UpdateBarbershopStatusDto {
  @IsEnum(BarbershopStatus) status: BarbershopStatus;
}

export class CreatePlanDto {
  @IsString() @MinLength(2) name: string;
  @Type(() => Number) @IsNumber() @Min(0) price: number;
  @Type(() => Number) @IsInt() @Min(0) maxEmployees: number;
  @Type(() => Number) @IsInt() @Min(0) maxUsers: number;
  @IsObject() features: Record<string, boolean>;
}

export class UpdatePlanDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) price?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) maxEmployees?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) maxUsers?: number;
  @IsOptional() @IsObject() features?: Record<string, boolean>;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class ConfigureTrialDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(365) days: number;
}

export class RenewSubscriptionDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(36) months: number;
}

export class ConfigureGracePeriodDto {
  @Type(() => Number) @IsInt() @Min(0) @Max(365) days: number;
}

export class CreateBillingCouponDto {
  @Transform(({ value }) => String(value).trim().toUpperCase())
  @Matches(/^[A-Z0-9_-]{3,30}$/, {
    message: 'O código deve ter entre 3 e 30 letras, números, hífens ou sublinhados',
  })
  code: string;
  @IsOptional() @IsString() description?: string;
  @IsEnum(CouponDiscountType) discountType: CouponDiscountType;
  @Type(() => Number) @IsNumber() @Min(0.01) value: number;
  @IsOptional() @IsDateString() validFrom?: string;
  @IsOptional() @IsDateString() validUntil?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) maxRedemptions?: number;
}

export class UpdateBillingCouponDto {
  @IsBoolean() active: boolean;
}

export class ListInvoicesQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 20;
  @IsOptional() @IsEnum(InvoiceStatus) status?: InvoiceStatus;
  @IsOptional() @IsString() search?: string;
}

export class CreateInvoiceDto {
  @Type(() => Number) @IsNumber() @Min(0.01) amount: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) discount = 0;
  @IsDateString() dueDate: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional()
  @Transform(({ value }) => String(value).trim().toUpperCase())
  @Matches(/^[A-Z0-9_-]{3,30}$/)
  couponCode?: string;
}

export class RegisterInvoicePaymentDto {
  @Type(() => Number) @IsNumber() @Min(0.01) amount: number;
  @IsEnum(BillingPaymentMethod) method: BillingPaymentMethod;
  @IsOptional() @IsDateString() paidAt?: string;
  @IsOptional() @IsString() externalReference?: string;
  @IsOptional() @IsString() notes?: string;
}

@Injectable()
export class SuperAdminService {
  constructor(private readonly db: PrismaService) {}

  plans() {
    return this.db.plan.findMany({
      include: { _count: { select: { subscriptions: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createPlan(dto: CreatePlanDto, actorId: string) {
    const name = dto.name.trim().toUpperCase();
    if (await this.db.plan.findUnique({ where: { name } })) {
      throw new ConflictException('Já existe um plano com este nome');
    }
    const created = await this.db.plan.create({
      data: {
        name,
        price: dto.price,
        maxEmployees: dto.maxEmployees,
        maxUsers: dto.maxUsers,
        features: dto.features,
        active: true,
      },
    });
    await this.audit(actorId, null, 'PLAN_CREATED', 'PLAN', created.id, null, created);
    return created;
  }

  async updatePlan(id: string, dto: UpdatePlanDto, actorId: string) {
    const plan = await this.db.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plano não encontrado');
    const name = dto.name?.trim().toUpperCase();
    if (name && name !== plan.name && (await this.db.plan.findUnique({ where: { name } }))) {
      throw new ConflictException('Já existe um plano com este nome');
    }
    const updated = await this.db.plan.update({
      where: { id },
      data: {
        ...dto,
        ...(name ? { name } : {}),
        ...(dto.features ? { features: dto.features } : {}),
      },
    });
    await this.audit(actorId, null, 'PLAN_UPDATED', 'PLAN', id, plan, updated);
    return updated;
  }

  coupons() {
    return this.db.billingCoupon.findMany({
      include: { _count: { select: { redemptions: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCoupon(dto: CreateBillingCouponDto, actorId: string) {
    if (dto.discountType === CouponDiscountType.PERCENTAGE && dto.value > 100) {
      throw new BadRequestException('O desconto percentual não pode ultrapassar 100%');
    }
    const validFrom = dto.validFrom ? new Date(dto.validFrom) : new Date();
    const validUntil = dto.validUntil ? new Date(dto.validUntil) : null;
    if (validUntil && validUntil <= validFrom) {
      throw new BadRequestException('O fim da vigência deve ser posterior ao início');
    }
    if (await this.db.billingCoupon.findUnique({ where: { code: dto.code } })) {
      throw new ConflictException('Já existe um cupom com este código');
    }
    const created = await this.db.billingCoupon.create({
      data: {
        code: dto.code,
        description: dto.description?.trim() || null,
        discountType: dto.discountType,
        value: dto.value,
        validFrom,
        validUntil,
        maxRedemptions: dto.maxRedemptions,
      },
      include: { _count: { select: { redemptions: true } } },
    });
    await this.audit(actorId, null, 'COUPON_CREATED', 'BILLING_COUPON', created.id, null, created);
    return created;
  }

  async updateCoupon(id: string, dto: UpdateBillingCouponDto, actorId: string) {
    const coupon = await this.db.billingCoupon.findUnique({ where: { id } });
    if (!coupon) throw new NotFoundException('Cupom não encontrado');
    const updated = await this.db.billingCoupon.update({
      where: { id },
      data: { active: dto.active },
      include: { _count: { select: { redemptions: true } } },
    });
    await this.audit(actorId, null, 'COUPON_UPDATED', 'BILLING_COUPON', id, coupon, updated);
    return updated;
  }

  async dashboard() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    await this.db.subscriptionInvoice.updateMany({
      where: { status: InvoiceStatus.PENDING, dueDate: { lt: now } },
      data: { status: InvoiceStatus.OVERDUE },
    });
    const [
      total,
      active,
      trial,
      suspended,
      subscriptions,
      users,
      employees,
      recent,
      paidInvoices,
      monthlyBilling,
      cancellations,
    ] = await Promise.all([
      this.db.barbershop.count({ where: { deletedAt: null } }),
      this.db.barbershop.count({
        where: { deletedAt: null, status: BarbershopStatus.ACTIVE },
      }),
      this.db.barbershop.count({
        where: { deletedAt: null, status: BarbershopStatus.TRIAL },
      }),
      this.db.barbershop.count({
        where: { deletedAt: null, status: BarbershopStatus.SUSPENDED },
      }),
      this.db.subscription.findMany({
        where: { barbershop: { deletedAt: null }, status: 'ACTIVE' },
        include: { plan: true },
      }),
      this.db.user.count({ where: { barbershopId: { not: null }, active: true } }),
      this.db.employee.count({ where: { deletedAt: null, active: true } }),
      this.db.barbershop.findMany({
        where: { deletedAt: null },
        take: 5,
        include: { subscription: { include: { plan: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.db.subscriptionInvoice.aggregate({
        where: {
          status: InvoiceStatus.PAID,
          paidAt: { gte: monthStart, lt: nextMonth },
        },
        _sum: { total: true },
        _avg: { total: true },
        _count: { _all: true },
      }),
      this.db.subscriptionInvoice.groupBy({
        by: ['status'],
        where: {
          status: { in: [InvoiceStatus.PAID, InvoiceStatus.OVERDUE] },
          dueDate: { gte: monthStart, lt: nextMonth },
        },
        _sum: { total: true },
      }),
      this.db.subscriptionHistory.findMany({
        where: {
          toStatus: SubscriptionStatus.CANCELLED,
          effectiveAt: { gte: monthStart, lt: nextMonth },
        },
        distinct: ['barbershopId'],
        select: { barbershopId: true },
      }),
    ]);

    const planDistribution = subscriptions.reduce<Record<string, number>>((summary, item) => {
      summary[item.plan.name] = (summary[item.plan.name] || 0) + 1;
      return summary;
    }, {});

    const mrr = subscriptions.reduce((sum, item) => sum + Number(item.plan.price), 0);
    const overdueAmount = Number(
      monthlyBilling.find((item) => item.status === InvoiceStatus.OVERDUE)?._sum.total || 0,
    );
    const paidDueAmount = Number(
      monthlyBilling.find((item) => item.status === InvoiceStatus.PAID)?._sum.total || 0,
    );
    const commercialMetrics = calculateCommercialMetrics({
      mrr,
      activeSubscriptions: subscriptions.length,
      cancellations: cancellations.length,
      paidRevenue: Number(paidInvoices._sum.total || 0),
      averageTicket: Number(paidInvoices._avg.total || 0),
      paidInvoices: paidInvoices._count._all,
      overdueAmount,
      paidDueAmount,
    });

    return {
      metrics: {
        total,
        active,
        trial,
        suspended,
        users,
        employees,
        ...commercialMetrics,
      },
      planDistribution,
      recent,
    };
  }

  async barbershop(id: string) {
    const barbershop = await this.db.barbershop.findFirst({
      where: { id, deletedAt: null },
      include: {
        subscription: { include: { plan: true } },
        settings: true,
        users: {
          select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: {
            users: true,
            employees: true,
            customers: true,
            appointments: true,
            sales: true,
            services: true,
          },
        },
      },
    });
    if (!barbershop) throw new NotFoundException('Barbearia não encontrada');
    return { ...barbershop, onboarding: this.onboarding(barbershop) };
  }

  async subscriptionHistory(barbershopId: string) {
    await this.assertBarbershopExists(barbershopId);
    return this.db.subscriptionHistory.findMany({
      where: { barbershopId },
      orderBy: { effectiveAt: 'desc' },
    });
  }

  async invoices(query: ListInvoicesQuery) {
    await this.db.subscriptionInvoice.updateMany({
      where: { status: InvoiceStatus.PENDING, dueDate: { lt: new Date() } },
      data: { status: InvoiceStatus.OVERDUE },
    });
    const page = query.page || 1;
    const limit = query.limit || 20;
    const search = query.search?.trim();
    const where: Prisma.SubscriptionInvoiceWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { number: { contains: search, mode: 'insensitive' } },
              { barbershop: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [items, total, grouped] = await Promise.all([
      this.db.subscriptionInvoice.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          barbershop: { select: { id: true, name: true } },
          payments: { orderBy: { paidAt: 'desc' } },
          couponRedemption: { include: { coupon: true } },
        },
        orderBy: { dueDate: 'desc' },
      }),
      this.db.subscriptionInvoice.count({ where }),
      this.db.subscriptionInvoice.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
        _sum: { total: true },
      }),
    ]);
    return {
      items,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      summary: grouped.reduce<Record<string, { count: number; total: number }>>((result, row) => {
        result[row.status] = { count: row._count._all, total: Number(row._sum.total || 0) };
        return result;
      }, {}),
    };
  }

  async createInvoice(barbershopId: string, dto: CreateInvoiceDto, actorId: string) {
    if (dto.discount > dto.amount) {
      throw new BadRequestException('O desconto não pode ser maior que o valor da fatura');
    }
    const subscription = await this.db.subscription.findUnique({ where: { barbershopId } });
    if (!subscription) throw new NotFoundException('Assinatura não encontrada');
    const dueDate = new Date(dto.dueDate);
    const invoice = await this.db.$transaction(
      async (tx) => {
        const amount = new Prisma.Decimal(dto.amount);
        const manualDiscount = new Prisma.Decimal(dto.discount);
        let coupon: any = null;
        let couponDiscount = new Prisma.Decimal(0);

        if (dto.couponCode) {
          coupon = await tx.billingCoupon.findUnique({
            where: { code: dto.couponCode },
            include: { _count: { select: { redemptions: true } } },
          });
          const now = new Date();
          if (!coupon || !coupon.active) throw new BadRequestException('Cupom inválido ou inativo');
          if (coupon.validFrom > now || (coupon.validUntil && coupon.validUntil < now)) {
            throw new BadRequestException('Cupom fora do período de vigência');
          }
          if (coupon.maxRedemptions && coupon._count.redemptions >= coupon.maxRedemptions) {
            throw new BadRequestException('O limite de utilizações deste cupom foi atingido');
          }
          const alreadyUsed = await tx.billingCouponRedemption.count({
            where: { couponId: coupon.id, barbershopId },
          });
          if (alreadyUsed) throw new ConflictException('Este cupom já foi usado pela barbearia');
          couponDiscount =
            coupon.discountType === CouponDiscountType.PERCENTAGE
              ? amount.mul(coupon.value).div(100).toDecimalPlaces(2)
              : Prisma.Decimal.min(amount, coupon.value);
        }

        const discount = manualDiscount.plus(couponDiscount);
        if (discount.greaterThan(amount)) {
          throw new BadRequestException('A soma dos descontos não pode superar o valor da fatura');
        }
        const total = amount.minus(discount);
        const paidAt = total.isZero() ? new Date() : null;
        const created = await tx.subscriptionInvoice.create({
          data: {
            number: `FAT-${new Date().toISOString().slice(0, 7).replace('-', '')}-${randomUUID()
              .slice(0, 8)
              .toUpperCase()}`,
            barbershopId,
            subscriptionId: subscription.id,
            amount,
            discount,
            total,
            dueDate,
            paidAt,
            status: paidAt
              ? InvoiceStatus.PAID
              : dueDate < new Date()
                ? InvoiceStatus.OVERDUE
                : InvoiceStatus.PENDING,
            notes: dto.notes?.trim() || null,
          },
        });
        if (coupon) {
          await tx.billingCouponRedemption.create({
            data: {
              couponId: coupon.id,
              invoiceId: created.id,
              barbershopId,
              actorId,
              discount: couponDiscount,
            },
          });
        }
        if (paidAt) {
          await tx.subscription.update({
            where: { id: subscription.id },
            data: { status: SubscriptionStatus.ACTIVE },
          });
          await tx.subscriptionHistory.create({
            data: {
              subscriptionId: subscription.id,
              barbershopId,
              actorId,
              action: 'COUPON_INVOICE_PAID',
              fromPlanId: subscription.planId,
              toPlanId: subscription.planId,
              fromStatus: subscription.status,
              toStatus: SubscriptionStatus.ACTIVE,
              metadata: { couponCode: dto.couponCode },
            },
          });
        }
        return tx.subscriptionInvoice.findUniqueOrThrow({
          where: { id: created.id },
          include: {
            barbershop: { select: { id: true, name: true } },
            payments: true,
            couponRedemption: { include: { coupon: true } },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    await this.audit(
      actorId,
      barbershopId,
      'INVOICE_CREATED',
      'SUBSCRIPTION_INVOICE',
      invoice.id,
      null,
      invoice,
    );
    return invoice;
  }

  async registerInvoicePayment(id: string, dto: RegisterInvoicePaymentDto, actorId: string) {
    const invoice = await this.db.subscriptionInvoice.findUnique({
      where: { id },
      include: { payments: true, subscription: true },
    });
    if (!invoice) throw new NotFoundException('Fatura não encontrada');
    if (
      invoice.status === InvoiceStatus.CANCELLED ||
      invoice.status === InvoiceStatus.REFUNDED ||
      invoice.status === InvoiceStatus.PAID
    ) {
      throw new BadRequestException('Esta fatura não aceita novos pagamentos');
    }
    const paid = invoice.payments
      .filter((payment) => payment.status === 'CONFIRMED')
      .reduce((sum, payment) => sum.plus(payment.amount), new Prisma.Decimal(0));
    const amount = new Prisma.Decimal(dto.amount);
    const remaining = invoice.total.minus(paid);
    if (amount.greaterThan(remaining)) {
      throw new BadRequestException(`O saldo restante da fatura é R$ ${remaining.toFixed(2)}`);
    }
    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
    const isPaid = paid.plus(amount).greaterThanOrEqualTo(invoice.total);
    const updated = await this.db.$transaction(async (tx) => {
      await tx.subscriptionPayment.create({
        data: {
          invoiceId: id,
          actorId,
          amount,
          method: dto.method,
          paidAt,
          externalReference: dto.externalReference?.trim() || null,
          notes: dto.notes?.trim() || null,
        },
      });
      const result = await tx.subscriptionInvoice.update({
        where: { id },
        data: isPaid ? { status: InvoiceStatus.PAID, paidAt } : {},
        include: { barbershop: { select: { id: true, name: true } }, payments: true },
      });
      if (isPaid) {
        await tx.subscription.update({
          where: { id: invoice.subscriptionId },
          data: { status: SubscriptionStatus.ACTIVE },
        });
        await tx.subscriptionHistory.create({
          data: {
            subscriptionId: invoice.subscriptionId,
            barbershopId: invoice.barbershopId,
            actorId,
            action: 'INVOICE_PAID',
            fromPlanId: invoice.subscription.planId,
            toPlanId: invoice.subscription.planId,
            fromStatus: invoice.subscription.status,
            toStatus: SubscriptionStatus.ACTIVE,
            metadata: { invoiceId: id, invoiceNumber: invoice.number },
          },
        });
      }
      return result;
    });
    await this.audit(
      actorId,
      invoice.barbershopId,
      'INVOICE_PAYMENT_REGISTERED',
      'SUBSCRIPTION_INVOICE',
      id,
      invoice,
      updated,
    );
    return updated;
  }

  async cancelInvoice(id: string, actorId: string) {
    const invoice = await this.db.subscriptionInvoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundException('Fatura não encontrada');
    if (invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.REFUNDED) {
      throw new BadRequestException('Uma fatura paga deve ser estornada, não cancelada');
    }
    const updated = await this.db.subscriptionInvoice.update({
      where: { id },
      data: { status: InvoiceStatus.CANCELLED },
    });
    await this.audit(
      actorId,
      invoice.barbershopId,
      'INVOICE_CANCELLED',
      'SUBSCRIPTION_INVOICE',
      id,
      invoice,
      updated,
    );
    return updated;
  }

  async refundInvoice(id: string, actorId: string) {
    const invoice = await this.db.subscriptionInvoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundException('Fatura não encontrada');
    if (invoice.status !== InvoiceStatus.PAID) {
      throw new BadRequestException('Somente uma fatura paga pode ser estornada');
    }
    const updated = await this.db.$transaction(async (tx) => {
      await tx.subscriptionPayment.updateMany({
        where: { invoiceId: id, status: 'CONFIRMED' },
        data: { status: 'REFUNDED' },
      });
      return tx.subscriptionInvoice.update({
        where: { id },
        data: { status: InvoiceStatus.REFUNDED },
        include: { barbershop: { select: { id: true, name: true } }, payments: true },
      });
    });
    await this.audit(
      actorId,
      invoice.barbershopId,
      'INVOICE_REFUNDED',
      'SUBSCRIPTION_INVOICE',
      id,
      invoice,
      updated,
    );
    return updated;
  }

  async barbershops(query: ListBarbershopsQuery) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const search = query.search?.trim();
    const where: Prisma.BarbershopWhereInput = {
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { slug: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.db.barbershop.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          subscription: { include: { plan: true } },
          settings: true,
          users: { select: { role: true, active: true } },
          _count: { select: { users: true, employees: true, services: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.db.barbershop.count({ where }),
    ]);
    return {
      items: items.map((item) => ({ ...item, onboarding: this.onboarding(item) })),
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    };
  }

  async createBarbershop(dto: CreateBarbershopDto, actorId: string) {
    if (dto.adminPassword !== dto.adminPasswordConfirmation) {
      throw new BadRequestException('A confirmação da senha não corresponde');
    }
    this.validateDocument(dto.documentType, dto.document);
    const slug = dto.slug || this.slugify(dto.name);
    const adminEmail = dto.adminEmail.toLowerCase();
    const [plan, existingShop, existingDocument, existingUser] = await Promise.all([
      this.db.plan.findFirst({ where: { id: dto.planId, active: true } }),
      this.db.barbershop.findUnique({ where: { slug } }),
      this.db.barbershop.findFirst({ where: { document: dto.document, deletedAt: null } }),
      this.db.user.findUnique({ where: { email: adminEmail } }),
    ]);
    if (!plan) throw new NotFoundException('Plano não encontrado ou inativo');
    if (existingShop) throw new ConflictException('Já existe uma barbearia com este slug');
    if (existingDocument) throw new ConflictException('Este CNPJ já está cadastrado');
    if (existingUser) throw new ConflictException('O e-mail do administrador já está em uso');

    const passwordHash = await bcrypt.hash(dto.adminPassword, 12);
    try {
      const created = await this.db.barbershop.create({
        data: {
          name: dto.name.trim(),
          tradeName: dto.name.trim(),
          slug,
          ownerName: dto.ownerName.trim(),
          email: dto.email.toLowerCase(),
          document: dto.document,
          phone: dto.phone,
          status: BarbershopStatus.ACTIVE,
          subscription: { create: { planId: plan.id, status: SubscriptionStatus.ACTIVE } },
          users: {
            create: {
              name: dto.adminName.trim(),
              email: adminEmail,
              passwordHash,
              role: Role.ADMIN,
            },
          },
        },
        include: {
          subscription: { include: { plan: true } },
          users: { select: { id: true, name: true, email: true, role: true } },
        },
      });
      if (created.subscription) {
        await this.db.subscriptionHistory.create({
          data: {
            subscriptionId: created.subscription.id,
            barbershopId: created.id,
            actorId,
            action: 'SUBSCRIPTION_CREATED',
            toPlanId: plan.id,
            toStatus: SubscriptionStatus.ACTIVE,
          },
        });
      }
      await this.audit(actorId, created.id, 'BARBERSHOP_CREATED', 'BARBERSHOP', created.id, null, {
        name: created.name,
        slug: created.slug,
        planId: plan.id,
      });
      return created;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Slug ou e-mail já cadastrado');
      }
      throw error;
    }
  }

  async updateBarbershop(id: string, dto: UpdateBarbershopDto, actorId: string) {
    const current = await this.db.barbershop.findFirst({
      where: { id, deletedAt: null },
      include: { subscription: { include: { plan: true } } },
    });
    if (!current) throw new NotFoundException('Barbearia não encontrada');
    if (dto.document || dto.documentType) {
      this.validateDocument(
        dto.documentType ||
          (current.document?.length === 11 ? DocumentType.CPF : DocumentType.CNPJ),
        dto.document || current.document || '',
      );
    }
    if (dto.document) {
      const duplicate = await this.db.barbershop.findFirst({
        where: { document: dto.document, deletedAt: null, id: { not: id } },
      });
      if (duplicate) throw new ConflictException('Este CNPJ já está cadastrado');
    }
    const targetPlan = dto.planId
      ? await this.db.plan.findFirst({ where: { id: dto.planId, active: true } })
      : null;
    if (dto.planId && !targetPlan) throw new NotFoundException('Plano não encontrado ou inativo');

    const { planId } = dto;
    const updated = await this.db.$transaction(async (tx) => {
      await tx.barbershop.update({
        where: { id },
        data: {
          ...(dto.name ? { name: dto.name.trim(), tradeName: dto.name.trim() } : {}),
          ...(dto.ownerName ? { ownerName: dto.ownerName.trim() } : {}),
          ...(dto.email ? { email: dto.email.toLowerCase() } : {}),
          ...(dto.document ? { document: dto.document } : {}),
          ...(dto.phone ? { phone: dto.phone } : {}),
        },
      });
      if (planId) {
        const subscription = await tx.subscription.upsert({
          where: { barbershopId: id },
          update: { planId, status: SubscriptionStatus.ACTIVE },
          create: { barbershopId: id, planId, status: SubscriptionStatus.ACTIVE },
        });
        if (current.subscription?.planId !== planId) {
          await tx.subscriptionHistory.create({
            data: {
              subscriptionId: subscription.id,
              barbershopId: id,
              actorId,
              action: current.subscription
                ? Number(targetPlan?.price) > Number(current.subscription.plan.price)
                  ? 'PLAN_UPGRADED'
                  : Number(targetPlan?.price) < Number(current.subscription.plan.price)
                    ? 'PLAN_DOWNGRADED'
                    : 'PLAN_CHANGED'
                : 'SUBSCRIPTION_CREATED',
              fromPlanId: current.subscription?.planId,
              toPlanId: planId,
              fromStatus: current.subscription?.status,
              toStatus: SubscriptionStatus.ACTIVE,
            },
          });
        }
      }
      return tx.barbershop.findUniqueOrThrow({
        where: { id },
        include: { subscription: { include: { plan: true } } },
      });
    });
    await this.audit(actorId, id, 'BARBERSHOP_UPDATED', 'BARBERSHOP', id, current, updated);
    return updated;
  }

  async updateBarbershopStatus(id: string, status: BarbershopStatus, actorId: string) {
    const barbershop = await this.db.barbershop.findFirst({
      where: { id, deletedAt: null },
      include: { subscription: true },
    });
    if (!barbershop) throw new NotFoundException('Barbearia não encontrada');
    const subscriptionStatus: Record<BarbershopStatus, SubscriptionStatus> = {
      [BarbershopStatus.ACTIVE]: SubscriptionStatus.ACTIVE,
      [BarbershopStatus.TRIAL]: SubscriptionStatus.TRIAL,
      [BarbershopStatus.SUSPENDED]: SubscriptionStatus.SUSPENDED,
      [BarbershopStatus.CANCELLED]: SubscriptionStatus.CANCELLED,
    };
    const updated = await this.db.$transaction(async (tx) => {
      const result = await tx.barbershop.update({ where: { id }, data: { status } });
      if (
        barbershop.subscription &&
        barbershop.subscription.status !== subscriptionStatus[status]
      ) {
        await tx.subscription.update({
          where: { id: barbershop.subscription.id },
          data: { status: subscriptionStatus[status] },
        });
        await tx.subscriptionHistory.create({
          data: {
            subscriptionId: barbershop.subscription.id,
            barbershopId: id,
            actorId,
            action: 'BARBERSHOP_STATUS_SYNCED',
            fromPlanId: barbershop.subscription.planId,
            toPlanId: barbershop.subscription.planId,
            fromStatus: barbershop.subscription.status,
            toStatus: subscriptionStatus[status],
            metadata: { barbershopStatus: status },
          },
        });
      }
      return result;
    });
    await this.audit(
      actorId,
      id,
      'BARBERSHOP_STATUS_CHANGED',
      'BARBERSHOP',
      id,
      { status: barbershop.status },
      { status },
    );
    return updated;
  }

  async configureTrial(id: string, days: number, actorId: string) {
    await this.assertBarbershopExists(id);
    const subscription = await this.db.subscription.findUnique({ where: { barbershopId: id } });
    if (!subscription) throw new NotFoundException('Assinatura não encontrada');
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + days);
    return this.db.$transaction(async (tx) => {
      const updated = await tx.subscription.update({
        where: { id: subscription.id },
        data: { status: SubscriptionStatus.TRIAL, trialEndsAt, graceEndsAt: null },
      });
      await tx.subscriptionHistory.create({
        data: {
          subscriptionId: subscription.id,
          barbershopId: id,
          actorId,
          action: 'TRIAL_STARTED',
          fromPlanId: subscription.planId,
          toPlanId: subscription.planId,
          fromStatus: subscription.status,
          toStatus: SubscriptionStatus.TRIAL,
          metadata: { days, trialEndsAt: trialEndsAt.toISOString() },
        },
      });
      return updated;
    });
  }

  async activateSubscription(id: string, actorId: string) {
    await this.assertBarbershopExists(id);
    const subscription = await this.db.subscription.findUnique({ where: { barbershopId: id } });
    if (!subscription) throw new NotFoundException('Assinatura não encontrada');
    return this.db.$transaction(async (tx) => {
      const updated = await tx.subscription.update({
        where: { id: subscription.id },
        data: { status: SubscriptionStatus.ACTIVE, trialEndsAt: null, graceEndsAt: null },
      });
      await tx.subscriptionHistory.create({
        data: {
          subscriptionId: subscription.id,
          barbershopId: id,
          actorId,
          action: 'SUBSCRIPTION_ACTIVATED',
          fromPlanId: subscription.planId,
          toPlanId: subscription.planId,
          fromStatus: subscription.status,
          toStatus: SubscriptionStatus.ACTIVE,
        },
      });
      return updated;
    });
  }

  async renewSubscription(id: string, months: number, actorId: string) {
    await this.assertBarbershopExists(id);
    const subscription = await this.db.subscription.findUnique({ where: { barbershopId: id } });
    if (!subscription) throw new NotFoundException('Assinatura não encontrada');
    const now = new Date();
    const expiresAt =
      subscription.expiresAt && subscription.expiresAt > now
        ? new Date(subscription.expiresAt)
        : new Date(now);
    expiresAt.setUTCMonth(expiresAt.getUTCMonth() + months);
    return this.db.$transaction(async (tx) => {
      const updated = await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          status: SubscriptionStatus.ACTIVE,
          trialEndsAt: null,
          graceEndsAt: null,
          expiresAt,
        },
      });
      await tx.subscriptionHistory.create({
        data: {
          subscriptionId: subscription.id,
          barbershopId: id,
          actorId,
          action: 'SUBSCRIPTION_RENEWED',
          fromPlanId: subscription.planId,
          toPlanId: subscription.planId,
          fromStatus: subscription.status,
          toStatus: SubscriptionStatus.ACTIVE,
          metadata: { months, expiresAt: expiresAt.toISOString() },
        },
      });
      return updated;
    });
  }

  async configureGracePeriod(id: string, days: number, actorId: string) {
    await this.assertBarbershopExists(id);
    const subscription = await this.db.subscription.findUnique({ where: { barbershopId: id } });
    if (!subscription) throw new NotFoundException('Assinatura não encontrada');
    const startsAt =
      subscription.expiresAt && subscription.expiresAt > new Date()
        ? new Date(subscription.expiresAt)
        : new Date();
    const graceEndsAt = days ? new Date(startsAt.getTime() + days * 86400000) : null;
    return this.db.$transaction(async (tx) => {
      const updated = await tx.subscription.update({
        where: { id: subscription.id },
        data: { graceEndsAt },
      });
      await tx.subscriptionHistory.create({
        data: {
          subscriptionId: subscription.id,
          barbershopId: id,
          actorId,
          action: days ? 'GRACE_PERIOD_CONFIGURED' : 'GRACE_PERIOD_REMOVED',
          fromPlanId: subscription.planId,
          toPlanId: subscription.planId,
          fromStatus: subscription.status,
          toStatus: subscription.status,
          metadata: { days, graceEndsAt: graceEndsAt?.toISOString() || null },
        },
      });
      return updated;
    });
  }

  private slugify(value: string) {
    const slug = value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    if (!slug) throw new ConflictException('Não foi possível gerar um slug válido');
    return slug;
  }

  private async assertBarbershopExists(id: string) {
    const exists = await this.db.barbershop.count({ where: { id, deletedAt: null } });
    if (!exists) throw new NotFoundException('Barbearia não encontrada');
  }

  private validateDocument(type: DocumentType, document: string) {
    const expectedLength = type === DocumentType.CPF ? 11 : 14;
    if (document.length !== expectedLength) {
      throw new BadRequestException(
        type === DocumentType.CPF
          ? 'O CPF deve conter 11 dígitos'
          : 'O CNPJ deve conter 14 dígitos',
      );
    }
  }

  private onboarding(barbershop: any) {
    const steps = [
      {
        key: 'profile',
        label: 'Dados da empresa',
        complete: Boolean(barbershop.document && barbershop.phone && barbershop.email),
      },
      {
        key: 'subscription',
        label: 'Plano contratado',
        complete: Boolean(barbershop.subscription),
      },
      {
        key: 'administrator',
        label: 'Administrador criado',
        complete: Boolean(
          barbershop.users?.some((user: any) => user.role === Role.ADMIN && user.active),
        ),
      },
      {
        key: 'team',
        label: 'Primeiro colaborador',
        complete: (barbershop._count?.employees || 0) > 0,
      },
      {
        key: 'catalog',
        label: 'Primeiro serviço',
        complete: (barbershop._count?.services || 0) > 0,
      },
      {
        key: 'schedule',
        label: 'Horário configurado',
        complete: Boolean(barbershop.settings?.openingHours),
      },
    ];
    const completed = steps.filter((step) => step.complete).length;
    return {
      completed,
      total: steps.length,
      percentage: Math.round((completed / steps.length) * 100),
      steps,
    };
  }

  private audit(
    userId: string,
    barbershopId: string | null,
    action: string,
    entity: string,
    entityId: string,
    before: unknown,
    after: unknown,
  ) {
    return this.db.auditLog.create({
      data: {
        userId,
        barbershopId,
        action,
        entity,
        entityId,
        before: before ? (JSON.parse(JSON.stringify(before)) as Prisma.InputJsonValue) : undefined,
        after: after ? (JSON.parse(JSON.stringify(after)) as Prisma.InputJsonValue) : undefined,
      },
    });
  }
}

@Controller('super-admin')
@Roles(Role.SUPER_ADMIN)
@AllowSuperAdmin()
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
export class SuperAdminController {
  constructor(private readonly service: SuperAdminService) {}

  @Get('plans')
  plans() {
    return this.service.plans();
  }

  @Post('plans')
  createPlan(@Body() dto: CreatePlanDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createPlan(dto, user.sub);
  }

  @Patch('plans/:id')
  updatePlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updatePlan(id, dto, user.sub);
  }

  @Get('coupons')
  coupons() {
    return this.service.coupons();
  }

  @Post('coupons')
  createCoupon(@Body() dto: CreateBillingCouponDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createCoupon(dto, user.sub);
  }

  @Patch('coupons/:id')
  updateCoupon(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBillingCouponDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateCoupon(id, dto, user.sub);
  }

  @Get('dashboard')
  dashboard() {
    return this.service.dashboard();
  }

  @Get('invoices')
  invoices(@Query() query: ListInvoicesQuery) {
    return this.service.invoices(query);
  }

  @Post('barbershops/:id/invoices')
  createInvoice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateInvoiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createInvoice(id, dto, user.sub);
  }

  @Post('invoices/:id/payments')
  registerInvoicePayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegisterInvoicePaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.registerInvoicePayment(id, dto, user.sub);
  }

  @Post('invoices/:id/cancel')
  cancelInvoice(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.cancelInvoice(id, user.sub);
  }

  @Post('invoices/:id/refund')
  refundInvoice(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.refundInvoice(id, user.sub);
  }

  @Get('barbershops')
  barbershops(@Query() query: ListBarbershopsQuery) {
    return this.service.barbershops(query);
  }

  @Get('barbershops/:id')
  barbershop(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.barbershop(id);
  }

  @Get('barbershops/:id/subscription-history')
  subscriptionHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.subscriptionHistory(id);
  }

  @Post('barbershops')
  createBarbershop(@Body() dto: CreateBarbershopDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createBarbershop(dto, user.sub);
  }

  @Patch('barbershops/:id')
  updateBarbershop(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBarbershopDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateBarbershop(id, dto, user.sub);
  }

  @Patch('barbershops/:id/status')
  updateBarbershopStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBarbershopStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateBarbershopStatus(id, dto.status, user.sub);
  }

  @Post('barbershops/:id/subscription/trial')
  configureTrial(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfigureTrialDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.configureTrial(id, dto.days, user.sub);
  }

  @Post('barbershops/:id/subscription/activate')
  activateSubscription(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.activateSubscription(id, user.sub);
  }

  @Post('barbershops/:id/subscription/renew')
  renewSubscription(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RenewSubscriptionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.renewSubscription(id, dto.months, user.sub);
  }

  @Post('barbershops/:id/subscription/grace-period')
  configureGracePeriod(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfigureGracePeriodDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.configureGracePeriod(id, dto.days, user.sub);
  }
}
