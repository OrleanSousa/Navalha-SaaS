import { DataService } from './data.service';

describe('DataService tenant isolation', () => {
  let db: any;
  let service: DataService;

  beforeEach(() => {
    db = {
      customer: { findMany: jest.fn().mockResolvedValue([]) },
      employee: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
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
      cashRegister: { findFirst: jest.fn().mockResolvedValue(null) },
    };
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
