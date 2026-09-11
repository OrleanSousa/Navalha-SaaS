import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import {
  IsDateString,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsArray,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ArrayUnique,
} from 'class-validator';

export enum EmployeeStatusFilter {
  ALL = 'ALL',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export class ListEmployeesQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 10;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(EmployeeStatusFilter)
  status = EmployeeStatusFilter.ALL;

  @IsOptional()
  @IsString()
  position?: string;
}

export class CreateEmployeeDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsOptional() @IsString() @MaxLength(20) cpf?: string;
  @IsOptional() @IsDateString() birthDate?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(30) whatsapp?: string;
  @IsOptional() @IsEmail() @MaxLength(160) email?: string;
  @IsOptional() @IsString() @MaxLength(240) address?: string;
  @IsOptional() @IsString() @MaxLength(80) position?: string;
  @IsOptional() @IsDateString() hiredAt?: string;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  color = '#4F7CAC';

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  defaultCommission = 0;

  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto) {
  constructor() {
    super();
    this.color = undefined;
    this.defaultCommission = undefined;
  }
}

export class SetEmployeeStatusDto {
  @IsBoolean()
  active: boolean;
}

export class CreateEmployeeAccessDto {
  @IsEmail() @MaxLength(160) email: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message: 'A senha deve conter maiúscula, minúscula, número e símbolo',
  })
  password: string;

  @IsEnum(Role)
  role: Role;
}

export class UpdateEmployeeAccessDto {
  @IsEmail() @MaxLength(160) email: string;

  @IsEnum(Role)
  role: Role;

  @IsBoolean()
  active: boolean;

  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissions: string[];
}
