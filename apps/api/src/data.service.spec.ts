import { DataService } from './data.service';

describe('DataService tenant isolation', () => {
  let db: any;
  let service: DataService;

  beforeEach(() => {
    db = {
      customer: { findMany: jest.fn().mockResolvedValue([]) },
      employee: { findMany: jest.fn().mockResolvedValue([]) },
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
