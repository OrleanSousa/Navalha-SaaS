import { AvailabilityService } from './availability.service';

describe('AvailabilityService', () => {
  let db: any;
  let service: AvailabilityService;

  beforeEach(() => {
    db = {
      employee: { findFirst: jest.fn().mockResolvedValue({ id: 'employee-1' }) },
      setting: {
        findUnique: jest.fn().mockResolvedValue({ timezone: 'America/Sao_Paulo' }),
      },
      workSchedule: { findMany: jest.fn().mockResolvedValue([]) },
      employeeUnavailability: { findMany: jest.fn().mockResolvedValue([]) },
      appointment: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new AvailabilityService(db, { barbershopId: 'shop-1' } as any);
  });

  it('calcula slots removendo pausa, bloqueio e agendamento', async () => {
    db.workSchedule.findMany.mockResolvedValue([
      {
        startTime: '08:00',
        endTime: '12:00',
        breakStart: '10:00',
        breakEnd: '10:30',
      },
    ]);
    db.employeeUnavailability.findMany.mockResolvedValue([
      {
        allDay: false,
        startAt: new Date('2026-09-14T12:00:00.000Z'),
        endAt: new Date('2026-09-14T13:00:00.000Z'),
      },
    ]);
    db.appointment.findMany.mockResolvedValue([
      {
        startAt: new Date('2026-09-14T14:00:00.000Z'),
        endAt: new Date('2026-09-14T14:30:00.000Z'),
      },
    ]);

    const result = await service.employeeSlots('employee-1', {
      date: '2026-09-14',
      durationMinutes: 30,
      stepMinutes: 30,
    });

    expect(result.slots.map(({ startAt }) => startAt)).toEqual([
      '2026-09-14T11:00:00.000Z',
      '2026-09-14T11:30:00.000Z',
      '2026-09-14T13:30:00.000Z',
      '2026-09-14T14:30:00.000Z',
    ]);
  });

  it('não oferece slots em indisponibilidade de dia inteiro', async () => {
    db.workSchedule.findMany.mockResolvedValue([
      { startTime: '08:00', endTime: '12:00', breakStart: null, breakEnd: null },
    ]);
    db.employeeUnavailability.findMany.mockResolvedValue([
      {
        allDay: true,
        startAt: new Date('2026-09-14T00:00:00.000Z'),
        endAt: new Date('2026-09-15T00:00:00.000Z'),
      },
    ]);

    const result = await service.employeeSlots('employee-1', {
      date: '2026-09-14',
      durationMinutes: 30,
      stepMinutes: 15,
    });

    expect(result.slots).toEqual([]);
  });

  it('mantém slots adjacentes a bloqueios e agendamentos', async () => {
    db.workSchedule.findMany.mockResolvedValue([
      { startTime: '08:00', endTime: '10:00', breakStart: null, breakEnd: null },
    ]);
    db.employeeUnavailability.findMany.mockResolvedValue([
      {
        allDay: false,
        startAt: new Date('2026-09-14T11:30:00.000Z'),
        endAt: new Date('2026-09-14T12:00:00.000Z'),
      },
    ]);
    db.appointment.findMany.mockResolvedValue([
      {
        startAt: new Date('2026-09-14T12:30:00.000Z'),
        endAt: new Date('2026-09-14T13:00:00.000Z'),
      },
    ]);

    const result = await service.employeeSlots('employee-1', {
      date: '2026-09-14',
      durationMinutes: 30,
      stepMinutes: 30,
    });

    expect(result.slots).toEqual([
      { startAt: '2026-09-14T11:00:00.000Z', endAt: '2026-09-14T11:30:00.000Z' },
      { startAt: '2026-09-14T12:00:00.000Z', endAt: '2026-09-14T12:30:00.000Z' },
    ]);
  });

  it('retorna vazio quando a duração não cabe na jornada', async () => {
    db.workSchedule.findMany.mockResolvedValue([
      { startTime: '08:00', endTime: '09:00', breakStart: null, breakEnd: null },
    ]);

    const result = await service.employeeSlots('employee-1', {
      date: '2026-09-14',
      durationMinutes: 90,
      stepMinutes: 15,
    });

    expect(result.slots).toEqual([]);
  });

  it('rejeita data inexistente antes de consultar a agenda', async () => {
    await expect(
      service.employeeSlots('employee-1', {
        date: '2026-02-31',
        durationMinutes: 30,
        stepMinutes: 15,
      }),
    ).rejects.toThrow('Data inválida');
    expect(db.workSchedule.findMany).not.toHaveBeenCalled();
  });

  it('não calcula disponibilidade de colaborador de outro tenant', async () => {
    db.employee.findFirst.mockResolvedValue(null);

    await expect(
      service.employeeSlots('employee-other', {
        date: '2026-09-14',
        durationMinutes: 30,
        stepMinutes: 15,
      }),
    ).rejects.toThrow('Colaborador não encontrado');
    expect(db.workSchedule.findMany).not.toHaveBeenCalled();
  });

  it('aplica tenant, colaborador, dia e status nas consultas de disponibilidade', async () => {
    await service.employeeSlots('employee-1', {
      date: '2026-09-14',
      durationMinutes: 30,
      stepMinutes: 15,
    });

    expect(db.workSchedule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          barbershopId: 'shop-1',
          employeeId: 'employee-1',
          weekday: 1,
          active: true,
        },
      }),
    );
    expect(db.employeeUnavailability.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ barbershopId: 'shop-1', employeeId: 'employee-1' }),
      }),
    );
    expect(db.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          barbershopId: 'shop-1',
          employeeId: 'employee-1',
          status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_SERVICE'] },
        }),
      }),
    );
  });
});
