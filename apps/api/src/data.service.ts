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
  CreateEmployeeDto,
  CreateEmployeeAccessDto,
  EmployeeStatusFilter,
  ListEmployeesQuery,
  UpdateEmployeeDto,
  UpdateEmployeeAccessDto,
} from './data.dto';

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
