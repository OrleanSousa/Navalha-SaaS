import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TenantContext } from './auth-context';

@Injectable()
export class DataService {
  constructor(
    private readonly db: PrismaService,
    private readonly tenant: TenantContext,
  ) {}

  customers() {
    return this.db.customer.findMany({
      where: { barbershopId: this.tenant.barbershopId, deletedAt: null },
      include: { _count: { select: { appointments: true } } },
      orderBy: { name: 'asc' },
    });
  }

  employees() {
    return this.db.employee.findMany({
      where: { barbershopId: this.tenant.barbershopId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  services() {
    return this.db.service.findMany({
      where: { barbershopId: this.tenant.barbershopId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  products() {
    return this.db.product.findMany({
      where: { barbershopId: this.tenant.barbershopId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  appointments() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    return this.db.appointment.findMany({
      where: {
        barbershopId: this.tenant.barbershopId,
        startAt: { gte: start, lt: end },
      },
      include: {
        customer: true,
        employee: true,
        services: { include: { service: true } },
      },
      orderBy: { startAt: 'asc' },
    });
  }

  async dashboard() {
    const barbershopId = this.tenant.barbershopId;
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const month = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todaySales, monthSales, appointments, customers, cash] = await Promise.all([
      this.db.sale.aggregate({
        where: { barbershopId, createdAt: { gte: today, lt: tomorrow } },
        _sum: { total: true },
        _avg: { total: true },
      }),
      this.db.sale.aggregate({
        where: { barbershopId, createdAt: { gte: month } },
        _sum: { total: true },
      }),
      this.db.appointment.findMany({
        where: { barbershopId, startAt: { gte: today, lt: tomorrow } },
        include: {
          customer: true,
          employee: true,
          services: { include: { service: true } },
        },
        orderBy: { startAt: 'asc' },
      }),
      this.db.appointment.count({
        where: {
          barbershopId,
          startAt: { gte: today, lt: tomorrow },
          status: 'COMPLETED',
        },
      }),
      this.db.cashRegister.findFirst({
        where: { barbershopId, closedAt: null },
        orderBy: { openedAt: 'desc' },
      }),
    ]);

    return {
      metrics: {
        todayRevenue: Number(todaySales._sum.total || 0),
        monthRevenue: Number(monthSales._sum.total || 0),
        todayAppointments: appointments.length,
        todayCustomers: customers,
        cashBalance: Number(cash?.openingBalance || 0),
        averageTicket: Number(todaySales._avg.total || 0),
      },
      appointments: appointments.slice(0, 5).map((appointment) => ({
        time: appointment.startAt.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        customer: appointment.customer.name,
        employee: appointment.employee.name,
        service: appointment.services.map(({ service }) => service.name).join(', '),
        status: appointment.status,
      })),
      chart: [],
    };
  }
}
