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
  CustomerSortField,
  CreateEmployeeAbsenceDto,
  CreateEmployeeDayOffDto,
  CreateEmployeeScheduleBlockDto,
  CreateEmployeeDto,
  CreateEmployeeAccessDto,
  CreateInventoryMovementDto,
  CreateAppointmentDto,
  AppointmentSlotsDto,
  CancelAppointmentDto,
  AddSaleProductItemDto,
  AddSaleServiceItemDto,
  ApplySaleDiscountDto,
  CreateWalkInSaleDto,
  FinalizeSaleDto,
  AdjustCommissionDto,
  ListCommissionsQuery,
  PayCommissionsDto,
  OpenCashRegisterDto,
  CloseCashRegisterDto,
  CreateFinancialTransactionDto,
  UpdateFinancialTransactionDto,
  CancelFinancialTransactionDto,
  ListCashRegistersQuery,
  CreateSupplierDto,
  UpdateSupplierDto,
  CreateFinancialCategoryDto,
  UpdateFinancialCategoryDto,
  CreateAccountPayableDto,
  CreateAccountReceivableDto,
  CreateExpenseRecurrenceDto,
  SettleAccountDto,
  CancelAccountDto,
  ListAccountsQuery,
  AccountListStatus,
  DashboardQuery,
  ReportsQuery,
  ListAppointmentsQuery,
  CreateProductCategoryDto,
  CreateProductDto,
  ConfigureServiceProfessionalDto,
  CreateServiceCategoryDto,
  CreateServiceDto,
  EmployeeStatusFilter,
  ListEmployeesQuery,
  ListCustomersQuery,
  SortDirection,
  UpdateEmployeeDto,
  UpdateCustomerDto,
  UpdateCustomerDuplicatePolicyDto,
  UpdateEmployeeAccessDto,
  UpdateProductDto,
  UpdateAppointmentDto,
  UpdateServiceDto,
  UpdateStockSettingsDto,
  CreateWorkScheduleDto,
  UpdateWorkScheduleDto,
} from './data.dto';
import { AvailabilityService } from './availability.service';

@Injectable()
export class DataService {
  constructor(
    private readonly db: PrismaService,
    private readonly tenant: TenantContext,
    private readonly availability: AvailabilityService,
  ) {}

  async customers(query: ListCustomersQuery = new ListCustomersQuery()) {
    const search = query.search?.trim();
    const digits = search?.replace(/\D/g, '');
    const page = query.page || 1;
    const limit = query.limit || 10;
    const where: Prisma.CustomerWhereInput = {
      barbershopId: this.tenant.barbershopId,
      ...(query.status === CustomerStatusFilter.ACTIVE && { deletedAt: null }),
      ...(query.status === CustomerStatusFilter.ARCHIVED && { deletedAt: { not: null } }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          ...(digits ? [{ phone: { contains: digits } }, { cpf: { contains: digits } }] : []),
        ],
      }),
    };
    const direction = query.direction === SortDirection.DESC ? 'desc' : 'asc';
    const orderBy: Prisma.CustomerOrderByWithRelationInput =
      query.sortBy === CustomerSortField.CREATED_AT
        ? { createdAt: direction }
        : { name: direction };
    const [items, total] = await Promise.all([
      this.db.customer.findMany({
        where,
        include: {
          _count: { select: { appointments: { where: { status: 'COMPLETED' } } } },
          appointments: {
            where: { status: 'COMPLETED' },
            select: { startAt: true },
            orderBy: { startAt: 'desc' },
            take: 1,
          },
          sales: { where: { status: 'COMPLETED' }, select: { total: true } },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.customer.count({ where }),
    ]);
    return {
      items: items.map(({ appointments, sales, ...customer }) => ({
        ...customer,
        totalSpent: sales.reduce((sum, sale) => sum + Number(sale.total), 0),
        lastVisit: appointments[0]?.startAt || null,
      })),
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    };
  }

  async createCustomer(dto: CreateCustomerDto) {
    const phone = this.normalizePhone(dto.phone);
    const whatsapp = dto.whatsapp ? this.normalizePhone(dto.whatsapp) : null;
    const cpf = dto.cpf?.replace(/\D/g, '') || null;
    await this.validateCustomerDuplicates(phone, cpf);

    return this.db.customer.create({
      data: {
        barbershopId: this.tenant.barbershopId,
        name: dto.name.trim(),
        phone,
        whatsapp,
        email: dto.email?.trim().toLowerCase() || null,
        cpf,
        birthDate: dto.birthDate ? this.parseDateOnly(dto.birthDate) : null,
        notes: dto.notes?.trim() || null,
      },
    });
  }

  async updateCustomer(id: string, dto: UpdateCustomerDto) {
    const customer = await this.db.customer.findFirst({
      where: { id, barbershopId: this.tenant.barbershopId, deletedAt: null },
      select: { id: true, phone: true, cpf: true },
    });
    if (!customer) throw new NotFoundException('Cliente não encontrado');

    const phone = dto.phone === undefined ? customer.phone : this.normalizePhone(dto.phone);
    const cpf = dto.cpf === undefined ? customer.cpf : dto.cpf?.replace(/\D/g, '') || null;
    await this.validateCustomerDuplicates(phone, cpf, customer.id);

    return this.db.customer.update({
      where: { id: customer.id },
      data: {
        name: dto.name?.trim(),
        phone: dto.phone === undefined ? undefined : phone,
        whatsapp:
          dto.whatsapp === undefined
            ? undefined
            : dto.whatsapp
              ? this.normalizePhone(dto.whatsapp)
              : null,
        email: dto.email === undefined ? undefined : dto.email?.trim().toLowerCase() || null,
        cpf: dto.cpf === undefined ? undefined : cpf,
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

  async customerDuplicatePolicy() {
    const settings = await this.db.setting.findUnique({
      where: { barbershopId: this.tenant.barbershopId },
      select: { allowDuplicateCustomerPhone: true, allowDuplicateCustomerCpf: true },
    });
    return {
      allowDuplicatePhone: settings?.allowDuplicateCustomerPhone ?? false,
      allowDuplicateCpf: settings?.allowDuplicateCustomerCpf ?? false,
    };
  }

  async updateCustomerDuplicatePolicy(dto: UpdateCustomerDuplicatePolicyDto) {
    const settings = await this.db.setting.upsert({
      where: { barbershopId: this.tenant.barbershopId },
      create: {
        barbershopId: this.tenant.barbershopId,
        allowDuplicateCustomerPhone: dto.allowDuplicatePhone,
        allowDuplicateCustomerCpf: dto.allowDuplicateCpf,
      },
      update: {
        allowDuplicateCustomerPhone: dto.allowDuplicatePhone,
        allowDuplicateCustomerCpf: dto.allowDuplicateCpf,
      },
      select: { allowDuplicateCustomerPhone: true, allowDuplicateCustomerCpf: true },
    });
    return {
      allowDuplicatePhone: settings.allowDuplicateCustomerPhone,
      allowDuplicateCpf: settings.allowDuplicateCustomerCpf,
    };
  }

  async customerDetails(id: string) {
    const customer = await this.db.customer.findFirst({
      where: { id, barbershopId: this.tenant.barbershopId },
    });
    if (!customer) throw new NotFoundException('Cliente não encontrado');
    const serviceHistory = await this.db.appointment.findMany({
      where: {
        barbershopId: this.tenant.barbershopId,
        customerId: customer.id,
        status: 'COMPLETED',
      },
      select: {
        id: true,
        startAt: true,
        endAt: true,
        price: true,
        employee: { select: { id: true, name: true } },
        services: {
          select: {
            id: true,
            price: true,
            durationMinutes: true,
            service: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { startAt: 'desc' },
    });
    const productSales = await this.db.sale.findMany({
      where: {
        barbershopId: this.tenant.barbershopId,
        customerId: customer.id,
        status: 'COMPLETED',
        items: { some: { productId: { not: null } } },
      },
      select: {
        id: true,
        createdAt: true,
        items: {
          where: { productId: { not: null } },
          select: {
            id: true,
            quantity: true,
            unitPrice: true,
            total: true,
            product: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    const productPurchases = productSales.flatMap((sale) =>
      sale.items.map((item) => ({ ...item, saleId: sale.id, purchasedAt: sale.createdAt })),
    );
    const spending = await this.db.sale.aggregate({
      where: {
        barbershopId: this.tenant.barbershopId,
        customerId: customer.id,
        status: 'COMPLETED',
      },
      _sum: { total: true },
    });
    const nextAppointment = await this.db.appointment.findFirst({
      where: {
        barbershopId: this.tenant.barbershopId,
        customerId: customer.id,
        startAt: { gte: new Date() },
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
      },
      select: {
        id: true,
        startAt: true,
        endAt: true,
        status: true,
        employee: { select: { id: true, name: true } },
        services: { select: { service: { select: { id: true, name: true } } } },
      },
      orderBy: { startAt: 'asc' },
    });
    return {
      customer,
      serviceHistory,
      productPurchases,
      nextAppointment,
      metrics: {
        visits: serviceHistory.length,
        totalSpent: Number(spending._sum.total || 0),
        lastVisit: serviceHistory[0]?.startAt || null,
      },
    };
  }

  private async validateCustomerDuplicates(phone: string, cpf: string | null, excludeId?: string) {
    const policy = await this.customerDuplicatePolicy();
    const conditions: Prisma.CustomerWhereInput[] = [];
    if (!policy.allowDuplicatePhone) conditions.push({ phone });
    if (cpf && !policy.allowDuplicateCpf) conditions.push({ cpf });
    if (!conditions.length) return;

    const duplicate = await this.db.customer.findFirst({
      where: {
        barbershopId: this.tenant.barbershopId,
        ...(excludeId && { id: { not: excludeId } }),
        OR: conditions,
      },
      select: { phone: true, cpf: true },
    });
    if (!duplicate) return;
    if (!policy.allowDuplicatePhone && duplicate.phone === phone) {
      throw new ConflictException('Já existe um cliente com este telefone');
    }
    if (cpf && !policy.allowDuplicateCpf && duplicate.cpf === cpf) {
      throw new ConflictException('Já existe um cliente com este CPF');
    }
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
          where: { barbershopId, employeeId: employee.id, status: 'COMPLETED' },
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
      include: {
        category: true,
        _count: { select: { employeeServices: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createService(dto: CreateServiceDto) {
    const name = dto.name.trim();
    if (name.length < 2) throw new BadRequestException('Informe um nome válido para o serviço');
    this.validateCommission(dto.commissionPercent, dto.commissionFixed);
    const categoryId = dto.categoryId || null;
    if (categoryId) await this.findTenantServiceCategory(categoryId);

    return this.db.service.create({
      data: {
        barbershopId: this.tenant.barbershopId,
        name,
        description: dto.description?.trim() || null,
        categoryId,
        price: dto.price,
        durationMinutes: dto.durationMinutes,
        commissionPercent: dto.commissionPercent ?? null,
        commissionFixed: dto.commissionFixed ?? null,
      },
      include: { category: true, _count: { select: { employeeServices: true } } },
    });
  }

  async serviceDetails(id: string) {
    const barbershopId = this.tenant.barbershopId;
    const service = await this.db.service.findFirst({
      where: { id, barbershopId, deletedAt: null },
      include: {
        category: true,
        employeeServices: {
          include: {
            employee: {
              select: {
                id: true,
                name: true,
                color: true,
                active: true,
                defaultCommission: true,
              },
            },
          },
          orderBy: { employee: { name: 'asc' } },
        },
      },
    });
    if (!service) throw new NotFoundException('Serviço não encontrado');

    const employees = await this.db.employee.findMany({
      where: { barbershopId, deletedAt: null },
      select: { id: true, name: true, color: true, active: true, defaultCommission: true },
      orderBy: { name: 'asc' },
    });

    return {
      service,
      employees,
      commissionPriority: [
        'Configuração específica do profissional',
        'Configuração do serviço',
        'Comissão padrão do profissional',
      ],
    };
  }

  async updateService(id: string, dto: UpdateServiceDto) {
    const service = await this.findTenantService(id);
    const name = dto.name === undefined ? undefined : dto.name.trim();
    if (name !== undefined && name.length < 2) {
      throw new BadRequestException('Informe um nome válido para o serviço');
    }
    const commissionPercent =
      dto.commissionPercent === undefined
        ? service.commissionPercent == null
          ? null
          : Number(service.commissionPercent)
        : dto.commissionPercent;
    const commissionFixed =
      dto.commissionFixed === undefined
        ? service.commissionFixed == null
          ? null
          : Number(service.commissionFixed)
        : dto.commissionFixed;
    this.validateCommission(commissionPercent, commissionFixed);
    if (dto.categoryId) await this.findTenantServiceCategory(dto.categoryId);

    return this.db.service.update({
      where: { id: service.id },
      data: {
        name,
        description: dto.description === undefined ? undefined : dto.description?.trim() || null,
        categoryId: dto.categoryId === undefined ? undefined : dto.categoryId || null,
        price: dto.price,
        durationMinutes: dto.durationMinutes,
        commissionPercent: dto.commissionPercent,
        commissionFixed: dto.commissionFixed,
      },
      include: { category: true, _count: { select: { employeeServices: true } } },
    });
  }

  async setServiceStatus(id: string, active: boolean) {
    const service = await this.findTenantService(id);
    return this.db.service.update({ where: { id: service.id }, data: { active } });
  }

  serviceCategories() {
    return this.db.serviceCategory.findMany({
      where: { barbershopId: this.tenant.barbershopId, active: true },
      orderBy: { name: 'asc' },
    });
  }

  async createServiceCategory(dto: CreateServiceCategoryDto) {
    const name = dto.name.trim();
    if (name.length < 2) throw new BadRequestException('Informe um nome válido para a categoria');
    const duplicate = await this.db.serviceCategory.findFirst({
      where: {
        barbershopId: this.tenant.barbershopId,
        name: { equals: name, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('Esta categoria já existe');
    return this.db.serviceCategory.create({
      data: { barbershopId: this.tenant.barbershopId, name },
    });
  }

  async configureServiceProfessional(
    serviceId: string,
    employeeId: string,
    dto: ConfigureServiceProfessionalDto,
  ) {
    const [service, employee] = await Promise.all([
      this.findTenantService(serviceId),
      this.findTenantEmployee(employeeId),
    ]);
    this.validateCommission(dto.commissionPercent, dto.commissionFixed);
    return this.db.employeeService.upsert({
      where: { employeeId_serviceId: { employeeId: employee.id, serviceId: service.id } },
      update: {
        commissionPercent: dto.commissionPercent ?? null,
        commissionFixed: dto.commissionFixed ?? null,
      },
      create: {
        barbershopId: this.tenant.barbershopId,
        employeeId: employee.id,
        serviceId: service.id,
        commissionPercent: dto.commissionPercent ?? null,
        commissionFixed: dto.commissionFixed ?? null,
      },
      include: { employee: true },
    });
  }

  async removeServiceProfessional(serviceId: string, employeeId: string) {
    await this.findTenantService(serviceId);
    const link = await this.db.employeeService.findFirst({
      where: { serviceId, employeeId, barbershopId: this.tenant.barbershopId },
      select: { id: true },
    });
    if (!link) throw new NotFoundException('Profissional não vinculado ao serviço');
    await this.db.employeeService.delete({ where: { id: link.id } });
  }

  async serviceCommissionRule(serviceId: string, employeeId: string) {
    const [service, employee] = await Promise.all([
      this.db.service.findFirst({
        where: { id: serviceId, barbershopId: this.tenant.barbershopId, deletedAt: null },
        include: { employeeServices: { where: { employeeId }, take: 1 } },
      }),
      this.db.employee.findFirst({
        where: { id: employeeId, barbershopId: this.tenant.barbershopId, deletedAt: null },
        select: { defaultCommission: true },
      }),
    ]);
    if (!service) throw new NotFoundException('Serviço não encontrado');
    if (!employee) throw new NotFoundException('Colaborador não encontrado');
    const specific = service.employeeServices[0];
    if (specific?.commissionFixed != null) {
      return { type: 'FIXED', value: Number(specific.commissionFixed), source: 'PROFESSIONAL' };
    }
    if (specific?.commissionPercent != null) {
      return { type: 'PERCENT', value: Number(specific.commissionPercent), source: 'PROFESSIONAL' };
    }
    if (service.commissionFixed != null) {
      return { type: 'FIXED', value: Number(service.commissionFixed), source: 'SERVICE' };
    }
    if (service.commissionPercent != null) {
      return { type: 'PERCENT', value: Number(service.commissionPercent), source: 'SERVICE' };
    }
    return { type: 'PERCENT', value: Number(employee.defaultCommission), source: 'EMPLOYEE' };
  }

  private validateCommission(percent?: number | null, fixed?: number | null) {
    if (percent != null && fixed != null) {
      throw new BadRequestException('Informe comissão percentual ou fixa, nunca ambas');
    }
  }

  private async findTenantService(id: string) {
    const service = await this.db.service.findFirst({
      where: { id, barbershopId: this.tenant.barbershopId, deletedAt: null },
      select: { id: true, commissionPercent: true, commissionFixed: true },
    });
    if (!service) throw new NotFoundException('Serviço não encontrado');
    return service;
  }

  private async findTenantServiceCategory(id: string) {
    const category = await this.db.serviceCategory.findFirst({
      where: { id, barbershopId: this.tenant.barbershopId, active: true },
      select: { id: true },
    });
    if (!category) throw new NotFoundException('Categoria não encontrada');
    return category;
  }

  async products() {
    const products = await this.db.product.findMany({
      where: { barbershopId: this.tenant.barbershopId, deletedAt: null },
      include: { category: true },
      orderBy: { name: 'asc' },
    });
    return products.map((product) => ({
      ...product,
      lowStock: product.stockQuantity <= product.minimumStock,
    }));
  }

  async createProduct(dto: CreateProductDto) {
    const name = dto.name.trim();
    if (name.length < 2) throw new BadRequestException('Informe um nome válido para o produto');
    const categoryId = dto.categoryId || null;
    if (categoryId) await this.findTenantProductCategory(categoryId);
    const sku = dto.sku?.trim() || null;
    const barcode = dto.barcode?.trim() || null;
    await this.validateProductCodes(sku, barcode);
    return this.db.product.create({
      data: {
        barbershopId: this.tenant.barbershopId,
        name,
        description: dto.description?.trim() || null,
        categoryId,
        sku,
        barcode,
        costPrice: dto.costPrice,
        salePrice: dto.salePrice,
        minimumStock: dto.minimumStock ?? 0,
        commissionPercent: dto.commissionPercent ?? null,
      },
      include: { category: true },
    });
  }

  async updateProduct(id: string, dto: UpdateProductDto) {
    const product = await this.findTenantProduct(id);
    const name = dto.name === undefined ? undefined : dto.name.trim();
    if (name !== undefined && name.length < 2) {
      throw new BadRequestException('Informe um nome válido para o produto');
    }
    if (dto.categoryId) await this.findTenantProductCategory(dto.categoryId);
    const sku = dto.sku === undefined ? undefined : dto.sku?.trim() || null;
    const barcode = dto.barcode === undefined ? undefined : dto.barcode?.trim() || null;
    await this.validateProductCodes(sku, barcode, product.id);
    return this.db.product.update({
      where: { id: product.id },
      data: {
        name,
        description: dto.description === undefined ? undefined : dto.description?.trim() || null,
        categoryId: dto.categoryId === undefined ? undefined : dto.categoryId || null,
        sku,
        barcode,
        costPrice: dto.costPrice,
        salePrice: dto.salePrice,
        minimumStock: dto.minimumStock,
        commissionPercent: dto.commissionPercent,
      },
      include: { category: true },
    });
  }

  async setProductStatus(id: string, active: boolean) {
    const product = await this.findTenantProduct(id);
    return this.db.product.update({ where: { id: product.id }, data: { active } });
  }

  async productDetails(id: string) {
    const product = await this.db.product.findFirst({
      where: { id, barbershopId: this.tenant.barbershopId, deletedAt: null },
      include: {
        category: true,
        movements: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
      },
    });
    if (!product) throw new NotFoundException('Produto não encontrado');
    return { ...product, lowStock: product.stockQuantity <= product.minimumStock };
  }

  productCategories() {
    return this.db.productCategory.findMany({
      where: { barbershopId: this.tenant.barbershopId, active: true },
      orderBy: { name: 'asc' },
    });
  }

  async createProductCategory(dto: CreateProductCategoryDto) {
    const name = dto.name.trim();
    if (name.length < 2) throw new BadRequestException('Informe um nome válido para a categoria');
    const duplicate = await this.db.productCategory.findFirst({
      where: {
        barbershopId: this.tenant.barbershopId,
        name: { equals: name, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('Esta categoria já existe');
    return this.db.productCategory.create({
      data: { barbershopId: this.tenant.barbershopId, name },
    });
  }

  async stockSettings() {
    const settings = await this.db.setting.findUnique({
      where: { barbershopId: this.tenant.barbershopId },
      select: { allowNegativeStock: true },
    });
    return { allowNegativeStock: settings?.allowNegativeStock ?? false };
  }

  async updateStockSettings(dto: UpdateStockSettingsDto) {
    return this.db.setting.upsert({
      where: { barbershopId: this.tenant.barbershopId },
      update: { allowNegativeStock: dto.allowNegativeStock },
      create: {
        barbershopId: this.tenant.barbershopId,
        allowNegativeStock: dto.allowNegativeStock,
      },
      select: { allowNegativeStock: true },
    });
  }

  async createInventoryMovement(productId: string, dto: CreateInventoryMovementDto) {
    if (dto.type === 'SALE') {
      throw new BadRequestException(
        'Baixas por venda são registradas pela finalização do atendimento',
      );
    }
    if (dto.type !== 'ADJUSTMENT' && dto.quantity < 1) {
      throw new BadRequestException(
        'A quantidade deve ser positiva para este tipo de movimentação',
      );
    }
    if ((dto.type === 'LOSS' || dto.type === 'ADJUSTMENT') && !dto.reason?.trim()) {
      throw new BadRequestException('Informe o motivo da movimentação');
    }
    const delta = dto.type === 'LOSS' ? -dto.quantity : dto.quantity;
    const barbershopId = this.tenant.barbershopId;
    try {
      return await this.db.$transaction(
        async (tx) => {
          const [product, settings] = await Promise.all([
            tx.product.findFirst({
              where: { id: productId, barbershopId, deletedAt: null },
              select: { id: true },
            }),
            tx.setting.findUnique({
              where: { barbershopId },
              select: { allowNegativeStock: true },
            }),
          ]);
          if (!product) throw new NotFoundException('Produto não encontrado');
          const allowNegativeStock = settings?.allowNegativeStock ?? false;
          const changed = await tx.product.updateMany({
            where: {
              id: product.id,
              barbershopId,
              ...(!allowNegativeStock && delta < 0 && { stockQuantity: { gte: -delta } }),
            },
            data: { stockQuantity: { increment: delta } },
          });
          if (!changed.count)
            throw new ConflictException('Estoque insuficiente para a movimentação');
          const movement = await tx.inventoryMovement.create({
            data: {
              barbershopId,
              productId: product.id,
              userId: this.tenant.userId,
              type: dto.type,
              quantity: delta,
              reason: dto.reason?.trim() || null,
            },
            include: { user: { select: { id: true, name: true } } },
          });
          const updatedProduct = await tx.product.findUniqueOrThrow({ where: { id: product.id } });
          return { movement, product: updatedProduct };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ConflictException('O estoque foi alterado por outra operação; tente novamente');
      }
      throw error;
    }
  }

  private async findTenantProduct(id: string) {
    const product = await this.db.product.findFirst({
      where: { id, barbershopId: this.tenant.barbershopId, deletedAt: null },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Produto não encontrado');
    return product;
  }

  private async findTenantProductCategory(id: string) {
    const category = await this.db.productCategory.findFirst({
      where: { id, barbershopId: this.tenant.barbershopId, active: true },
      select: { id: true },
    });
    if (!category) throw new NotFoundException('Categoria não encontrada');
    return category;
  }

  private async validateProductCodes(
    sku?: string | null,
    barcode?: string | null,
    exceptId?: string,
  ) {
    if (!sku && !barcode) return;
    const duplicate = await this.db.product.findFirst({
      where: {
        barbershopId: this.tenant.barbershopId,
        deletedAt: null,
        ...(exceptId && { id: { not: exceptId } }),
        OR: [...(sku ? [{ sku }] : []), ...(barcode ? [{ barcode }] : [])],
      },
      select: { sku: true, barcode: true },
    });
    if (sku && duplicate?.sku === sku) {
      throw new ConflictException('Já existe um produto com este SKU');
    }
    if (barcode && duplicate?.barcode === barcode) {
      throw new ConflictException('Já existe um produto com este código de barras');
    }
  }

  appointments(query: ListAppointmentsQuery) {
    const start = new Date(query.start);
    const end = new Date(query.end);
    if (end <= start)
      throw new BadRequestException('O fim do período deve ser posterior ao início');
    if (end.getTime() - start.getTime() > 93 * 86400000) {
      throw new BadRequestException('O período da agenda está limitado a 93 dias');
    }
    return this.db.appointment.findMany({
      where: {
        barbershopId: this.tenant.barbershopId,
        startAt: { gte: start, lt: end },
        ...(query.employeeId && { employeeId: query.employeeId }),
        ...(query.status && { status: query.status }),
      },
      include: {
        customer: true,
        employee: true,
        services: { include: { service: true } },
      },
      orderBy: { startAt: 'asc' },
    });
  }

  async appointmentOptions() {
    const barbershopId = this.tenant.barbershopId;
    const [customers, employees, services] = await Promise.all([
      this.db.customer.findMany({
        where: { barbershopId, deletedAt: null },
        select: { id: true, name: true, phone: true },
        orderBy: { name: 'asc' },
        take: 200,
      }),
      this.db.employee.findMany({
        where: { barbershopId, deletedAt: null, active: true },
        select: { id: true, name: true, color: true },
        orderBy: { name: 'asc' },
      }),
      this.db.service.findMany({
        where: { barbershopId, deletedAt: null, active: true },
        select: {
          id: true,
          name: true,
          price: true,
          durationMinutes: true,
          employeeServices: { select: { employeeId: true } },
        },
        orderBy: { name: 'asc' },
      }),
    ]);
    return { customers, employees, services };
  }

  async appointmentSlots(dto: AppointmentSlotsDto) {
    if (dto.appointmentId) await this.findTenantAppointment(dto.appointmentId);
    const details = await this.resolveAppointmentInput(undefined, dto.employeeId, dto.serviceIds);
    return this.availability.employeeSlots(
      dto.employeeId,
      {
        date: dto.date,
        durationMinutes: details.durationMinutes,
        stepMinutes: dto.stepMinutes,
      },
      dto.appointmentId,
    );
  }

  async createAppointment(dto: CreateAppointmentDto) {
    const details = await this.resolveAppointmentInput(
      dto.customerId,
      dto.employeeId,
      dto.serviceIds,
    );
    const startAt = new Date(dto.startAt);
    await this.availability.assertEmployeeAvailable(
      dto.employeeId,
      startAt,
      details.durationMinutes,
    );
    const endAt = new Date(startAt.getTime() + details.durationMinutes * 60000);
    try {
      return await this.db.$transaction(
        (tx) =>
          tx.appointment.create({
            data: {
              barbershopId: this.tenant.barbershopId,
              customerId: dto.customerId,
              employeeId: dto.employeeId,
              startAt,
              endAt,
              price: details.price,
              notes: dto.notes?.trim() || null,
              services: {
                create: details.services.map((service) => ({
                  barbershopId: this.tenant.barbershopId,
                  serviceId: service.id,
                  price: service.price,
                  durationMinutes: service.durationMinutes,
                })),
              },
            },
            include: this.appointmentInclude(),
          }),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowAppointmentConflict(error);
    }
  }

  async updateAppointment(id: string, dto: UpdateAppointmentDto) {
    const current = await this.db.appointment.findFirst({
      where: { id, barbershopId: this.tenant.barbershopId },
      include: { services: { select: { serviceId: true } } },
    });
    if (!current) throw new NotFoundException('Agendamento não encontrado');
    if (!['SCHEDULED', 'CONFIRMED'].includes(current.status)) {
      throw new BadRequestException('Somente agendamentos pendentes podem ser editados');
    }
    const customerId = dto.customerId ?? current.customerId;
    const employeeId = dto.employeeId ?? current.employeeId;
    const serviceIds = dto.serviceIds ?? current.services.map(({ serviceId }) => serviceId);
    const startAt = dto.startAt ? new Date(dto.startAt) : current.startAt;
    const details = await this.resolveAppointmentInput(customerId, employeeId, serviceIds);
    await this.availability.assertEmployeeAvailable(
      employeeId,
      startAt,
      details.durationMinutes,
      current.id,
    );
    const endAt = new Date(startAt.getTime() + details.durationMinutes * 60000);
    try {
      return await this.db.$transaction(
        async (tx) => {
          if (dto.serviceIds) {
            await tx.appointmentService.deleteMany({ where: { appointmentId: current.id } });
          }
          return tx.appointment.update({
            where: { id: current.id },
            data: {
              customerId,
              employeeId,
              startAt,
              endAt,
              price: details.price,
              notes: dto.notes === undefined ? undefined : dto.notes?.trim() || null,
              ...(dto.serviceIds && {
                services: {
                  create: details.services.map((service) => ({
                    barbershopId: this.tenant.barbershopId,
                    serviceId: service.id,
                    price: service.price,
                    durationMinutes: service.durationMinutes,
                  })),
                },
              }),
            },
            include: this.appointmentInclude(),
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowAppointmentConflict(error);
    }
  }

  async confirmAppointment(id: string) {
    return this.changeAppointmentStatus(id, ['SCHEDULED'], 'CONFIRMED');
  }

  async cancelAppointment(id: string, dto: CancelAppointmentDto) {
    const appointment = await this.findTenantAppointment(id);
    if (!['SCHEDULED', 'CONFIRMED'].includes(appointment.status)) {
      throw new BadRequestException('Este agendamento não pode ser cancelado');
    }
    return this.db.appointment.update({
      where: { id: appointment.id },
      data: {
        status: 'CANCELLED',
        cancellationReason: dto.reason.trim(),
        cancelledAt: new Date(),
      },
      include: this.appointmentInclude(),
    });
  }

  async markAppointmentNoShow(id: string) {
    return this.changeAppointmentStatus(id, ['SCHEDULED', 'CONFIRMED'], 'NO_SHOW');
  }

  private async changeAppointmentStatus(
    id: string,
    allowed: string[],
    status: 'CONFIRMED' | 'NO_SHOW',
  ) {
    const appointment = await this.findTenantAppointment(id);
    if (!allowed.includes(appointment.status)) {
      throw new BadRequestException('Transição de status inválida');
    }
    return this.db.appointment.update({
      where: { id: appointment.id },
      data: { status },
      include: this.appointmentInclude(),
    });
  }

  private async findTenantAppointment(id: string) {
    const appointment = await this.db.appointment.findFirst({
      where: { id, barbershopId: this.tenant.barbershopId },
      select: { id: true, status: true },
    });
    if (!appointment) throw new NotFoundException('Agendamento não encontrado');
    return appointment;
  }

  private async resolveAppointmentInput(
    customerId: string | undefined,
    employeeId: string,
    serviceIds: string[],
  ) {
    const barbershopId = this.tenant.barbershopId;
    const [customer, employee, services] = await Promise.all([
      customerId
        ? this.db.customer.findFirst({
            where: { id: customerId, barbershopId, deletedAt: null },
            select: { id: true },
          })
        : Promise.resolve({ id: '' }),
      this.db.employee.findFirst({
        where: { id: employeeId, barbershopId, deletedAt: null, active: true },
        select: { id: true },
      }),
      this.db.service.findMany({
        where: {
          id: { in: serviceIds },
          barbershopId,
          deletedAt: null,
          active: true,
          employeeServices: { some: { employeeId } },
        },
        select: { id: true, price: true, durationMinutes: true },
      }),
    ]);
    if (!customer) throw new NotFoundException('Cliente não encontrado');
    if (!employee) throw new NotFoundException('Profissional não encontrado');
    if (services.length !== serviceIds.length) {
      throw new BadRequestException(
        'Um ou mais serviços não estão habilitados para o profissional',
      );
    }
    return {
      services,
      durationMinutes: services.reduce((sum, service) => sum + service.durationMinutes, 0),
      price: services.reduce((sum, service) => sum + Number(service.price), 0),
    };
  }

  private appointmentInclude() {
    return {
      customer: true,
      employee: true,
      services: { include: { service: true } },
    } satisfies Prisma.AppointmentInclude;
  }

  private rethrowAppointmentConflict(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ['P2004', 'P2034'].includes(error.code)
    ) {
      throw new ConflictException('O profissional já possui um agendamento neste horário');
    }
    if (
      error instanceof Prisma.PrismaClientUnknownRequestError &&
      (error.message.includes('23P01') ||
        error.message.includes('40P01') ||
        error.message.includes('deadlock detected') ||
        error.message.includes('Appointment_active_time_exclusion'))
    ) {
      throw new ConflictException('O profissional já possui um agendamento neste horário');
    }
    throw error;
  }

  async sales() {
    return this.db.sale.findMany({
      where: { barbershopId: this.tenant.barbershopId },
      include: this.saleInclude(),
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async saleOptions() {
    const barbershopId = this.tenant.barbershopId;
    const [customers, employees, services, products, appointments] = await Promise.all([
      this.db.customer.findMany({
        where: { barbershopId, deletedAt: null },
        select: { id: true, name: true, phone: true },
        orderBy: { name: 'asc' },
        take: 200,
      }),
      this.db.employee.findMany({
        where: { barbershopId, deletedAt: null, active: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.db.service.findMany({
        where: { barbershopId, deletedAt: null, active: true },
        select: { id: true, name: true, price: true },
        orderBy: { name: 'asc' },
      }),
      this.db.product.findMany({
        where: { barbershopId, deletedAt: null, active: true },
        select: { id: true, name: true, salePrice: true, stockQuantity: true },
        orderBy: { name: 'asc' },
      }),
      this.db.appointment.findMany({
        where: {
          barbershopId,
          status: { in: ['SCHEDULED', 'CONFIRMED'] },
          sale: null,
        },
        select: {
          id: true,
          startAt: true,
          customer: { select: { name: true } },
          employee: { select: { name: true } },
        },
        orderBy: { startAt: 'asc' },
        take: 100,
      }),
    ]);
    return { customers, employees, services, products, appointments };
  }

  async saleDetails(id: string) {
    const sale = await this.db.sale.findFirst({
      where: { id, barbershopId: this.tenant.barbershopId },
      include: this.saleInclude(),
    });
    if (!sale) throw new NotFoundException('Atendimento nÃ£o encontrado');
    return sale;
  }

  async startSaleFromAppointment(appointmentId: string) {
    const barbershopId = this.tenant.barbershopId;
    try {
      return await this.db.$transaction(
        async (tx) => {
          const appointment = await tx.appointment.findFirst({
            where: { id: appointmentId, barbershopId },
            include: { services: { include: { service: true } }, sale: true },
          });
          if (!appointment) throw new NotFoundException('Agendamento nÃ£o encontrado');
          if (appointment.sale) {
            if (appointment.sale.status === 'DRAFT') return this.saleById(tx, appointment.sale.id);
            throw new ConflictException('Este agendamento jÃ¡ possui uma venda finalizada');
          }
          if (!['SCHEDULED', 'CONFIRMED'].includes(appointment.status)) {
            throw new BadRequestException('Este agendamento nÃ£o pode iniciar atendimento');
          }
          const subtotal = appointment.services.reduce(
            (sum, item) => sum + this.moneyToCents(item.price),
            0,
          );
          const sale = await tx.sale.create({
            data: {
              barbershopId,
              appointmentId: appointment.id,
              customerId: appointment.customerId,
              employeeId: appointment.employeeId,
              subtotal: subtotal / 100,
              total: subtotal / 100,
              status: 'DRAFT',
              items: {
                create: appointment.services.map((item) => ({
                  barbershopId,
                  serviceId: item.serviceId,
                  description: item.service.name,
                  quantity: 1,
                  unitPrice: item.price,
                  total: item.price,
                })),
              },
            },
          });
          await tx.appointment.update({
            where: { id: appointment.id },
            data: { status: 'IN_SERVICE' },
          });
          return this.saleById(tx, sale.id);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowSaleConflict(error);
    }
  }

  async createWalkInSale(dto: CreateWalkInSaleDto) {
    const barbershopId = this.tenant.barbershopId;
    const [employee, customer] = await Promise.all([
      this.db.employee.findFirst({
        where: { id: dto.employeeId, barbershopId, active: true, deletedAt: null },
        select: { id: true },
      }),
      dto.customerId
        ? this.db.customer.findFirst({
            where: { id: dto.customerId, barbershopId, deletedAt: null },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);
    if (!employee) throw new NotFoundException('Profissional nÃ£o encontrado');
    if (dto.customerId && !customer) throw new NotFoundException('Cliente nÃ£o encontrado');
    return this.db.sale.create({
      data: {
        barbershopId,
        customerId: customer?.id ?? null,
        employeeId: employee.id,
        subtotal: 0,
        total: 0,
        status: 'DRAFT',
      },
      include: this.saleInclude(),
    });
  }

  async addSaleServiceItem(saleId: string, dto: AddSaleServiceItemDto) {
    return this.db.$transaction(async (tx) => {
      const sale = await this.findDraftSale(tx, saleId);
      const service = await tx.service.findFirst({
        where: {
          id: dto.serviceId,
          barbershopId: this.tenant.barbershopId,
          active: true,
          deletedAt: null,
          employeeServices: { some: { employeeId: sale.employeeId! } },
        },
      });
      if (!service) throw new NotFoundException('ServiÃ§o indisponÃ­vel para o profissional');
      await tx.saleItem.create({
        data: {
          barbershopId: this.tenant.barbershopId,
          saleId,
          serviceId: service.id,
          description: service.name,
          quantity: dto.quantity,
          unitPrice: service.price,
          total: (this.moneyToCents(service.price) * dto.quantity) / 100,
        },
      });
      return this.recalculateSale(tx, saleId);
    });
  }

  async addSaleProductItem(saleId: string, dto: AddSaleProductItemDto) {
    return this.db.$transaction(async (tx) => {
      await this.findDraftSale(tx, saleId);
      const product = await tx.product.findFirst({
        where: {
          id: dto.productId,
          barbershopId: this.tenant.barbershopId,
          active: true,
          deletedAt: null,
        },
      });
      if (!product) throw new NotFoundException('Produto nÃ£o encontrado');
      await tx.saleItem.create({
        data: {
          barbershopId: this.tenant.barbershopId,
          saleId,
          productId: product.id,
          description: product.name,
          quantity: dto.quantity,
          unitPrice: product.salePrice,
          total: (this.moneyToCents(product.salePrice) * dto.quantity) / 100,
        },
      });
      return this.recalculateSale(tx, saleId);
    });
  }

  async removeSaleItem(saleId: string, itemId: string) {
    return this.db.$transaction(async (tx) => {
      await this.findDraftSale(tx, saleId);
      const removed = await tx.saleItem.deleteMany({
        where: { id: itemId, saleId, barbershopId: this.tenant.barbershopId },
      });
      if (!removed.count) throw new NotFoundException('Item nÃ£o encontrado');
      return this.recalculateSale(tx, saleId);
    });
  }

  async applySaleDiscount(saleId: string, dto: ApplySaleDiscountDto) {
    return this.db.$transaction(async (tx) => {
      const sale = await this.findDraftSale(tx, saleId);
      const discount = this.moneyToCents(dto.amount);
      const subtotal = this.moneyToCents(sale.subtotal);
      if (discount > subtotal)
        throw new BadRequestException('O desconto nÃ£o pode superar o subtotal');
      await tx.sale.update({
        where: { id: sale.id },
        data: {
          discount: discount / 100,
          total: (subtotal - discount) / 100,
          discountReason: dto.reason.trim(),
        },
      });
      return this.saleById(tx, sale.id);
    });
  }

  async finalizeSale(saleId: string, dto: FinalizeSaleDto) {
    const barbershopId = this.tenant.barbershopId;
    try {
      return await this.db.$transaction(
        async (tx) => {
          const sale = await tx.sale.findFirst({
            where: { id: saleId, barbershopId },
            include: {
              items: { include: { service: true, product: true } },
              employee: true,
            },
          });
          if (!sale) throw new NotFoundException('Atendimento nÃ£o encontrado');
          if (sale.status !== 'DRAFT') throw new ConflictException('Atendimento jÃ¡ finalizado');
          if (!sale.employee) throw new BadRequestException('Informe o profissional da venda');
          if (!sale.items.length) throw new BadRequestException('Adicione ao menos um item');

          const subtotal = sale.items.reduce((sum, item) => sum + this.moneyToCents(item.total), 0);
          const discount = this.moneyToCents(sale.discount);
          if (discount > subtotal) throw new BadRequestException('Desconto invÃ¡lido');
          const total = subtotal - discount;
          const paid = dto.payments.reduce(
            (sum, payment) => sum + this.moneyToCents(payment.amount),
            0,
          );
          if (paid !== total) {
            throw new BadRequestException('A soma dos pagamentos deve ser igual ao total da venda');
          }

          const settings = await tx.setting.findUnique({
            where: { barbershopId },
            select: { allowNegativeStock: true },
          });
          for (const item of sale.items.filter((entry) => entry.productId)) {
            const changed = await tx.product.updateMany({
              where: {
                id: item.productId!,
                barbershopId,
                ...(!(settings?.allowNegativeStock ?? false) && {
                  stockQuantity: { gte: item.quantity },
                }),
              },
              data: { stockQuantity: { decrement: item.quantity } },
            });
            if (!changed.count) {
              throw new ConflictException(`Estoque insuficiente para ${item.description}`);
            }
            await tx.inventoryMovement.create({
              data: {
                barbershopId,
                productId: item.productId!,
                userId: this.tenant.userId,
                saleId: sale.id,
                type: 'SALE',
                quantity: -item.quantity,
                reason: `Venda ${sale.id}`,
              },
            });
          }

          await this.lockCashFlow(tx);
          const openRegister = await tx.cashRegister.findFirst({
            where: { barbershopId, closedAt: null },
            orderBy: { openedAt: 'desc' },
            select: { id: true },
          });
          await tx.payment.createMany({
            data: dto.payments.map((payment) => ({
              barbershopId,
              saleId: sale.id,
              method: payment.method,
              amount: this.moneyToCents(payment.amount) / 100,
            })),
          });
          await tx.financialTransaction.createMany({
            data: dto.payments.map((payment) => ({
              barbershopId,
              cashRegisterId: openRegister?.id ?? null,
              saleId: sale.id,
              type: 'INCOME',
              origin: 'SALE',
              category: 'Vendas',
              description: `Venda ${sale.id}`,
              amount: this.moneyToCents(payment.amount) / 100,
              method: payment.method,
              status: 'PAID',
              paidAt: new Date(),
            })),
          });

          const commission = await this.calculateSaleCommission(tx, sale);
          if (commission.cents > 0) {
            await tx.commission.upsert({
              where: {
                saleId_employeeId: { saleId: sale.id, employeeId: sale.employee.id },
              },
              update: {
                amount: commission.cents / 100,
                percentage: commission.percentage,
                calculation: commission.breakdown,
              },
              create: {
                barbershopId,
                saleId: sale.id,
                employeeId: sale.employee.id,
                amount: commission.cents / 100,
                percentage: commission.percentage,
                calculation: commission.breakdown,
              },
            });
          }
          if (sale.appointmentId) {
            await tx.appointment.update({
              where: { id: sale.appointmentId },
              data: { status: 'COMPLETED' },
            });
          }
          await tx.sale.update({
            where: { id: sale.id },
            data: {
              subtotal: subtotal / 100,
              total: total / 100,
              status: 'COMPLETED',
              completedAt: new Date(),
            },
          });
          return this.saleById(tx, sale.id);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.rethrowSaleConflict(error);
    }
  }

  private async calculateSaleCommission(
    tx: Prisma.TransactionClient,
    sale: Prisma.SaleGetPayload<{
      include: { items: { include: { service: true; product: true } }; employee: true };
    }>,
  ) {
    let cents = 0;
    const breakdown: Array<{
      saleItemId: string;
      itemType: 'SERVICE' | 'PRODUCT';
      description: string;
      baseAmount: number;
      ruleType: 'FIXED' | 'PERCENT';
      ruleValue: number;
      source: 'PROFESSIONAL' | 'SERVICE' | 'PRODUCT' | 'EMPLOYEE';
      amount: number;
    }> = [];
    for (const item of sale.items) {
      const itemCents = this.moneyToCents(item.total);
      let ruleType: 'FIXED' | 'PERCENT' = 'PERCENT';
      let ruleValue = 0;
      let source: 'PROFESSIONAL' | 'SERVICE' | 'PRODUCT' | 'EMPLOYEE' = 'EMPLOYEE';
      let itemCommission = 0;
      if (item.serviceId && item.service) {
        const specific = await tx.employeeService.findUnique({
          where: {
            employeeId_serviceId: {
              employeeId: sale.employee!.id,
              serviceId: item.serviceId,
            },
          },
        });
        if (specific?.commissionFixed != null) {
          ruleType = 'FIXED';
          ruleValue = Number(specific.commissionFixed);
          source = 'PROFESSIONAL';
          itemCommission = this.moneyToCents(specific.commissionFixed) * item.quantity;
        } else if (specific?.commissionPercent != null) {
          ruleValue = Number(specific.commissionPercent);
          source = 'PROFESSIONAL';
          itemCommission = Math.round((itemCents * ruleValue) / 100);
        } else if (item.service.commissionFixed != null) {
          ruleType = 'FIXED';
          ruleValue = Number(item.service.commissionFixed);
          source = 'SERVICE';
          itemCommission = this.moneyToCents(item.service.commissionFixed) * item.quantity;
        } else {
          const percent = item.service.commissionPercent ?? sale.employee!.defaultCommission;
          ruleValue = Number(percent);
          source = item.service.commissionPercent != null ? 'SERVICE' : 'EMPLOYEE';
          itemCommission = Math.round((itemCents * ruleValue) / 100);
        }
      } else if (item.product) {
        const percent = item.product.commissionPercent ?? sale.employee!.defaultCommission;
        ruleValue = Number(percent);
        source = item.product.commissionPercent != null ? 'PRODUCT' : 'EMPLOYEE';
        itemCommission = Math.round((itemCents * ruleValue) / 100);
      }
      cents += itemCommission;
      breakdown.push({
        saleItemId: item.id,
        itemType: item.serviceId ? 'SERVICE' : 'PRODUCT',
        description: item.description,
        baseAmount: itemCents / 100,
        ruleType,
        ruleValue,
        source,
        amount: itemCommission / 100,
      });
    }
    const percentages = breakdown
      .filter((entry) => entry.ruleType === 'PERCENT')
      .map((entry) => entry.ruleValue);
    const percentage =
      percentages.length === breakdown.length && new Set(percentages).size === 1
        ? percentages[0]
        : null;
    return { cents, percentage, breakdown };
  }

  private async recalculateSale(tx: Prisma.TransactionClient, saleId: string) {
    const sale = await this.findDraftSale(tx, saleId);
    const totals = await tx.saleItem.aggregate({ where: { saleId }, _sum: { total: true } });
    const subtotal = this.moneyToCents(totals._sum.total ?? 0);
    const discount = Math.min(this.moneyToCents(sale.discount), subtotal);
    await tx.sale.update({
      where: { id: sale.id },
      data: {
        subtotal: subtotal / 100,
        discount: discount / 100,
        total: (subtotal - discount) / 100,
        ...(discount === 0 && { discountReason: null }),
      },
    });
    return this.saleById(tx, sale.id);
  }

  private async findDraftSale(tx: Prisma.TransactionClient, id: string) {
    const sale = await tx.sale.findFirst({
      where: { id, barbershopId: this.tenant.barbershopId },
    });
    if (!sale) throw new NotFoundException('Atendimento nÃ£o encontrado');
    if (sale.status !== 'DRAFT') throw new ConflictException('Atendimento jÃ¡ finalizado');
    return sale;
  }

  private saleById(tx: Prisma.TransactionClient, id: string) {
    return tx.sale.findUniqueOrThrow({ where: { id }, include: this.saleInclude() });
  }

  private saleInclude() {
    return {
      customer: true,
      employee: true,
      appointment: true,
      items: {
        include: { service: true, product: true },
        orderBy: { description: 'asc' as const },
      },
      payments: { orderBy: { createdAt: 'asc' as const } },
      commissions: true,
    } satisfies Prisma.SaleInclude;
  }

  private moneyToCents(value: Prisma.Decimal | number | string) {
    return Math.round(Number(value) * 100);
  }

  private rethrowSaleConflict(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') throw new ConflictException('Este atendimento jÃ¡ foi iniciado');
      if (error.code === 'P2034') {
        throw new ConflictException('A venda foi alterada por outra operaÃ§Ã£o; tente novamente');
      }
    }
    throw error;
  }

  async commissions(query: ListCommissionsQuery = new ListCommissionsQuery()) {
    const { where, start, end } = this.commissionWhere(query);
    const page = query.page || 1;
    const limit = query.limit || 25;
    const [items, total, aggregate, sales, employees] = await Promise.all([
      this.db.commission.findMany({
        where,
        include: {
          employee: { select: { id: true, name: true, color: true } },
          sale: {
            select: {
              id: true,
              total: true,
              completedAt: true,
              customer: { select: { id: true, name: true } },
              items: { select: { id: true, description: true, quantity: true, total: true } },
            },
          },
          paidBy: { select: { id: true, name: true } },
          financialTransaction: { select: { id: true, amount: true, createdAt: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.commission.count({ where }),
      this.db.commission.aggregate({ where, _sum: { amount: true } }),
      this.db.sale.aggregate({
        where: {
          barbershopId: this.tenant.barbershopId,
          status: 'COMPLETED',
          ...(query.employeeId && { employeeId: query.employeeId }),
          completedAt: { gte: start, lte: end },
          ...(query.status && { commissions: { some: { status: query.status } } }),
        },
        _sum: { total: true },
        _count: { _all: true },
      }),
      this.db.employee.findMany({
        where: { barbershopId: this.tenant.barbershopId, deletedAt: null },
        select: { id: true, name: true, color: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    return {
      items,
      employees,
      summary: {
        sold: Number(sales._sum.total ?? 0),
        commission: Number(aggregate._sum.amount ?? 0),
        attendances: sales._count._all,
      },
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    };
  }

  async adjustCommission(id: string, dto: AdjustCommissionDto) {
    return this.db.$transaction(async (tx) => {
      const commission = await tx.commission.findFirst({
        where: { id, barbershopId: this.tenant.barbershopId },
      });
      if (!commission) throw new NotFoundException('Comissão não encontrada');
      if (commission.status !== 'PENDING') {
        throw new ConflictException('Somente comissões pendentes podem ser ajustadas');
      }
      const amount = this.moneyToCents(dto.amount) / 100;
      const updated = await tx.commission.update({
        where: { id: commission.id },
        data: { amount, percentage: null, notes: dto.reason.trim() },
        include: { employee: true, sale: true },
      });
      await tx.auditLog.create({
        data: {
          barbershopId: this.tenant.barbershopId,
          userId: this.tenant.userId,
          action: 'COMMISSION_ADJUSTED',
          entity: 'Commission',
          entityId: commission.id,
          before: { amount: Number(commission.amount), notes: commission.notes },
          after: { amount, reason: dto.reason.trim() },
        },
      });
      return updated;
    });
  }

  payCommissions(dto: PayCommissionsDto) {
    const barbershopId = this.tenant.barbershopId;
    return this.db.$transaction(
      async (tx) => {
        const commissions = await tx.commission.findMany({
          where: { id: { in: dto.commissionIds }, barbershopId, status: 'PENDING' },
          include: { employee: { select: { name: true } } },
        });
        if (commissions.length !== dto.commissionIds.length) {
          throw new ConflictException('Uma ou mais comissões não existem ou já foram pagas');
        }
        const totalCents = commissions.reduce(
          (sum, commission) => sum + this.moneyToCents(commission.amount),
          0,
        );
        if (totalCents <= 0)
          throw new BadRequestException('O total do pagamento deve ser positivo');
        await this.lockCashFlow(tx);
        const openRegister = await tx.cashRegister.findFirst({
          where: { barbershopId, closedAt: null },
          orderBy: { openedAt: 'desc' },
          select: { id: true },
        });
        const transaction = await tx.financialTransaction.create({
          data: {
            barbershopId,
            cashRegisterId: openRegister?.id ?? null,
            type: 'EXPENSE',
            origin: 'COMMISSION',
            category: 'Comissões',
            description: `Pagamento de ${commissions.length} comissão(ões)`,
            amount: totalCents / 100,
            method: dto.method,
            status: 'PAID',
            paidAt: new Date(),
            notes: dto.notes?.trim() || null,
          },
        });
        const paidAt = new Date();
        const updated = await tx.commission.updateMany({
          where: { id: { in: dto.commissionIds }, barbershopId, status: 'PENDING' },
          data: {
            status: 'PAID',
            paidAt,
            paidById: this.tenant.userId,
            paymentMethod: dto.method,
            financialTransactionId: transaction.id,
            notes: dto.notes?.trim() || undefined,
          },
        });
        if (updated.count !== commissions.length) {
          throw new ConflictException('As comissões foram alteradas por outra operação');
        }
        await tx.auditLog.create({
          data: {
            barbershopId,
            userId: this.tenant.userId,
            action: 'COMMISSIONS_PAID',
            entity: 'Commission',
            before: {
              commissionIds: commissions.map((commission) => commission.id),
              status: 'PENDING',
            },
            after: {
              status: 'PAID',
              total: totalCents / 100,
              method: dto.method,
              notes: dto.notes?.trim() || null,
              financialTransactionId: transaction.id,
            },
          },
        });
        const paid = await tx.commission.findMany({
          where: { id: { in: dto.commissionIds }, barbershopId },
          include: {
            employee: { select: { id: true, name: true } },
            paidBy: { select: { id: true, name: true } },
          },
        });
        return { transaction, commissions: paid };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private commissionWhere(query: ListCommissionsQuery) {
    const now = new Date();
    const start = query.start
      ? new Date(query.start)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = query.end ? new Date(query.end) : now;
    if (start >= end) throw new BadRequestException('O período informado é inválido');
    if (end.getTime() - start.getTime() > 370 * 86400000) {
      throw new BadRequestException('O período está limitado a 370 dias');
    }
    return {
      start,
      end,
      where: {
        barbershopId: this.tenant.barbershopId,
        ...(query.employeeId && { employeeId: query.employeeId }),
        ...(query.status && { status: query.status }),
        createdAt: { gte: start, lte: end },
      } satisfies Prisma.CommissionWhereInput,
    };
  }

  async cashRegisterOverview() {
    const register = await this.db.cashRegister.findFirst({
      where: { barbershopId: this.tenant.barbershopId, closedAt: null },
      include: {
        openedBy: { select: { id: true, name: true } },
        transactions: {
          include: { cancelledBy: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { openedAt: 'desc' },
    });
    if (!register) return { register: null, summary: this.financialSummary(0, []) };
    return {
      register,
      summary: this.financialSummary(Number(register.openingBalance), register.transactions),
    };
  }

  async cashRegisters(query: ListCashRegistersQuery = new ListCashRegistersQuery()) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const where: Prisma.CashRegisterWhereInput = { barbershopId: this.tenant.barbershopId };
    const [items, total] = await Promise.all([
      this.db.cashRegister.findMany({
        where,
        include: {
          openedBy: { select: { id: true, name: true } },
          closedBy: { select: { id: true, name: true } },
          transactions: {
            where: { status: 'PAID' },
            select: { type: true, amount: true, method: true },
          },
        },
        orderBy: { openedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.cashRegister.count({ where }),
    ]);
    return {
      items: items.map((register) => ({
        ...register,
        summary: this.financialSummary(Number(register.openingBalance), register.transactions),
      })),
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    };
  }

  openCashRegister(dto: OpenCashRegisterDto) {
    const barbershopId = this.tenant.barbershopId;
    return this.db.$transaction(
      async (tx) => {
        await this.lockCashFlow(tx);
        const setting = await tx.setting.findUnique({
          where: { barbershopId },
          select: { allowMultipleOpenCashRegisters: true },
        });
        if (!setting?.allowMultipleOpenCashRegisters) {
          const existing = await tx.cashRegister.findFirst({
            where: { barbershopId, closedAt: null },
            select: { id: true },
          });
          if (existing) throw new ConflictException('Já existe um caixa aberto');
        }
        const register = await tx.cashRegister.create({
          data: {
            barbershopId,
            openedById: this.tenant.userId,
            openingBalance: this.moneyToCents(dto.openingBalance) / 100,
          },
          include: { openedBy: { select: { id: true, name: true } } },
        });
        await tx.auditLog.create({
          data: {
            barbershopId,
            userId: this.tenant.userId,
            action: 'CASH_REGISTER_OPENED',
            entity: 'CashRegister',
            entityId: register.id,
            after: { openingBalance: Number(register.openingBalance) },
          },
        });
        return register;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  createFinancialTransaction(cashRegisterId: string, dto: CreateFinancialTransactionDto) {
    const barbershopId = this.tenant.barbershopId;
    return this.db.$transaction(async (tx) => {
      await this.lockCashFlow(tx);
      const register = await tx.cashRegister.findFirst({
        where: { id: cashRegisterId, barbershopId, closedAt: null },
        select: { id: true },
      });
      if (!register) throw new NotFoundException('Caixa aberto não encontrado');
      const transaction = await tx.financialTransaction.create({
        data: {
          barbershopId,
          cashRegisterId: register.id,
          origin: 'MANUAL',
          type: dto.type,
          category: dto.category.trim(),
          description: dto.description.trim(),
          amount: this.moneyToCents(dto.amount) / 100,
          method: dto.method,
          status: 'PAID',
          paidAt: new Date(),
          notes: dto.notes?.trim() || null,
        },
      });
      await tx.auditLog.create({
        data: {
          barbershopId,
          userId: this.tenant.userId,
          action: 'FINANCIAL_TRANSACTION_CREATED',
          entity: 'FinancialTransaction',
          entityId: transaction.id,
          after: this.transactionAuditValue(transaction),
        },
      });
      return transaction;
    });
  }

  updateFinancialTransaction(id: string, dto: UpdateFinancialTransactionDto) {
    const barbershopId = this.tenant.barbershopId;
    return this.db.$transaction(async (tx) => {
      await this.lockCashFlow(tx);
      const transaction = await tx.financialTransaction.findFirst({
        where: {
          id,
          barbershopId,
          origin: 'MANUAL',
          status: 'PAID',
          cashRegister: { closedAt: null },
        },
      });
      if (!transaction) {
        throw new NotFoundException('Lançamento manual de caixa aberto não encontrado');
      }
      const updated = await tx.financialTransaction.update({
        where: { id: transaction.id },
        data: {
          type: dto.type,
          category: dto.category?.trim(),
          description: dto.description?.trim(),
          amount: dto.amount === undefined ? undefined : this.moneyToCents(dto.amount) / 100,
          method: dto.method,
          notes: dto.notes === undefined ? undefined : dto.notes?.trim() || null,
        },
      });
      await tx.auditLog.create({
        data: {
          barbershopId,
          userId: this.tenant.userId,
          action: 'FINANCIAL_TRANSACTION_UPDATED',
          entity: 'FinancialTransaction',
          entityId: transaction.id,
          before: this.transactionAuditValue(transaction),
          after: this.transactionAuditValue(updated),
        },
      });
      return updated;
    });
  }

  cancelFinancialTransaction(id: string, dto: CancelFinancialTransactionDto) {
    const barbershopId = this.tenant.barbershopId;
    return this.db.$transaction(async (tx) => {
      await this.lockCashFlow(tx);
      const transaction = await tx.financialTransaction.findFirst({
        where: {
          id,
          barbershopId,
          origin: 'MANUAL',
          status: 'PAID',
          cashRegister: { closedAt: null },
        },
      });
      if (!transaction) {
        throw new NotFoundException('Lançamento manual de caixa aberto não encontrado');
      }
      const updated = await tx.financialTransaction.update({
        where: { id: transaction.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledById: this.tenant.userId,
          cancellationReason: dto.reason.trim(),
        },
      });
      await tx.auditLog.create({
        data: {
          barbershopId,
          userId: this.tenant.userId,
          action: 'FINANCIAL_TRANSACTION_CANCELLED',
          entity: 'FinancialTransaction',
          entityId: transaction.id,
          before: this.transactionAuditValue(transaction),
          after: { ...this.transactionAuditValue(updated), reason: dto.reason.trim() },
        },
      });
      return updated;
    });
  }

  closeCashRegister(id: string, dto: CloseCashRegisterDto) {
    const barbershopId = this.tenant.barbershopId;
    return this.db.$transaction(
      async (tx) => {
        await this.lockCashFlow(tx);
        const register = await tx.cashRegister.findFirst({
          where: { id, barbershopId },
        });
        if (!register) throw new NotFoundException('Caixa não encontrado');
        if (register.closedAt) throw new ConflictException('Este caixa já foi fechado');
        const transactions = await tx.financialTransaction.findMany({
          where: { barbershopId, cashRegisterId: register.id, status: 'PAID' },
          select: { type: true, amount: true, method: true },
        });
        const summary = this.financialSummary(Number(register.openingBalance), transactions);
        const closingBalance = this.moneyToCents(dto.closingBalance) / 100;
        const closedAt = new Date();
        const updated = await tx.cashRegister.update({
          where: { id: register.id },
          data: {
            closingBalance,
            expectedBalance: summary.expectedBalance,
            difference:
              (this.moneyToCents(closingBalance) - this.moneyToCents(summary.expectedBalance)) /
              100,
            closingNotes: dto.notes?.trim() || null,
            closedAt,
            closedById: this.tenant.userId,
          },
          include: {
            openedBy: { select: { id: true, name: true } },
            closedBy: { select: { id: true, name: true } },
          },
        });
        await tx.auditLog.create({
          data: {
            barbershopId,
            userId: this.tenant.userId,
            action: 'CASH_REGISTER_CLOSED',
            entity: 'CashRegister',
            entityId: register.id,
            before: {
              openedAt: register.openedAt,
              openingBalance: Number(register.openingBalance),
            },
            after: {
              closedAt,
              closingBalance,
              expectedBalance: summary.expectedBalance,
              difference:
                (this.moneyToCents(closingBalance) - this.moneyToCents(summary.expectedBalance)) /
                100,
            },
          },
        });
        return { ...updated, summary };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private financialSummary(
    openingBalance: number,
    transactions: Array<{
      type: string;
      amount: Prisma.Decimal | number;
      method?: string | null;
      status?: string;
    }>,
  ) {
    const paid = transactions.filter(
      (transaction) => !transaction.status || transaction.status === 'PAID',
    );
    const incomeCents = paid
      .filter((transaction) => transaction.type === 'INCOME')
      .reduce((sum, transaction) => sum + this.moneyToCents(transaction.amount), 0);
    const expenseCents = paid
      .filter((transaction) => transaction.type === 'EXPENSE')
      .reduce((sum, transaction) => sum + this.moneyToCents(transaction.amount), 0);
    const methods: Record<string, { income: number; expense: number; net: number }> = {};
    for (const transaction of paid) {
      const method = transaction.method || 'OTHER';
      methods[method] ||= { income: 0, expense: 0, net: 0 };
      const amount = this.moneyToCents(transaction.amount) / 100;
      if (transaction.type === 'INCOME') methods[method].income += amount;
      else methods[method].expense += amount;
      methods[method].net = methods[method].income - methods[method].expense;
    }
    return {
      openingBalance,
      income: incomeCents / 100,
      expense: expenseCents / 100,
      expectedBalance: (this.moneyToCents(openingBalance) + incomeCents - expenseCents) / 100,
      methods,
    };
  }

  private async lockCashFlow(tx: Prisma.TransactionClient) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${this.tenant.barbershopId}))`;
  }

  private transactionAuditValue(transaction: {
    type: unknown;
    category: string;
    description: string;
    amount: Prisma.Decimal | number;
    method?: unknown;
    status: unknown;
    notes?: string | null;
  }) {
    return {
      type: String(transaction.type),
      category: transaction.category,
      description: transaction.description,
      amount: Number(transaction.amount),
      method: transaction.method ? String(transaction.method) : null,
      status: String(transaction.status),
      notes: transaction.notes || null,
    };
  }

  suppliers() {
    return this.db.supplier.findMany({
      where: { barbershopId: this.tenant.barbershopId },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
  }

  async createSupplier(dto: CreateSupplierDto) {
    const barbershopId = this.tenant.barbershopId;
    const document = dto.document?.replace(/\D/g, '') || null;
    if (document) {
      const duplicate = await this.db.supplier.findFirst({
        where: { barbershopId, document },
        select: { id: true },
      });
      if (duplicate) throw new ConflictException('Já existe um fornecedor com este documento');
    }
    return this.db.supplier.create({
      data: {
        barbershopId,
        name: dto.name.trim(),
        document,
        contactName: dto.contactName?.trim() || null,
        phone: dto.phone?.replace(/\D/g, '') || null,
        email: dto.email?.trim().toLowerCase() || null,
        notes: dto.notes?.trim() || null,
      },
    });
  }

  async updateSupplier(id: string, dto: UpdateSupplierDto) {
    const barbershopId = this.tenant.barbershopId;
    const supplier = await this.db.supplier.findFirst({ where: { id, barbershopId } });
    if (!supplier) throw new NotFoundException('Fornecedor não encontrado');
    const document =
      dto.document === undefined ? undefined : dto.document?.replace(/\D/g, '') || null;
    if (document) {
      const duplicate = await this.db.supplier.findFirst({
        where: { barbershopId, document, id: { not: supplier.id } },
        select: { id: true },
      });
      if (duplicate) throw new ConflictException('Já existe um fornecedor com este documento');
    }
    return this.db.supplier.update({
      where: { id: supplier.id },
      data: {
        name: dto.name?.trim(),
        document,
        contactName: dto.contactName === undefined ? undefined : dto.contactName?.trim() || null,
        phone: dto.phone === undefined ? undefined : dto.phone?.replace(/\D/g, '') || null,
        email: dto.email === undefined ? undefined : dto.email?.trim().toLowerCase() || null,
        notes: dto.notes === undefined ? undefined : dto.notes?.trim() || null,
      },
    });
  }

  async setSupplierStatus(id: string, active: boolean) {
    const supplier = await this.db.supplier.findFirst({
      where: { id, barbershopId: this.tenant.barbershopId },
      select: { id: true },
    });
    if (!supplier) throw new NotFoundException('Fornecedor não encontrado');
    return this.db.supplier.update({ where: { id: supplier.id }, data: { active } });
  }

  financialCategories() {
    return this.db.financialCategory.findMany({
      where: { barbershopId: this.tenant.barbershopId },
      orderBy: [{ type: 'asc' }, { active: 'desc' }, { name: 'asc' }],
    });
  }

  async createFinancialCategory(dto: CreateFinancialCategoryDto) {
    const barbershopId = this.tenant.barbershopId;
    const name = dto.name.trim();
    const duplicate = await this.db.financialCategory.findFirst({
      where: { barbershopId, type: dto.type, name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('Esta categoria financeira já existe');
    return this.db.financialCategory.create({ data: { barbershopId, name, type: dto.type } });
  }

  async updateFinancialCategory(id: string, dto: UpdateFinancialCategoryDto) {
    const barbershopId = this.tenant.barbershopId;
    const category = await this.db.financialCategory.findFirst({ where: { id, barbershopId } });
    if (!category) throw new NotFoundException('Categoria financeira não encontrada');
    const name = dto.name?.trim() || category.name;
    const type = dto.type || category.type;
    const duplicate = await this.db.financialCategory.findFirst({
      where: {
        barbershopId,
        type,
        name: { equals: name, mode: 'insensitive' },
        id: { not: category.id },
      },
      select: { id: true },
    });
    if (duplicate) throw new ConflictException('Esta categoria financeira já existe');
    return this.db.financialCategory.update({
      where: { id: category.id },
      data: { name: dto.name === undefined ? undefined : name, type: dto.type },
    });
  }

  async setFinancialCategoryStatus(id: string, active: boolean) {
    const category = await this.db.financialCategory.findFirst({
      where: { id, barbershopId: this.tenant.barbershopId },
      select: { id: true },
    });
    if (!category) throw new NotFoundException('Categoria financeira não encontrada');
    return this.db.financialCategory.update({ where: { id: category.id }, data: { active } });
  }

  async accountOptions() {
    const barbershopId = this.tenant.barbershopId;
    const [suppliers, categories, customers] = await Promise.all([
      this.db.supplier.findMany({
        where: { barbershopId, active: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.db.financialCategory.findMany({
        where: { barbershopId, active: true },
        select: { id: true, name: true, type: true },
        orderBy: { name: 'asc' },
      }),
      this.db.customer.findMany({
        where: { barbershopId, deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
        take: 500,
      }),
    ]);
    return { suppliers, categories, customers };
  }

  async createAccountPayable(dto: CreateAccountPayableDto) {
    const barbershopId = this.tenant.barbershopId;
    await this.validatePayableRelations(dto.supplierId, dto.categoryId);
    return this.db.accountPayable.create({
      data: {
        barbershopId,
        supplierId: dto.supplierId || null,
        categoryId: dto.categoryId || null,
        description: dto.description.trim(),
        documentNumber: dto.documentNumber?.trim() || null,
        amount: this.moneyToCents(dto.amount) / 100,
        dueDate: this.accountDate(dto.dueDate),
        notes: dto.notes?.trim() || null,
      },
      include: { supplier: true, category: true },
    });
  }

  async createAccountReceivable(dto: CreateAccountReceivableDto) {
    const barbershopId = this.tenant.barbershopId;
    const [customer, category] = await Promise.all([
      this.db.customer.findFirst({
        where: { id: dto.customerId, barbershopId, deletedAt: null },
        select: { id: true },
      }),
      dto.categoryId
        ? this.db.financialCategory.findFirst({
            where: { id: dto.categoryId, barbershopId, type: 'INCOME', active: true },
            select: { id: true },
          })
        : null,
    ]);
    if (!customer) throw new NotFoundException('Cliente não encontrado');
    if (dto.categoryId && !category) {
      throw new NotFoundException('Categoria de receita não encontrada');
    }
    return this.db.accountReceivable.create({
      data: {
        barbershopId,
        customerId: customer.id,
        categoryId: category?.id || null,
        description: dto.description.trim(),
        documentNumber: dto.documentNumber?.trim() || null,
        amount: this.moneyToCents(dto.amount) / 100,
        dueDate: this.accountDate(dto.dueDate),
        notes: dto.notes?.trim() || null,
      },
      include: { customer: true, category: true },
    });
  }

  async accountPayables(query: ListAccountsQuery = new ListAccountsQuery()) {
    await this.materializeExpenseRecurrences();
    return this.listAccounts('PAYABLE', query);
  }

  accountReceivables(query: ListAccountsQuery = new ListAccountsQuery()) {
    return this.listAccounts('RECEIVABLE', query);
  }

  settleAccountPayable(id: string, dto: SettleAccountDto) {
    return this.settleAccount('PAYABLE', id, dto);
  }

  settleAccountReceivable(id: string, dto: SettleAccountDto) {
    return this.settleAccount('RECEIVABLE', id, dto);
  }

  cancelAccountPayable(id: string, dto: CancelAccountDto) {
    return this.cancelAccount('PAYABLE', id, dto);
  }

  cancelAccountReceivable(id: string, dto: CancelAccountDto) {
    return this.cancelAccount('RECEIVABLE', id, dto);
  }

  async createExpenseRecurrence(dto: CreateExpenseRecurrenceDto) {
    const barbershopId = this.tenant.barbershopId;
    await this.validatePayableRelations(dto.supplierId, dto.categoryId);
    const dueDate = this.accountDate(dto.dueDate);
    const endDate = dto.endDate ? this.accountDate(dto.endDate) : null;
    if (endDate && endDate < dueDate) {
      throw new BadRequestException('O fim da recorrência deve ser igual ou posterior ao início');
    }
    return this.db.$transaction(async (tx) => {
      const nextDueDate = this.nextRecurrenceDate(dueDate, dto.frequency, dto.intervalCount);
      const recurrence = await tx.expenseRecurrence.create({
        data: {
          barbershopId,
          supplierId: dto.supplierId || null,
          categoryId: dto.categoryId || null,
          description: dto.description.trim(),
          amount: this.moneyToCents(dto.amount) / 100,
          frequency: dto.frequency,
          intervalCount: dto.intervalCount,
          nextDueDate,
          endDate,
          active: !endDate || nextDueDate <= endDate,
          lastGeneratedAt: new Date(),
          notes: dto.notes?.trim() || null,
        },
      });
      const account = await tx.accountPayable.create({
        data: {
          barbershopId,
          supplierId: dto.supplierId || null,
          categoryId: dto.categoryId || null,
          recurrenceId: recurrence.id,
          recurrenceDueDate: dueDate,
          description: dto.description.trim(),
          documentNumber: dto.documentNumber?.trim() || null,
          amount: this.moneyToCents(dto.amount) / 100,
          dueDate,
          notes: dto.notes?.trim() || null,
        },
      });
      return { recurrence, account };
    });
  }

  expenseRecurrences() {
    return this.db.expenseRecurrence.findMany({
      where: { barbershopId: this.tenant.barbershopId },
      include: { supplier: true, category: true },
      orderBy: [{ active: 'desc' }, { nextDueDate: 'asc' }],
    });
  }

  async setExpenseRecurrenceStatus(id: string, active: boolean) {
    const recurrence = await this.db.expenseRecurrence.findFirst({
      where: { id, barbershopId: this.tenant.barbershopId },
      select: { id: true, endDate: true, nextDueDate: true },
    });
    if (!recurrence) throw new NotFoundException('Recorrência não encontrada');
    if (active && recurrence.endDate && recurrence.nextDueDate > recurrence.endDate) {
      throw new ConflictException('Esta recorrência já atingiu a data final');
    }
    return this.db.expenseRecurrence.update({ where: { id }, data: { active } });
  }

  private async validatePayableRelations(supplierId?: string, categoryId?: string) {
    const barbershopId = this.tenant.barbershopId;
    const [supplier, category] = await Promise.all([
      supplierId
        ? this.db.supplier.findFirst({
            where: { id: supplierId, barbershopId, active: true },
            select: { id: true },
          })
        : null,
      categoryId
        ? this.db.financialCategory.findFirst({
            where: { id: categoryId, barbershopId, type: 'EXPENSE', active: true },
            select: { id: true },
          })
        : null,
    ]);
    if (supplierId && !supplier) throw new NotFoundException('Fornecedor não encontrado');
    if (categoryId && !category) {
      throw new NotFoundException('Categoria de despesa não encontrada');
    }
  }

  private async listAccounts(type: 'PAYABLE' | 'RECEIVABLE', query: ListAccountsQuery) {
    const barbershopId = this.tenant.barbershopId;
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const dueSoon = new Date(today);
    dueSoon.setUTCDate(dueSoon.getUTCDate() + 7);
    const statusWhere =
      query.status === AccountListStatus.OVERDUE
        ? { status: 'PENDING' as const, dueDate: { lt: today } }
        : query.status === AccountListStatus.PENDING
          ? { status: 'PENDING' as const, dueDate: { gte: today } }
          : query.status !== AccountListStatus.ALL
            ? { status: query.status }
            : {};
    const dateWhere = {
      ...(query.start && { gte: this.accountDate(query.start) }),
      ...(query.end && { lte: this.accountDate(query.end) }),
    };
    const shared = {
      barbershopId,
      ...statusWhere,
      ...(Object.keys(dateWhere).length && {
        dueDate: { ...(statusWhere as any).dueDate, ...dateWhere },
      }),
      ...(query.categoryId && { categoryId: query.categoryId }),
      ...(query.search && {
        OR: [
          { description: { contains: query.search.trim(), mode: 'insensitive' as const } },
          { documentNumber: { contains: query.search.trim(), mode: 'insensitive' as const } },
        ],
      }),
    };
    const page = query.page || 1;
    const limit = query.limit || 20;
    if (type === 'PAYABLE') {
      const where: Prisma.AccountPayableWhereInput = {
        ...shared,
        ...(query.supplierId && { supplierId: query.supplierId }),
      };
      const [items, total, totals] = await Promise.all([
        this.db.accountPayable.findMany({
          where,
          include: { supplier: true, category: true, paidBy: { select: { id: true, name: true } } },
          orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.db.accountPayable.count({ where }),
        this.db.accountPayable.findMany({
          where: { barbershopId },
          select: { amount: true, status: true, dueDate: true },
        }),
      ]);
      return this.accountListResult(items, total, page, limit, totals, today, dueSoon);
    }
    const where: Prisma.AccountReceivableWhereInput = {
      ...shared,
      ...(query.customerId && { customerId: query.customerId }),
    };
    const [items, total, totals] = await Promise.all([
      this.db.accountReceivable.findMany({
        where,
        include: {
          customer: true,
          category: true,
          receivedBy: { select: { id: true, name: true } },
        },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.accountReceivable.count({ where }),
      this.db.accountReceivable.findMany({
        where: { barbershopId },
        select: { amount: true, status: true, dueDate: true },
      }),
    ]);
    return this.accountListResult(items, total, page, limit, totals, today, dueSoon);
  }

  private accountListResult<T extends { amount: Prisma.Decimal; status: string; dueDate: Date }>(
    items: T[],
    total: number,
    page: number,
    limit: number,
    totals: Array<{ amount: Prisma.Decimal; status: string; dueDate: Date }>,
    today: Date,
    dueSoon: Date,
  ) {
    const sum = (entries: typeof totals) =>
      entries.reduce((value, account) => value + this.moneyToCents(account.amount), 0) / 100;
    const pending = totals.filter((account) => account.status === 'PENDING');
    const overdue = pending.filter((account) => account.dueDate < today);
    const upcoming = pending.filter(
      (account) => account.dueDate >= today && account.dueDate <= dueSoon,
    );
    return {
      items: items.map((account) => ({
        ...account,
        effectiveStatus:
          account.status === 'PENDING' && account.dueDate < today ? 'OVERDUE' : account.status,
      })),
      summary: {
        pending: sum(pending),
        overdue: sum(overdue),
        paid: sum(totals.filter((account) => account.status === 'PAID')),
        cancelled: sum(totals.filter((account) => account.status === 'CANCELLED')),
      },
      alerts: { overdue: overdue.length, dueSoon: upcoming.length },
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    };
  }

  private settleAccount(type: 'PAYABLE' | 'RECEIVABLE', id: string, dto: SettleAccountDto) {
    const barbershopId = this.tenant.barbershopId;
    return this.db.$transaction(
      async (tx) => {
        await this.lockCashFlow(tx);
        const account =
          type === 'PAYABLE'
            ? await tx.accountPayable.findFirst({
                where: { id, barbershopId },
                include: { category: true },
              })
            : await tx.accountReceivable.findFirst({
                where: { id, barbershopId },
                include: { category: true },
              });
        if (!account) throw new NotFoundException('Conta não encontrada');
        if (account.status !== 'PENDING') {
          throw new ConflictException('Somente contas pendentes podem ser baixadas');
        }
        const openRegister = await tx.cashRegister.findFirst({
          where: { barbershopId, closedAt: null },
          orderBy: { openedAt: 'desc' },
          select: { id: true },
        });
        const settledAt = dto.settledAt ? new Date(dto.settledAt) : new Date();
        const transaction = await tx.financialTransaction.create({
          data: {
            barbershopId,
            cashRegisterId: openRegister?.id || null,
            type: type === 'PAYABLE' ? 'EXPENSE' : 'INCOME',
            origin: type === 'PAYABLE' ? 'ACCOUNT_PAYABLE' : 'ACCOUNT_RECEIVABLE',
            category:
              account.category?.name ||
              (type === 'PAYABLE' ? 'Contas a pagar' : 'Contas a receber'),
            description: account.description,
            amount: account.amount,
            method: dto.method,
            status: 'PAID',
            dueDate: account.dueDate,
            paidAt: settledAt,
            notes: dto.notes?.trim() || account.notes,
          },
        });
        if (type === 'PAYABLE') {
          await tx.accountPayable.update({
            where: { id: account.id },
            data: {
              status: 'PAID',
              paidAt: settledAt,
              paidById: this.tenant.userId,
              paymentMethod: dto.method,
              financialTransactionId: transaction.id,
              notes: dto.notes?.trim() || undefined,
            },
          });
        } else {
          await tx.accountReceivable.update({
            where: { id: account.id },
            data: {
              status: 'PAID',
              receivedAt: settledAt,
              receivedById: this.tenant.userId,
              paymentMethod: dto.method,
              financialTransactionId: transaction.id,
              notes: dto.notes?.trim() || undefined,
            },
          });
        }
        await tx.auditLog.create({
          data: {
            barbershopId,
            userId: this.tenant.userId,
            action: type === 'PAYABLE' ? 'ACCOUNT_PAYABLE_PAID' : 'ACCOUNT_RECEIVABLE_RECEIVED',
            entity: type === 'PAYABLE' ? 'AccountPayable' : 'AccountReceivable',
            entityId: account.id,
            before: { status: 'PENDING', amount: Number(account.amount) },
            after: { status: 'PAID', settledAt, method: dto.method, transactionId: transaction.id },
          },
        });
        return { accountId: account.id, transaction };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private cancelAccount(type: 'PAYABLE' | 'RECEIVABLE', id: string, dto: CancelAccountDto) {
    const barbershopId = this.tenant.barbershopId;
    return this.db.$transaction(async (tx) => {
      const account =
        type === 'PAYABLE'
          ? await tx.accountPayable.findFirst({ where: { id, barbershopId } })
          : await tx.accountReceivable.findFirst({ where: { id, barbershopId } });
      if (!account) throw new NotFoundException('Conta não encontrada');
      if (account.status !== 'PENDING') {
        throw new ConflictException('Somente contas pendentes podem ser canceladas');
      }
      const data = {
        status: 'CANCELLED' as const,
        cancelledAt: new Date(),
        cancellationReason: dto.reason.trim(),
      };
      if (type === 'PAYABLE') await tx.accountPayable.update({ where: { id }, data });
      else await tx.accountReceivable.update({ where: { id }, data });
      await tx.auditLog.create({
        data: {
          barbershopId,
          userId: this.tenant.userId,
          action: type === 'PAYABLE' ? 'ACCOUNT_PAYABLE_CANCELLED' : 'ACCOUNT_RECEIVABLE_CANCELLED',
          entity: type === 'PAYABLE' ? 'AccountPayable' : 'AccountReceivable',
          entityId: id,
          before: { status: 'PENDING' },
          after: { status: 'CANCELLED', reason: dto.reason.trim() },
        },
      });
      return { id, ...data };
    });
  }

  private async materializeExpenseRecurrences() {
    const barbershopId = this.tenant.barbershopId;
    const horizon = new Date();
    horizon.setUTCDate(horizon.getUTCDate() + 30);
    await this.db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${barbershopId}:recurrences`}))`;
        const recurrences = await tx.expenseRecurrence.findMany({
          where: { barbershopId, active: true, nextDueDate: { lte: horizon } },
        });
        for (const recurrence of recurrences) {
          let dueDate = recurrence.nextDueDate;
          let generated = false;
          let iterations = 0;
          while (
            dueDate <= horizon &&
            (!recurrence.endDate || dueDate <= recurrence.endDate) &&
            iterations < 120
          ) {
            await tx.accountPayable.upsert({
              where: {
                recurrenceId_recurrenceDueDate: {
                  recurrenceId: recurrence.id,
                  recurrenceDueDate: dueDate,
                },
              },
              update: {},
              create: {
                barbershopId,
                supplierId: recurrence.supplierId,
                categoryId: recurrence.categoryId,
                recurrenceId: recurrence.id,
                recurrenceDueDate: dueDate,
                description: recurrence.description,
                amount: recurrence.amount,
                dueDate,
                notes: recurrence.notes,
              },
            });
            generated = true;
            iterations += 1;
            dueDate = this.nextRecurrenceDate(
              dueDate,
              recurrence.frequency,
              recurrence.intervalCount,
            );
          }
          await tx.expenseRecurrence.update({
            where: { id: recurrence.id },
            data: {
              nextDueDate: dueDate,
              active: !recurrence.endDate || dueDate <= recurrence.endDate,
              lastGeneratedAt: generated ? new Date() : undefined,
            },
          });
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private nextRecurrenceDate(date: Date, frequency: string, intervalCount: number) {
    const next = new Date(date);
    if (frequency === 'WEEKLY') {
      next.setUTCDate(next.getUTCDate() + 7 * intervalCount);
    } else if (frequency === 'MONTHLY') {
      const day = next.getUTCDate();
      next.setUTCDate(1);
      next.setUTCMonth(next.getUTCMonth() + intervalCount);
      const lastDay = new Date(
        Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0),
      ).getUTCDate();
      next.setUTCDate(Math.min(day, lastDay));
    } else {
      const month = next.getUTCMonth();
      const day = next.getUTCDate();
      next.setUTCDate(1);
      next.setUTCFullYear(next.getUTCFullYear() + intervalCount);
      next.setUTCMonth(month);
      const lastDay = new Date(Date.UTC(next.getUTCFullYear(), month + 1, 0)).getUTCDate();
      next.setUTCDate(Math.min(day, lastDay));
    }
    return next;
  }

  private accountDate(value: string) {
    return this.parseDateOnly(value.slice(0, 10));
  }

  async reports(query: ReportsQuery) {
    const barbershopId = this.tenant.barbershopId;
    const { start, end } = this.reportPeriod(query);
    const [sales, transactions, commissions, employees] = await Promise.all([
      this.db.sale.findMany({
        where: { barbershopId, status: 'COMPLETED', completedAt: { gte: start, lte: end } },
        include: {
          employee: { select: { id: true, name: true, color: true } },
          customer: { select: { id: true, name: true } },
          items: {
            include: { product: { select: { costPrice: true } } },
          },
        },
        orderBy: { completedAt: 'desc' },
      }),
      this.db.financialTransaction.findMany({
        where: { barbershopId, status: 'PAID', paidAt: { gte: start, lte: end } },
        orderBy: { paidAt: 'desc' },
      }),
      this.db.commission.findMany({
        where: { barbershopId, createdAt: { gte: start, lte: end } },
        include: { employee: { select: { id: true, name: true } } },
      }),
      this.db.employee.findMany({
        where: { barbershopId, deletedAt: null },
        select: { id: true, name: true, color: true, active: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    const revenue = sales.reduce((sum, sale) => sum + this.moneyToCents(sale.total), 0) / 100;
    const expenses =
      transactions
        .filter((transaction) => transaction.type === 'EXPENSE')
        .reduce((sum, transaction) => sum + this.moneyToCents(transaction.amount), 0) / 100;
    const financialIncome =
      transactions
        .filter((transaction) => transaction.type === 'INCOME')
        .reduce((sum, transaction) => sum + this.moneyToCents(transaction.amount), 0) / 100;
    const customerIds = new Set(
      sales.flatMap((sale) => (sale.customerId ? [sale.customerId] : [])),
    );
    const commissionTotal =
      commissions.reduce((sum, commission) => sum + this.moneyToCents(commission.amount), 0) / 100;
    const timeline = this.reportTimeline(start, end);
    const timelineMap = new Map(timeline.map((entry) => [entry.date, entry]));
    for (const sale of sales) {
      const key = (sale.completedAt || sale.createdAt).toISOString().slice(0, 10);
      const entry = timelineMap.get(key);
      if (entry) entry.revenue += Number(sale.total);
    }
    for (const transaction of transactions.filter((item) => item.type === 'EXPENSE')) {
      const key = (transaction.paidAt || transaction.createdAt).toISOString().slice(0, 10);
      const entry = timelineMap.get(key);
      if (entry) entry.expenses += Number(transaction.amount);
    }

    const employeeMap = new Map(
      employees.map((employee) => [
        employee.id,
        { ...employee, attendances: 0, revenue: 0, commission: 0 },
      ]),
    );
    for (const sale of sales) {
      if (!sale.employeeId) continue;
      const entry = employeeMap.get(sale.employeeId);
      if (!entry) continue;
      entry.attendances += 1;
      entry.revenue += Number(sale.total);
    }
    for (const commission of commissions) {
      const entry = employeeMap.get(commission.employeeId);
      if (entry) entry.commission += Number(commission.amount);
    }

    const serviceMap = new Map<
      string,
      { id: string; name: string; quantity: number; revenue: number }
    >();
    const productMap = new Map<
      string,
      { id: string; name: string; quantity: number; revenue: number; cost: number; margin: number }
    >();
    for (const sale of sales) {
      for (const item of sale.items) {
        if (item.serviceId) {
          const entry = serviceMap.get(item.serviceId) || {
            id: item.serviceId,
            name: item.description,
            quantity: 0,
            revenue: 0,
          };
          entry.quantity += item.quantity;
          entry.revenue += Number(item.total);
          serviceMap.set(item.serviceId, entry);
        }
        if (item.productId) {
          const entry = productMap.get(item.productId) || {
            id: item.productId,
            name: item.description,
            quantity: 0,
            revenue: 0,
            cost: 0,
            margin: 0,
          };
          entry.quantity += item.quantity;
          entry.revenue += Number(item.total);
          entry.cost += Number(item.product?.costPrice || 0) * item.quantity;
          entry.margin = entry.revenue - entry.cost;
          productMap.set(item.productId, entry);
        }
      }
    }

    const customerMap = new Map<
      string,
      { id: string; name: string; visits: number; spent: number; lastVisit: Date | null }
    >();
    for (const sale of sales) {
      if (!sale.customer) continue;
      const entry = customerMap.get(sale.customer.id) || {
        id: sale.customer.id,
        name: sale.customer.name,
        visits: 0,
        spent: 0,
        lastVisit: null,
      };
      entry.visits += 1;
      entry.spent += Number(sale.total);
      const visit = sale.completedAt || sale.createdAt;
      if (!entry.lastVisit || visit > entry.lastVisit) entry.lastVisit = visit;
      customerMap.set(sale.customer.id, entry);
    }

    const groupTransactions = (field: 'category' | 'method') => {
      const groups = new Map<
        string,
        { name: string; income: number; expense: number; balance: number }
      >();
      for (const transaction of transactions) {
        const name = String(transaction[field] || 'OTHER');
        const entry = groups.get(name) || { name, income: 0, expense: 0, balance: 0 };
        if (transaction.type === 'INCOME') entry.income += Number(transaction.amount);
        else entry.expense += Number(transaction.amount);
        entry.balance = entry.income - entry.expense;
        groups.set(name, entry);
      }
      return [...groups.values()].sort((a, b) => b.income + b.expense - (a.income + a.expense));
    };

    return {
      period: { start, end },
      overview: {
        revenue,
        financialIncome,
        expenses,
        balance: financialIncome - expenses,
        averageTicket: sales.length ? revenue / sales.length : 0,
        attendances: sales.length,
        customers: customerIds.size,
        commissions: commissionTotal,
      },
      timeline,
      employees: [...employeeMap.values()].sort((a, b) => b.revenue - a.revenue),
      services: [...serviceMap.values()].sort((a, b) => b.quantity - a.quantity),
      products: [...productMap.values()].sort((a, b) => b.quantity - a.quantity),
      customers: [...customerMap.values()].sort((a, b) => b.spent - a.spent),
      financial: {
        transactions: transactions.map((transaction) => ({
          id: transaction.id,
          type: transaction.type,
          origin: transaction.origin,
          category: transaction.category,
          description: transaction.description,
          amount: Number(transaction.amount),
          method: transaction.method,
          paidAt: transaction.paidAt,
        })),
        byCategory: groupTransactions('category'),
        byMethod: groupTransactions('method'),
      },
    };
  }

  private reportPeriod(query: ReportsQuery) {
    const start = this.accountDate(query.start);
    const endDate = this.accountDate(query.end);
    const end = new Date(endDate);
    end.setUTCHours(23, 59, 59, 999);
    if (start > end) throw new BadRequestException('O período informado é inválido');
    if (end.getTime() - start.getTime() > 370 * 86400000) {
      throw new BadRequestException('O período está limitado a 370 dias');
    }
    return { start, end };
  }

  private reportTimeline(start: Date, end: Date) {
    const timeline: Array<{ date: string; label: string; revenue: number; expenses: number }> = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      timeline.push({
        date: cursor.toISOString().slice(0, 10),
        label: cursor.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          timeZone: 'UTC',
        }),
        revenue: 0,
        expenses: 0,
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return timeline;
  }

  async dashboard(query: DashboardQuery = new DashboardQuery()) {
    const barbershopId = this.tenant.barbershopId;
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const month = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const chartStart = new Date(today);
    chartStart.setDate(chartStart.getDate() - (query.days - 1));
    const previousChartStart = new Date(chartStart);
    previousChartStart.setDate(previousChartStart.getDate() - query.days);

    const [
      shop,
      todaySales,
      yesterdaySales,
      monthSales,
      previousMonthSales,
      appointments,
      cash,
      expenses,
      pendingCommissions,
      products,
      chartSales,
      previousChartSales,
    ] = await Promise.all([
      this.db.barbershop.findUnique({
        where: { id: barbershopId },
        select: { name: true },
      }),
      this.db.sale.findMany({
        where: { barbershopId, status: 'COMPLETED', completedAt: { gte: today, lt: tomorrow } },
        select: { total: true, customerId: true },
      }),
      this.db.sale.aggregate({
        where: { barbershopId, status: 'COMPLETED', completedAt: { gte: yesterday, lt: today } },
        _sum: { total: true },
      }),
      this.db.sale.aggregate({
        where: { barbershopId, status: 'COMPLETED', completedAt: { gte: month } },
        _sum: { total: true },
      }),
      this.db.sale.aggregate({
        where: {
          barbershopId,
          status: 'COMPLETED',
          completedAt: { gte: previousMonth, lt: month },
        },
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
      this.db.cashRegister.findFirst({
        where: { barbershopId, closedAt: null },
        orderBy: { openedAt: 'desc' },
        include: {
          transactions: {
            where: { status: 'PAID' },
            select: { type: true, amount: true, method: true },
          },
        },
      }),
      this.db.financialTransaction.aggregate({
        where: { barbershopId, type: 'EXPENSE', status: 'PAID', paidAt: { gte: month } },
        _sum: { amount: true },
      }),
      this.db.commission.aggregate({
        where: { barbershopId, status: 'PENDING' },
        _sum: { amount: true },
      }),
      this.db.product.findMany({
        where: { barbershopId, active: true, deletedAt: null },
        select: { stockQuantity: true, minimumStock: true },
      }),
      this.db.sale.findMany({
        where: {
          barbershopId,
          status: 'COMPLETED',
          completedAt: { gte: chartStart, lt: tomorrow },
        },
        select: { total: true, completedAt: true, createdAt: true },
      }),
      this.db.sale.aggregate({
        where: {
          barbershopId,
          status: 'COMPLETED',
          completedAt: { gte: previousChartStart, lt: chartStart },
        },
        _sum: { total: true },
      }),
    ]);

    const cashSummary = cash
      ? this.financialSummary(Number(cash.openingBalance), cash.transactions)
      : null;
    const todayRevenue =
      todaySales.reduce((sum, sale) => sum + this.moneyToCents(sale.total), 0) / 100;
    const yesterdayRevenue = Number(yesterdaySales._sum.total || 0);
    const monthRevenue = Number(monthSales._sum.total || 0);
    const previousMonthRevenue = Number(previousMonthSales._sum.total || 0);
    const chart = this.reportTimeline(chartStart, today);
    const chartMap = new Map(chart.map((entry) => [entry.date, entry]));
    for (const sale of chartSales) {
      const key = (sale.completedAt || sale.createdAt).toISOString().slice(0, 10);
      const entry = chartMap.get(key);
      if (entry) entry.revenue += Number(sale.total);
    }
    const chartTotal = chart.reduce((sum, entry) => sum + entry.revenue, 0);
    const previousChartTotal = Number(previousChartSales._sum.total || 0);

    return {
      barbershop: shop?.name || '',
      metrics: {
        todayRevenue,
        todayRevenueTrend: this.percentageChange(todayRevenue, yesterdayRevenue),
        monthRevenue,
        monthRevenueTrend: this.percentageChange(monthRevenue, previousMonthRevenue),
        todayAppointments: appointments.length,
        confirmedAppointments: appointments.filter((item) => item.status === 'CONFIRMED').length,
        todayCustomers: new Set(
          todaySales.flatMap((sale) => (sale.customerId ? [sale.customerId] : [])),
        ).size,
        cashBalance: cashSummary?.expectedBalance || 0,
        cashOpen: Boolean(cash),
        averageTicket: todaySales.length ? todayRevenue / todaySales.length : 0,
        monthExpenses: Number(expenses._sum.amount || 0),
        pendingCommissions: Number(pendingCommissions._sum.amount || 0),
        lowStockProducts: products.filter(
          (product) => product.stockQuantity <= product.minimumStock,
        ).length,
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
        durationMinutes: Math.max(
          0,
          Math.round((appointment.endAt.getTime() - appointment.startAt.getTime()) / 60000),
        ),
      })),
      chart: chart.map((entry) => ({ day: entry.label, value: entry.revenue })),
      chartTotal,
      chartTrend: this.percentageChange(chartTotal, previousChartTotal),
    };
  }

  private percentageChange(current: number, previous: number) {
    if (!previous) return current ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }
}
