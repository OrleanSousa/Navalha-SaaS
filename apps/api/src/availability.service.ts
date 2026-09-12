import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EmployeeAvailabilityQuery } from './data.dto';
import { PrismaService } from './prisma.service';
import { TenantContext } from './auth-context';

@Injectable()
export class AvailabilityService {
  constructor(
    private readonly db: PrismaService,
    private readonly tenant: TenantContext,
  ) {}

  async employeeSlots(employeeId: string, query: EmployeeAvailabilityQuery) {
    const barbershopId = this.tenant.barbershopId;
    const [employee, settings] = await Promise.all([
      this.db.employee.findFirst({
        where: { id: employeeId, barbershopId, active: true, deletedAt: null },
        select: { id: true },
      }),
      this.db.setting.findUnique({
        where: { barbershopId },
        select: { timezone: true },
      }),
    ]);
    if (!employee) throw new NotFoundException('Colaborador não encontrado');

    const timezone = settings?.timezone || 'America/Sao_Paulo';
    const calendarDay = new Date(`${query.date}T00:00:00.000Z`);
    if (
      Number.isNaN(calendarDay.getTime()) ||
      calendarDay.toISOString().slice(0, 10) !== query.date
    ) {
      throw new BadRequestException('Data inválida');
    }
    const dayStart = this.zonedDateTimeToUtc(query.date, '00:00', timezone);
    const nextDate = this.shiftDate(query.date, 1);
    const dayEnd = this.zonedDateTimeToUtc(nextDate, '00:00', timezone);
    const weekday = calendarDay.getUTCDay();

    const [schedules, unavailabilities, appointments] = await Promise.all([
      this.db.workSchedule.findMany({
        where: { barbershopId, employeeId, weekday, active: true },
        orderBy: { startTime: 'asc' },
      }),
      this.db.employeeUnavailability.findMany({
        where: {
          barbershopId,
          employeeId,
          OR: [
            { allDay: true, startAt: { lte: calendarDay }, endAt: { gt: calendarDay } },
            { allDay: false, startAt: { lt: dayEnd }, endAt: { gt: dayStart } },
          ],
        },
        orderBy: { startAt: 'asc' },
      }),
      this.db.appointment.findMany({
        where: {
          barbershopId,
          employeeId,
          status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_SERVICE'] },
          startAt: { lt: dayEnd },
          endAt: { gt: dayStart },
        },
        select: { startAt: true, endAt: true },
        orderBy: { startAt: 'asc' },
      }),
    ]);

    if (unavailabilities.some(({ allDay }) => allDay)) {
      return {
        date: query.date,
        timezone,
        durationMinutes: query.durationMinutes,
        stepMinutes: query.stepMinutes,
        slots: [],
      };
    }

    const blockers = [
      ...unavailabilities.map(({ startAt, endAt }) => ({ startAt, endAt })),
      ...appointments,
    ];
    const slots: Array<{ startAt: string; endAt: string }> = [];

    for (const schedule of schedules) {
      const scheduleStart = this.timeToMinutes(schedule.startTime);
      const scheduleEnd = this.timeToMinutes(schedule.endTime);
      const breakStart = schedule.breakStart ? this.timeToMinutes(schedule.breakStart) : null;
      const breakEnd = schedule.breakEnd ? this.timeToMinutes(schedule.breakEnd) : null;

      for (
        let startMinute = scheduleStart;
        startMinute + query.durationMinutes <= scheduleEnd;
        startMinute += query.stepMinutes
      ) {
        const endMinute = startMinute + query.durationMinutes;
        if (
          breakStart !== null &&
          breakEnd !== null &&
          startMinute < breakEnd &&
          endMinute > breakStart
        ) {
          continue;
        }

        const startAt = this.zonedDateTimeToUtc(
          query.date,
          this.minutesToTime(startMinute),
          timezone,
        );
        const endAt = new Date(startAt.getTime() + query.durationMinutes * 60000);
        const blocked = blockers.some(
          (blocker) => startAt < blocker.endAt && endAt > blocker.startAt,
        );
        if (!blocked) slots.push({ startAt: startAt.toISOString(), endAt: endAt.toISOString() });
      }
    }

    return {
      date: query.date,
      timezone,
      durationMinutes: query.durationMinutes,
      stepMinutes: query.stepMinutes,
      slots,
    };
  }

  private timeToMinutes(value: string) {
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private minutesToTime(value: number) {
    const hours = Math.floor(value / 60);
    const minutes = value % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  private shiftDate(value: string, days: number) {
    const date = new Date(`${value}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  private zonedDateTimeToUtc(date: string, time: string, timezone: string) {
    const target = Date.parse(`${date}T${time}:00.000Z`);
    let instant = target;
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const parts = Object.fromEntries(
        formatter
          .formatToParts(new Date(instant))
          .filter(({ type }) => type !== 'literal')
          .map(({ type, value }) => [type, value]),
      );
      const rendered = Date.UTC(
        Number(parts.year),
        Number(parts.month) - 1,
        Number(parts.day),
        Number(parts.hour),
        Number(parts.minute),
        Number(parts.second),
      );
      instant -= rendered - target;
    }
    return new Date(instant);
  }
}
