-- Execute como papel proprietário após as migrations. A aplicação deve conectar com
-- um papel diferente, sem BYPASSRLS, e definir app.current_tenant_id em cada transação.
DO $$
DECLARE
  table_name text;
  tenant_tables text[] := ARRAY[
    'Subscription','SubscriptionHistory','SubscriptionInvoice','BillingCouponRedemption',
    'Employee','WorkSchedule','EmployeeUnavailability','Customer','Service','ServiceCategory',
    'EmployeeService','Product','ProductCategory','InventoryMovement','Appointment',
    'AppointmentService','Sale','SaleItem','Payment','Commission','CashRegister',
    'FinancialTransaction','Supplier','FinancialCategory','ExpenseRecurrence','AccountPayable',
    'AccountReceivable','Notification','MessageJob','AuditLog','Setting','OnboardingProgress'
  ];
BEGIN
  FOREACH table_name IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING ("barbershopId" = nullif(current_setting(''app.current_tenant_id'', true), '''')::text) WITH CHECK ("barbershopId" = nullif(current_setting(''app.current_tenant_id'', true), '''')::text)',
      table_name
    );
  END LOOP;
END $$;
