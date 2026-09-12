import { DataService } from './data.service';
import { EmployeeAbsenceType } from './data.dto';
import * as fs from 'node:fs/promises';

jest.mock('node:fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
}));

describe('DataService tenant isolation', () => {
  let db: any;
  let service: DataService;

  beforeEach(() => {
    jest.clearAllMocks();
    db = {
      customer: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
      },
      employee: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn().mockResolvedValue({}),
      },
      permission: { findMany: jest.fn().mockResolvedValue([]) },
      rolePermission: { findMany: jest.fn().mockResolvedValue([]) },
      userPermission: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      session: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      subscription: {
        findUnique: jest.fn().mockResolvedValue({ plan: { maxUsers: 0 } }),
      },
      setting: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn(),
      },
      service: { findMany: jest.fn().mockResolvedValue([]) },
      product: { findMany: jest.fn().mockResolvedValue([]) },
      appointment: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      sale: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { total: null }, _avg: { total: null } }),
      },
      commission: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
      },
      workSchedule: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      employeeUnavailability: {
        create: jest.fn(),
        findFirst: jest.fn(),
        delete: jest.fn(),
      },
      cashRegister: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    db.$transaction = jest.fn((callback) => callback(db));
    service = new DataService(db, { barbershopId: 'shop-1' } as any);
  });

  it.each([
    ['customers', 'customer'],
    ['employees', 'employee'],
    ['services', 'service'],
    ['products', 'product'],
  ] as const)('isola a listagem de %s pelo tenant', async (method, model) => {
    await service[method]();

    expect(db[model].findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ barbershopId: 'shop-1' }),
      }),
    );
  });

  it('cadastra cliente com telefone e WhatsApp normalizados', async () => {
    db.customer.create.mockResolvedValue({ id: 'customer-1' });

    await service.createCustomer({
      name: '  Ana Souza  ',
      phone: '(11) 99876-5432',
      whatsapp: '(11) 98765-4321',
      email: 'ANA@EXAMPLE.COM ',
      cpf: '123.456.789-01',
      birthDate: '1990-05-10',
      notes: '  Cliente recorrente  ',
    });

    expect(db.customer.create).toHaveBeenCalledWith({
      data: {
        barbershopId: 'shop-1',
        name: 'Ana Souza',
        phone: '11998765432',
        whatsapp: '11987654321',
        email: 'ana@example.com',
        cpf: '12345678901',
        birthDate: new Date('1990-05-10T00:00:00.000Z'),
        notes: 'Cliente recorrente',
      },
    });
  });

  it('rejeita telefone sem DDD válido', async () => {
    await expect(service.createCustomer({ name: 'Ana', phone: '9876-5432' })).rejects.toThrow(
      'Informe um telefone com DDD válido',
    );
    expect(db.customer.create).not.toHaveBeenCalled();
  });

  it('edita cliente normalizando os campos de contato', async () => {
    db.customer.findFirst
      .mockResolvedValueOnce({ id: 'customer-1', phone: '11999999999', cpf: null })
      .mockResolvedValueOnce(null);
    db.customer.update.mockResolvedValue({ id: 'customer-1' });

    await service.updateCustomer('customer-1', {
      name: '  Ana Atualizada  ',
      phone: '(21) 99876-5432',
      whatsapp: '',
      email: 'NOVA@EXAMPLE.COM',
    });

    expect(db.customer.update).toHaveBeenCalledWith({
      where: { id: 'customer-1' },
      data: expect.objectContaining({
        name: 'Ana Atualizada',
        phone: '21998765432',
        whatsapp: null,
        email: 'nova@example.com',
      }),
    });
  });

  it('não edita cliente de outro tenant', async () => {
    db.customer.findFirst.mockResolvedValue(null);

    await expect(service.updateCustomer('customer-other', { name: 'Outro' })).rejects.toThrow(
      'Cliente não encontrado',
    );
    expect(db.customer.update).not.toHaveBeenCalled();
  });

  it('arquiva e restaura cliente sem remover seu histórico', async () => {
    db.customer.findFirst.mockResolvedValue({ id: 'customer-1' });
    db.customer.update.mockResolvedValue({ id: 'customer-1' });

    await service.setCustomerArchive('customer-1', true);
    expect(db.customer.update).toHaveBeenLastCalledWith({
      where: { id: 'customer-1' },
      data: { deletedAt: expect.any(Date) },
    });

    await service.setCustomerArchive('customer-1', false);
    expect(db.customer.update).toHaveBeenLastCalledWith({
      where: { id: 'customer-1' },
      data: { deletedAt: null },
    });
  });

  it('busca clientes por nome, telefone e CPF normalizados', async () => {
    await service.customers({ status: 'ACTIVE', search: '(11) 99876-5432' } as any);

    expect(db.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          barbershopId: 'shop-1',
          deletedAt: null,
          OR: [
            { name: { contains: '(11) 99876-5432', mode: 'insensitive' } },
            { phone: { contains: '11998765432' } },
            { cpf: { contains: '11998765432' } },
          ],
        }),
      }),
    );
  });

  it('pagina e ordena clientes dentro do tenant', async () => {
    db.customer.findMany.mockResolvedValue([{ id: 'customer-1' }]);
    db.customer.count.mockResolvedValue(12);

    const result = await service.customers({
      page: 2,
      limit: 5,
      status: 'ALL',
      sortBy: 'CREATED_AT',
      direction: 'DESC',
    } as any);

    expect(db.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' }, skip: 5, take: 5 }),
    );
    expect(result).toEqual({
      items: [{ id: 'customer-1' }],
      page: 2,
      limit: 5,
      total: 12,
      pages: 3,
    });
  });

  it.each([
    ['phone', { phone: '11999990000', cpf: null }, 'Já existe um cliente com este telefone'],
    ['cpf', { phone: '11888880000', cpf: '12345678901' }, 'Já existe um cliente com este CPF'],
  ])(
    'rejeita cliente com %s duplicado quando a política bloqueia',
    async (_, duplicate, message) => {
      db.customer.findFirst.mockResolvedValue(duplicate);

      await expect(
        service.createCustomer({
          name: 'Cliente duplicado',
          phone: '11999990000',
          cpf: '123.456.789-01',
        }),
      ).rejects.toThrow(message);
      expect(db.customer.create).not.toHaveBeenCalled();
    },
  );

  it('permite duplicidade liberada pela configuração do tenant', async () => {
    db.setting.findUnique.mockResolvedValue({
      allowDuplicateCustomerPhone: true,
      allowDuplicateCustomerCpf: true,
    });
    db.customer.create.mockResolvedValue({ id: 'customer-2' });

    await service.createCustomer({
      name: 'Cliente permitido',
      phone: '11999990000',
      cpf: '12345678901',
    });

    expect(db.customer.findFirst).not.toHaveBeenCalled();
    expect(db.customer.create).toHaveBeenCalled();
  });

  it('salva a política de duplicidade somente no tenant autenticado', async () => {
    db.setting.upsert.mockResolvedValue({
      allowDuplicateCustomerPhone: true,
      allowDuplicateCustomerCpf: false,
    });

    const result = await service.updateCustomerDuplicatePolicy({
      allowDuplicatePhone: true,
      allowDuplicateCpf: false,
    });

    expect(db.setting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { barbershopId: 'shop-1' },
        create: expect.objectContaining({ barbershopId: 'shop-1' }),
      }),
    );
    expect(result).toEqual({ allowDuplicatePhone: true, allowDuplicateCpf: false });
  });

  it('carrega a ficha do cliente somente no tenant autenticado', async () => {
    db.customer.findFirst.mockResolvedValue({ id: 'customer-1', name: 'Ana' });

    const result = await service.customerDetails('customer-1');

    expect(db.customer.findFirst).toHaveBeenCalledWith({
      where: { id: 'customer-1', barbershopId: 'shop-1' },
    });
    expect(result.customer.name).toBe('Ana');
    expect(db.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { barbershopId: 'shop-1', customerId: 'customer-1', status: 'COMPLETED' },
      }),
    );
  });

  it('retorna histórico de serviços concluídos em ordem recente', async () => {
    db.customer.findFirst.mockResolvedValue({ id: 'customer-1', name: 'Ana' });
    db.appointment.findMany.mockResolvedValue([{ id: 'appointment-1' }]);

    const result = await service.customerDetails('customer-1');

    expect(result.serviceHistory).toEqual([{ id: 'appointment-1' }]);
    expect(db.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { startAt: 'desc' } }),
    );
  });

  it('não revela ficha de cliente de outro tenant', async () => {
    db.customer.findFirst.mockResolvedValue(null);
    await expect(service.customerDetails('customer-other')).rejects.toThrow(
      'Cliente não encontrado',
    );
  });

  it('isola a agenda pelo tenant', async () => {
    await service.appointments();

    expect(db.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ barbershopId: 'shop-1' }),
      }),
    );
  });

  it('pagina e filtra colaboradores sem sair do tenant', async () => {
    db.employee.findMany
      .mockResolvedValueOnce([{ id: 'employee-1', name: 'Ana' }])
      .mockResolvedValueOnce([{ position: 'Barbeiro' }]);
    db.employee.count.mockResolvedValue(1);

    const result = await service.employees({
      page: 2,
      limit: 5,
      search: 'ana',
      status: 'ACTIVE',
      position: 'Barbeiro',
    } as any);

    expect(db.employee.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          barbershopId: 'shop-1',
          active: true,
          position: 'Barbeiro',
          OR: expect.any(Array),
        }),
        skip: 5,
        take: 5,
      }),
    );
    expect(db.employee.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ barbershopId: 'shop-1' }),
    });
    expect(result).toEqual(
      expect.objectContaining({ items: [{ id: 'employee-1', name: 'Ana' }], total: 1, pages: 1 }),
    );
    expect(result.positions).toEqual(['Barbeiro']);
  });

  it('carrega detalhes e indicadores do colaborador sem sair do tenant', async () => {
    db.employee.findFirst.mockResolvedValue({
      id: 'employee-1',
      name: 'Maria',
      schedules: [],
      unavailabilities: [],
      employeeServices: [],
    });
    db.appointment.findMany.mockResolvedValue([]);
    db.appointment.count.mockResolvedValueOnce(4).mockResolvedValueOnce(3);
    db.sale.aggregate.mockResolvedValue({ _sum: { total: 250 }, _count: { _all: 2 } });
    db.commission.aggregate.mockResolvedValue({ _sum: { amount: 75 } });

    const result = await service.employeeDetails('employee-1');

    expect(db.employee.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'employee-1', barbershopId: 'shop-1', deletedAt: null },
        include: expect.objectContaining({
          schedules: expect.any(Object),
          unavailabilities: { orderBy: { startAt: 'asc' } },
        }),
      }),
    );
    for (const [query] of [
      ...db.appointment.findMany.mock.calls,
      ...db.appointment.count.mock.calls,
      ...db.sale.aggregate.mock.calls,
      ...db.commission.aggregate.mock.calls,
    ]) {
      expect(query.where).toEqual(expect.objectContaining({ barbershopId: 'shop-1' }));
    }
    expect(result.metrics).toEqual({
      appointments: 4,
      completedAppointments: 3,
      sales: 2,
      revenue: 250,
      commissions: 75,
    });
  });

  it('não revela detalhes de colaborador de outro tenant', async () => {
    db.employee.findFirst.mockResolvedValue(null);

    await expect(service.employeeDetails('employee-other')).rejects.toThrow(
      'Colaborador não encontrado',
    );
    expect(db.appointment.findMany).not.toHaveBeenCalled();
  });

  it('cadastra colaborador no tenant autenticado', async () => {
    db.employee.create.mockResolvedValue({ id: 'employee-2', name: 'Maria' });

    await service.createEmployee({
      name: ' Maria ',
      email: 'MARIA@EXEMPLO.COM',
      color: '#527CA0',
      defaultCommission: 40,
    });

    expect(db.employee.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ barbershopId: 'shop-1' }) }),
    );
    expect(db.employee.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        barbershopId: 'shop-1',
        name: 'Maria',
        email: 'maria@exemplo.com',
        defaultCommission: 40,
      }),
    });
  });

  it('impede CPF duplicado no mesmo tenant', async () => {
    db.employee.findFirst.mockResolvedValue({ cpf: '12345678900', email: null });

    await expect(
      service.createEmployee({
        name: 'Maria',
        cpf: '12345678900',
        color: '#527CA0',
        defaultCommission: 0,
      }),
    ).rejects.toThrow('CPF já cadastrado');
    expect(db.employee.create).not.toHaveBeenCalled();
  });

  it('edita somente colaborador pertencente ao tenant', async () => {
    db.employee.findFirst.mockResolvedValueOnce({ id: 'employee-1' }).mockResolvedValueOnce(null);
    db.employee.update.mockResolvedValue({ id: 'employee-1', name: 'Maria Silva' });

    await service.updateEmployee('employee-1', {
      name: ' Maria Silva ',
      email: 'MARIA@EXEMPLO.COM',
      phone: null,
    } as any);

    expect(db.employee.findFirst).toHaveBeenNthCalledWith(1, {
      where: { id: 'employee-1', barbershopId: 'shop-1', deletedAt: null },
    });
    expect(db.employee.update).toHaveBeenCalledWith({
      where: { id: 'employee-1' },
      data: expect.objectContaining({
        name: 'Maria Silva',
        email: 'maria@exemplo.com',
        phone: null,
      }),
    });
  });

  it('não edita colaborador de outro tenant', async () => {
    db.employee.findFirst.mockResolvedValue(null);

    await expect(service.updateEmployee('employee-other', { name: 'Outro' })).rejects.toThrow(
      'Colaborador não encontrado',
    );
    expect(db.employee.update).not.toHaveBeenCalled();
  });

  it('inativa colaborador do tenant autenticado', async () => {
    db.employee.findFirst.mockResolvedValue({ id: 'employee-1', active: true });
    db.employee.update.mockResolvedValue({ id: 'employee-1', active: false });

    const result = await service.setEmployeeStatus('employee-1', false);

    expect(db.employee.findFirst).toHaveBeenCalledWith({
      where: { id: 'employee-1', barbershopId: 'shop-1', deletedAt: null },
      select: { id: true, active: true },
    });
    expect(db.employee.update).toHaveBeenCalledWith({
      where: { id: 'employee-1' },
      data: { active: false },
    });
    expect(result.active).toBe(false);
  });

  it('não altera status de colaborador de outro tenant', async () => {
    db.employee.findFirst.mockResolvedValue(null);

    await expect(service.setEmployeeStatus('employee-other', false)).rejects.toThrow(
      'Colaborador não encontrado',
    );
    expect(db.employee.update).not.toHaveBeenCalled();
  });

  it('armazena foto somente para colaborador do tenant', async () => {
    db.employee.findFirst.mockResolvedValue({
      id: 'employee-1',
      photoUrl: '/uploads/employees/old.png',
    });
    db.employee.update.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'employee-1', ...data }),
    );
    const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const result = await service.uploadEmployeePhoto('employee-1', {
      mimetype: 'image/png',
      buffer,
    } as Express.Multer.File);

    expect(fs.mkdir).toHaveBeenCalledWith(expect.stringContaining('employees'), {
      recursive: true,
    });
    expect(fs.writeFile).toHaveBeenCalledWith(expect.stringMatching(/\.png$/), buffer);
    expect(db.employee.update).toHaveBeenCalledWith({
      where: { id: 'employee-1' },
      data: { photoUrl: expect.stringMatching(/^\/uploads\/employees\/.+\.png$/) },
    });
    expect(result.photoUrl).toMatch(/^\/uploads\/employees\//);
    expect(fs.unlink).toHaveBeenCalledWith(expect.stringMatching(/old\.png$/));
  });

  it('não grava foto para colaborador de outro tenant', async () => {
    db.employee.findFirst.mockResolvedValue(null);

    await expect(
      service.uploadEmployeePhoto('employee-other', {
        mimetype: 'image/png',
        buffer: Buffer.from('imagem'),
      } as Express.Multer.File),
    ).rejects.toThrow('Colaborador não encontrado');
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('rejeita arquivo com MIME de imagem e conteúdo inválido', async () => {
    db.employee.findFirst.mockResolvedValue({ id: 'employee-1', photoUrl: null });

    await expect(
      service.uploadEmployeePhoto('employee-1', {
        mimetype: 'image/png',
        buffer: Buffer.from('não é imagem'),
      } as Express.Multer.File),
    ).rejects.toThrow('Conteúdo da imagem inválido');
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('cria acesso vinculado a colaborador ativo do tenant', async () => {
    db.employee.findFirst.mockResolvedValue({
      id: 'employee-1',
      name: 'Maria',
      active: true,
      userId: null,
    });
    db.employee.update.mockResolvedValue({
      id: 'employee-1',
      user: { id: 'user-1', email: 'maria@example.com', role: 'BARBER', active: true },
    });

    await service.createEmployeeAccess('employee-1', {
      email: 'MARIA@EXAMPLE.COM',
      password: 'Senha@123',
      role: 'BARBER',
    } as any);

    expect(db.employee.findFirst).toHaveBeenCalledWith({
      where: { id: 'employee-1', barbershopId: 'shop-1', deletedAt: null },
      select: { id: true, name: true, active: true, userId: true },
    });
    expect(db.employee.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'employee-1' },
        data: {
          user: {
            create: expect.objectContaining({
              barbershopId: 'shop-1',
              email: 'maria@example.com',
              role: 'BARBER',
              passwordHash: expect.not.stringMatching(/^Senha@123$/),
            }),
          },
        },
      }),
    );
  });

  it('respeita o limite de usuários do plano', async () => {
    db.employee.findFirst.mockResolvedValue({
      id: 'employee-1',
      name: 'Maria',
      active: true,
      userId: null,
    });
    db.subscription.findUnique.mockResolvedValue({ plan: { maxUsers: 2 } });
    db.user.count.mockResolvedValue(2);

    await expect(
      service.createEmployeeAccess('employee-1', {
        email: 'maria@example.com',
        password: 'Senha@123',
        role: 'BARBER',
      } as any),
    ).rejects.toThrow('Limite de usuários do plano atingido');
    expect(db.employee.update).not.toHaveBeenCalled();
  });

  it('retorna permissões efetivas do acesso do colaborador', async () => {
    db.employee.findFirst.mockResolvedValue({
      id: 'employee-1',
      name: 'Maria',
      user: { id: 'user-1', email: 'maria@example.com', role: 'BARBER', active: true },
    });
    db.permission.findMany.mockResolvedValue([
      { id: 'p1', key: 'dashboard.read', description: 'Dashboard' },
      { id: 'p2', key: 'customers.read', description: 'Clientes' },
    ]);
    db.rolePermission.findMany.mockResolvedValue([{ permissionId: 'p1' }]);
    db.userPermission.findMany.mockResolvedValue([{ permissionId: 'p2', granted: true }]);

    const result = await service.employeeAccess('employee-1');

    expect(result.permissions).toEqual([
      expect.objectContaining({ key: 'dashboard.read', inherited: true, granted: true }),
      expect.objectContaining({ key: 'customers.read', inherited: false, granted: true }),
    ]);
  });

  it('salva somente diferenças entre perfil e permissões individuais', async () => {
    db.employee.findFirst.mockResolvedValue({
      id: 'employee-1',
      user: { id: 'user-1', email: 'maria@example.com' },
    });
    db.user.findUnique.mockResolvedValue({ id: 'user-1' });
    db.permission.findMany
      .mockResolvedValueOnce([{ id: 'p2', key: 'customers.read' }])
      .mockResolvedValueOnce([
        { id: 'p1', key: 'dashboard.read' },
        { id: 'p2', key: 'customers.read' },
      ]);
    db.rolePermission.findMany.mockResolvedValue([{ permissionId: 'p1' }]);
    jest.spyOn(service, 'employeeAccess').mockResolvedValue({ updated: true } as any);

    await service.updateEmployeeAccess('employee-1', {
      email: 'maria@example.com',
      role: 'BARBER',
      active: true,
      permissions: ['customers.read'],
    } as any);

    expect(db.userPermission.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        { userId: 'user-1', permissionId: 'p1', granted: false },
        { userId: 'user-1', permissionId: 'p2', granted: true },
      ]),
    });
    expect(db.session.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('configura comissão padrão somente no colaborador do tenant', async () => {
    db.employee.findFirst.mockResolvedValue({ id: 'employee-1' });
    db.employee.update.mockResolvedValue({ id: 'employee-1', defaultCommission: 42.5 });

    const result = await service.setEmployeeCommission('employee-1', 42.5);

    expect(db.employee.findFirst).toHaveBeenCalledWith({
      where: { id: 'employee-1', barbershopId: 'shop-1', deletedAt: null },
      select: { id: true },
    });
    expect(db.employee.update).toHaveBeenCalledWith({
      where: { id: 'employee-1' },
      data: { defaultCommission: 42.5 },
    });
    expect(result.defaultCommission).toBe(42.5);
  });

  it('não configura comissão de colaborador de outro tenant', async () => {
    db.employee.findFirst.mockResolvedValue(null);

    await expect(service.setEmployeeCommission('employee-other', 30)).rejects.toThrow(
      'Colaborador não encontrado',
    );
    expect(db.employee.update).not.toHaveBeenCalled();
  });

  it('cria jornada vinculada ao colaborador e tenant autenticados', async () => {
    db.employee.findFirst.mockResolvedValue({ id: 'employee-1' });
    db.workSchedule.create.mockResolvedValue({ id: 'schedule-1' });

    await service.createWorkSchedule('employee-1', {
      weekday: 1,
      startTime: '08:00',
      endTime: '18:00',
      breakStart: '12:00',
      breakEnd: '13:00',
      active: true,
    });

    expect(db.workSchedule.create).toHaveBeenCalledWith({
      data: {
        barbershopId: 'shop-1',
        employeeId: 'employee-1',
        weekday: 1,
        startTime: '08:00',
        endTime: '18:00',
        breakStart: '12:00',
        breakEnd: '13:00',
        active: true,
      },
    });
  });

  it('edita e exclui somente jornada pertencente ao tenant e colaborador', async () => {
    db.workSchedule.findFirst
      .mockResolvedValueOnce({
        id: 'schedule-1',
        weekday: 1,
        startTime: '08:00',
        endTime: '18:00',
        breakStart: null,
        breakEnd: null,
        active: true,
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'schedule-1' });
    db.workSchedule.update.mockResolvedValue({ id: 'schedule-1', endTime: '17:00' });

    await service.updateWorkSchedule('employee-1', 'schedule-1', { endTime: '17:00' });
    await service.deleteWorkSchedule('employee-1', 'schedule-1');

    expect(db.workSchedule.findFirst).toHaveBeenCalledWith({
      where: { id: 'schedule-1', employeeId: 'employee-1', barbershopId: 'shop-1' },
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
    expect(db.workSchedule.update).toHaveBeenCalledWith({
      where: { id: 'schedule-1' },
      data: {
        weekday: 1,
        startTime: '08:00',
        endTime: '17:00',
        breakStart: null,
        breakEnd: null,
        active: true,
      },
    });
    expect(db.workSchedule.delete).toHaveBeenCalledWith({ where: { id: 'schedule-1' } });
  });

  it('não altera jornada pertencente a outro tenant', async () => {
    db.workSchedule.findFirst.mockResolvedValue(null);

    await expect(
      service.updateWorkSchedule('employee-1', 'schedule-other', { endTime: '17:00' }),
    ).rejects.toThrow('Jornada não encontrada');
    await expect(service.deleteWorkSchedule('employee-1', 'schedule-other')).rejects.toThrow(
      'Jornada não encontrada',
    );
    expect(db.workSchedule.update).not.toHaveBeenCalled();
    expect(db.workSchedule.delete).not.toHaveBeenCalled();
  });

  it.each([
    [
      'fim anterior ao início',
      { weekday: 1, startTime: '18:00', endTime: '08:00', active: true },
      'O fim da jornada deve ser posterior ao início',
    ],
    [
      'pausa incompleta',
      {
        weekday: 1,
        startTime: '08:00',
        endTime: '18:00',
        breakStart: '12:00',
        active: true,
      },
      'Informe o início e o fim da pausa',
    ],
    [
      'pausa invertida',
      {
        weekday: 1,
        startTime: '08:00',
        endTime: '18:00',
        breakStart: '13:00',
        breakEnd: '12:00',
        active: true,
      },
      'O fim da pausa deve ser posterior ao início',
    ],
    [
      'pausa fora da jornada',
      {
        weekday: 1,
        startTime: '08:00',
        endTime: '18:00',
        breakStart: '07:30',
        breakEnd: '08:30',
        active: true,
      },
      'A pausa deve estar dentro da jornada',
    ],
  ])('rejeita jornada com %s', async (_, dto, message) => {
    db.employee.findFirst.mockResolvedValue({ id: 'employee-1' });

    await expect(service.createWorkSchedule('employee-1', dto)).rejects.toThrow(message);
    expect(db.workSchedule.create).not.toHaveBeenCalled();
  });

  it('rejeita sobreposição entre jornadas ativas no mesmo dia', async () => {
    db.employee.findFirst.mockResolvedValue({ id: 'employee-1' });
    db.workSchedule.findFirst.mockResolvedValue({ id: 'schedule-existing' });

    await expect(
      service.createWorkSchedule('employee-1', {
        weekday: 1,
        startTime: '12:00',
        endTime: '19:00',
        active: true,
      }),
    ).rejects.toThrow('A jornada sobrepõe outro horário do colaborador');
    expect(db.workSchedule.findFirst).toHaveBeenCalledWith({
      where: {
        barbershopId: 'shop-1',
        employeeId: 'employee-1',
        weekday: 1,
        active: true,
        startTime: { lt: '19:00' },
        endTime: { gt: '12:00' },
      },
      select: { id: true },
    });
    expect(db.workSchedule.create).not.toHaveBeenCalled();
  });

  it('permite horários adjacentes e jornadas inativas', async () => {
    db.employee.findFirst.mockResolvedValue({ id: 'employee-1' });
    db.workSchedule.findFirst.mockResolvedValue(null);
    db.workSchedule.create.mockResolvedValue({ id: 'schedule-2' });

    await service.createWorkSchedule('employee-1', {
      weekday: 1,
      startTime: '18:00',
      endTime: '20:00',
      active: true,
    });
    await service.createWorkSchedule('employee-1', {
      weekday: 1,
      startTime: '12:00',
      endTime: '14:00',
      active: false,
    });

    expect(db.workSchedule.create).toHaveBeenCalledTimes(2);
    expect(db.workSchedule.findFirst).toHaveBeenCalledTimes(1);
  });

  it('cadastra folga de dia inteiro no tenant do colaborador', async () => {
    db.employee.findFirst.mockResolvedValue({ id: 'employee-1' });
    db.employeeUnavailability.create.mockResolvedValue({ id: 'day-off-1' });

    await service.createEmployeeDayOff('employee-1', {
      date: '2026-09-20',
      reason: '  Compensação  ',
    });

    expect(db.employeeUnavailability.create).toHaveBeenCalledWith({
      data: {
        barbershopId: 'shop-1',
        employeeId: 'employee-1',
        type: 'DAY_OFF',
        startAt: new Date('2026-09-20T00:00:00.000Z'),
        endAt: new Date('2026-09-21T00:00:00.000Z'),
        allDay: true,
        reason: 'Compensação',
      },
    });
  });

  it('rejeita data de folga inexistente', async () => {
    db.employee.findFirst.mockResolvedValue({ id: 'employee-1' });

    await expect(
      service.createEmployeeDayOff('employee-1', { date: '2026-02-31' }),
    ).rejects.toThrow('Data inválida');
    expect(db.employeeUnavailability.create).not.toHaveBeenCalled();
  });

  it.each([EmployeeAbsenceType.VACATION, EmployeeAbsenceType.LEAVE])(
    'cadastra período de %s',
    async (type) => {
      db.employee.findFirst.mockResolvedValue({ id: 'employee-1' });
      db.employeeUnavailability.create.mockResolvedValue({ id: 'absence-1' });

      await service.createEmployeeAbsence('employee-1', {
        type,
        startDate: '2026-10-01',
        endDate: '2026-10-10',
        reason: 'Período programado',
      });

      expect(db.employeeUnavailability.create).toHaveBeenCalledWith({
        data: {
          barbershopId: 'shop-1',
          employeeId: 'employee-1',
          type,
          startAt: new Date('2026-10-01T00:00:00.000Z'),
          endAt: new Date('2026-10-11T00:00:00.000Z'),
          allDay: true,
          reason: 'Período programado',
        },
      });
    },
  );

  it('rejeita período de ausência invertido', async () => {
    db.employee.findFirst.mockResolvedValue({ id: 'employee-1' });

    await expect(
      service.createEmployeeAbsence('employee-1', {
        type: EmployeeAbsenceType.VACATION,
        startDate: '2026-10-10',
        endDate: '2026-10-01',
      }),
    ).rejects.toThrow('O fim do período deve ser igual ou posterior ao início');
    expect(db.employeeUnavailability.create).not.toHaveBeenCalled();
  });

  it('cadastra bloqueio pontual com horário', async () => {
    db.employee.findFirst.mockResolvedValue({ id: 'employee-1' });
    db.employeeUnavailability.create.mockResolvedValue({ id: 'block-1' });

    await service.createEmployeeScheduleBlock('employee-1', {
      startAt: '2026-09-20T13:00:00.000Z',
      endAt: '2026-09-20T14:30:00.000Z',
      reason: '  Compromisso  ',
    });

    expect(db.employeeUnavailability.create).toHaveBeenCalledWith({
      data: {
        barbershopId: 'shop-1',
        employeeId: 'employee-1',
        type: 'BLOCK',
        startAt: new Date('2026-09-20T13:00:00.000Z'),
        endAt: new Date('2026-09-20T14:30:00.000Z'),
        allDay: false,
        reason: 'Compromisso',
      },
    });
  });

  it('rejeita bloqueio pontual sem duração positiva', async () => {
    db.employee.findFirst.mockResolvedValue({ id: 'employee-1' });

    await expect(
      service.createEmployeeScheduleBlock('employee-1', {
        startAt: '2026-09-20T14:30:00.000Z',
        endAt: '2026-09-20T14:30:00.000Z',
      }),
    ).rejects.toThrow('O fim do bloqueio deve ser posterior ao início');
    expect(db.employeeUnavailability.create).not.toHaveBeenCalled();
  });

  it('exclui somente indisponibilidade do colaborador e tenant autenticados', async () => {
    db.employeeUnavailability.findFirst.mockResolvedValue({ id: 'day-off-1' });

    await service.deleteEmployeeUnavailability('employee-1', 'day-off-1');

    expect(db.employeeUnavailability.findFirst).toHaveBeenCalledWith({
      where: { id: 'day-off-1', employeeId: 'employee-1', barbershopId: 'shop-1' },
      select: { id: true },
    });
    expect(db.employeeUnavailability.delete).toHaveBeenCalledWith({ where: { id: 'day-off-1' } });
  });

  it('aplica o tenant em todas as consultas do dashboard', async () => {
    await service.dashboard();

    const calls = [
      ...db.sale.aggregate.mock.calls,
      ...db.appointment.findMany.mock.calls,
      ...db.appointment.count.mock.calls,
      ...db.cashRegister.findFirst.mock.calls,
    ];
    expect(calls).toHaveLength(5);
    for (const [query] of calls) {
      expect(query.where.barbershopId).toBe('shop-1');
    }
  });
});
