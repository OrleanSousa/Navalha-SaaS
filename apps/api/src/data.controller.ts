import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { DataService } from './data.service';
import {
  CreateEmployeeDto,
  ListEmployeesQuery,
  SetEmployeeStatusDto,
  UpdateEmployeeDto,
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
