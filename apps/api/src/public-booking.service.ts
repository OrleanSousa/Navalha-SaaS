import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AvailabilityService } from './availability.service';
import { CreatePublicAppointmentDto, PublicAvailabilityQuery } from './public-booking.dto';
import { PrismaService } from './prisma.service';

@Injectable()
export class PublicBookingService {
  constructor(
    private readonly db: PrismaService,
    private readonly availabilityService: AvailabilityService,
  ) {}

  async page(slug: string) {
    const shop = await this.publicShop(slug);
    const services = await this.db.service.findMany({
      where: { barbershopId: shop.id, active: true, deletedAt: null },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        durationMinutes: true,
        category: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    });
    return { barbershop: shop, services };
  }

  async professionals(slug: string, serviceId: string) {
    const shop = await this.publicShop(slug);
    await this.activeService(shop.id, serviceId);
    return this.db.employee.findMany({
      where: {
        barbershopId: shop.id,
        active: true,
        deletedAt: null,
        employeeServices: { some: { serviceId, barbershopId: shop.id } },
      },
      select: { id: true, name: true, photoUrl: true, color: true, position: true },
      orderBy: { name: 'asc' },
    });
  }

  async availability(slug: string, query: PublicAvailabilityQuery) {
    const shop = await this.publicShop(slug);
    const service = await this.activeService(shop.id, query.serviceId);
    await this.assertProfessional(shop.id, query.employeeId, service.id);
    return this.availabilityService.employeeSlotsForTenant(shop.id, query.employeeId, {
      date: query.date,
      durationMinutes: service.durationMinutes,
      stepMinutes: 15,
    });
  }

  async create(slug: string, dto: CreatePublicAppointmentDto) {
    const shop = await this.publicShop(slug);
    const service = await this.activeService(shop.id, dto.serviceId);
    await this.assertProfessional(shop.id, dto.employeeId, service.id);
    const startAt = new Date(dto.startAt);
    if (Number.isNaN(startAt.getTime()) || startAt <= new Date()) {
      throw new BadRequestException('Escolha um horário futuro válido');
    }
    const timezone = shop.settings?.timezone || 'America/Sao_Paulo';
    const date = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(startAt);
    const available = await this.availabilityService.employeeSlotsForTenant(
      shop.id,
      dto.employeeId,
      { date, durationMinutes: service.durationMinutes, stepMinutes: 15 },
    );
    if (!available.slots.some((slot) => slot.startAt === startAt.toISOString())) {
      throw new ConflictException('Este horário não está mais disponível');
    }
    const endAt = new Date(startAt.getTime() + service.durationMinutes * 60000);
    const phone = this.normalizePhone(dto.whatsapp);

    try {
      return await this.db.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${shop.id}:${dto.employeeId}`}))`;
          const conflict = await tx.appointment.findFirst({
            where: {
              barbershopId: shop.id,
              employeeId: dto.employeeId,
              status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_SERVICE'] },
              startAt: { lt: endAt },
              endAt: { gt: startAt },
            },
            select: { id: true },
          });
          if (conflict) throw new ConflictException('Este horário acabou de ser reservado');

          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${shop.id}:customer:${phone}`}))`;
          const existing = await tx.customer.findFirst({
            where: { barbershopId: shop.id, OR: [{ phone }, { whatsapp: phone }] },
            orderBy: { createdAt: 'asc' },
          });
          const customer = existing
            ? await tx.customer.update({
                where: { id: existing.id },
                data: {
                  name: dto.name.trim(),
                  phone,
                  whatsapp: phone,
                  deletedAt: null,
                },
              })
            : await tx.customer.create({
                data: {
                  barbershopId: shop.id,
                  name: dto.name.trim(),
                  phone,
                  whatsapp: phone,
                },
              });
          const appointment = await tx.appointment.create({
            data: {
              barbershopId: shop.id,
              customerId: customer.id,
              employeeId: dto.employeeId,
              startAt,
              endAt,
              price: service.price,
              notes: 'Agendamento realizado pelo portal público',
              services: {
                create: {
                  barbershopId: shop.id,
                  serviceId: service.id,
                  price: service.price,
                  durationMinutes: service.durationMinutes,
                },
              },
            },
            select: {
              id: true,
              startAt: true,
              endAt: true,
              status: true,
              employee: { select: { name: true } },
              services: { select: { service: { select: { name: true } } } },
            },
          });
          return {
            appointment,
            barbershop: { name: shop.tradeName || shop.name, whatsapp: shop.whatsapp },
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ConflictException('Este horário acabou de ser reservado');
      }
      throw error;
    }
  }

  private async publicShop(slug: string) {
    const shop = await this.db.barbershop.findFirst({
      where: {
        slug: slug.trim().toLowerCase(),
        deletedAt: null,
        status: { in: ['ACTIVE', 'TRIAL'] },
        settings: { is: { publicBooking: true } },
      },
      select: {
        id: true,
        name: true,
        tradeName: true,
        logoUrl: true,
        primaryColor: true,
        primaryTextColor: true,
        address: true,
        city: true,
        state: true,
        whatsapp: true,
        settings: { select: { timezone: true, currency: true } },
      },
    });
    if (!shop) throw new NotFoundException('Página de agendamento indisponível');
    return shop;
  }

  private async activeService(barbershopId: string, serviceId: string) {
    const service = await this.db.service.findFirst({
      where: { id: serviceId, barbershopId, active: true, deletedAt: null },
      select: { id: true, price: true, durationMinutes: true },
    });
    if (!service) throw new NotFoundException('Serviço não encontrado');
    return service;
  }

  private async assertProfessional(barbershopId: string, employeeId: string, serviceId: string) {
    const professional = await this.db.employeeService.findFirst({
      where: {
        barbershopId,
        employeeId,
        serviceId,
        employee: { active: true, deletedAt: null },
      },
      select: { id: true },
    });
    if (!professional) throw new NotFoundException('Profissional não habilitado para o serviço');
  }

  private normalizePhone(value: string) {
    const phone = value.replace(/\D/g, '');
    if (phone.length < 10 || phone.length > 13) {
      throw new BadRequestException('Informe um WhatsApp válido com DDD');
    }
    return phone;
  }
}
