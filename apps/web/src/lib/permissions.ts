export const Permissions = {
  DASHBOARD_READ: 'dashboard.read',
  CUSTOMERS_READ: 'customers.read',
  EMPLOYEES_READ: 'employees.read',
  SERVICES_READ: 'services.read',
  PRODUCTS_READ: 'products.read',
  APPOINTMENTS_READ: 'appointments.read',
  CUSTOMERS_CREATE: 'customers.create',
  SERVICES_CREATE: 'services.create',
  PRODUCTS_CREATE: 'products.create',
  APPOINTMENTS_CREATE: 'appointments.create',
} as const;

export type PermissionKey = (typeof Permissions)[keyof typeof Permissions];
