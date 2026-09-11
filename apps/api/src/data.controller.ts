import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { DataService } from './data.service';
import { ListEmployeesQuery } from './data.dto';
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
