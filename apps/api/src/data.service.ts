import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { basename, join } from 'node:path';
import * as bcrypt from 'bcrypt';
import { PrismaService } from './prisma.service';
import { TenantContext } from './auth-context';
import {
  CreateCustomerDto,
  CustomerStatusFilter,
  CreateEmployeeAbsenceDto,
  CreateEmployeeDayOffDto,
  CreateEmployeeScheduleBlockDto,
  CreateEmployeeDto,
  CreateEmployeeAccessDto,
  EmployeeStatusFilter,
  ListEmployeesQuery,
  ListCustomersQuery,
  UpdateEmployeeDto,
  UpdateCustomerDto,
  UpdateEmployeeAccessDto,
  CreateWorkScheduleDto,
  UpdateWorkScheduleDto,
} from './data.dto';

@Injectable()
export class DataService {
  constructor(
    private readonly db: PrismaService,
    private readonly tenant: TenantContext,
  ) {}

  customers(query: ListCustomersQuery = new ListCustomersQuery()) {
    const search = query.search?.trim();
    const digits = search?.replace(/\D/g, '');
    return this.db.customer.findMany({
      where: {
        barbershopId: this.tenant.barbershopId,
        ...(query.status === CustomerStatusFilter.ACTIVE && { deletedAt: null }),
        ...(query.status === CustomerStatusFilter.ARCHIVED && { deletedAt: { not: null } }),
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            ...(digits ? [{ phone: { contains: digits } }, { cpf: { contains: digits } }] : []),
          ],
        }),
      },
      include: { _count: { select: { appointments: true } } },
      orderBy: { name: 'asc' },
    });
  }

  createCustomer(dto: CreateCustomerDto) {
    const phone = this.normalizePhone(dto.phone);
    const whatsapp = dto.whatsapp ? this.normalizePhone(dto.whatsapp) : null;

    return this.db.customer.create({
      data: {
        barbershopId: this.tenant.barbershopId,
        name: dto.name.trim(),
        phone,
        whatsapp,
        email: dto.email?.trim().toLowerCase() || null,
        cpf: dto.cpf?.replace(/\D/g, '') || null,
        birthDate: dto.birthDate ? this.parseDateOnly(dto.birthDate) : null,
        notes: dto.notes?.trim() || null,
      },
    });
  }

  async updateCustomer(id: string, dto: UpdateCustomerDto) {
    const customer = await this.db.customer.findFirst({
      where: { id, barbershopId: this.tenant.barbershopId, deletedAt: null },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Cliente não encontrado');

    return this.db.customer.update({
      where: { id: customer.id },
      data: {
        name: dto.name?.trim(),
        phone: dto.phone === undefined ? undefined : this.normalizePhone(dto.phone),
        whatsapp:
          dto.whatsapp === undefined
            ? undefined
            : dto.whatsapp
              ? this.normalizePhone(dto.whatsapp)
              : null,
        email: dto.email === undefined ? undefined : dto.email?.trim().toLowerCase() || null,
        cpf: dto.cpf === undefined ? undefined : dto.cpf?.replace(/\D/g, '') || null,
        birthDate:
          dto.birthDate === undefined
            ? undefined
            : dto.birthDate
              ? this.parseDateOnly(dto.birthDate)
              : null,
        notes: dto.notes === undefined ? undefined : dto.notes?.trim() || null,
      },
    });
  }

  async setCustomerArchive(id: string, archived: boolean) {
    const customer = await this.db.customer.findFirst({
      where: { id, barbershopId: this.tenant.barbershopId },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Cliente não encontrado');
    return this.db.customer.update({
      where: { id: customer.id },
      data: { deletedAt: archived ? new Date() : null },
    });
  }

  private normalizePhone(value: string) {
    const phone = value.replace(/\D/g, '');
    if (phone.length < 10 || phone.length > 11) {
      throw new BadRequestException('Informe um telefone com DDD válido');
    }
    return phone;
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

  async employeeDetails(id: string) {
    const barbershopId = this.tenant.barbershopId;
    const employee = await this.db.employee.findFirst({
      where: { id, barbershopId, deletedAt: null },
      include: {
        user: { select: { id: true, email: true, role: true, active: true } },
        schedules: { orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }] },
        unavailabilities: { orderBy: { startAt: 'asc' } },
        employeeServices: {
          include: {
            service: {
              select: { id: true, name: true, price: true, durationMinutes: true, active: true },
            },
          },
          orderBy: { service: { name: 'asc' } },
        },
      },
    });
    if (!employee) throw new NotFoundException('Colaborador não encontrado');

    const [appointments, totalAppointments, completedAppointments, sales, commissions] =
      await Promise.all([
        this.db.appointment.findMany({
          where: { barbershopId, employeeId: employee.id },
          include: {
            customer: { select: { id: true, name: true } },
            services: { include: { service: { select: { id: true, name: true } } } },
          },
          orderBy: { startAt: 'desc' },
          take: 10,
        }),
        this.db.appointment.count({ where: { barbershopId, employeeId: employee.id } }),
        this.db.appointment.count({
          where: { barbershopId, employeeId: employee.id, status: 'COMPLETED' },
        }),
        this.db.sale.aggregate({
          where: { barbershopId, employeeId: employee.id },
          _sum: { total: true },
          _count: { _all: true },
        }),
        this.db.commission.aggregate({
          where: { barbershopId, employeeId: employee.id },
          _sum: { amount: true },
        }),
      ]);

    return {
      employee,
      metrics: {
        appointments: totalAppointments,
        completedAppointments,
        sales: sales._count._all,
        revenue: Number(sales._sum.total || 0),
        commissions: Number(commissions._sum.amount || 0),
      },
      appointments,
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
      if (cpf && duplicate?.cpf === cpf) throw new ConflictException('CPF já cadastrado');
      if (email && duplicate?.email === email) throw new ConflictException('E-mail já cadastrado');
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

  async updateEmployee(id: string, dto: UpdateEmployeeDto) {
    const barbershopId = this.tenant.barbershopId;
    const current = await this.db.employee.findFirst({
      where: { id, barbershopId, deletedAt: null },
    });
    if (!current) throw new NotFoundException('Colaborador não encontrado');

    const cpf = dto.cpf === undefined ? undefined : dto.cpf?.trim() || null;
    const email = dto.email === undefined ? undefined : dto.email?.trim().toLowerCase() || null;
    if (cpf || email) {
      const duplicate = await this.db.employee.findFirst({
        where: {
          barbershopId,
          deletedAt: null,
          id: { not: id },
          OR: [...(cpf ? [{ cpf }] : []), ...(email ? [{ email }] : [])],
        },
        select: { cpf: true, email: true },
      });
      if (cpf && duplicate?.cpf === cpf) throw new ConflictException('CPF já cadastrado');
      if (email && duplicate?.email === email) throw new ConflictException('E-mail já cadastrado');
    }

    return this.db.employee.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        cpf,
        birthDate:
          dto.birthDate === undefined ? undefined : dto.birthDate ? new Date(dto.birthDate) : null,
        phone: dto.phone === undefined ? undefined : dto.phone?.trim() || null,
        whatsapp: dto.whatsapp === undefined ? undefined : dto.whatsapp?.trim() || null,
        email,
        address: dto.address === undefined ? undefined : dto.address?.trim() || null,
        position: dto.position === undefined ? undefined : dto.position?.trim() || null,
        hiredAt: dto.hiredAt === undefined ? undefined : dto.hiredAt ? new Date(dto.hiredAt) : null,
        color: dto.color,
        defaultCommission: dto.defaultCommission,
        notes: dto.notes === undefined ? undefined : dto.notes?.trim() || null,
      },
    });
  }

  async setEmployeeStatus(id: string, active: boolean) {
    const employee = await this.db.employee.findFirst({
      where: {
        id,
        barbershopId: this.tenant.barbershopId,
        deletedAt: null,
      },
      select: { id: true, active: true },
    });
    if (!employee) throw new NotFoundException('Colaborador não encontrado');

    if (employee.active === active) return employee;

    return this.db.employee.update({
      where: { id: employee.id },
      data: { active },
    });
  }

  async uploadEmployeePhoto(id: string, photo: Express.Multer.File) {
    const employee = await this.db.employee.findFirst({
      where: {
        id,
        barbershopId: this.tenant.barbershopId,
        deletedAt: null,
      },
      select: { id: true, photoUrl: true },
    });
    if (!employee) throw new NotFoundException('Colaborador não encontrado');

    const extensions: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
    };
    const extension = extensions[photo.mimetype];
    if (!extension) throw new BadRequestException('Formato de imagem não suportado');
    const validSignature =
      (photo.mimetype === 'image/jpeg' &&
        photo.buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) ||
      (photo.mimetype === 'image/png' &&
        photo.buffer
          .subarray(0, 8)
          .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) ||
      (photo.mimetype === 'image/webp' &&
        photo.buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
        photo.buffer.subarray(8, 12).toString('ascii') === 'WEBP');
    if (!validSignature) throw new BadRequestException('Conteúdo da imagem inválido');

    const directory = join(process.env.UPLOAD_DIR || join(process.cwd(), 'uploads'), 'employees');
    const filename = `${randomUUID()}${extension}`;
    const target = join(directory, filename);
    const photoUrl = `/uploads/employees/${filename}`;
    await mkdir(directory, { recursive: true });
    await writeFile(target, photo.buffer);

    let updated;
    try {
      updated = await this.db.employee.update({
        where: { id: employee.id },
        data: { photoUrl },
      });
    } catch (error) {
      await unlink(target).catch(() => undefined);
      throw error;
    }

    if (employee.photoUrl?.startsWith('/uploads/employees/')) {
      await unlink(join(directory, basename(employee.photoUrl))).catch(() => undefined);
    }
    return updated;
  }

  async createEmployeeAccess(id: string, dto: CreateEmployeeAccessDto) {
    const barbershopId = this.tenant.barbershopId;
    const employee = await this.db.employee.findFirst({
      where: { id, barbershopId, deletedAt: null },
      select: { id: true, name: true, active: true, userId: true },
    });
    if (!employee) throw new NotFoundException('Colaborador não encontrado');
    if (!employee.active)
      throw new ConflictException('Reative o colaborador antes de criar acesso');
    if (employee.userId) throw new ConflictException('Colaborador já possui acesso ao sistema');
    if (dto.role !== Role.BARBER && dto.role !== Role.RECEPTIONIST) {
      throw new BadRequestException('Perfil inválido para colaborador');
    }

    const email = dto.email.trim().toLowerCase();
    if (await this.db.user.findUnique({ where: { email }, select: { id: true } })) {
      throw new ConflictException('E-mail já utilizado por outro usuário');
    }

    const subscription = await this.db.subscription.findUnique({
      where: { barbershopId },
      select: { plan: { select: { maxUsers: true } } },
    });
    if (!subscription) throw new ConflictException('Assinatura sem plano configurado');
    if (subscription.plan.maxUsers > 0) {
      const users = await this.db.user.count({ where: { barbershopId } });
      if (users >= subscription.plan.maxUsers) {
        throw new ConflictException('Limite de usuários do plano atingido');
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    return this.db.employee.update({
      where: { id: employee.id },
      data: {
        user: {
          create: {
            barbershopId,
            name: employee.name,
            email,
            passwordHash,
            role: dto.role,
          },
        },
      },
      include: { user: { select: { id: true, email: true, role: true, active: true } } },
    });
  }

  async employeeAccess(id: string) {
    const employee = await this.db.employee.findFirst({
      where: { id, barbershopId: this.tenant.barbershopId, deletedAt: null },
      select: {
        id: true,
        name: true,
        user: { select: { id: true, email: true, role: true, active: true } },
      },
    });
    if (!employee) throw new NotFoundException('Colaborador não encontrado');
    if (!employee.user) throw new ConflictException('Colaborador ainda não possui acesso');

    const [catalog, rolePermissions, overrides] = await Promise.all([
      this.db.permission.findMany({ orderBy: { description: 'asc' } }),
      this.db.rolePermission.findMany({
        where: { role: employee.user.role },
        select: { permissionId: true },
      }),
      this.db.userPermission.findMany({
        where: { userId: employee.user.id },
        select: { permissionId: true, granted: true },
      }),
    ]);
    const roleKeys = new Set(rolePermissions.map(({ permissionId }) => permissionId));
    const overrideById = new Map(overrides.map((item) => [item.permissionId, item.granted]));

    return {
      employee: { id: employee.id, name: employee.name },
      user: employee.user,
      permissions: catalog.map((permission) => ({
        key: permission.key,
        description: permission.description,
        inherited: roleKeys.has(permission.id),
        granted: overrideById.get(permission.id) ?? roleKeys.has(permission.id),
      })),
    };
  }

  async updateEmployeeAccess(id: string, dto: UpdateEmployeeAccessDto) {
    const barbershopId = this.tenant.barbershopId;
    const employee = await this.db.employee.findFirst({
      where: { id, barbershopId, deletedAt: null },
      select: { id: true, user: { select: { id: true, email: true } } },
    });
    if (!employee) throw new NotFoundException('Colaborador não encontrado');
    if (!employee.user) throw new ConflictException('Colaborador ainda não possui acesso');
    if (dto.role !== Role.BARBER && dto.role !== Role.RECEPTIONIST) {
      throw new BadRequestException('Perfil inválido para colaborador');
    }

    const email = dto.email.trim().toLowerCase();
    const emailOwner = await this.db.user.findUnique({ where: { email }, select: { id: true } });
    if (emailOwner && emailOwner.id !== employee.user.id) {
      throw new ConflictException('E-mail já utilizado por outro usuário');
    }

    const uniqueKeys = [...new Set(dto.permissions)];
    const [catalog, rolePermissions] = await Promise.all([
      this.db.permission.findMany({
        where: { key: { in: uniqueKeys } },
        select: { id: true, key: true },
      }),
      this.db.rolePermission.findMany({
        where: { role: dto.role },
        select: { permissionId: true },
      }),
    ]);
    if (catalog.length !== uniqueKeys.length) {
      throw new BadRequestException('A lista contém permissão inválida');
    }

    const selected = new Set(uniqueKeys);
    const rolePermissionIds = new Set(rolePermissions.map(({ permissionId }) => permissionId));
    const allPermissions = await this.db.permission.findMany({ select: { id: true, key: true } });
    const overrides = allPermissions
      .filter((permission) => selected.has(permission.key) !== rolePermissionIds.has(permission.id))
      .map((permission) => ({
        userId: employee.user!.id,
        permissionId: permission.id,
        granted: selected.has(permission.key),
      }));

    await this.db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: employee.user!.id },
        data: { email, role: dto.role, active: dto.active },
      });
      await tx.userPermission.deleteMany({ where: { userId: employee.user!.id } });
      if (overrides.length) await tx.userPermission.createMany({ data: overrides });
      await tx.session.updateMany({
        where: { userId: employee.user!.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    return this.employeeAccess(id);
  }

  async setEmployeeCommission(id: string, defaultCommission: number) {
    const employee = await this.db.employee.findFirst({
      where: {
        id,
        barbershopId: this.tenant.barbershopId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException('Colaborador não encontrado');

    return this.db.employee.update({
      where: { id: employee.id },
      data: { defaultCommission },
    });
  }

  async createWorkSchedule(employeeId: string, dto: CreateWorkScheduleDto) {
    const barbershopId = this.tenant.barbershopId;
    const employee = await this.db.employee.findFirst({
      where: { id: employeeId, barbershopId, deletedAt: null },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException('Colaborador não encontrado');

    const schedule = {
      weekday: dto.weekday,
      startTime: dto.startTime,
      endTime: dto.endTime,
      breakStart: dto.breakStart || null,
      breakEnd: dto.breakEnd || null,
      active: dto.active ?? true,
    };
    await this.validateWorkSchedule(employee.id, schedule);

    return this.db.workSchedule.create({
      data: {
        barbershopId,
        employeeId: employee.id,
        ...schedule,
      },
    });
  }

  async updateWorkSchedule(employeeId: string, scheduleId: string, dto: UpdateWorkScheduleDto) {
    const schedule = await this.db.workSchedule.findFirst({
      where: { id: scheduleId, employeeId, barbershopId: this.tenant.barbershopId },
      select: {
        id: true,
        weekday: true,
        startTime: true,
        endTime: true,
        breakStart: true,
        breakEnd: true,
        active: true,
      },
    });
    if (!schedule) throw new NotFoundException('Jornada não encontrada');

    const updatedSchedule = {
      weekday: dto.weekday ?? schedule.weekday,
      startTime: dto.startTime ?? schedule.startTime,
      endTime: dto.endTime ?? schedule.endTime,
      breakStart: dto.breakStart === undefined ? schedule.breakStart : dto.breakStart || null,
      breakEnd: dto.breakEnd === undefined ? schedule.breakEnd : dto.breakEnd || null,
      active: dto.active ?? schedule.active,
    };
    await this.validateWorkSchedule(employeeId, updatedSchedule, schedule.id);

    return this.db.workSchedule.update({
      where: { id: schedule.id },
      data: updatedSchedule,
    });
  }

  private async validateWorkSchedule(
    employeeId: string,
    schedule: {
      weekday: number;
      startTime: string;
      endTime: string;
      breakStart: string | null;
      breakEnd: string | null;
      active: boolean;
    },
    scheduleId?: string,
  ) {
    if (schedule.endTime <= schedule.startTime) {
      throw new BadRequestException('O fim da jornada deve ser posterior ao início');
    }
    if (Boolean(schedule.breakStart) !== Boolean(schedule.breakEnd)) {
      throw new BadRequestException('Informe o início e o fim da pausa');
    }
    if (schedule.breakStart && schedule.breakEnd) {
      if (schedule.breakEnd <= schedule.breakStart) {
        throw new BadRequestException('O fim da pausa deve ser posterior ao início');
      }
      if (schedule.breakStart < schedule.startTime || schedule.breakEnd > schedule.endTime) {
        throw new BadRequestException('A pausa deve estar dentro da jornada');
      }
    }
    if (!schedule.active) return;

    const overlap = await this.db.workSchedule.findFirst({
      where: {
        barbershopId: this.tenant.barbershopId,
        employeeId,
        weekday: schedule.weekday,
        active: true,
        startTime: { lt: schedule.endTime },
        endTime: { gt: schedule.startTime },
        ...(scheduleId ? { id: { not: scheduleId } } : {}),
      },
      select: { id: true },
    });
    if (overlap) {
      throw new ConflictException('A jornada sobrepõe outro horário do colaborador');
    }
  }

  async deleteWorkSchedule(employeeId: string, scheduleId: string) {
    const schedule = await this.db.workSchedule.findFirst({
      where: { id: scheduleId, employeeId, barbershopId: this.tenant.barbershopId },
      select: { id: true },
    });
    if (!schedule) throw new NotFoundException('Jornada não encontrada');
    await this.db.workSchedule.delete({ where: { id: schedule.id } });
  }

  async createEmployeeDayOff(employeeId: string, dto: CreateEmployeeDayOffDto) {
    const employee = await this.findTenantEmployee(employeeId);
    const startAt = this.parseDateOnly(dto.date);
    const endAt = new Date(startAt);
    endAt.setUTCDate(endAt.getUTCDate() + 1);

    return this.db.employeeUnavailability.create({
      data: {
        barbershopId: this.tenant.barbershopId,
        employeeId: employee.id,
        type: 'DAY_OFF',
        startAt,
        endAt,
        allDay: true,
        reason: dto.reason?.trim() || null,
      },
    });
  }

  async createEmployeeAbsence(employeeId: string, dto: CreateEmployeeAbsenceDto) {
    const employee = await this.findTenantEmployee(employeeId);
    const startAt = this.parseDateOnly(dto.startDate);
    const endDate = this.parseDateOnly(dto.endDate);
    if (endDate < startAt) {
      throw new BadRequestException('O fim do período deve ser igual ou posterior ao início');
    }
    const endAt = new Date(endDate);
    endAt.setUTCDate(endAt.getUTCDate() + 1);

    return this.db.employeeUnavailability.create({
      data: {
        barbershopId: this.tenant.barbershopId,
        employeeId: employee.id,
        type: dto.type,
        startAt,
        endAt,
        allDay: true,
        reason: dto.reason?.trim() || null,
      },
    });
  }

  async createEmployeeScheduleBlock(employeeId: string, dto: CreateEmployeeScheduleBlockDto) {
    const employee = await this.findTenantEmployee(employeeId);
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    if (endAt <= startAt) {
      throw new BadRequestException('O fim do bloqueio deve ser posterior ao início');
    }

    return this.db.employeeUnavailability.create({
      data: {
        barbershopId: this.tenant.barbershopId,
        employeeId: employee.id,
        type: 'BLOCK',
        startAt,
        endAt,
        allDay: false,
        reason: dto.reason?.trim() || null,
      },
    });
  }

  async deleteEmployeeUnavailability(employeeId: string, unavailabilityId: string) {
    const unavailability = await this.db.employeeUnavailability.findFirst({
      where: {
        id: unavailabilityId,
        employeeId,
        barbershopId: this.tenant.barbershopId,
      },
      select: { id: true },
    });
    if (!unavailability) throw new NotFoundException('Indisponibilidade não encontrada');
    await this.db.employeeUnavailability.delete({ where: { id: unavailability.id } });
  }

  private async findTenantEmployee(employeeId: string) {
    const employee = await this.db.employee.findFirst({
      where: { id: employeeId, barbershopId: this.tenant.barbershopId, deletedAt: null },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException('Colaborador não encontrado');
    return employee;
  }

  private parseDateOnly(value: string) {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      throw new BadRequestException('Data inválida');
    }
    return date;
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
