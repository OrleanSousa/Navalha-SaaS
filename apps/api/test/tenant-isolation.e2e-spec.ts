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
      db.customer.create({
        data: { barbershopId: shopAId, name: `Cliente A ${suffix}`, phone: '11911111111' },
      }),
      db.customer.create({
        data: { barbershopId: shopBId, name: `Cliente B ${suffix}`, phone: '11922222222' },
      }),
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
        document: '12345678901',
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
