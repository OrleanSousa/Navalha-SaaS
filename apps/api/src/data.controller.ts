import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { memoryStorage } from 'multer';
import { DataService } from './data.service';
import {
  CreateEmployeeDto,
  CreateWorkScheduleDto,
  CreateEmployeeAccessDto,
  ListEmployeesQuery,
  SetEmployeeStatusDto,
  SetEmployeeCommissionDto,
  UpdateEmployeeAccessDto,
  UpdateEmployeeDto,
  UpdateWorkScheduleDto,
} from './data.dto';
import { Permissions, PermissionsGuard, RequirePermissions, Roles, RolesGuard } from './rbac';

@Controller()
@Roles(Role.ADMIN, Role.RECEPTIONIST, Role.BARBER)
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
export class DataController {
  constructor(private readonly data: DataService) {}

  @Get('customers')
  @RequirePermissions(Permissions.CUSTOMERS_READ)
  customers() {
    return this.data.customers();
  }

  @Get('employees')
  @RequirePermissions(Permissions.EMPLOYEES_READ)
  employees(@Query() query: ListEmployeesQuery) {
    return this.data.employees(query);
  }

  @Get('employees/:id')
  @RequirePermissions(Permissions.EMPLOYEES_READ)
  employeeDetails(@Param('id') id: string) {
    return this.data.employeeDetails(id);
  }

  @Post('employees')
  @RequirePermissions(Permissions.EMPLOYEES_CREATE)
  createEmployee(@Body() dto: CreateEmployeeDto) {
    return this.data.createEmployee(dto);
  }

  @Patch('employees/:id')
  @RequirePermissions(Permissions.EMPLOYEES_UPDATE)
  updateEmployee(@Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.data.updateEmployee(id, dto);
  }

  @Patch('employees/:id/status')
  @RequirePermissions(Permissions.EMPLOYEES_STATUS)
  setEmployeeStatus(@Param('id') id: string, @Body() dto: SetEmployeeStatusDto) {
    return this.data.setEmployeeStatus(id, dto.active);
  }

  @Post('employees/:id/photo')
  @RequirePermissions(Permissions.EMPLOYEES_PHOTO)
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
      fileFilter: (_request, file, callback) => {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
          callback(new BadRequestException('Envie uma imagem JPEG, PNG ou WebP'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  uploadEmployeePhoto(@Param('id') id: string, @UploadedFile() photo?: Express.Multer.File) {
    if (!photo) throw new BadRequestException('Selecione uma foto');
    return this.data.uploadEmployeePhoto(id, photo);
  }

  @Post('employees/:id/access')
  @RequirePermissions(Permissions.EMPLOYEES_ACCESS)
  createEmployeeAccess(@Param('id') id: string, @Body() dto: CreateEmployeeAccessDto) {
    return this.data.createEmployeeAccess(id, dto);
  }

  @Get('employees/:id/access')
  @RequirePermissions(Permissions.EMPLOYEES_PERMISSIONS)
  employeeAccess(@Param('id') id: string) {
    return this.data.employeeAccess(id);
  }

  @Patch('employees/:id/access')
  @RequirePermissions(Permissions.EMPLOYEES_PERMISSIONS)
  updateEmployeeAccess(@Param('id') id: string, @Body() dto: UpdateEmployeeAccessDto) {
    return this.data.updateEmployeeAccess(id, dto);
  }

  @Patch('employees/:id/commission')
  @RequirePermissions(Permissions.EMPLOYEES_COMMISSION)
  setEmployeeCommission(@Param('id') id: string, @Body() dto: SetEmployeeCommissionDto) {
    return this.data.setEmployeeCommission(id, dto.defaultCommission);
  }

  @Post('employees/:id/schedules')
  @RequirePermissions(Permissions.EMPLOYEES_SCHEDULE)
  createWorkSchedule(@Param('id') id: string, @Body() dto: CreateWorkScheduleDto) {
    return this.data.createWorkSchedule(id, dto);
  }

  @Patch('employees/:id/schedules/:scheduleId')
  @RequirePermissions(Permissions.EMPLOYEES_SCHEDULE)
  updateWorkSchedule(
    @Param('id') id: string,
    @Param('scheduleId') scheduleId: string,
    @Body() dto: UpdateWorkScheduleDto,
  ) {
    return this.data.updateWorkSchedule(id, scheduleId, dto);
  }

  @Delete('employees/:id/schedules/:scheduleId')
  @HttpCode(204)
  @RequirePermissions(Permissions.EMPLOYEES_SCHEDULE)
  deleteWorkSchedule(@Param('id') id: string, @Param('scheduleId') scheduleId: string) {
    return this.data.deleteWorkSchedule(id, scheduleId);
  }

  @Get('services')
  @RequirePermissions(Permissions.SERVICES_READ)
  services() {
    return this.data.services();
  }

  @Get('products')
  @RequirePermissions(Permissions.PRODUCTS_READ)
  products() {
    return this.data.products();
  }

  @Get('appointments')
  @RequirePermissions(Permissions.APPOINTMENTS_READ)
  appointments() {
    return this.data.appointments();
  }

  @Get('dashboard')
  @RequirePermissions(Permissions.DASHBOARD_READ)
  dashboard() {
    return this.data.dashboard();
  }
}
