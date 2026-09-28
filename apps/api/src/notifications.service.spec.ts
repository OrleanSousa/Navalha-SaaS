import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let db: any;
  let provider: { send: jest.Mock };
  let service: NotificationsService;

  beforeEach(() => {
    db = {
      barbershop: {
        findUnique: jest.fn().mockResolvedValue({ name: 'Navalha', tradeName: null }),
      },
      notification: {
        upsert: jest.fn().mockResolvedValue({ id: 'notification-1' }),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      messageJob: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn(),
      },
      product: { fields: { minimumStock: {} }, findMany: jest.fn().mockResolvedValue([]) },
      accountPayable: { findMany: jest.fn().mockResolvedValue([]) },
      cashRegister: { findMany: jest.fn().mockResolvedValue([]) },
      commission: { findMany: jest.fn().mockResolvedValue([]) },
    };
    provider = { send: jest.fn().mockResolvedValue(undefined) };
    service = new NotificationsService(db, provider);
  });

  it('cria notificação idempotente para novo agendamento', async () => {
    await service.appointmentCreated('shop-1', {
      id: 'appointment-1',
      customerName: 'Maria',
      employeeName: 'Ana',
      startAt: new Date('2026-10-10T13:00:00.000Z'),
    });

    expect(db.notification.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          barbershopId_dedupKey: {
            barbershopId: 'shop-1',
            dedupKey: 'appointment:created:appointment-1',
          },
        },
        create: expect.objectContaining({ type: 'APPOINTMENT_CREATED', actionUrl: '/agenda' }),
      }),
    );
  });

  it('processa uma mensagem pendente pelo provedor configurado', async () => {
    db.messageJob.findMany.mockResolvedValue([
      {
        id: 'job-1',
        status: 'PENDING',
        channel: 'WHATSAPP',
        recipient: '11999999999',
        template: 'appointment_created',
        payload: { customerName: 'Maria' },
      },
    ]);

    await expect(service.processPending()).resolves.toEqual({ processed: 1 });

    expect(provider.send).toHaveBeenCalledWith(
      expect.objectContaining({ recipient: '11999999999', template: 'appointment_created' }),
    );
    expect(db.messageJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { status: 'SENT', processedAt: expect.any(Date), lastError: null },
    });
  });

  it('materializa alertas operacionais sem duplicá-los', async () => {
    db.product.findMany.mockResolvedValue([
      { id: 'product-1', name: 'Pomada', stockQuantity: 1, minimumStock: 2 },
    ]);
    db.accountPayable.findMany.mockResolvedValue([
      { id: 'account-1', description: 'Aluguel', dueDate: new Date(), amount: 1000 },
    ]);
    db.cashRegister.findMany.mockResolvedValue([
      { id: 'cash-1', openedAt: new Date('2026-09-27T10:00:00.000Z') },
    ]);
    db.commission.findMany.mockResolvedValue([
      { id: 'commission-1', amount: 25, employee: { name: 'Ana' } },
    ]);

    await service.syncOperationalAlerts('shop-1');

    const keys = db.notification.upsert.mock.calls.map(
      ([call]: any[]) => call.where.barbershopId_dedupKey.dedupKey,
    );
    expect(keys).toEqual([
      'stock:low:product-1',
      'account:due:account-1',
      'cash:unclosed:cash-1',
      'commission:pending:commission-1',
    ]);
  });
});
