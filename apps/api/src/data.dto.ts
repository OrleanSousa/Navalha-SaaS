import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/swagger';
import {
  AppointmentStatus,
  CommissionStatus,
  FinancialCategoryType,
  FinancialType,
  MovementType,
  OnboardingStep,
  PaymentMethod,
  Role,
  RecurrenceFrequency,
} from '@prisma/client';
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
  NotEquals,
  ArrayUnique,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';

export enum EmployeeStatusFilter {
  ALL = 'ALL',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export class CreateCustomerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsString()
  @MinLength(8)
  @MaxLength(30)
  phone: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  whatsapp?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  cpf?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {}

export enum CustomerStatusFilter {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
  ALL = 'ALL',
}

export enum CustomerSortField {
  NAME = 'NAME',
  CREATED_AT = 'CREATED_AT',
}

export enum SortDirection {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class ListCustomersQuery {
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
  @IsEnum(CustomerStatusFilter)
  status = CustomerStatusFilter.ACTIVE;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsEnum(CustomerSortField)
  sortBy = CustomerSortField.NAME;

  @IsOptional()
  @IsEnum(SortDirection)
  direction = SortDirection.ASC;
}

export class SetCustomerArchiveDto {
  @IsBoolean()
  archived: boolean;
}

export class UpdateCustomerDuplicatePolicyDto {
  @IsBoolean()
  allowDuplicatePhone: boolean;

  @IsBoolean()
  allowDuplicateCpf: boolean;
}

export class CreateServiceDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  categoryId?: string | null;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
  price: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  durationMinutes: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  commissionPercent?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999.99)
  commissionFixed?: number | null;
}

export class UpdateServiceDto extends PartialType(CreateServiceDto) {}

export class SetServiceStatusDto {
  @IsBoolean()
  active: boolean;
}

export class CreateServiceCategoryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;
}

export class ConfigureServiceProfessionalDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  commissionPercent?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999.99)
  commissionFixed?: number | null;
}

export class CreateProductDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsString() categoryId?: string | null;
  @IsOptional() @IsString() @MaxLength(80) sku?: string | null;
  @IsOptional() @IsString() @MaxLength(80) barcode?: string | null;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999.99)
  costPrice: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
  salePrice: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(999999999)
  minimumStock = 0;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  commissionPercent?: number | null;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {
  constructor() {
    super();
    this.minimumStock = undefined;
  }
}

export class SetProductStatusDto {
  @IsBoolean()
  active: boolean;
}

export class CreateProductCategoryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;
}

export class CreateInventoryMovementDto {
  @IsEnum(MovementType)
  type: MovementType;

  @Type(() => Number)
  @IsInt()
  @NotEquals(0)
  @Min(-999999999)
  @Max(999999999)
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class UpdateStockSettingsDto {
  @IsBoolean()
  allowNegativeStock: boolean;
}

export class CreateAppointmentDto {
  @IsString()
  customerId: string;

  @IsString()
  employeeId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  serviceIds: string[];

  @IsDateString()
  startAt: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}

export class UpdateAppointmentDto extends PartialType(CreateAppointmentDto) {}

export class AppointmentSlotsDto {
  @IsOptional()
  @IsString()
  appointmentId?: string;

  @IsString()
  employeeId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  serviceIds: string[];

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(120)
  stepMinutes = 15;
}

export class ListAppointmentsQuery {
  @IsDateString()
  start: string;

  @IsDateString()
  end: string;

  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;
}

export class CancelAppointmentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  reason: string;
}

export class CreateWalkInSaleDto {
  @IsOptional()
  @IsString()
  customerId?: string | null;

  @IsString()
  employeeId: string;
}

export class AddSaleServiceItemDto {
  @IsString()
  serviceId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  quantity = 1;
}

export class AddSaleProductItemDto {
  @IsString()
  productId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999999)
  quantity = 1;
}

export class ApplySaleDiscountDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999.99)
  amount: number;

  @IsString()
  @MinLength(2)
  @MaxLength(300)
  reason: string;
}

export class SalePaymentDto {
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
  amount: number;
}

export class FinalizeSaleDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SalePaymentDto)
  payments: SalePaymentDto[];
}

export class ListCommissionsQuery {
  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsEnum(CommissionStatus)
  status?: CommissionStatus;

  @IsOptional()
  @IsDateString()
  start?: string;

  @IsOptional()
  @IsDateString()
  end?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25;
}

export class AdjustCommissionDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999.99)
  amount: number;

  @IsString()
  @MinLength(2)
  @MaxLength(300)
  reason: string;
}

export class PayCommissionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  commissionIds: string[];

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class PayCommissionDto {
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class OpenCashRegisterDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999.99)
  openingBalance: number;
}

export class CloseCashRegisterDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999999.99)
  closingBalance: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CreateFinancialTransactionDto {
  @IsEnum(FinancialType)
  type: FinancialType;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  category: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  description: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
  amount: number;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateFinancialTransactionDto extends PartialType(CreateFinancialTransactionDto) {}

export class CancelFinancialTransactionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  reason: string;
}

export class ListCashRegistersQuery {
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
}

export class CreateSupplierDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsOptional() @IsString() @MaxLength(30) document?: string;
  @IsOptional() @IsString() @MaxLength(120) contactName?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsEmail() @MaxLength(160) email?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class UpdateSupplierDto extends PartialType(CreateSupplierDto) {}

export class SetSupplierStatusDto {
  @IsBoolean()
  active: boolean;
}

export class CreateFinancialCategoryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @IsEnum(FinancialCategoryType)
  type: FinancialCategoryType;
}

export class UpdateFinancialCategoryDto extends PartialType(CreateFinancialCategoryDto) {}

export class SetFinancialCategoryStatusDto {
  @IsBoolean()
  active: boolean;
}

export class CreateAccountPayableDto {
  @IsOptional() @IsString() supplierId?: string;
  @IsOptional() @IsString() categoryId?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  description: string;

  @IsOptional() @IsString() @MaxLength(80) documentNumber?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
  amount: number;

  @IsDateString()
  dueDate: string;

  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class CreateAccountReceivableDto {
  @IsString()
  customerId: string;

  @IsOptional() @IsString() categoryId?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  description: string;

  @IsOptional() @IsString() @MaxLength(80) documentNumber?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
  amount: number;

  @IsDateString()
  dueDate: string;

  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class SettleAccountDto {
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsOptional()
  @IsDateString()
  settledAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CancelAccountDto {
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  reason: string;
}

export class CreateExpenseRecurrenceDto extends CreateAccountPayableDto {
  @IsEnum(RecurrenceFrequency)
  frequency: RecurrenceFrequency;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  intervalCount = 1;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export enum AccountListStatus {
  ALL = 'ALL',
  PENDING = 'PENDING',
  OVERDUE = 'OVERDUE',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

export class ListAccountsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional() @IsEnum(AccountListStatus) status = AccountListStatus.ALL;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() supplierId?: string;
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsDateString() start?: string;
  @IsOptional() @IsDateString() end?: string;
}

export class SetExpenseRecurrenceStatusDto {
  @IsBoolean()
  active: boolean;
}

export class DashboardQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(7)
  @Max(30)
  days = 7;
}

export class ReportsQuery {
  @IsDateString()
  start: string;

  @IsDateString()
  end: string;
}

export class UpdateBusinessSettingsDto {
  @IsString() @MinLength(2) @MaxLength(120) name: string;
  @IsOptional() @IsString() @MaxLength(120) tradeName?: string;
  @IsOptional() @IsString() @MaxLength(30) document?: string;
  @IsString() @MinLength(2) @MaxLength(120) ownerName: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(30) whatsapp?: string;
  @IsOptional() @IsEmail() @MaxLength(160) email?: string;
  @IsOptional() @IsString() @MaxLength(240) address?: string;
  @IsOptional() @IsString() @MaxLength(100) city?: string;
  @IsOptional() @IsString() @MaxLength(2) state?: string;
  @IsOptional() @IsString() @MaxLength(12) zipCode?: string;

  @Matches(/^#[0-9A-Fa-f]{6}$/)
  primaryColor: string;
}

export class UpdateRegionalSettingsDto {
  @IsString() @Matches(/^[A-Z]{3}$/) currency: string;
  @IsString() @MinLength(3) @MaxLength(80) timezone: string;
}

export class OpeningHourDto {
  @Matches(/^(mon|tue|wed|thu|fri|sat|sun)$/)
  day: string;

  @IsBoolean()
  enabled: boolean;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  start: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  end: string;
}

export class UpdateOpeningHoursDto {
  @IsArray()
  @ArrayMinSize(7)
  @ArrayUnique((entry: OpeningHourDto) => entry.day)
  @ValidateNested({ each: true })
  @Type(() => OpeningHourDto)
  hours: OpeningHourDto[];
}

export class UpdateOperationalSettingsDto {
  @IsBoolean() allowNegativeStock: boolean;
  @IsBoolean() allowCreditSales: boolean;
  @IsBoolean() publicBooking: boolean;
}

export class CompleteOnboardingStepDto {
  @IsEnum(OnboardingStep)
  step: OnboardingStep;
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

export class SetEmployeeCommissionDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  defaultCommission: number;
}

export class CreateWorkScheduleDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  weekday: number;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  startTime: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  endTime: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  breakStart?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  breakEnd?: string;

  @IsOptional()
  @IsBoolean()
  active = true;
}

export class UpdateWorkScheduleDto extends PartialType(CreateWorkScheduleDto) {
  constructor() {
    super();
    this.active = undefined;
  }
}

export class CreateEmployeeDayOffDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export enum EmployeeAbsenceType {
  VACATION = 'VACATION',
  LEAVE = 'LEAVE',
}

export class CreateEmployeeAbsenceDto {
  @IsEnum(EmployeeAbsenceType)
  type: EmployeeAbsenceType;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class CreateEmployeeScheduleBlockDto {
  @IsDateString()
  startAt: string;

  @IsDateString()
  endAt: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class EmployeeAvailabilityQuery {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(720)
  durationMinutes = 30;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(120)
  stepMinutes = 15;
}
