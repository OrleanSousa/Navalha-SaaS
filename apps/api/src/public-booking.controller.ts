import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CreatePublicAppointmentDto, PublicAvailabilityQuery } from './public-booking.dto';
import { PublicBookingService } from './public-booking.service';

@Controller('public/booking')
@Throttle({ default: { limit: 60, ttl: 60000 } })
export class PublicBookingController {
  constructor(private readonly booking: PublicBookingService) {}

  @Get(':slug')
  page(@Param('slug') slug: string) {
    return this.booking.page(slug);
  }

  @Get(':slug/services/:serviceId/professionals')
  professionals(@Param('slug') slug: string, @Param('serviceId') serviceId: string) {
    return this.booking.professionals(slug, serviceId);
  }

  @Get(':slug/availability')
  availability(@Param('slug') slug: string, @Query() query: PublicAvailabilityQuery) {
    return this.booking.availability(slug, query);
  }

  @Post(':slug/appointments')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  create(@Param('slug') slug: string, @Body() dto: CreatePublicAppointmentDto) {
    return this.booking.create(slug, dto);
  }
}
