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
import { AvailabilityService } from './availability.service';
import {
  CreateCustomerDto,
  CreateAppointmentDto,
  AppointmentSlotsDto,
  CancelAppointmentDto,
  AddSaleProductItemDto,
  AddSaleServiceItemDto,
  ApplySaleDiscountDto,
  CreateWalkInSaleDto,
  FinalizeSaleDto,
  AdjustCommissionDto,
  ListCommissionsQuery,
  PayCommissionDto,
  PayCommissionsDto,
  OpenCashRegisterDto,
  CloseCashRegisterDto,
  CreateFinancialTransactionDto,
  UpdateFinancialTransactionDto,
  CancelFinancialTransactionDto,
  ListCashRegistersQuery,
  CreateSupplierDto,
  UpdateSupplierDto,
  SetSupplierStatusDto,
  CreateFinancialCategoryDto,
  UpdateFinancialCategoryDto,
  SetFinancialCategoryStatusDto,
  CreateAccountPayableDto,
  CreateAccountReceivableDto,
  CreateExpenseRecurrenceDto,
  SettleAccountDto,
  CancelAccountDto,
  ListAccountsQuery,
  SetExpenseRecurrenceStatusDto,
  DashboardQuery,
  ReportsQuery,
  ConfigureServiceProfessionalDto,
  CreateEmployeeAbsenceDto,
  CreateEmployeeDayOffDto,
  CreateEmployeeScheduleBlockDto,
  CreateEmployeeDto,
  CreateInventoryMovementDto,
  CreateProductCategoryDto,
  CreateProductDto,
  CreateServiceDto,
  CreateServiceCategoryDto,
  CreateWorkScheduleDto,
  EmployeeAvailabilityQuery,
  CreateEmployeeAccessDto,
  ListEmployeesQuery,
  ListCustomersQuery,
  ListAppointmentsQuery,
  SetCustomerArchiveDto,
  SetEmployeeStatusDto,
  SetEmployeeCommissionDto,
  SetServiceStatusDto,
  SetProductStatusDto,
  UpdateEmployeeAccessDto,
  UpdateCustomerDto,
  UpdateAppointmentDto,
  UpdateCustomerDuplicatePolicyDto,
  UpdateEmployeeDto,
  UpdateServiceDto,
  UpdateProductDto,
  UpdateStockSettingsDto,
  UpdateWorkScheduleDto,
} from './data.dto';
import { Permissions, PermissionsGuard, RequirePermissions, Roles, RolesGuard } from './rbac';

@Controller()
@Roles(Role.ADMIN, Role.RECEPTIONIST, Role.BARBER)
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
export class DataController {
  constructor(
    private readonly data: DataService,
    private readonly availability: AvailabilityService,
  ) {}

  @Get('customers')
  @RequirePermissions(Permissions.CUSTOMERS_READ)
  customers(@Query() query: ListCustomersQuery) {
    return this.data.customers(query);
  }

  @Post('customers')
  @RequirePermissions(Permissions.CUSTOMERS_CREATE)
  createCustomer(@Body() dto: CreateCustomerDto) {
    return this.data.createCustomer(dto);
  }

  @Patch('customers/:id')
  @RequirePermissions(Permissions.CUSTOMERS_UPDATE)
  updateCustomer(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.data.updateCustomer(id, dto);
  }

  @Patch('customers/:id/archive')
  @RequirePermissions(Permissions.CUSTOMERS_STATUS)
  setCustomerArchive(@Param('id') id: string, @Body() dto: SetCustomerArchiveDto) {
    return this.data.setCustomerArchive(id, dto.archived);
  }

  @Get('customers/settings/duplicates')
  @RequirePermissions(Permissions.CUSTOMERS_READ)
  customerDuplicatePolicy() {
    return this.data.customerDuplicatePolicy();
  }

  @Patch('customers/settings/duplicates')
  @RequirePermissions(Permissions.CUSTOMERS_UPDATE)
  updateCustomerDuplicatePolicy(@Body() dto: UpdateCustomerDuplicatePolicyDto) {
    return this.data.updateCustomerDuplicatePolicy(dto);
  }

  @Get('customers/:id')
  @RequirePermissions(Permissions.CUSTOMERS_READ)
  customerDetails(@Param('id') id: string) {
    return this.data.customerDetails(id);
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

  @Get('employees/:id/availability')
  @RequirePermissions(Permissions.EMPLOYEES_READ)
  employeeAvailability(@Param('id') id: string, @Query() query: EmployeeAvailabilityQuery) {
    return this.availability.employeeSlots(id, query);
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

  @Post('employees/:id/unavailabilities/day-off')
  @RequirePermissions(Permissions.EMPLOYEES_UNAVAILABILITY)
  createEmployeeDayOff(@Param('id') id: string, @Body() dto: CreateEmployeeDayOffDto) {
    return this.data.createEmployeeDayOff(id, dto);
  }

  @Post('employees/:id/unavailabilities/absence')
  @RequirePermissions(Permissions.EMPLOYEES_UNAVAILABILITY)
  createEmployeeAbsence(@Param('id') id: string, @Body() dto: CreateEmployeeAbsenceDto) {
    return this.data.createEmployeeAbsence(id, dto);
  }

  @Post('employees/:id/unavailabilities/block')
  @RequirePermissions(Permissions.EMPLOYEES_UNAVAILABILITY)
  createEmployeeScheduleBlock(
    @Param('id') id: string,
    @Body() dto: CreateEmployeeScheduleBlockDto,
  ) {
    return this.data.createEmployeeScheduleBlock(id, dto);
  }

  @Delete('employees/:id/unavailabilities/:unavailabilityId')
  @HttpCode(204)
  @RequirePermissions(Permissions.EMPLOYEES_UNAVAILABILITY)
  deleteEmployeeUnavailability(
    @Param('id') id: string,
    @Param('unavailabilityId') unavailabilityId: string,
  ) {
    return this.data.deleteEmployeeUnavailability(id, unavailabilityId);
  }

  @Get('services')
  @RequirePermissions(Permissions.SERVICES_READ)
  services() {
    return this.data.services();
  }

  @Post('services')
  @RequirePermissions(Permissions.SERVICES_CREATE)
  createService(@Body() dto: CreateServiceDto) {
    return this.data.createService(dto);
  }

  @Get('services/categories')
  @RequirePermissions(Permissions.SERVICES_READ)
  serviceCategories() {
    return this.data.serviceCategories();
  }

  @Post('services/categories')
  @RequirePermissions(Permissions.SERVICES_CATEGORIES)
  createServiceCategory(@Body() dto: CreateServiceCategoryDto) {
    return this.data.createServiceCategory(dto);
  }

  @Get('services/:id')
  @RequirePermissions(Permissions.SERVICES_READ)
  serviceDetails(@Param('id') id: string) {
    return this.data.serviceDetails(id);
  }

  @Patch('services/:id')
  @RequirePermissions(Permissions.SERVICES_UPDATE)
  updateService(@Param('id') id: string, @Body() dto: UpdateServiceDto) {
    return this.data.updateService(id, dto);
  }

  @Patch('services/:id/status')
  @RequirePermissions(Permissions.SERVICES_STATUS)
  setServiceStatus(@Param('id') id: string, @Body() dto: SetServiceStatusDto) {
    return this.data.setServiceStatus(id, dto.active);
  }

  @Post('services/:id/professionals/:employeeId')
  @RequirePermissions(Permissions.SERVICES_PROFESSIONALS)
  configureServiceProfessional(
    @Param('id') id: string,
    @Param('employeeId') employeeId: string,
    @Body() dto: ConfigureServiceProfessionalDto,
  ) {
    return this.data.configureServiceProfessional(id, employeeId, dto);
  }

  @Delete('services/:id/professionals/:employeeId')
  @HttpCode(204)
  @RequirePermissions(Permissions.SERVICES_PROFESSIONALS)
  removeServiceProfessional(@Param('id') id: string, @Param('employeeId') employeeId: string) {
    return this.data.removeServiceProfessional(id, employeeId);
  }

  @Get('products')
  @RequirePermissions(Permissions.PRODUCTS_READ)
  products() {
    return this.data.products();
  }

  @Post('products')
  @RequirePermissions(Permissions.PRODUCTS_CREATE)
  createProduct(@Body() dto: CreateProductDto) {
    return this.data.createProduct(dto);
  }

  @Get('products/categories')
  @RequirePermissions(Permissions.PRODUCTS_READ)
  productCategories() {
    return this.data.productCategories();
  }

  @Post('products/categories')
  @RequirePermissions(Permissions.PRODUCTS_CATEGORIES)
  createProductCategory(@Body() dto: CreateProductCategoryDto) {
    return this.data.createProductCategory(dto);
  }

  @Get('products/settings/stock')
  @RequirePermissions(Permissions.PRODUCTS_READ)
  stockSettings() {
    return this.data.stockSettings();
  }

  @Patch('products/settings/stock')
  @RequirePermissions(Permissions.PRODUCTS_SETTINGS)
  updateStockSettings(@Body() dto: UpdateStockSettingsDto) {
    return this.data.updateStockSettings(dto);
  }

  @Get('products/:id')
  @RequirePermissions(Permissions.PRODUCTS_READ)
  productDetails(@Param('id') id: string) {
    return this.data.productDetails(id);
  }

  @Patch('products/:id')
  @RequirePermissions(Permissions.PRODUCTS_UPDATE)
  updateProduct(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.data.updateProduct(id, dto);
  }

  @Patch('products/:id/status')
  @RequirePermissions(Permissions.PRODUCTS_STATUS)
  setProductStatus(@Param('id') id: string, @Body() dto: SetProductStatusDto) {
    return this.data.setProductStatus(id, dto.active);
  }

  @Post('products/:id/movements')
  @RequirePermissions(Permissions.PRODUCTS_STOCK)
  createInventoryMovement(@Param('id') id: string, @Body() dto: CreateInventoryMovementDto) {
    return this.data.createInventoryMovement(id, dto);
  }

  @Get('appointments')
  @RequirePermissions(Permissions.APPOINTMENTS_READ)
  appointments(@Query() query: ListAppointmentsQuery) {
    return this.data.appointments(query);
  }

  @Get('appointments/options')
  @RequirePermissions(Permissions.APPOINTMENTS_READ)
  appointmentOptions() {
    return this.data.appointmentOptions();
  }

  @Post('appointments/available-slots')
  @RequirePermissions(Permissions.APPOINTMENTS_READ)
  appointmentSlots(@Body() dto: AppointmentSlotsDto) {
    return this.data.appointmentSlots(dto);
  }

  @Post('appointments')
  @RequirePermissions(Permissions.APPOINTMENTS_CREATE)
  createAppointment(@Body() dto: CreateAppointmentDto) {
    return this.data.createAppointment(dto);
  }

  @Patch('appointments/:id')
  @RequirePermissions(Permissions.APPOINTMENTS_UPDATE)
  updateAppointment(@Param('id') id: string, @Body() dto: UpdateAppointmentDto) {
    return this.data.updateAppointment(id, dto);
  }

  @Post('appointments/:id/confirm')
  @RequirePermissions(Permissions.APPOINTMENTS_STATUS)
  confirmAppointment(@Param('id') id: string) {
    return this.data.confirmAppointment(id);
  }

  @Post('appointments/:id/cancel')
  @RequirePermissions(Permissions.APPOINTMENTS_STATUS)
  cancelAppointment(@Param('id') id: string, @Body() dto: CancelAppointmentDto) {
    return this.data.cancelAppointment(id, dto);
  }

  @Post('appointments/:id/no-show')
  @RequirePermissions(Permissions.APPOINTMENTS_STATUS)
  markAppointmentNoShow(@Param('id') id: string) {
    return this.data.markAppointmentNoShow(id);
  }

  @Get('sales')
  @RequirePermissions(Permissions.SALES_READ)
  sales() {
    return this.data.sales();
  }

  @Get('sales/options')
  @RequirePermissions(Permissions.SALES_READ)
  saleOptions() {
    return this.data.saleOptions();
  }

  @Get('sales/:id')
  @RequirePermissions(Permissions.SALES_READ)
  saleDetails(@Param('id') id: string) {
    return this.data.saleDetails(id);
  }

  @Post('sales/from-appointment/:appointmentId')
  @RequirePermissions(Permissions.SALES_CREATE)
  startSaleFromAppointment(@Param('appointmentId') appointmentId: string) {
    return this.data.startSaleFromAppointment(appointmentId);
  }

  @Post('sales/walk-in')
  @RequirePermissions(Permissions.SALES_CREATE)
  createWalkInSale(@Body() dto: CreateWalkInSaleDto) {
    return this.data.createWalkInSale(dto);
  }

  @Post('sales/:id/items/services')
  @RequirePermissions(Permissions.SALES_UPDATE)
  addSaleServiceItem(@Param('id') id: string, @Body() dto: AddSaleServiceItemDto) {
    return this.data.addSaleServiceItem(id, dto);
  }

  @Post('sales/:id/items/products')
  @RequirePermissions(Permissions.SALES_UPDATE)
  addSaleProductItem(@Param('id') id: string, @Body() dto: AddSaleProductItemDto) {
    return this.data.addSaleProductItem(id, dto);
  }

  @Delete('sales/:id/items/:itemId')
  @RequirePermissions(Permissions.SALES_UPDATE)
  removeSaleItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.data.removeSaleItem(id, itemId);
  }

  @Patch('sales/:id/discount')
  @RequirePermissions(Permissions.SALES_DISCOUNT)
  applySaleDiscount(@Param('id') id: string, @Body() dto: ApplySaleDiscountDto) {
    return this.data.applySaleDiscount(id, dto);
  }

  @Post('sales/:id/finalize')
  @RequirePermissions(Permissions.SALES_FINALIZE)
  finalizeSale(@Param('id') id: string, @Body() dto: FinalizeSaleDto) {
    return this.data.finalizeSale(id, dto);
  }

  @Get('commissions')
  @RequirePermissions(Permissions.COMMISSIONS_READ)
  commissions(@Query() query: ListCommissionsQuery) {
    return this.data.commissions(query);
  }

  @Patch('commissions/:id')
  @RequirePermissions(Permissions.COMMISSIONS_UPDATE)
  adjustCommission(@Param('id') id: string, @Body() dto: AdjustCommissionDto) {
    return this.data.adjustCommission(id, dto);
  }

  @Post('commissions/:id/pay')
  @RequirePermissions(Permissions.COMMISSIONS_PAY)
  payCommission(@Param('id') id: string, @Body() dto: PayCommissionDto) {
    return this.data.payCommissions({ ...dto, commissionIds: [id] });
  }

  @Post('commissions/pay')
  @RequirePermissions(Permissions.COMMISSIONS_PAY)
  payCommissions(@Body() dto: PayCommissionsDto) {
    return this.data.payCommissions(dto);
  }

  @Get('cash-registers/current')
  @RequirePermissions(Permissions.FINANCE_READ)
  cashRegisterOverview() {
    return this.data.cashRegisterOverview();
  }

  @Get('cash-registers')
  @RequirePermissions(Permissions.FINANCE_READ)
  cashRegisters(@Query() query: ListCashRegistersQuery) {
    return this.data.cashRegisters(query);
  }

  @Post('cash-registers')
  @RequirePermissions(Permissions.CASH_REGISTER_MANAGE)
  openCashRegister(@Body() dto: OpenCashRegisterDto) {
    return this.data.openCashRegister(dto);
  }

  @Post('cash-registers/:id/transactions')
  @RequirePermissions(Permissions.FINANCIAL_TRANSACTIONS_MANAGE)
  createFinancialTransaction(@Param('id') id: string, @Body() dto: CreateFinancialTransactionDto) {
    return this.data.createFinancialTransaction(id, dto);
  }

  @Patch('financial-transactions/:id')
  @RequirePermissions(Permissions.FINANCIAL_TRANSACTIONS_MANAGE)
  updateFinancialTransaction(@Param('id') id: string, @Body() dto: UpdateFinancialTransactionDto) {
    return this.data.updateFinancialTransaction(id, dto);
  }

  @Post('financial-transactions/:id/cancel')
  @RequirePermissions(Permissions.FINANCIAL_TRANSACTIONS_MANAGE)
  cancelFinancialTransaction(@Param('id') id: string, @Body() dto: CancelFinancialTransactionDto) {
    return this.data.cancelFinancialTransaction(id, dto);
  }

  @Post('cash-registers/:id/close')
  @RequirePermissions(Permissions.CASH_REGISTER_MANAGE)
  closeCashRegister(@Param('id') id: string, @Body() dto: CloseCashRegisterDto) {
    return this.data.closeCashRegister(id, dto);
  }

  @Get('suppliers')
  @RequirePermissions(Permissions.ACCOUNTS_READ)
  suppliers() {
    return this.data.suppliers();
  }

  @Post('suppliers')
  @RequirePermissions(Permissions.ACCOUNTS_MANAGE)
  createSupplier(@Body() dto: CreateSupplierDto) {
    return this.data.createSupplier(dto);
  }

  @Patch('suppliers/:id')
  @RequirePermissions(Permissions.ACCOUNTS_MANAGE)
  updateSupplier(@Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.data.updateSupplier(id, dto);
  }

  @Patch('suppliers/:id/status')
  @RequirePermissions(Permissions.ACCOUNTS_MANAGE)
  setSupplierStatus(@Param('id') id: string, @Body() dto: SetSupplierStatusDto) {
    return this.data.setSupplierStatus(id, dto.active);
  }

  @Get('financial-categories')
  @RequirePermissions(Permissions.ACCOUNTS_READ)
  financialCategories() {
    return this.data.financialCategories();
  }

  @Post('financial-categories')
  @RequirePermissions(Permissions.ACCOUNTS_MANAGE)
  createFinancialCategory(@Body() dto: CreateFinancialCategoryDto) {
    return this.data.createFinancialCategory(dto);
  }

  @Patch('financial-categories/:id')
  @RequirePermissions(Permissions.ACCOUNTS_MANAGE)
  updateFinancialCategory(@Param('id') id: string, @Body() dto: UpdateFinancialCategoryDto) {
    return this.data.updateFinancialCategory(id, dto);
  }

  @Patch('financial-categories/:id/status')
  @RequirePermissions(Permissions.ACCOUNTS_MANAGE)
  setFinancialCategoryStatus(@Param('id') id: string, @Body() dto: SetFinancialCategoryStatusDto) {
    return this.data.setFinancialCategoryStatus(id, dto.active);
  }

  @Get('accounts/options')
  @RequirePermissions(Permissions.ACCOUNTS_READ)
  accountOptions() {
    return this.data.accountOptions();
  }

  @Get('accounts/payable')
  @RequirePermissions(Permissions.ACCOUNTS_READ)
  accountPayables(@Query() query: ListAccountsQuery) {
    return this.data.accountPayables(query);
  }

  @Post('accounts/payable')
  @RequirePermissions(Permissions.ACCOUNTS_MANAGE)
  createAccountPayable(@Body() dto: CreateAccountPayableDto) {
    return this.data.createAccountPayable(dto);
  }

  @Post('accounts/payable/:id/pay')
  @RequirePermissions(Permissions.ACCOUNTS_SETTLE)
  settleAccountPayable(@Param('id') id: string, @Body() dto: SettleAccountDto) {
    return this.data.settleAccountPayable(id, dto);
  }

  @Post('accounts/payable/:id/cancel')
  @RequirePermissions(Permissions.ACCOUNTS_MANAGE)
  cancelAccountPayable(@Param('id') id: string, @Body() dto: CancelAccountDto) {
    return this.data.cancelAccountPayable(id, dto);
  }

  @Get('accounts/receivable')
  @RequirePermissions(Permissions.ACCOUNTS_READ)
  accountReceivables(@Query() query: ListAccountsQuery) {
    return this.data.accountReceivables(query);
  }

  @Post('accounts/receivable')
  @RequirePermissions(Permissions.ACCOUNTS_MANAGE)
  createAccountReceivable(@Body() dto: CreateAccountReceivableDto) {
    return this.data.createAccountReceivable(dto);
  }

  @Post('accounts/receivable/:id/receive')
  @RequirePermissions(Permissions.ACCOUNTS_SETTLE)
  settleAccountReceivable(@Param('id') id: string, @Body() dto: SettleAccountDto) {
    return this.data.settleAccountReceivable(id, dto);
  }

  @Post('accounts/receivable/:id/cancel')
  @RequirePermissions(Permissions.ACCOUNTS_MANAGE)
  cancelAccountReceivable(@Param('id') id: string, @Body() dto: CancelAccountDto) {
    return this.data.cancelAccountReceivable(id, dto);
  }

  @Get('expense-recurrences')
  @RequirePermissions(Permissions.ACCOUNTS_READ)
  expenseRecurrences() {
    return this.data.expenseRecurrences();
  }

  @Post('expense-recurrences')
  @RequirePermissions(Permissions.ACCOUNTS_MANAGE)
  createExpenseRecurrence(@Body() dto: CreateExpenseRecurrenceDto) {
    return this.data.createExpenseRecurrence(dto);
  }

  @Patch('expense-recurrences/:id/status')
  @RequirePermissions(Permissions.ACCOUNTS_MANAGE)
  setExpenseRecurrenceStatus(@Param('id') id: string, @Body() dto: SetExpenseRecurrenceStatusDto) {
    return this.data.setExpenseRecurrenceStatus(id, dto.active);
  }

  @Get('dashboard')
  @RequirePermissions(Permissions.DASHBOARD_READ)
  dashboard(@Query() query: DashboardQuery) {
    return this.data.dashboard(query);
  }

  @Get('reports')
  @RequirePermissions(Permissions.REPORTS_READ)
  reports(@Query() query: ReportsQuery) {
    return this.data.reports(query);
  }
}
