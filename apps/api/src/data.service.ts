import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { TenantContext } from './auth-context';
import { CreateEmployeeDto, EmployeeStatusFilter, ListEmployeesQuery } from './data.dto';

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

  async employees(query: ListEmployeesQuery = new ListEmployeesQuery()) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const search = query.search?.trim();
    const position = query.position?.trim();
    const where: Prisma.EmployeeWhereInput = {
      barbershopId: this.tenant.barbershopId,
      deletedAt: null,
      ...(query.status === EmployeeStatusFilter.ACTIVE && { active: true }),
      ...(query.status === EmployeeStatusFilter.INACTIVE && { active: false }),
      ...(position && { position }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
          { cpf: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total, positionRows] = await Promise.all([
      this.db.employee.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, role: true, active: true } },
          _count: { select: { appointments: true, employeeServices: true } },
        },
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.employee.count({ where }),
      this.db.employee.findMany({
        where: {
          barbershopId: this.tenant.barbershopId,
          deletedAt: null,
          position: { not: null },
        },
        select: { position: true },
        distinct: ['position'],
        orderBy: { position: 'asc' },
      }),
    ]);

    return {
      items,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      positions: positionRows.map(({ position }) => position).filter(Boolean),
    };
  }

  async createEmployee(dto: CreateEmployeeDto) {
    const barbershopId = this.tenant.barbershopId;
    const cpf = dto.cpf?.trim() || null;
    const email = dto.email?.trim().toLowerCase() || null;

    if (cpf || email) {
      const duplicate = await this.db.employee.findFirst({
        where: {
          barbershopId,
          deletedAt: null,
          OR: [...(cpf ? [{ cpf }] : []), ...(email ? [{ email }] : [])],
        },
        select: { cpf: true, email: true },
      });
      if (duplicate?.cpf === cpf) throw new ConflictException('CPF já cadastrado');
      if (duplicate?.email === email) throw new ConflictException('E-mail já cadastrado');
    }

    return this.db.employee.create({
      data: {
        barbershopId,
        name: dto.name.trim(),
        cpf,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
        phone: dto.phone?.trim() || null,
        whatsapp: dto.whatsapp?.trim() || null,
        email,
        address: dto.address?.trim() || null,
        position: dto.position?.trim() || null,
        hiredAt: dto.hiredAt ? new Date(dto.hiredAt) : null,
        color: dto.color,
        defaultCommission: dto.defaultCommission,
        notes: dto.notes?.trim() || null,
      },
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
