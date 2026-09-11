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
