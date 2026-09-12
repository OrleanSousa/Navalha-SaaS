import { PrismaClient, Role, BarbershopStatus, AppointmentStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
const db = new PrismaClient();
const permissionCatalog = [
  ['dashboard.read', 'Visualizar o dashboard'],
  ['customers.read', 'Visualizar clientes'],
  ['employees.read', 'Visualizar colaboradores'],
  ['employees.create', 'Cadastrar colaboradores'],
  ['employees.update', 'Editar colaboradores'],
  ['employees.status', 'Ativar e inativar colaboradores'],
  ['employees.photo', 'Alterar foto de colaboradores'],
  ['employees.access', 'Criar acesso de colaboradores'],
  ['employees.permissions', 'Editar perfil e permissões'],
  ['employees.commission', 'Configurar comissão padrão'],
  ['employees.schedule', 'Gerenciar jornada semanal'],
  ['employees.unavailability', 'Gerenciar indisponibilidades'],
  ['services.read', 'Visualizar serviços'],
  ['products.read', 'Visualizar produtos'],
  ['appointments.read', 'Visualizar agenda'],
  ['customers.create', 'Cadastrar clientes'],
  ['services.create', 'Cadastrar serviços'],
  ['products.create', 'Cadastrar produtos'],
  ['appointments.create', 'Criar agendamentos'],
] as const;
async function seedPermissions() {
  const permissions = [];
  for (const [key, description] of permissionCatalog) {
    permissions.push(
      await db.permission.upsert({
        where: { key },
        update: { description },
        create: { key, description },
      }),
    );
  }
  await db.rolePermission.createMany({
    data: permissions.map((permission) => ({ role: Role.ADMIN, permissionId: permission.id })),
    skipDuplicates: true,
  });
  const receptionistKeys = new Set<string>([
    'dashboard.read',
    'customers.read',
    'employees.read',
    'services.read',
    'products.read',
    'appointments.read',
    'customers.create',
    'appointments.create',
  ]);
  await db.rolePermission.createMany({
    data: permissions
      .filter((permission) => receptionistKeys.has(permission.key))
      .map((permission) => ({ role: Role.RECEPTIONIST, permissionId: permission.id })),
    skipDuplicates: true,
  });
  const barberKeys = new Set<string>([
    'dashboard.read',
    'customers.read',
    'services.read',
    'products.read',
    'appointments.read',
    'appointments.create',
  ]);
  await db.rolePermission.createMany({
    data: permissions
      .filter((permission) => barberKeys.has(permission.key))
      .map((permission) => ({ role: Role.BARBER, permissionId: permission.id })),
    skipDuplicates: true,
  });
}
async function main() {
  const plan = await db.plan.upsert({
    where: { name: 'PRO' },
    update: {
      price: 0,
      maxEmployees: 0,
      maxUsers: 0,
      features: { pendingDefinition: true },
      active: true,
    },
    create: {
      name: 'PRO',
      price: 0,
      maxEmployees: 0,
      maxUsers: 0,
      features: { pendingDefinition: true },
      active: true,
    },
  });
  for (const name of ['BÁSICO', 'PREMIUM', 'EMPRESARIAL']) {
    await db.plan.upsert({
      where: { name },
      update: { active: true },
      create: {
        name,
        price: 0,
        maxEmployees: 0,
        maxUsers: 0,
        features: { pendingDefinition: true },
        active: true,
      },
    });
  }
  const shop = await db.barbershop.upsert({
    where: { slug: 'barbearia-modelo' },
    update: {},
    create: {
      name: 'Barbearia Modelo',
      tradeName: 'Barbearia Modelo',
      slug: 'barbearia-modelo',
      ownerName: 'Administrador',
      email: 'contato@barbeariamodelo.com',
      phone: '(11) 99999-0000',
      city: 'São Paulo',
      state: 'SP',
      status: BarbershopStatus.ACTIVE,
      subscription: { create: { planId: plan.id, status: 'ACTIVE' } },
      settings: { create: { openingHours: { mon: ['08:00', '18:00'], tue: ['08:00', '18:00'] } } },
    },
  });
  const passwordHash = await bcrypt.hash('Admin@123', 12);
  await db.user.upsert({
    where: { email: 'admin@barbeariamodelo.com' },
    update: { passwordHash },
    create: {
      barbershopId: shop.id,
      email: 'admin@barbeariamodelo.com',
      passwordHash,
      name: 'Administrador',
      role: Role.ADMIN,
    },
  });
  const superAdminPasswordHash = await bcrypt.hash('Super@123', 12);
  await db.user.upsert({
    where: { email: 'superadmin@navalha.com' },
    update: { passwordHash: superAdminPasswordHash, active: true },
    create: {
      email: 'superadmin@navalha.com',
      passwordHash: superAdminPasswordHash,
      name: 'Super Administrador',
      role: Role.SUPER_ADMIN,
    },
  });
  const colors = ['#527CA0', '#56845F', '#815E98'];
  const employees = [];
  for (const [i, name] of ['João Silva', 'Carlos Lima', 'Pedro Alves'].entries()) {
    let e = await db.employee.findFirst({ where: { barbershopId: shop.id, name } });
    e ??= await db.employee.create({
      data: {
        barbershopId: shop.id,
        name,
        phone: `(11) 9999${i}-000${i}`,
        position: 'Barbeiro',
        defaultCommission: 50,
        color: colors[i],
      },
    });
    employees.push(e);
  }
  const services = [];
  for (const s of [
    { name: 'Corte', price: 40, durationMinutes: 30, commissionPercent: 50 },
    { name: 'Barba', price: 30, durationMinutes: 30, commissionPercent: 50 },
    { name: 'Corte + Barba', price: 65, durationMinutes: 60, commissionPercent: 50 },
    { name: 'Sobrancelha', price: 15, durationMinutes: 15, commissionPercent: 40 },
  ]) {
    let x = await db.service.findFirst({ where: { barbershopId: shop.id, name: s.name } });
    x ??= await db.service.create({ data: { ...s, barbershopId: shop.id, category: 'Barbearia' } });
    services.push(x);
  }
  for (const p of [
    { name: 'Pomada', salePrice: 35, costPrice: 15, stockQuantity: 4, minimumStock: 5 },
    { name: 'Shampoo', salePrice: 30, costPrice: 12, stockQuantity: 12, minimumStock: 4 },
    { name: 'Balm', salePrice: 25, costPrice: 10, stockQuantity: 8, minimumStock: 3 },
  ]) {
    if (!(await db.product.findFirst({ where: { barbershopId: shop.id, name: p.name } })))
      await db.product.create({ data: { ...p, barbershopId: shop.id, category: 'Cuidados' } });
  }
  const customers = [];
  for (const [i, name] of [
    'Rafael Mendes',
    'Bruno Costa',
    'Lucas Rocha',
    'André Santos',
    'Gabriel Souza',
  ].entries()) {
    let c = await db.customer.findFirst({ where: { barbershopId: shop.id, name } });
    c ??= await db.customer.create({
      data: {
        barbershopId: shop.id,
        name,
        phone: `(11) 9888${i}-123${i}`,
        whatsapp: `119888${i}123${i}`,
      },
    });
    customers.push(c);
  }
  const today = new Date();
  today.setHours(9, 0, 0, 0);
  if (
    !(await db.appointment.count({
      where: {
        barbershopId: shop.id,
        startAt: { gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()) },
      },
    }))
  ) {
    for (let i = 0; i < 4; i++) {
      const start = new Date(today);
      start.setMinutes(start.getMinutes() + i * 60);
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + services[i % 3].durationMinutes);
      await db.appointment.create({
        data: {
          barbershopId: shop.id,
          customerId: customers[i].id,
          employeeId: employees[i % 3].id,
          startAt: start,
          endAt: end,
          status: i % 2 ? AppointmentStatus.SCHEDULED : AppointmentStatus.CONFIRMED,
          price: services[i % 3].price,
          services: {
            create: {
              barbershopId: shop.id,
              serviceId: services[i % 3].id,
              price: services[i % 3].price,
              durationMinutes: services[i % 3].durationMinutes,
            },
          },
        },
      });
    }
  }
  console.log('Seed concluído: admin@barbeariamodelo.com e superadmin@navalha.com');
}
seedPermissions()
  .then(main)
  .finally(() => db.$disconnect());
