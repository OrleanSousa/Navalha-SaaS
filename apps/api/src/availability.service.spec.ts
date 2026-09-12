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
});
