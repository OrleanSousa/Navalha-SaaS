import { IsDateString, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class PublicAvailabilityQuery {
  @IsString()
  @MinLength(1)
  serviceId: string;

  @IsString()
  @MinLength(1)
  employeeId: string;

  @IsDateString({ strict: true })
  date: string;
}

export class CreatePublicAppointmentDto {
  @IsString()
  @MinLength(1)
  serviceId: string;

  @IsString()
  @MinLength(1)
  employeeId: string;

  @IsDateString()
  startAt: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @Matches(/^\+?[\d\s().-]{10,20}$/)
  whatsapp: string;
}
