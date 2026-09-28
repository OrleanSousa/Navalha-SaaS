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
  let availability: any;

  beforeEach(() => {
    jest.clearAllMocks();
    db = {
      barbershop: {
        findUnique: jest.fn().mockResolvedValue({ name: 'Barbearia Teste' }),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
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
      onboardingProgress: {
        upsert: jest.fn().mockResolvedValue({ completedSteps: [], completedAt: null }),
        update: jest.fn(),
      },
      service: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      serviceCategory: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      employeeService: {
        findFirst: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
      },
      product: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      productCategory: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      inventoryMovement: { create: jest.fn() },
      appointment: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
      },
      appointmentService: { deleteMany: jest.fn() },
      sale: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { total: null }, _avg: { total: null } }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      commission: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
      },
      financialTransaction: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
      auditLog: { create: jest.fn() },
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
      cashRegister: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
      },
      supplier: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      financialCategory: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      accountPayable: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      },
      accountReceivable: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
      },
      expenseRecurrence: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    db.$queryRaw = jest.fn().mockResolvedValue([]);
    db.$executeRaw = jest.fn().mockResolvedValue(1);
    db.$transaction = jest.fn((callback) => callback(db));
    availability = {
      employeeSlots: jest.fn(),
      assertEmployeeAvailable: jest.fn().mockResolvedValue(undefined),
    };
    service = new DataService(
      db,
      { barbershopId: 'shop-1', userId: 'user-1' } as any,
      availability,
    );
  });

  it('paga múltiplas comissões em uma única saída financeira auditada', async () => {
    db.commission.findMany
      .mockResolvedValueOnce([
        { id: 'commission-1', amount: 12, employee: { name: 'Ana' } },
        { id: 'commission-2', amount: 18, employee: { name: 'Bia' } },
      ])
      .mockResolvedValueOnce([
        { id: 'commission-1', status: 'PAID' },
        { id: 'commission-2', status: 'PAID' },
      ]);
    db.financialTransaction.create.mockResolvedValue({ id: 'transaction-1', amount: 30 });
    db.commission.updateMany.mockResolvedValue({ count: 2 });
    db.auditLog.create.mockResolvedValue({ id: 'audit-1' });

    const result = await service.payCommissions({
      commissionIds: ['commission-1', 'commission-2'],
      method: 'PIX',
      notes: 'Fechamento',
    });

    expect(db.financialTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        barbershopId: 'shop-1',
        type: 'EXPENSE',
        category: 'Comissões',
        amount: 30,
        method: 'PIX',
      }),
    });
    expect(db.commission.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ['commission-1', 'commission-2'] },
          status: 'PENDING',
        }),
        data: expect.objectContaining({
          status: 'PAID',
          paidById: 'user-1',
          financialTransactionId: 'transaction-1',
        }),
      }),
    );
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'COMMISSIONS_PAID', entity: 'Commission' }),
    });
    expect(result.commissions).toHaveLength(2);
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

  it('cadastra serviço no tenant autenticado e normaliza textos opcionais', async () => {
    db.service.create.mockResolvedValue({ id: 'service-1' });

    await service.createService({
      name: '  Corte degradê  ',
      description: '  Corte com acabamento  ',
      price: 55.9,
      durationMinutes: 45,
      commissionPercent: 40,
    });

    expect(db.service.create).toHaveBeenCalledWith({
      data: {
        barbershopId: 'shop-1',
        name: 'Corte degradê',
        description: 'Corte com acabamento',
        categoryId: null,
        price: 55.9,
        durationMinutes: 45,
        commissionPercent: 40,
        commissionFixed: null,
      },
      include: { category: true, _count: { select: { employeeServices: true } } },
    });
  });

  it('rejeita nome de serviço composto apenas por espaços', async () => {
    await expect(
      service.createService({ name: '   ', price: 30, durationMinutes: 30 }),
    ).rejects.toThrow('Informe um nome válido para o serviço');
    expect(db.service.create).not.toHaveBeenCalled();
  });

  it('rejeita comissão percentual e fixa simultâneas', async () => {
    await expect(
      service.createService({
        name: 'Corte',
        price: 40,
        durationMinutes: 30,
        commissionPercent: 50,
        commissionFixed: 20,
      }),
    ).rejects.toThrow('Informe comissão percentual ou fixa, nunca ambas');
    expect(db.service.create).not.toHaveBeenCalled();
  });

  it('não edita nem altera status de serviço de outro tenant', async () => {
    db.service.findFirst.mockResolvedValue(null);

    await expect(service.updateService('service-other', { name: 'Invadido' })).rejects.toThrow(
      'Serviço não encontrado',
    );
    await expect(service.setServiceStatus('service-other', false)).rejects.toThrow(
      'Serviço não encontrado',
    );
    expect(db.service.update).not.toHaveBeenCalled();
  });

  it('vincula somente profissional e serviço do tenant autenticado', async () => {
    db.service.findFirst.mockResolvedValue({
      id: 'service-1',
      commissionPercent: 40,
      commissionFixed: null,
    });
    db.employee.findFirst.mockResolvedValue({ id: 'employee-1' });
    db.employeeService.upsert.mockResolvedValue({ id: 'link-1' });

    await service.configureServiceProfessional('service-1', 'employee-1', {
      commissionFixed: 25,
    });

    expect(db.employeeService.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { employeeId_serviceId: { employeeId: 'employee-1', serviceId: 'service-1' } },
        create: expect.objectContaining({ barbershopId: 'shop-1', commissionFixed: 25 }),
      }),
    );
  });

  it.each([
    [
      'PROFESSIONAL',
      { commissionPercent: 35, commissionFixed: null },
      { commissionPercent: 40, commissionFixed: null },
      { type: 'PERCENT', value: 35, source: 'PROFESSIONAL' },
    ],
    [
      'SERVICE',
      { commissionPercent: null, commissionFixed: null },
      { commissionPercent: null, commissionFixed: 18 },
      { type: 'FIXED', value: 18, source: 'SERVICE' },
    ],
    [
      'EMPLOYEE',
      { commissionPercent: null, commissionFixed: null },
      { commissionPercent: null, commissionFixed: null },
      { type: 'PERCENT', value: 22, source: 'EMPLOYEE' },
    ],
  ])('aplica prioridade de comissão %s', async (_, specific, base, expected) => {
    db.service.findFirst.mockResolvedValue({
      id: 'service-1',
      ...base,
      employeeServices: [specific],
    });
    db.employee.findFirst.mockResolvedValue({ defaultCommission: 22 });

    await expect(service.serviceCommissionRule('service-1', 'employee-1')).resolves.toEqual(
      expected,
    );
  });

  it('cadastra produto normalizando identificadores no tenant autenticado', async () => {
    db.product.findFirst.mockResolvedValue(null);
    db.product.create.mockResolvedValue({ id: 'product-1' });

    await service.createProduct({
      name: '  Pomada modeladora  ',
      description: '  Efeito seco  ',
      sku: '  POM-01  ',
      barcode: '  789123  ',
      costPrice: 15,
      salePrice: 35,
      minimumStock: 5,
      commissionPercent: 10,
    });

    expect(db.product.create).toHaveBeenCalledWith({
      data: {
        barbershopId: 'shop-1',
        name: 'Pomada modeladora',
        description: 'Efeito seco',
        categoryId: null,
        sku: 'POM-01',
        barcode: '789123',
        costPrice: 15,
        salePrice: 35,
        minimumStock: 5,
        commissionPercent: 10,
      },
      include: { category: true },
    });
  });

  it.each([
    [{ sku: 'SKU-1', barcode: null }, 'Já existe um produto com este SKU'],
    [{ sku: null, barcode: '789' }, 'Já existe um produto com este código de barras'],
  ])('rejeita SKU e código de barras duplicados por tenant', async (duplicate, message) => {
    db.product.findFirst.mockResolvedValue(duplicate);
    await expect(
      service.createProduct({
        name: 'Produto',
        sku: duplicate.sku,
        barcode: duplicate.barcode,
        costPrice: 10,
        salePrice: 20,
        minimumStock: 0,
      }),
    ).rejects.toThrow(message);
    expect(db.product.create).not.toHaveBeenCalled();
  });

  it('registra perda e decrementa estoque atomicamente', async () => {
    db.product.findFirst.mockResolvedValue({ id: 'product-1' });
    db.product.updateMany.mockResolvedValue({ count: 1 });
    db.inventoryMovement.create.mockResolvedValue({ id: 'movement-1' });
    db.product.findUniqueOrThrow.mockResolvedValue({ id: 'product-1', stockQuantity: 3 });

    await service.createInventoryMovement('product-1', {
      type: 'LOSS',
      quantity: 2,
      reason: 'Avaria',
    } as any);

    expect(db.product.updateMany).toHaveBeenCalledWith({
      where: { id: 'product-1', barbershopId: 'shop-1', stockQuantity: { gte: 2 } },
      data: { stockQuantity: { increment: -2 } },
    });
    expect(db.inventoryMovement.create).toHaveBeenCalledWith({
      data: {
        barbershopId: 'shop-1',
        productId: 'product-1',
        userId: 'user-1',
        type: 'LOSS',
        quantity: -2,
        reason: 'Avaria',
      },
      include: { user: { select: { id: true, name: true } } },
    });
  });

  it('impede estoque negativo quando a atualização atômica não encontra saldo', async () => {
    db.product.findFirst.mockResolvedValue({ id: 'product-1' });
    db.product.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.createInventoryMovement('product-1', {
        type: 'LOSS',
        quantity: 10,
        reason: 'Avaria',
      } as any),
    ).rejects.toThrow('Estoque insuficiente para a movimentação');
    expect(db.inventoryMovement.create).not.toHaveBeenCalled();
  });

  it('cria agendamento com múltiplos serviços calculando duração e preço', async () => {
    db.customer.findFirst.mockResolvedValue({ id: 'customer-1' });
    db.employee.findFirst.mockResolvedValue({ id: 'employee-1' });
    db.service.findMany.mockResolvedValue([
      { id: 'service-1', price: 40, durationMinutes: 30 },
      { id: 'service-2', price: 25, durationMinutes: 20 },
    ]);
    db.appointment.create.mockResolvedValue({ id: 'appointment-1' });

    await service.createAppointment({
      customerId: 'customer-1',
      employeeId: 'employee-1',
      serviceIds: ['service-1', 'service-2'],
      startAt: '2030-01-07T11:00:00.000Z',
      notes: '  Preferência pela manhã  ',
    });

    expect(availability.assertEmployeeAvailable).toHaveBeenCalledWith(
      'employee-1',
      new Date('2030-01-07T11:00:00.000Z'),
      50,
    );
    expect(db.appointment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          barbershopId: 'shop-1',
          customerId: 'customer-1',
          employeeId: 'employee-1',
          endAt: new Date('2030-01-07T11:50:00.000Z'),
          price: 65,
          notes: 'Preferência pela manhã',
          services: {
            create: [
              {
                barbershopId: 'shop-1',
                serviceId: 'service-1',
                price: 40,
                durationMinutes: 30,
              },
              {
                barbershopId: 'shop-1',
                serviceId: 'service-2',
                price: 25,
                durationMinutes: 20,
              },
            ],
          },
        }),
      }),
    );
  });

  it('rejeita serviço não habilitado para o profissional', async () => {
    db.customer.findFirst.mockResolvedValue({ id: 'customer-1' });
    db.employee.findFirst.mockResolvedValue({ id: 'employee-1' });
    db.service.findMany.mockResolvedValue([]);

    await expect(
      service.createAppointment({
        customerId: 'customer-1',
        employeeId: 'employee-1',
        serviceIds: ['service-other'],
        startAt: '2030-01-07T11:00:00.000Z',
      }),
    ).rejects.toThrow('Um ou mais serviços não estão habilitados para o profissional');
    expect(db.appointment.create).not.toHaveBeenCalled();
  });

  it('não confirma agendamento de outro tenant', async () => {
    db.appointment.findFirst.mockResolvedValue(null);
    await expect(service.confirmAppointment('appointment-other')).rejects.toThrow(
      'Agendamento não encontrado',
    );
    expect(db.appointment.update).not.toHaveBeenCalled();
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
    db.customer.findMany.mockResolvedValue([{ id: 'customer-1', appointments: [], sales: [] }]);
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
      items: [{ id: 'customer-1', totalSpent: 0, lastVisit: null }],
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

  it('retorna somente produtos comprados pelo cliente', async () => {
    db.customer.findFirst.mockResolvedValue({ id: 'customer-1', name: 'Ana' });
    db.sale.findMany.mockResolvedValue([
      {
        id: 'sale-1',
        createdAt: new Date('2026-09-10T12:00:00.000Z'),
        items: [{ id: 'item-1', product: { id: 'product-1', name: 'Pomada' }, quantity: 2 }],
      },
    ]);

    const result = await service.customerDetails('customer-1');

    expect(db.sale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          barbershopId: 'shop-1',
          customerId: 'customer-1',
          status: 'COMPLETED',
          items: { some: { productId: { not: null } } },
        },
      }),
    );
    expect(result.productPurchases[0]).toEqual(
      expect.objectContaining({ id: 'item-1', saleId: 'sale-1', purchasedAt: expect.any(Date) }),
    );
  });

  it('calcula visitas, total gasto e último atendimento do cliente', async () => {
    db.customer.findFirst.mockResolvedValue({ id: 'customer-1', name: 'Ana' });
    db.appointment.findMany.mockResolvedValue([
      { id: 'appointment-2', startAt: new Date('2026-09-10T12:00:00.000Z') },
      { id: 'appointment-1', startAt: new Date('2026-08-10T12:00:00.000Z') },
    ]);
    db.sale.aggregate.mockResolvedValue({ _sum: { total: 425.5 } });

    const result = await service.customerDetails('customer-1');

    expect(result.metrics).toEqual({
      visits: 2,
      totalSpent: 425.5,
      lastVisit: new Date('2026-09-10T12:00:00.000Z'),
    });
    expect(db.sale.aggregate).toHaveBeenCalledWith({
      where: { barbershopId: 'shop-1', customerId: 'customer-1', status: 'COMPLETED' },
      _sum: { total: true },
    });
  });

  it('retorna o próximo agendamento válido do cliente', async () => {
    db.customer.findFirst.mockResolvedValue({ id: 'customer-1', name: 'Ana' });
    db.appointment.findFirst.mockResolvedValue({ id: 'next-appointment' });

    const result = await service.customerDetails('customer-1');

    expect(result.nextAppointment).toEqual({ id: 'next-appointment' });
    expect(db.appointment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          barbershopId: 'shop-1',
          customerId: 'customer-1',
          startAt: { gte: expect.any(Date) },
          status: { in: ['SCHEDULED', 'CONFIRMED'] },
        }),
        orderBy: { startAt: 'asc' },
      }),
    );
  });

  it('não revela ficha de cliente de outro tenant', async () => {
    db.customer.findFirst.mockResolvedValue(null);
    await expect(service.customerDetails('customer-other')).rejects.toThrow(
      'Cliente não encontrado',
    );
  });

  it('isola a agenda pelo tenant', async () => {
    await service.appointments({
      start: '2030-01-01T00:00:00.000Z',
      end: '2030-02-01T00:00:00.000Z',
    });

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
    ).rejects.toThrow('A jornada se sobrepõe a outro horário do colaborador');
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

  it('abre caixa com saldo inicial e registra auditoria no tenant', async () => {
    db.setting.findUnique.mockResolvedValue({ allowMultipleOpenCashRegisters: false });
    db.cashRegister.findFirst.mockResolvedValue(null);
    db.cashRegister.create.mockResolvedValue({
      id: 'cash-1',
      barbershopId: 'shop-1',
      openingBalance: 150.25,
      openedBy: { id: 'user-1', name: 'Admin' },
    });

    await service.openCashRegister({ openingBalance: 150.25 });

    expect(db.cashRegister.findFirst).toHaveBeenCalledWith({
      where: { barbershopId: 'shop-1', closedAt: null },
      select: { id: true },
    });
    expect(db.cashRegister.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          barbershopId: 'shop-1',
          openedById: 'user-1',
          openingBalance: 150.25,
        },
      }),
    );
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'CASH_REGISTER_OPENED' }),
      }),
    );
  });

  it('impede segundo caixa quando a configuração não permite', async () => {
    db.setting.findUnique.mockResolvedValue({ allowMultipleOpenCashRegisters: false });
    db.cashRegister.findFirst.mockResolvedValue({ id: 'cash-open' });

    await expect(service.openCashRegister({ openingBalance: 0 })).rejects.toThrow(
      'Já existe um caixa aberto',
    );
    expect(db.cashRegister.create).not.toHaveBeenCalled();
  });

  it('registra entrada manual somente em caixa aberto do tenant', async () => {
    db.cashRegister.findFirst.mockResolvedValue({ id: 'cash-1' });
    db.financialTransaction.create.mockResolvedValue({
      id: 'transaction-1',
      type: 'INCOME',
      category: 'Reforço',
      description: 'Troco',
      amount: 50,
      method: 'CASH',
      status: 'PAID',
    });

    await service.createFinancialTransaction('cash-1', {
      type: 'INCOME',
      category: ' Reforço ',
      description: ' Troco ',
      amount: 50,
      method: 'CASH',
    } as any);

    expect(db.cashRegister.findFirst).toHaveBeenCalledWith({
      where: { id: 'cash-1', barbershopId: 'shop-1', closedAt: null },
      select: { id: true },
    });
    expect(db.financialTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        barbershopId: 'shop-1',
        cashRegisterId: 'cash-1',
        origin: 'MANUAL',
        category: 'Reforço',
        amount: 50,
      }),
    });
  });

  it('cancela apenas lançamento manual pago de caixa aberto e audita', async () => {
    const transaction = {
      id: 'transaction-1',
      type: 'EXPENSE',
      category: 'Despesa',
      description: 'Material',
      amount: 25,
      method: 'PIX',
      status: 'PAID',
      notes: null,
    };
    db.financialTransaction.findFirst.mockResolvedValue(transaction);
    db.financialTransaction.update.mockResolvedValue({ ...transaction, status: 'CANCELLED' });

    await service.cancelFinancialTransaction('transaction-1', { reason: 'Duplicado' });

    expect(db.financialTransaction.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'transaction-1',
        barbershopId: 'shop-1',
        origin: 'MANUAL',
        status: 'PAID',
        cashRegister: { closedAt: null },
      },
    });
    expect(db.financialTransaction.update).toHaveBeenCalledWith({
      where: { id: 'transaction-1' },
      data: expect.objectContaining({
        status: 'CANCELLED',
        cancelledById: 'user-1',
        cancellationReason: 'Duplicado',
      }),
    });
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'FINANCIAL_TRANSACTION_CANCELLED' }),
      }),
    );
  });

  it('fecha caixa consolidando entradas, saídas e diferença', async () => {
    db.cashRegister.findFirst.mockResolvedValue({
      id: 'cash-1',
      barbershopId: 'shop-1',
      openingBalance: 100,
      openedAt: new Date('2026-09-28T10:00:00.000Z'),
      closedAt: null,
    });
    db.financialTransaction.findMany.mockResolvedValue([
      { type: 'INCOME', amount: 80, method: 'PIX' },
      { type: 'EXPENSE', amount: 20, method: 'CASH' },
    ]);
    db.cashRegister.update.mockResolvedValue({ id: 'cash-1', closingBalance: 155 });

    const result = await service.closeCashRegister('cash-1', {
      closingBalance: 155,
      notes: 'Conferido',
    });

    expect(result.summary).toEqual(
      expect.objectContaining({ income: 80, expense: 20, expectedBalance: 160 }),
    );
    expect(db.cashRegister.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'cash-1' },
        data: expect.objectContaining({
          closingBalance: 155,
          expectedBalance: 160,
          difference: -5,
          closedById: 'user-1',
        }),
      }),
    );
  });

  it('impede fechamento duplicado do caixa', async () => {
    db.cashRegister.findFirst.mockResolvedValue({
      id: 'cash-1',
      barbershopId: 'shop-1',
      openingBalance: 0,
      closedAt: new Date(),
    });

    await expect(service.closeCashRegister('cash-1', { closingBalance: 0 })).rejects.toThrow(
      'Este caixa já foi fechado',
    );
    expect(db.cashRegister.update).not.toHaveBeenCalled();
  });

  it('cadastra fornecedor normalizando documento e isolando pelo tenant', async () => {
    db.supplier.findFirst.mockResolvedValue(null);
    db.supplier.create.mockResolvedValue({ id: 'supplier-1' });

    await service.createSupplier({
      name: ' Fornecedor Modelo ',
      document: '12.345.678/0001-99',
      phone: '(11) 99999-0000',
    });

    expect(db.supplier.findFirst).toHaveBeenCalledWith({
      where: { barbershopId: 'shop-1', document: '12345678000199' },
      select: { id: true },
    });
    expect(db.supplier.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        barbershopId: 'shop-1',
        name: 'Fornecedor Modelo',
        document: '12345678000199',
        phone: '11999990000',
      }),
    });
  });

  it('cria conta a receber somente para cliente e categoria do tenant', async () => {
    db.customer.findFirst.mockResolvedValue({ id: 'customer-1' });
    db.financialCategory.findFirst.mockResolvedValue({ id: 'category-1' });
    db.accountReceivable.create.mockResolvedValue({ id: 'receivable-1' });

    await service.createAccountReceivable({
      customerId: 'customer-1',
      categoryId: 'category-1',
      description: 'Mensalidade',
      amount: 120,
      dueDate: '2026-10-10',
    });

    expect(db.customer.findFirst).toHaveBeenCalledWith({
      where: { id: 'customer-1', barbershopId: 'shop-1', deletedAt: null },
      select: { id: true },
    });
    expect(db.financialCategory.findFirst).toHaveBeenCalledWith({
      where: { id: 'category-1', barbershopId: 'shop-1', type: 'INCOME', active: true },
      select: { id: true },
    });
    expect(db.accountReceivable.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          barbershopId: 'shop-1',
          customerId: 'customer-1',
          amount: 120,
          dueDate: new Date('2026-10-10T00:00:00.000Z'),
        }),
      }),
    );
  });

  it('calcula conta vencida, totais e alertas sem alterar o status persistido', async () => {
    const past = new Date('2020-01-01T00:00:00.000Z');
    const item = {
      id: 'payable-1',
      amount: 75,
      status: 'PENDING',
      dueDate: past,
      supplier: null,
      category: null,
      paidBy: null,
    };
    db.accountPayable.findMany
      .mockResolvedValueOnce([item])
      .mockResolvedValueOnce([{ amount: 75, status: 'PENDING', dueDate: past }]);
    db.accountPayable.count.mockResolvedValue(1);

    const result = await service.accountPayables();

    expect(result.items[0]).toEqual(expect.objectContaining({ effectiveStatus: 'OVERDUE' }));
    expect(result.summary).toEqual(expect.objectContaining({ pending: 75, overdue: 75 }));
    expect(result.alerts.overdue).toBe(1);
    expect(db.accountPayable.findMany.mock.calls[0][0].where).toEqual(
      expect.objectContaining({ barbershopId: 'shop-1' }),
    );
  });

  it('baixa conta a pagar criando saída financeira e auditoria', async () => {
    db.accountPayable.findFirst.mockResolvedValue({
      id: 'payable-1',
      status: 'PENDING',
      amount: 250,
      dueDate: new Date('2026-10-10T00:00:00.000Z'),
      description: 'Aluguel',
      notes: null,
      category: { name: 'Estrutura' },
    });
    db.cashRegister.findFirst.mockResolvedValue({ id: 'cash-1' });
    db.financialTransaction.create.mockResolvedValue({ id: 'transaction-1' });
    db.accountPayable.update.mockResolvedValue({ id: 'payable-1', status: 'PAID' });

    await service.settleAccountPayable('payable-1', { method: 'PIX' } as any);

    expect(db.accountPayable.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'payable-1', barbershopId: 'shop-1' } }),
    );
    expect(db.financialTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        barbershopId: 'shop-1',
        cashRegisterId: 'cash-1',
        type: 'EXPENSE',
        origin: 'ACCOUNT_PAYABLE',
        category: 'Estrutura',
        amount: 250,
      }),
    });
    expect(db.accountPayable.update).toHaveBeenCalledWith({
      where: { id: 'payable-1' },
      data: expect.objectContaining({
        status: 'PAID',
        paidById: 'user-1',
        financialTransactionId: 'transaction-1',
      }),
    });
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'ACCOUNT_PAYABLE_PAID' }),
      }),
    );
  });

  it('baixa conta a receber criando entrada financeira', async () => {
    db.accountReceivable.findFirst.mockResolvedValue({
      id: 'receivable-1',
      status: 'PENDING',
      amount: 90,
      dueDate: new Date('2026-10-10T00:00:00.000Z'),
      description: 'Crédito do cliente',
      notes: null,
      category: null,
    });
    db.cashRegister.findFirst.mockResolvedValue(null);
    db.financialTransaction.create.mockResolvedValue({ id: 'transaction-2' });

    await service.settleAccountReceivable('receivable-1', { method: 'CASH' } as any);

    expect(db.financialTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'INCOME',
        origin: 'ACCOUNT_RECEIVABLE',
        amount: 90,
      }),
    });
    expect(db.accountReceivable.update).toHaveBeenCalledWith({
      where: { id: 'receivable-1' },
      data: expect.objectContaining({
        status: 'PAID',
        receivedById: 'user-1',
        financialTransactionId: 'transaction-2',
      }),
    });
  });

  it('cria recorrência e primeira despesa com chave de idempotência', async () => {
    db.expenseRecurrence.create.mockResolvedValue({ id: 'recurrence-1' });
    db.accountPayable.create.mockResolvedValue({ id: 'payable-1' });

    await service.createExpenseRecurrence({
      description: 'Internet',
      amount: 120,
      dueDate: '2026-10-10',
      frequency: 'MONTHLY',
      intervalCount: 1,
    } as any);

    expect(db.expenseRecurrence.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        barbershopId: 'shop-1',
        nextDueDate: new Date('2026-11-10T00:00:00.000Z'),
      }),
    });
    expect(db.accountPayable.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        recurrenceId: 'recurrence-1',
        recurrenceDueDate: new Date('2026-10-10T00:00:00.000Z'),
        dueDate: new Date('2026-10-10T00:00:00.000Z'),
      }),
    });
  });

  it('ajusta recorrência mensal ao último dia de meses mais curtos', async () => {
    db.expenseRecurrence.create.mockResolvedValue({ id: 'recurrence-2' });
    db.accountPayable.create.mockResolvedValue({ id: 'payable-2' });

    await service.createExpenseRecurrence({
      description: 'Licença',
      amount: 80,
      dueDate: '2027-01-31',
      frequency: 'MONTHLY',
      intervalCount: 1,
    } as any);

    expect(db.expenseRecurrence.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ nextDueDate: new Date('2027-02-28T00:00:00.000Z') }),
    });
  });

  it('impede baixa duplicada de conta já paga', async () => {
    db.accountPayable.findFirst.mockResolvedValue({
      id: 'payable-1',
      status: 'PAID',
      amount: 20,
      dueDate: new Date(),
      description: 'Conta',
      category: null,
    });

    await expect(
      service.settleAccountPayable('payable-1', { method: 'PIX' } as any),
    ).rejects.toThrow('Somente contas pendentes podem ser baixadas');
    expect(db.financialTransaction.create).not.toHaveBeenCalled();
  });

  it('aplica o tenant em todas as consultas do dashboard', async () => {
    await service.dashboard();

    const calls = [
      ...db.sale.aggregate.mock.calls,
      ...db.sale.findMany.mock.calls,
      ...db.appointment.findMany.mock.calls,
      ...db.cashRegister.findFirst.mock.calls,
      ...db.financialTransaction.aggregate.mock.calls,
      ...db.commission.aggregate.mock.calls,
      ...db.product.findMany.mock.calls,
    ];
    expect(calls).toHaveLength(11);
    for (const [query] of calls) {
      expect(query.where.barbershopId).toBe('shop-1');
    }
    expect(db.barbershop.findUnique).toHaveBeenCalledWith({
      where: { id: 'shop-1' },
      select: { name: true },
    });
  });

  it('consolida relatórios reais por período e tenant', async () => {
    const completedAt = new Date('2026-09-15T12:00:00.000Z');
    db.sale.findMany.mockResolvedValue([
      {
        id: 'sale-1',
        total: 100,
        customerId: 'customer-1',
        employeeId: 'employee-1',
        completedAt,
        createdAt: completedAt,
        employee: { id: 'employee-1', name: 'Ana', color: '#000000' },
        customer: { id: 'customer-1', name: 'Cliente' },
        items: [
          {
            serviceId: 'service-1',
            productId: null,
            description: 'Corte',
            quantity: 1,
            total: 60,
            product: null,
          },
          {
            serviceId: null,
            productId: 'product-1',
            description: 'Pomada',
            quantity: 2,
            total: 40,
            product: { costPrice: 8 },
          },
        ],
      },
    ]);
    db.financialTransaction.findMany.mockResolvedValue([
      {
        id: 'income-1',
        type: 'INCOME',
        origin: 'SALE',
        category: 'Vendas',
        description: 'Venda',
        amount: 100,
        method: 'PIX',
        paidAt: completedAt,
        createdAt: completedAt,
      },
      {
        id: 'expense-1',
        type: 'EXPENSE',
        origin: 'MANUAL',
        category: 'Material',
        description: 'Compra',
        amount: 20,
        method: 'PIX',
        paidAt: completedAt,
        createdAt: completedAt,
      },
    ]);
    db.commission.findMany.mockResolvedValue([
      { amount: 10, employeeId: 'employee-1', employee: { id: 'employee-1', name: 'Ana' } },
    ]);
    db.employee.findMany.mockResolvedValue([
      { id: 'employee-1', name: 'Ana', color: '#000000', active: true },
    ]);

    const result = await service.reports({ start: '2026-09-01', end: '2026-09-30' });

    expect(result.overview).toEqual(
      expect.objectContaining({
        revenue: 100,
        financialIncome: 100,
        expenses: 20,
        balance: 80,
        averageTicket: 100,
        attendances: 1,
        customers: 1,
        commissions: 10,
      }),
    );
    expect(result.services[0]).toEqual(
      expect.objectContaining({ name: 'Corte', quantity: 1, revenue: 60 }),
    );
    expect(result.products[0]).toEqual(
      expect.objectContaining({ name: 'Pomada', quantity: 2, revenue: 40, cost: 16, margin: 24 }),
    );
    expect(result.employees[0]).toEqual(
      expect.objectContaining({ name: 'Ana', attendances: 1, revenue: 100, commission: 10 }),
    );
    expect(result.customers[0]).toEqual(
      expect.objectContaining({ name: 'Cliente', visits: 1, spent: 100 }),
    );
    expect(db.sale.findMany.mock.calls[0][0].where.barbershopId).toBe('shop-1');
    expect(db.financialTransaction.findMany.mock.calls[0][0].where.barbershopId).toBe('shop-1');
  });

  it('rejeita período de relatório invertido ou superior a 370 dias', async () => {
    await expect(service.reports({ start: '2026-10-10', end: '2026-10-01' })).rejects.toThrow(
      'O período informado é inválido',
    );
    await expect(service.reports({ start: '2025-01-01', end: '2026-09-01' })).rejects.toThrow(
      'O período está limitado a 370 dias',
    );
  });

  it('atualiza a identidade e escolhe uma cor de texto com contraste', async () => {
    db.barbershop.update.mockResolvedValue({ id: 'shop-1' });

    await service.updateBusinessSettings({
      name: ' Navalha ',
      ownerName: ' Proprietário ',
      email: 'CONTATO@EXAMPLE.COM ',
      primaryColor: '#F5D547',
    } as any);

    expect(db.barbershop.update).toHaveBeenCalledWith({
      where: { id: 'shop-1' },
      data: expect.objectContaining({
        name: 'Navalha',
        ownerName: 'Proprietário',
        email: 'contato@example.com',
        primaryColor: '#F5D547',
        primaryTextColor: '#000000',
      }),
    });
    expect(db.onboardingProgress.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ completedSteps: ['BUSINESS'] }) }),
    );
  });

  it('salva os sete dias de funcionamento e avança o onboarding', async () => {
    const hours = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => ({
      day,
      enabled: day !== 'sun',
      start: '08:00',
      end: '18:00',
    }));
    db.setting.upsert.mockResolvedValue({ openingHours: {} });

    await service.updateOpeningHours({ hours } as any);

    expect(db.setting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { barbershopId: 'shop-1' },
        update: {
          openingHours: expect.objectContaining({ mon: ['08:00', '18:00'], sun: null }),
        },
      }),
    );
    expect(db.onboardingProgress.update).toHaveBeenCalled();
  });

  it('rejeita intervalo de funcionamento e fuso horário inválidos', async () => {
    const hours = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => ({
      day,
      enabled: true,
      start: '18:00',
      end: '08:00',
    }));

    await expect(service.updateOpeningHours({ hours } as any)).rejects.toThrow('Horário inválido');
    await expect(
      service.updateRegionalSettings({ currency: 'BRL', timezone: 'Fuso/Inexistente' } as any),
    ).rejects.toThrow('Fuso horário inválido');
  });

  it('infere e persiste o progresso completo do onboarding', async () => {
    db.barbershop.findUniqueOrThrow.mockResolvedValue({ name: 'Navalha', ownerName: 'Ana' });
    db.setting.upsert.mockResolvedValue({ openingHours: {}, publicBooking: true });
    db.employee.count.mockResolvedValue(1);
    db.service.count.mockResolvedValue(1);
    db.onboardingProgress.update.mockImplementation(({ data }: any) => ({ ...data }));

    const result = await service.settings();

    expect(result.onboarding.completedSteps).toEqual([
      'BUSINESS',
      'HOURS',
      'TEAM',
      'SERVICES',
      'BOOKING',
    ]);
    expect(result.onboarding.completedAt).toBeInstanceOf(Date);
  });
});
