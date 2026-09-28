import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MESSAGE_PROVIDER, MessageProvider } from './message-provider';
import { PrismaService } from './prisma.service';

type AppointmentEvent = {
  id: string;
  customerName: string;
  customerWhatsapp?: string | null;
  employeeName: string;
  startAt: Date;
};

@Injectable()
export class NotificationsService {
  private processing = false;

  constructor(
    private readonly db: PrismaService,
    @Inject(MESSAGE_PROVIDER) private readonly provider: MessageProvider,
  ) {}

  async list(barbershopId: string, unreadOnly = false) {
    await this.syncOperationalAlerts(barbershopId);
    void this.processPending();
    const [items, unread] = await Promise.all([
      this.db.notification.findMany({
        where: { barbershopId, ...(unreadOnly && { readAt: null }) },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.db.notification.count({ where: { barbershopId, readAt: null } }),
    ]);
    return { items, unread };
  }

  async unreadCount(barbershopId: string) {
    await this.syncOperationalAlerts(barbershopId);
    return { count: await this.db.notification.count({ where: { barbershopId, readAt: null } }) };
  }

  async markRead(barbershopId: string, id: string) {
    const notification = await this.db.notification.findFirst({ where: { id, barbershopId } });
    if (!notification) throw new NotFoundException('Notificação não encontrada');
    return this.db.notification.update({ where: { id }, data: { readAt: new Date() } });
  }

  markAllRead(barbershopId: string) {
    return this.db.notification.updateMany({
      where: { barbershopId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async appointmentCreated(barbershopId: string, event: AppointmentEvent) {
    const shop = await this.db.barbershop.findUnique({
      where: { id: barbershopId },
      select: { name: true, tradeName: true },
    });
    const shopName = shop?.tradeName || shop?.name || 'Barbearia';
    await this.create({
      barbershopId,
      dedupKey: `appointment:created:${event.id}`,
      type: 'APPOINTMENT_CREATED',
      title: 'Novo agendamento',
      message: `${event.customerName} agendou com ${event.employeeName}.`,
      actionUrl: '/agenda',
      metadata: { appointmentId: event.id, startAt: event.startAt.toISOString() },
    });
    if (event.customerWhatsapp) {
      await this.enqueue({
        barbershopId,
        recipient: event.customerWhatsapp,
        template: 'appointment_created',
        payload: {
          customerName: event.customerName,
          barbershopName: shopName,
          employeeName: event.employeeName,
          startAt: event.startAt.toISOString(),
        },
      });
    }
  }

  async appointmentCancelled(barbershopId: string, event: AppointmentEvent) {
    const shop = await this.db.barbershop.findUnique({
      where: { id: barbershopId },
      select: { name: true, tradeName: true },
    });
    const shopName = shop?.tradeName || shop?.name || 'Barbearia';
    await this.create({
      barbershopId,
      dedupKey: `appointment:cancelled:${event.id}`,
      type: 'APPOINTMENT_CANCELLED',
      title: 'Agendamento cancelado',
      message: `O horário de ${event.customerName} foi cancelado.`,
      actionUrl: '/agenda',
      metadata: { appointmentId: event.id, startAt: event.startAt.toISOString() },
    });
    if (event.customerWhatsapp) {
      await this.enqueue({
        barbershopId,
        recipient: event.customerWhatsapp,
        template: 'appointment_cancelled',
        payload: {
          customerName: event.customerName,
          barbershopName: shopName,
          startAt: event.startAt.toISOString(),
        },
      });
    }
  }

  async syncOperationalAlerts(barbershopId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 2 * 86400000);
    const [products, accounts, cashRegisters, commissions] = await Promise.all([
      this.db.product.findMany({
        where: {
          barbershopId,
          active: true,
          deletedAt: null,
          stockQuantity: { lte: this.db.product.fields.minimumStock },
        },
        select: { id: true, name: true, stockQuantity: true, minimumStock: true },
      }),
      this.db.accountPayable.findMany({
        where: { barbershopId, status: 'PENDING', dueDate: { lt: tomorrow } },
        select: { id: true, description: true, dueDate: true, amount: true },
      }),
      this.db.cashRegister.findMany({
        where: { barbershopId, closedAt: null, openedAt: { lt: today } },
        select: { id: true, openedAt: true },
      }),
      this.db.commission.findMany({
        where: { barbershopId, status: 'PENDING' },
        select: { id: true, amount: true, employee: { select: { name: true } } },
        take: 50,
      }),
    ]);

    await Promise.all([
      ...products.map((product) =>
        this.create({
          barbershopId,
          dedupKey: `stock:low:${product.id}`,
          type: 'LOW_STOCK',
          title: 'Estoque baixo',
          message: `${product.name} possui ${product.stockQuantity} unidade(s); mínimo ${product.minimumStock}.`,
          actionUrl: `/produtos/${product.id}`,
          metadata: { productId: product.id },
        }),
      ),
      ...accounts.map((account) =>
        this.create({
          barbershopId,
          dedupKey: `account:due:${account.id}`,
          type: 'ACCOUNT_DUE',
          title: account.dueDate < today ? 'Conta vencida' : 'Conta vencendo',
          message: `${account.description} · R$ ${Number(account.amount).toFixed(2)}.`,
          actionUrl: '/contas',
          metadata: { accountId: account.id, dueDate: account.dueDate.toISOString() },
        }),
      ),
      ...cashRegisters.map((cashRegister) =>
        this.create({
          barbershopId,
          dedupKey: `cash:unclosed:${cashRegister.id}`,
          type: 'CASH_UNCLOSED',
          title: 'Caixa não fechado',
          message: `O caixa aberto em ${cashRegister.openedAt.toLocaleDateString('pt-BR')} continua pendente.`,
          actionUrl: '/financeiro',
          metadata: { cashRegisterId: cashRegister.id },
        }),
      ),
      ...commissions.map((commission) =>
        this.create({
          barbershopId,
          dedupKey: `commission:pending:${commission.id}`,
          type: 'COMMISSION_PENDING',
          title: 'Comissão pendente',
          message: `${commission.employee.name} possui R$ ${Number(commission.amount).toFixed(2)} a receber.`,
          actionUrl: '/comissoes',
          metadata: { commissionId: commission.id },
        }),
      ),
    ]);
  }

  async enqueue(input: {
    barbershopId: string;
    recipient: string;
    template: string;
    payload: Record<string, unknown>;
  }) {
    const job = await this.db.messageJob.create({
      data: { ...input, channel: 'WHATSAPP', payload: input.payload as Prisma.InputJsonValue },
    });
    setImmediate(() => void this.processPending());
    return job;
  }

  async processPending(limit = 20) {
    if (this.processing) return { processed: 0 };
    this.processing = true;
    let processed = 0;
    try {
      const jobs = await this.db.messageJob.findMany({
        where: {
          status: { in: ['PENDING', 'FAILED'] },
          scheduledAt: { lte: new Date() },
          attempts: { lt: 3 },
        },
        orderBy: { createdAt: 'asc' },
        take: limit,
      });
      for (const job of jobs) {
        const claimed = await this.db.messageJob.updateMany({
          where: { id: job.id, status: job.status },
          data: { status: 'PROCESSING', attempts: { increment: 1 } },
        });
        if (!claimed.count) continue;
        try {
          await this.provider.send({
            channel: job.channel,
            recipient: job.recipient,
            template: job.template,
            payload: job.payload as Record<string, unknown>,
          });
          await this.db.messageJob.update({
            where: { id: job.id },
            data: { status: 'SENT', processedAt: new Date(), lastError: null },
          });
        } catch (error) {
          await this.db.messageJob.update({
            where: { id: job.id },
            data: {
              status: 'FAILED',
              lastError: error instanceof Error ? error.message.slice(0, 500) : 'Erro desconhecido',
              scheduledAt: new Date(Date.now() + 60000),
            },
          });
        }
        processed += 1;
      }
      return { processed };
    } finally {
      this.processing = false;
    }
  }

  private create(input: {
    barbershopId: string;
    dedupKey: string;
    type: string;
    title: string;
    message: string;
    actionUrl?: string;
    metadata?: Record<string, unknown>;
  }) {
    const { barbershopId, dedupKey, metadata, ...data } = input;
    return this.db.notification.upsert({
      where: { barbershopId_dedupKey: { barbershopId, dedupKey } },
      create: {
        barbershopId,
        dedupKey,
        ...data,
        metadata: metadata as Prisma.InputJsonValue | undefined,
      },
      update: {
        ...data,
        metadata: metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }
}
