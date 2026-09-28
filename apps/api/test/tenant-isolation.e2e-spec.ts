import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { BarbershopStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
// CommonJS export used by Jest in this project.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import request = require('supertest');
import { TenantContext } from '../src/auth-context';
import { AuthController, AuthService, JwtStrategy } from '../src/auth';
import { AvailabilityService } from '../src/availability.service';
import { DataController } from '../src/data.controller';
import { DataService } from '../src/data.service';
import { PrismaService } from '../src/prisma.service';
import { PermissionsGuard, RolesGuard } from '../src/rbac';
import { SuperAdminController, SuperAdminService } from '../src/super-admin';

describe('Isolamento multi-tenant (e2e)', () => {
  let app: INestApplication;
  let db: PrismaService;
  let shopAId: string;
  let shopBId: string;
  let userAId: string;
  let userBId: string;
  let receptionistAId: string;
  let superAdminId: string;
  let createdShopId: string | undefined;
  let createdAdminId: string | undefined;
  let createdPlanId: string | undefined;
  let employeeAId: string;
  let employeeBId: string;
  let customerAId: string;
  let customerBId: string;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const password = 'Test@1234';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        PassportModule,
        JwtModule.register({
          global: true,
          secret: process.env.JWT_SECRET || 'development-secret-change-me',
          signOptions: { expiresIn: '15m' },
        }),
      ],
      controllers: [AuthController, DataController, SuperAdminController],
      providers: [
        PrismaService,
        AuthService,
        JwtStrategy,
        TenantContext,
        DataService,
        AvailabilityService,
        RolesGuard,
        PermissionsGuard,
        SuperAdminService,
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    await app.init();
    db = app.get(PrismaService);
    const basePlan = await db.plan.findFirstOrThrow({ where: { active: true } });

    const [shopA, shopB] = await Promise.all([
      db.barbershop.create({
        data: {
          name: `Tenant A ${suffix}`,
          slug: `tenant-a-${suffix}`,
          ownerName: 'Tenant A',
          status: BarbershopStatus.ACTIVE,
          subscription: { create: { planId: basePlan.id, status: 'ACTIVE' } },
        },
      }),
      db.barbershop.create({
        data: {
          name: `Tenant B ${suffix}`,
          slug: `tenant-b-${suffix}`,
          ownerName: 'Tenant B',
          status: BarbershopStatus.ACTIVE,
          subscription: { create: { planId: basePlan.id, status: 'ACTIVE' } },
        },
      }),
    ]);
    shopAId = shopA.id;
    shopBId = shopB.id;

    const passwordHash = await bcrypt.hash(password, 4);
    const [userA, userB, receptionistA, superAdmin] = await Promise.all([
      db.user.create({
        data: {
          barbershopId: shopAId,
          email: `receptionist-a-${suffix}@example.com`,
          passwordHash,
          name: 'Recepcionista A',
          role: Role.RECEPTIONIST,
        },
      }),
      db.user.create({
        data: {
          barbershopId: shopAId,
          email: `admin-a-${suffix}@example.com`,
          passwordHash,
          name: 'Admin A',
          role: Role.ADMIN,
        },
      }),
      db.user.create({
        data: {
          barbershopId: shopBId,
          email: `admin-b-${suffix}@example.com`,
          passwordHash,
          name: 'Admin B',
          role: Role.ADMIN,
        },
      }),
      db.user.create({
        data: {
          email: `super-${suffix}@example.com`,
          passwordHash,
          name: 'Super Admin',
          role: Role.SUPER_ADMIN,
        },
      }),
    ]);
    userAId = userA.id;
    userBId = userB.id;
    receptionistAId = receptionistA.id;
    superAdminId = superAdmin.id;

    await Promise.all([
      db.customer
        .create({
          data: { barbershopId: shopAId, name: `Cliente A ${suffix}`, phone: '11911111111' },
        })
        .then((customer) => (customerAId = customer.id)),
      db.customer
        .create({
          data: { barbershopId: shopBId, name: `Cliente B ${suffix}`, phone: '11922222222' },
        })
        .then((customer) => (customerBId = customer.id)),
      db.employee
        .create({ data: { barbershopId: shopAId, name: `Colaborador A ${suffix}` } })
        .then((employee) => (employeeAId = employee.id)),
      db.employee
        .create({ data: { barbershopId: shopBId, name: `Colaborador B ${suffix}` } })
        .then((employee) => (employeeBId = employee.id)),
    ]);
  });

  afterAll(async () => {
    const userIds = [userAId, userBId, receptionistAId, superAdminId, createdAdminId].filter(
      (id): id is string => Boolean(id),
    );
    const shopIds = [shopAId, shopBId, createdShopId].filter((id): id is string => Boolean(id));
    if (userIds.length) {
      await db.session.deleteMany({ where: { userId: { in: userIds } } });
      await db.auditLog.deleteMany({ where: { userId: { in: userIds } } });
      await db.user.deleteMany({ where: { id: { in: userIds } } });
    }
    if (shopIds.length) {
      await db.employee.deleteMany({ where: { barbershopId: { in: shopIds } } });
      await db.customer.deleteMany({ where: { barbershopId: { in: shopIds } } });
      await db.setting.deleteMany({ where: { barbershopId: { in: shopIds } } });
      await db.subscription.deleteMany({ where: { barbershopId: { in: shopIds } } });
      await db.barbershop.deleteMany({ where: { id: { in: shopIds } } });
    }
    if (createdPlanId) await db.plan.deleteMany({ where: { id: createdPlanId } });
    await app.close();
  });

  async function login(email: string) {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    return response.body.accessToken as string;
  }

  it('configura a barbearia e persiste o progresso do onboarding', async () => {
    const adminToken = await login(`admin-a-${suffix}@example.com`);
    const receptionistToken = await login(`receptionist-a-${suffix}@example.com`);
    const authorization = { Authorization: `Bearer ${adminToken}` };

    await request(app.getHttpServer())
      .patch('/api/settings/business')
      .set(authorization)
      .send({
        name: `Navalha ${suffix}`,
        ownerName: 'Responsável',
        email: `contato-${suffix}@example.com`,
        primaryColor: '#F5D547',
      })
      .expect(200);

    await request(app.getHttpServer())
      .patch('/api/settings/opening-hours')
      .set(authorization)
      .send({
        hours: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => ({
          day,
          enabled: day !== 'sun',
          start: '08:00',
          end: '18:00',
        })),
      })
      .expect(200);

    await request(app.getHttpServer())
      .patch('/api/settings/operational')
      .set(authorization)
      .send({ allowNegativeStock: false, allowCreditSales: true, publicBooking: true })
      .expect(200);

    const settings = await request(app.getHttpServer())
      .get('/api/settings')
      .set(authorization)
      .expect(200);
    expect(settings.body.barbershop).toEqual(
      expect.objectContaining({ primaryColor: '#F5D547', primaryTextColor: '#000000' }),
    );
    expect(settings.body.settings.allowCreditSales).toBe(true);
    expect(settings.body.onboarding.completedSteps).toEqual(
      expect.arrayContaining(['BUSINESS', 'HOURS', 'TEAM', 'BOOKING']),
    );

    await request(app.getHttpServer())
      .post('/api/settings/onboarding/dismiss')
      .set(authorization)
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/settings/onboarding/resume')
      .set(authorization)
      .expect(201);

    const workspace = await request(app.getHttpServer())
      .get('/api/workspace')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .expect(200);
    expect(workspace.body.name).toBe(`Navalha ${suffix}`);

    await request(app.getHttpServer())
      .get('/api/settings')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .expect(403);
  });

  it('retorna somente registros pertencentes ao tenant do token', async () => {
    const tokenA = await login(`admin-a-${suffix}@example.com`);
    const tokenB = await login(`admin-b-${suffix}@example.com`);

    const [responseA, responseB] = await Promise.all([
      request(app.getHttpServer())
        .get('/api/customers?status=ALL')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200),
      request(app.getHttpServer())
        .get('/api/customers?status=ALL')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200),
    ]);

    expect(responseA.body.items.map((customer: { name: string }) => customer.name)).toEqual([
      `Cliente A ${suffix}`,
    ]);
    expect(responseB.body.items.map((customer: { name: string }) => customer.name)).toEqual([
      `Cliente B ${suffix}`,
    ]);
  });

  it('rejeita acesso sem autenticação', () =>
    request(app.getHttpServer()).get('/api/customers').expect(401));

  it('não libera Super Admin em rota tenant-aware sem exceção explícita', async () => {
    const token = await login(`super-${suffix}@example.com`);
    await request(app.getHttpServer())
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('protege relatórios por tenant, permissão e período válido', async () => {
    const adminToken = await login(`admin-a-${suffix}@example.com`);
    const receptionistToken = await login(`receptionist-a-${suffix}@example.com`);
    const report = await request(app.getHttpServer())
      .get('/api/reports?start=2026-09-01&end=2026-09-30')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(report.body).toEqual(
      expect.objectContaining({
        overview: expect.any(Object),
        timeline: expect.any(Array),
        financial: expect.any(Object),
      }),
    );
    await request(app.getHttpServer())
      .get('/api/reports?start=2026-09-01&end=2026-09-30')
      .set('Authorization', `Bearer ${receptionistToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/reports?start=2026-10-10&end=2026-10-01')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
  });

  it('isola listagem e detalhes de colaboradores entre tenants', async () => {
    const tokenA = await login(`admin-a-${suffix}@example.com`);
    const tokenB = await login(`admin-b-${suffix}@example.com`);

    const [listA, listB] = await Promise.all([
      request(app.getHttpServer())
        .get('/api/employees')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200),
      request(app.getHttpServer())
        .get('/api/employees')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200),
    ]);
    expect(listA.body.items.map((employee: { id: string }) => employee.id)).toContain(employeeAId);
    expect(listA.body.items.map((employee: { id: string }) => employee.id)).not.toContain(
      employeeBId,
    );
    expect(listB.body.items.map((employee: { id: string }) => employee.id)).toContain(employeeBId);

    await request(app.getHttpServer())
      .get(`/api/employees/${employeeBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(404);
  });

  it('bloqueia mutações de colaborador pertencente a outro tenant', async () => {
    const tokenA = await login(`admin-a-${suffix}@example.com`);

    await request(app.getHttpServer())
      .patch(`/api/employees/${employeeBId}/status`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ active: false })
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/api/employees/${employeeBId}/commission`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ defaultCommission: 25 })
      .expect(404);

    const untouched = await db.employee.findUniqueOrThrow({ where: { id: employeeBId } });
    expect(untouched.active).toBe(true);
    expect(Number(untouched.defaultCommission)).toBe(0);
  });

  it('permite consulta e nega administração ao recepcionista', async () => {
    const token = await login(`receptionist-a-${suffix}@example.com`);

    await request(app.getHttpServer())
      .get('/api/employees')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/employees')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Sem permissão' })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/api/employees/${employeeAId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ active: false })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/api/employees/${employeeAId}/commission`)
      .set('Authorization', `Bearer ${token}`)
      .send({ defaultCommission: 25 })
      .expect(403);
  });

  it('valida jornada, folga, bloqueio, disponibilidade e isolamento', async () => {
    const tokenA = await login(`admin-a-${suffix}@example.com`);
    const scheduleIds: string[] = [];
    const unavailabilityIds: string[] = [];

    try {
      const schedule = await request(app.getHttpServer())
        .post(`/api/employees/${employeeAId}/schedules`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ weekday: 1, startTime: '08:00', endTime: '10:00', active: true })
        .expect(201);
      scheduleIds.push(schedule.body.id);

      await request(app.getHttpServer())
        .post(`/api/employees/${employeeAId}/schedules`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ weekday: 1, startTime: '09:00', endTime: '11:00', active: true })
        .expect(409);
      await request(app.getHttpServer())
        .post(`/api/employees/${employeeAId}/schedules`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ weekday: 2, startTime: '18:00', endTime: '08:00', active: true })
        .expect(400);

      const block = await request(app.getHttpServer())
        .post(`/api/employees/${employeeAId}/unavailabilities/block`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          startAt: '2030-01-07T11:30:00.000Z',
          endAt: '2030-01-07T12:00:00.000Z',
          reason: 'Bloqueio E2E',
        })
        .expect(201);
      unavailabilityIds.push(block.body.id);

      const availability = await request(app.getHttpServer())
        .get(
          `/api/employees/${employeeAId}/availability?date=2030-01-07&durationMinutes=30&stepMinutes=30`,
        )
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      expect(availability.body.slots.map((slot: { startAt: string }) => slot.startAt)).toEqual([
        '2030-01-07T11:00:00.000Z',
        '2030-01-07T12:00:00.000Z',
        '2030-01-07T12:30:00.000Z',
      ]);

      const dayOff = await request(app.getHttpServer())
        .post(`/api/employees/${employeeAId}/unavailabilities/day-off`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ date: '2030-01-07', reason: 'Folga E2E' })
        .expect(201);
      unavailabilityIds.push(dayOff.body.id);

      const unavailable = await request(app.getHttpServer())
        .get(`/api/employees/${employeeAId}/availability?date=2030-01-07`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      expect(unavailable.body.slots).toEqual([]);

      await request(app.getHttpServer())
        .post(`/api/employees/${employeeBId}/unavailabilities/day-off`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ date: '2030-01-08' })
        .expect(404);
      await request(app.getHttpServer())
        .get(`/api/employees/${employeeBId}/availability?date=2030-01-07`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);

      const receptionistToken = await login(`receptionist-a-${suffix}@example.com`);
      await request(app.getHttpServer())
        .post(`/api/employees/${employeeAId}/unavailabilities/day-off`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({ date: '2030-01-08' })
        .expect(403);
    } finally {
      await db.employeeUnavailability.deleteMany({ where: { id: { in: unavailabilityIds } } });
      await db.workSchedule.deleteMany({ where: { id: { in: scheduleIds } } });
    }
  });

  it('valida CRUD, busca, paginação, permissões e isolamento de clientes', async () => {
    const tokenA = await login(`admin-a-${suffix}@example.com`);
    const tokenB = await login(`admin-b-${suffix}@example.com`);
    const receptionistToken = await login(`receptionist-a-${suffix}@example.com`);
    const phone = `119${String(Date.now()).slice(-8)}`;
    const cpf = `8${String(Date.now()).slice(-10)}`;
    let customerId: string | undefined;

    try {
      const created = await request(app.getHttpServer())
        .post('/api/customers')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: `Cliente CRUD ${suffix}`,
          phone: `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7)}`,
          cpf,
        })
        .expect(201);
      customerId = created.body.id;
      expect(created.body.phone).toBe(phone);
      expect(created.body.cpf).toBe(cpf);

      await request(app.getHttpServer())
        .post('/api/customers')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Telefone repetido', phone })
        .expect(409);

      const list = await request(app.getHttpServer())
        .get(`/api/customers?search=${phone}&page=1&limit=1&sortBy=CREATED_AT&direction=DESC`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      expect(list.body).toEqual(expect.objectContaining({ page: 1, limit: 1, total: 1, pages: 1 }));
      expect(list.body.items[0].id).toBe(customerId);

      const updated = await request(app.getHttpServer())
        .patch(`/api/customers/${customerId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: `Cliente atualizado ${suffix}` })
        .expect(200);
      expect(updated.body.name).toBe(`Cliente atualizado ${suffix}`);

      const detail = await request(app.getHttpServer())
        .get(`/api/customers/${customerId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      expect(detail.body.customer.id).toBe(customerId);
      expect(detail.body).toEqual(
        expect.objectContaining({
          serviceHistory: [],
          productPurchases: [],
          nextAppointment: null,
          metrics: { visits: 0, totalSpent: 0, lastVisit: null },
        }),
      );

      await request(app.getHttpServer())
        .patch(`/api/customers/${customerId}/archive`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ archived: true })
        .expect(200);
      const archived = await request(app.getHttpServer())
        .get(`/api/customers?status=ARCHIVED&search=${phone}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      expect(archived.body.items.map((item: { id: string }) => item.id)).toContain(customerId);

      await request(app.getHttpServer())
        .patch(`/api/customers/${customerId}/archive`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ archived: false })
        .expect(200);

      await request(app.getHttpServer())
        .get(`/api/customers/${customerId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(404);
      await request(app.getHttpServer())
        .patch(`/api/customers/${customerId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ name: 'Invasão' })
        .expect(404);

      await request(app.getHttpServer())
        .patch(`/api/customers/${customerId}`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({ name: 'Sem permissão' })
        .expect(403);
      await request(app.getHttpServer())
        .patch(`/api/customers/${customerId}/archive`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({ archived: true })
        .expect(403);
    } finally {
      if (customerId) await db.customer.deleteMany({ where: { id: customerId } });
    }
  });

  it('valida o catálogo completo de serviços, permissões e isolamento', async () => {
    const tokenA = await login(`admin-a-${suffix}@example.com`);
    const tokenB = await login(`admin-b-${suffix}@example.com`);
    const receptionistToken = await login(`receptionist-a-${suffix}@example.com`);
    let categoryId: string | undefined;
    let serviceId: string | undefined;

    try {
      const category = await request(app.getHttpServer())
        .post('/api/services/categories')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: `Categoria ${suffix}` })
        .expect(201);
      categoryId = category.body.id;

      const created = await request(app.getHttpServer())
        .post('/api/services')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: `Serviço ${suffix}`,
          categoryId,
          price: 49.9,
          durationMinutes: 45,
          commissionFixed: 15,
        })
        .expect(201);
      serviceId = created.body.id;
      expect(created.body.category.id).toBe(categoryId);

      await request(app.getHttpServer())
        .post('/api/services')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Comissão inválida',
          price: 40,
          durationMinutes: 30,
          commissionPercent: 50,
          commissionFixed: 10,
        })
        .expect(400);

      const updated = await request(app.getHttpServer())
        .patch(`/api/services/${serviceId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ commissionPercent: 35, commissionFixed: null })
        .expect(200);
      expect(Number(updated.body.commissionPercent)).toBe(35);
      expect(updated.body.commissionFixed).toBeNull();

      await request(app.getHttpServer())
        .post(`/api/services/${serviceId}/professionals/${employeeAId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ commissionFixed: 20 })
        .expect(201);

      const details = await request(app.getHttpServer())
        .get(`/api/services/${serviceId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      expect(details.body.service.employeeServices[0].employeeId).toBe(employeeAId);
      expect(details.body.commissionPriority).toHaveLength(3);

      await request(app.getHttpServer())
        .patch(`/api/services/${serviceId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ name: 'Invasão' })
        .expect(404);
      await request(app.getHttpServer())
        .post(`/api/services/${serviceId}/professionals/${employeeBId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({})
        .expect(404);
      await request(app.getHttpServer())
        .patch(`/api/services/${serviceId}/status`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({ active: false })
        .expect(403);

      const inactive = await request(app.getHttpServer())
        .patch(`/api/services/${serviceId}/status`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ active: false })
        .expect(200);
      expect(inactive.body.active).toBe(false);
    } finally {
      if (serviceId) {
        await db.employeeService.deleteMany({ where: { serviceId } });
        await db.service.deleteMany({ where: { id: serviceId } });
      }
      if (categoryId) await db.serviceCategory.deleteMany({ where: { id: categoryId } });
    }
  });

  it('valida produtos, estoque, identificadores e concorrência na baixa', async () => {
    const tokenA = await login(`admin-a-${suffix}@example.com`);
    const tokenB = await login(`admin-b-${suffix}@example.com`);
    const receptionistToken = await login(`receptionist-a-${suffix}@example.com`);
    let categoryId: string | undefined;
    let productId: string | undefined;
    const sku = `SKU-${suffix}`;
    const barcode = `789${Date.now()}`;

    try {
      const category = await request(app.getHttpServer())
        .post('/api/products/categories')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: `Produtos ${suffix}` })
        .expect(201);
      categoryId = category.body.id;

      const created = await request(app.getHttpServer())
        .post('/api/products')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: `Produto ${suffix}`,
          categoryId,
          sku,
          barcode,
          costPrice: 10,
          salePrice: 25,
          minimumStock: 2,
        })
        .expect(201);
      productId = created.body.id;

      await request(app.getHttpServer())
        .post('/api/products')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'SKU repetido', sku, costPrice: 5, salePrice: 10, minimumStock: 0 })
        .expect(409);
      await request(app.getHttpServer())
        .post('/api/products')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Barcode repetido', barcode, costPrice: 5, salePrice: 10, minimumStock: 0 })
        .expect(409);

      await request(app.getHttpServer())
        .post(`/api/products/${productId}/movements`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ type: 'ENTRY', quantity: 1, reason: 'Carga inicial' })
        .expect(201);

      const losses = await Promise.all([
        request(app.getHttpServer())
          .post(`/api/products/${productId}/movements`)
          .set('Authorization', `Bearer ${tokenA}`)
          .send({ type: 'LOSS', quantity: 1, reason: 'Concorrência A' }),
        request(app.getHttpServer())
          .post(`/api/products/${productId}/movements`)
          .set('Authorization', `Bearer ${tokenA}`)
          .send({ type: 'LOSS', quantity: 1, reason: 'Concorrência B' }),
      ]);
      expect(losses.map(({ status }) => status).sort()).toEqual([201, 409]);

      const details = await request(app.getHttpServer())
        .get(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      expect(details.body.stockQuantity).toBe(0);
      expect(details.body.lowStock).toBe(true);
      expect(details.body.movements).toHaveLength(2);

      await request(app.getHttpServer())
        .patch(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ name: 'Invasão' })
        .expect(404);
      await request(app.getHttpServer())
        .post(`/api/products/${productId}/movements`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({ type: 'ENTRY', quantity: 1 })
        .expect(403);

      await request(app.getHttpServer())
        .patch('/api/products/settings/stock')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ allowNegativeStock: true })
        .expect(200);
      await request(app.getHttpServer())
        .post(`/api/products/${productId}/movements`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ type: 'ADJUSTMENT', quantity: -2, reason: 'Inventário' })
        .expect(201);
      const negative = await db.product.findUniqueOrThrow({ where: { id: productId } });
      expect(negative.stockQuantity).toBe(-2);
    } finally {
      if (productId) {
        await db.inventoryMovement.deleteMany({ where: { productId } });
        await db.product.deleteMany({ where: { id: productId } });
      }
      if (categoryId) await db.productCategory.deleteMany({ where: { id: categoryId } });
    }
  });

  it('valida agenda, múltiplos serviços, status, isolamento e disputa de horário', async () => {
    const tokenA = await login(`admin-a-${suffix}@example.com`);
    const tokenB = await login(`admin-b-${suffix}@example.com`);
    const appointmentIds: string[] = [];
    const serviceIds: string[] = [];
    let scheduleId: string | undefined;

    try {
      const schedule = await db.workSchedule.create({
        data: {
          barbershopId: shopAId,
          employeeId: employeeAId,
          weekday: 1,
          startTime: '08:00',
          endTime: '12:00',
          breakStart: '10:00',
          breakEnd: '10:30',
        },
      });
      scheduleId = schedule.id;
      for (const [name, price, durationMinutes] of [
        [`Corte agenda ${suffix}`, 40, 30],
        [`Barba agenda ${suffix}`, 25, 20],
      ] as const) {
        const service = await db.service.create({
          data: { barbershopId: shopAId, name, price, durationMinutes },
        });
        serviceIds.push(service.id);
        await db.employeeService.create({
          data: { barbershopId: shopAId, employeeId: employeeAId, serviceId: service.id },
        });
      }

      const slots = await request(app.getHttpServer())
        .post('/api/appointments/available-slots')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ employeeId: employeeAId, serviceIds, date: '2030-01-07', stepMinutes: 10 })
        .expect(201);
      expect(slots.body.durationMinutes).toBe(50);
      expect(slots.body.slots[0].startAt).toBe('2030-01-07T11:00:00.000Z');

      const payload = {
        customerId: customerAId,
        employeeId: employeeAId,
        serviceIds,
        startAt: '2030-01-07T11:00:00.000Z',
      };
      const disputed = await Promise.all([
        request(app.getHttpServer())
          .post('/api/appointments')
          .set('Authorization', `Bearer ${tokenA}`)
          .send(payload),
        request(app.getHttpServer())
          .post('/api/appointments')
          .set('Authorization', `Bearer ${tokenA}`)
          .send(payload),
      ]);
      expect(disputed.map(({ status }) => status).sort()).toEqual([201, 409]);
      const created = disputed.find(({ status }) => status === 201)!;
      appointmentIds.push(created.body.id);
      expect(Number(created.body.price)).toBe(65);
      expect(created.body.services).toHaveLength(2);

      const updated = await request(app.getHttpServer())
        .patch(`/api/appointments/${created.body.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ startAt: '2030-01-07T11:30:00.000Z' })
        .expect(200);
      expect(updated.body.startAt).toBe('2030-01-07T11:30:00.000Z');

      await request(app.getHttpServer())
        .post(`/api/appointments/${created.body.id}/confirm`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(201);
      const cancelled = await request(app.getHttpServer())
        .post(`/api/appointments/${created.body.id}/cancel`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ reason: 'Cliente solicitou' })
        .expect(201);
      expect(cancelled.body.status).toBe('CANCELLED');
      expect(cancelled.body.cancellationReason).toBe('Cliente solicitou');

      const noShow = await request(app.getHttpServer())
        .post('/api/appointments')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...payload, serviceIds: [serviceIds[0]], startAt: '2030-01-07T12:00:00.000Z' })
        .expect(201);
      appointmentIds.push(noShow.body.id);
      const missed = await request(app.getHttpServer())
        .post(`/api/appointments/${noShow.body.id}/no-show`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(201);
      expect(missed.body.status).toBe('NO_SHOW');

      const list = await request(app.getHttpServer())
        .get('/api/appointments?start=2030-01-07T00:00:00.000Z&end=2030-01-08T00:00:00.000Z')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      expect(list.body.map((item: { id: string }) => item.id)).toEqual(
        expect.arrayContaining(appointmentIds),
      );

      await request(app.getHttpServer())
        .post('/api/appointments')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ ...payload, customerId: customerBId, startAt: '2030-01-07T13:30:00.000Z' })
        .expect(404);
      await request(app.getHttpServer())
        .patch(`/api/appointments/${created.body.id}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ notes: 'Invasão' })
        .expect(404);
    } finally {
      await db.appointment.deleteMany({
        where: {
          employeeId: employeeAId,
          startAt: {
            gte: new Date('2030-01-07T00:00:00.000Z'),
            lt: new Date('2030-01-08T00:00:00.000Z'),
          },
        },
      });
      await db.employeeService.deleteMany({ where: { serviceId: { in: serviceIds } } });
      await db.service.deleteMany({ where: { id: { in: serviceIds } } });
      if (scheduleId) await db.workSchedule.deleteMany({ where: { id: scheduleId } });
    }
  });

  it('finaliza venda dividida e reverte toda a transacao quando o estoque falha', async () => {
    const tokenA = await login(`admin-a-${suffix}@example.com`);
    await db.setting.upsert({
      where: { barbershopId: shopAId },
      update: { allowNegativeStock: false },
      create: { barbershopId: shopAId, allowNegativeStock: false },
    });
    const service = await db.service.create({
      data: {
        barbershopId: shopAId,
        name: `Corte venda ${suffix}`,
        price: 50,
        durationMinutes: 30,
        commissionPercent: 20,
      },
    });
    await db.employeeService.create({
      data: { barbershopId: shopAId, employeeId: employeeAId, serviceId: service.id },
    });
    const stocked = await db.product.create({
      data: {
        barbershopId: shopAId,
        name: `A produto ${suffix}`,
        costPrice: 10,
        salePrice: 30,
        stockQuantity: 2,
        commissionPercent: 10,
      },
    });
    const unavailable = await db.product.create({
      data: {
        barbershopId: shopAId,
        name: `Z sem estoque ${suffix}`,
        costPrice: 5,
        salePrice: 20,
        stockQuantity: 0,
      },
    });
    let saleId: string | undefined;
    let commissionTransactionId: string | undefined;
    try {
      const sale = await request(app.getHttpServer())
        .post('/api/sales/walk-in')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ employeeId: employeeAId, customerId: customerAId })
        .expect(201);
      saleId = sale.body.id;

      await request(app.getHttpServer())
        .post(`/api/sales/${saleId}/items/services`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ serviceId: service.id, quantity: 1 })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/sales/${saleId}/items/products`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ productId: stocked.id, quantity: 1 })
        .expect(201);
      const withUnavailable = await request(app.getHttpServer())
        .post(`/api/sales/${saleId}/items/products`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ productId: unavailable.id, quantity: 1 })
        .expect(201);

      const receptionistToken = await login(`receptionist-a-${suffix}@example.com`);
      await request(app.getHttpServer())
        .patch(`/api/sales/${saleId}/discount`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({ amount: 5, reason: 'Sem autorizacao' })
        .expect(403);

      await request(app.getHttpServer())
        .post(`/api/sales/${saleId}/finalize`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ payments: [{ method: 'PIX', amount: 100 }] })
        .expect(409);

      const [afterFailure, failedSale, failedMovements, failedTransactions] = await Promise.all([
        db.product.findUniqueOrThrow({ where: { id: stocked.id } }),
        db.sale.findUniqueOrThrow({ where: { id: saleId } }),
        db.inventoryMovement.count({ where: { saleId } }),
        db.financialTransaction.count({ where: { saleId } }),
      ]);
      expect(afterFailure.stockQuantity).toBe(2);
      expect(failedSale.status).toBe('DRAFT');
      expect(failedMovements).toBe(0);
      expect(failedTransactions).toBe(0);

      const unavailableItem = withUnavailable.body.items.find(
        (item: { productId?: string }) => item.productId === unavailable.id,
      );
      await request(app.getHttpServer())
        .delete(`/api/sales/${saleId}/items/${unavailableItem.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/api/sales/${saleId}/discount`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ amount: 10, reason: 'Cortesia de fidelidade' })
        .expect(200);
      await request(app.getHttpServer())
        .post(`/api/sales/${saleId}/finalize`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          payments: [
            { method: 'PIX', amount: 40 },
            { method: 'CASH', amount: 30 },
          ],
        })
        .expect(201);

      const [finished, updatedProduct, movements, transactions, commissions] = await Promise.all([
        db.sale.findUniqueOrThrow({ where: { id: saleId }, include: { payments: true } }),
        db.product.findUniqueOrThrow({ where: { id: stocked.id } }),
        db.inventoryMovement.count({ where: { saleId } }),
        db.financialTransaction.count({ where: { saleId } }),
        db.commission.findMany({ where: { saleId } }),
      ]);
      expect(finished.status).toBe('COMPLETED');
      expect(Number(finished.total)).toBe(70);
      expect(finished.payments).toHaveLength(2);
      expect(updatedProduct.stockQuantity).toBe(1);
      expect(movements).toBe(1);
      expect(transactions).toBe(2);
      expect(commissions).toHaveLength(1);
      expect(Number(commissions[0].amount)).toBe(13);
      expect(commissions[0].calculation).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ source: 'SERVICE', ruleType: 'PERCENT', amount: 10 }),
          expect.objectContaining({ source: 'PRODUCT', ruleType: 'PERCENT', amount: 3 }),
        ]),
      );

      const commissionList = await request(app.getHttpServer())
        .get('/api/commissions?start=2026-01-01T00:00:00.000Z&end=2027-01-01T00:00:00.000Z')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      expect(commissionList.body.items.map((item: { id: string }) => item.id)).toContain(
        commissions[0].id,
      );
      expect(commissionList.body.summary).toEqual(
        expect.objectContaining({ sold: expect.any(Number), commission: expect.any(Number) }),
      );
      await request(app.getHttpServer())
        .get('/api/commissions')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .expect(403);

      await request(app.getHttpServer())
        .patch(`/api/commissions/${commissions[0].id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ amount: 14, reason: 'Ajuste acordado com o profissional' })
        .expect(200);
      const paid = await request(app.getHttpServer())
        .post('/api/commissions/pay')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          commissionIds: [commissions[0].id],
          method: 'PIX',
          notes: 'Fechamento semanal',
        })
        .expect(201);
      commissionTransactionId = paid.body.transaction.id;

      const [paidCommission, expense, audits] = await Promise.all([
        db.commission.findUniqueOrThrow({ where: { id: commissions[0].id } }),
        db.financialTransaction.findUniqueOrThrow({ where: { id: commissionTransactionId } }),
        db.auditLog.findMany({
          where: {
            barbershopId: shopAId,
            action: { in: ['COMMISSION_ADJUSTED', 'COMMISSIONS_PAID'] },
          },
        }),
      ]);
      expect(paidCommission.status).toBe('PAID');
      expect(paidCommission.paidById).toBe(userBId);
      expect(paidCommission.paymentMethod).toBe('PIX');
      expect(Number(expense.amount)).toBe(14);
      expect(expense.type).toBe('EXPENSE');
      expect(audits.map((audit) => audit.action)).toEqual(
        expect.arrayContaining(['COMMISSION_ADJUSTED', 'COMMISSIONS_PAID']),
      );
      await request(app.getHttpServer())
        .post(`/api/commissions/${commissions[0].id}/pay`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ method: 'CASH' })
        .expect(409);
    } finally {
      if (saleId) {
        await db.commission.deleteMany({ where: { saleId } });
        await db.sale.deleteMany({ where: { id: saleId } });
      }
      if (commissionTransactionId) {
        await db.financialTransaction.deleteMany({ where: { id: commissionTransactionId } });
      }
      await db.auditLog.deleteMany({
        where: {
          barbershopId: shopAId,
          action: { in: ['COMMISSION_ADJUSTED', 'COMMISSIONS_PAID'] },
        },
      });
      await db.employeeService.deleteMany({ where: { serviceId: service.id } });
      await db.service.deleteMany({ where: { id: service.id } });
      await db.product.deleteMany({ where: { id: { in: [stocked.id, unavailable.id] } } });
    }
  });

  it('isola e baixa contas a pagar e receber com lançamentos financeiros', async () => {
    const tokenA = await login(`admin-a-${suffix}@example.com`);
    const tokenB = await login(`admin-b-${suffix}@example.com`);
    const transactionIds: string[] = [];
    let supplierId: string | undefined;
    let expenseCategoryId: string | undefined;
    let incomeCategoryId: string | undefined;
    try {
      const supplier = await request(app.getHttpServer())
        .post('/api/suppliers')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: `Fornecedor ${suffix}`, document: '12.345.678/0001-99' })
        .expect(201);
      supplierId = supplier.body.id;
      const expenseCategory = await request(app.getHttpServer())
        .post('/api/financial-categories')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: `Despesa ${suffix}`, type: 'EXPENSE' })
        .expect(201);
      expenseCategoryId = expenseCategory.body.id;
      const incomeCategory = await request(app.getHttpServer())
        .post('/api/financial-categories')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: `Receita ${suffix}`, type: 'INCOME' })
        .expect(201);
      incomeCategoryId = incomeCategory.body.id;

      const payable = await request(app.getHttpServer())
        .post('/api/accounts/payable')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          supplierId,
          categoryId: expenseCategoryId,
          description: `Aluguel ${suffix}`,
          amount: 450,
          dueDate: '2026-10-10',
        })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/accounts/payable/${payable.body.id}/pay`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ method: 'PIX' })
        .expect(404);
      const paid = await request(app.getHttpServer())
        .post(`/api/accounts/payable/${payable.body.id}/pay`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ method: 'PIX' })
        .expect(201);
      transactionIds.push(paid.body.transaction.id);
      expect(paid.body.transaction.origin).toBe('ACCOUNT_PAYABLE');
      expect(paid.body.transaction.type).toBe('EXPENSE');

      await request(app.getHttpServer())
        .post('/api/accounts/receivable')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          customerId: customerBId,
          description: `Inválida ${suffix}`,
          amount: 10,
          dueDate: '2026-10-10',
        })
        .expect(404);
      const receivable = await request(app.getHttpServer())
        .post('/api/accounts/receivable')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          customerId: customerAId,
          categoryId: incomeCategoryId,
          description: `Crédito ${suffix}`,
          amount: 90,
          dueDate: '2026-10-10',
        })
        .expect(201);
      const received = await request(app.getHttpServer())
        .post(`/api/accounts/receivable/${receivable.body.id}/receive`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ method: 'CASH' })
        .expect(201);
      transactionIds.push(received.body.transaction.id);
      expect(received.body.transaction.origin).toBe('ACCOUNT_RECEIVABLE');
      expect(received.body.transaction.type).toBe('INCOME');

      await request(app.getHttpServer())
        .post('/api/expense-recurrences')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          supplierId,
          categoryId: expenseCategoryId,
          description: `Internet ${suffix}`,
          amount: 120,
          dueDate: '2026-10-15',
          frequency: 'MONTHLY',
          intervalCount: 1,
        })
        .expect(201);
      const tenantBList = await request(app.getHttpServer())
        .get('/api/accounts/payable')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);
      expect(
        tenantBList.body.items.some((item: { description: string }) =>
          item.description.includes(suffix),
        ),
      ).toBe(false);
    } finally {
      await db.accountPayable.deleteMany({ where: { barbershopId: shopAId } });
      await db.accountReceivable.deleteMany({ where: { barbershopId: shopAId } });
      await db.expenseRecurrence.deleteMany({ where: { barbershopId: shopAId } });
      if (transactionIds.length) {
        await db.financialTransaction.deleteMany({ where: { id: { in: transactionIds } } });
      }
      await db.auditLog.deleteMany({
        where: {
          barbershopId: shopAId,
          action: { in: ['ACCOUNT_PAYABLE_PAID', 'ACCOUNT_RECEIVABLE_RECEIVED'] },
        },
      });
      if (supplierId) await db.supplier.deleteMany({ where: { id: supplierId } });
      const categoryIds = [expenseCategoryId, incomeCategoryId].filter((id): id is string =>
        Boolean(id),
      );
      if (categoryIds.length) {
        await db.financialCategory.deleteMany({ where: { id: { in: categoryIds } } });
      }
    }
  });

  it('permite ao Super Admin cadastrar um tenant com administrador inicial', async () => {
    const token = await login(`super-${suffix}@example.com`);
    const plans = await request(app.getHttpServer())
      .get('/api/super-admin/plans')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const targetPlanId = plans.body.find((plan: { active: boolean }) => plan.active).id;

    const createdPlan = await request(app.getHttpServer())
      .post('/api/super-admin/plans')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Teste ${suffix}`,
        price: 49.9,
        maxEmployees: 5,
        maxUsers: 2,
        features: { agenda: true },
      })
      .expect(201);
    createdPlanId = createdPlan.body.id;
    const updatedPlan = await request(app.getHttpServer())
      .patch(`/api/super-admin/plans/${createdPlanId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ price: 59.9 })
      .expect(200);
    expect(Number(updatedPlan.body.price)).toBe(59.9);

    const response = await request(app.getHttpServer())
      .post('/api/super-admin/barbershops')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Tenant criado ${suffix}`,
        ownerName: 'Novo Proprietário',
        email: `tenant-${suffix}@example.com`,
        documentType: 'CPF',
        document: String(Date.now()).slice(-11),
        phone: '11999999999',
        planId: createdPlanId,
        adminName: 'Novo Administrador',
        adminEmail: `novo-admin-${suffix}@example.com`,
        adminPassword: password,
        adminPasswordConfirmation: password,
      })
      .expect(201);

    createdShopId = response.body.id;
    createdAdminId = response.body.users[0].id;
    expect(response.body.subscription.plan.id).toBe(createdPlanId);

    const updatedShop = await request(app.getHttpServer())
      .patch(`/api/super-admin/barbershops/${createdShopId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Tenant atualizado ${suffix}`,
        phone: '(11) 98888-7777',
        planId: targetPlanId,
      })
      .expect(200);
    expect(updatedShop.body.name).toBe(`Tenant atualizado ${suffix}`);
    expect(updatedShop.body.subscription.plan.id).toBe(targetPlanId);

    await request(app.getHttpServer())
      .patch(`/api/super-admin/barbershops/${createdShopId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'SUSPENDED' })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: `novo-admin-${suffix}@example.com`, password })
      .expect(401);
    await request(app.getHttpServer())
      .patch(`/api/super-admin/barbershops/${createdShopId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'ACTIVE' })
      .expect(200);

    const detail = await request(app.getHttpServer())
      .get(`/api/super-admin/barbershops/${createdShopId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(detail.body._count.users).toBe(1);

    const trial = await request(app.getHttpServer())
      .post(`/api/super-admin/barbershops/${createdShopId}/subscription/trial`)
      .set('Authorization', `Bearer ${token}`)
      .send({ days: 14 })
      .expect(201);
    expect(trial.body.status).toBe('TRIAL');

    const history = await request(app.getHttpServer())
      .get(`/api/super-admin/barbershops/${createdShopId}/subscription-history`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(history.body.map((entry: { action: string }) => entry.action)).toEqual(
      expect.arrayContaining(['SUBSCRIPTION_CREATED', 'TRIAL_STARTED']),
    );
    expect(history.body.some((entry: { action: string }) => entry.action.startsWith('PLAN_'))).toBe(
      true,
    );

    await request(app.getHttpServer())
      .post(`/api/super-admin/barbershops/${createdShopId}/subscription/activate`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    const renewed = await request(app.getHttpServer())
      .post(`/api/super-admin/barbershops/${createdShopId}/subscription/renew`)
      .set('Authorization', `Bearer ${token}`)
      .send({ months: 2 })
      .expect(201);
    expect(renewed.body.status).toBe('ACTIVE');
    expect(new Date(renewed.body.expiresAt).getTime()).toBeGreaterThan(Date.now());

    const invoice = await request(app.getHttpServer())
      .post(`/api/super-admin/barbershops/${createdShopId}/invoices`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 100, discount: 10, dueDate: new Date(Date.now() + 86400000).toISOString() })
      .expect(201);
    expect(Number(invoice.body.total)).toBe(90);
    expect(invoice.body.status).toBe('PENDING');

    const paidInvoice = await request(app.getHttpServer())
      .post(`/api/super-admin/invoices/${invoice.body.id}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 90, method: 'PIX' })
      .expect(201);
    expect(paidInvoice.body.status).toBe('PAID');
    expect(paidInvoice.body.payments).toHaveLength(1);

    const invoices = await request(app.getHttpServer())
      .get('/api/super-admin/invoices?status=PAID')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(invoices.body.items.some((item: { id: string }) => item.id === invoice.body.id)).toBe(
      true,
    );

    const refunded = await request(app.getHttpServer())
      .post(`/api/super-admin/invoices/${invoice.body.id}/refund`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect(refunded.body.status).toBe('REFUNDED');

    const cancelledInvoice = await request(app.getHttpServer())
      .post(`/api/super-admin/barbershops/${createdShopId}/invoices`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 59.9, dueDate: new Date(Date.now() + 86400000).toISOString() })
      .expect(201);
    const cancelled = await request(app.getHttpServer())
      .post(`/api/super-admin/invoices/${cancelledInvoice.body.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect(cancelled.body.status).toBe('CANCELLED');

    const dashboard = await request(app.getHttpServer())
      .get('/api/super-admin/dashboard')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(dashboard.body.metrics.total).toBeGreaterThanOrEqual(3);

    const adminToken = await login(`novo-admin-${suffix}@example.com`);
    const customers = await request(app.getHttpServer())
      .get('/api/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(customers.body.items).toEqual([]);
  });
});
