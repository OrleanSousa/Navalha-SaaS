import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { AuthenticatedRequest } from './auth-context';
import { PrismaService } from './prisma.service';

export const Permissions = {
  DASHBOARD_READ: 'dashboard.read',
  CUSTOMERS_READ: 'customers.read',
  CUSTOMERS_UPDATE: 'customers.update',
  CUSTOMERS_STATUS: 'customers.status',
  EMPLOYEES_READ: 'employees.read',
  EMPLOYEES_CREATE: 'employees.create',
  EMPLOYEES_UPDATE: 'employees.update',
  EMPLOYEES_STATUS: 'employees.status',
  EMPLOYEES_PHOTO: 'employees.photo',
  EMPLOYEES_ACCESS: 'employees.access',
  EMPLOYEES_PERMISSIONS: 'employees.permissions',
  EMPLOYEES_COMMISSION: 'employees.commission',
  EMPLOYEES_SCHEDULE: 'employees.schedule',
  EMPLOYEES_UNAVAILABILITY: 'employees.unavailability',
  SERVICES_READ: 'services.read',
  SERVICES_UPDATE: 'services.update',
  SERVICES_STATUS: 'services.status',
  SERVICES_CATEGORIES: 'services.categories',
  SERVICES_PROFESSIONALS: 'services.professionals',
  PRODUCTS_READ: 'products.read',
  PRODUCTS_UPDATE: 'products.update',
  PRODUCTS_STATUS: 'products.status',
  PRODUCTS_CATEGORIES: 'products.categories',
  PRODUCTS_STOCK: 'products.stock',
  PRODUCTS_SETTINGS: 'products.settings',
  APPOINTMENTS_READ: 'appointments.read',
  APPOINTMENTS_UPDATE: 'appointments.update',
  APPOINTMENTS_STATUS: 'appointments.status',
  CUSTOMERS_CREATE: 'customers.create',
  SERVICES_CREATE: 'services.create',
  PRODUCTS_CREATE: 'products.create',
  APPOINTMENTS_CREATE: 'appointments.create',
  SALES_READ: 'sales.read',
  SALES_CREATE: 'sales.create',
  SALES_UPDATE: 'sales.update',
  SALES_DISCOUNT: 'sales.discount',
  SALES_FINALIZE: 'sales.finalize',
  COMMISSIONS_READ: 'commissions.read',
  COMMISSIONS_UPDATE: 'commissions.update',
  COMMISSIONS_PAY: 'commissions.pay',
  FINANCE_READ: 'finance.read',
  CASH_REGISTER_MANAGE: 'cash-register.manage',
  FINANCIAL_TRANSACTIONS_MANAGE: 'financial-transactions.manage',
  ACCOUNTS_READ: 'accounts.read',
  ACCOUNTS_MANAGE: 'accounts.manage',
  ACCOUNTS_SETTLE: 'accounts.settle',
  REPORTS_READ: 'reports.read',
  SETTINGS_READ: 'settings.read',
  SETTINGS_MANAGE: 'settings.manage',
  NOTIFICATIONS_READ: 'notifications.read',
  NOTIFICATIONS_MANAGE: 'notifications.manage',
  AUDIT_READ: 'audit.read',
} as const;

export type PermissionKey = (typeof Permissions)[keyof typeof Permissions];

export const PERMISSION_CATALOG: ReadonlyArray<{
  key: PermissionKey;
  description: string;
}> = [
  { key: Permissions.DASHBOARD_READ, description: 'Visualizar o dashboard' },
  { key: Permissions.CUSTOMERS_READ, description: 'Visualizar clientes' },
  { key: Permissions.CUSTOMERS_UPDATE, description: 'Editar clientes' },
  { key: Permissions.CUSTOMERS_STATUS, description: 'Arquivar e restaurar clientes' },
  { key: Permissions.EMPLOYEES_READ, description: 'Visualizar colaboradores' },
  { key: Permissions.EMPLOYEES_CREATE, description: 'Cadastrar colaboradores' },
  { key: Permissions.EMPLOYEES_UPDATE, description: 'Editar colaboradores' },
  { key: Permissions.EMPLOYEES_STATUS, description: 'Ativar e inativar colaboradores' },
  { key: Permissions.EMPLOYEES_PHOTO, description: 'Alterar foto de colaboradores' },
  { key: Permissions.EMPLOYEES_ACCESS, description: 'Criar acesso de colaboradores' },
  { key: Permissions.EMPLOYEES_PERMISSIONS, description: 'Editar perfil e permissões' },
  { key: Permissions.EMPLOYEES_COMMISSION, description: 'Configurar comissão padrão' },
  { key: Permissions.EMPLOYEES_SCHEDULE, description: 'Gerenciar jornada semanal' },
  { key: Permissions.EMPLOYEES_UNAVAILABILITY, description: 'Gerenciar indisponibilidades' },
  { key: Permissions.SERVICES_READ, description: 'Visualizar serviços' },
  { key: Permissions.SERVICES_UPDATE, description: 'Editar serviços' },
  { key: Permissions.SERVICES_STATUS, description: 'Ativar e inativar serviços' },
  { key: Permissions.SERVICES_CATEGORIES, description: 'Gerenciar categorias de serviços' },
  {
    key: Permissions.SERVICES_PROFESSIONALS,
    description: 'Vincular profissionais e comissões aos serviços',
  },
  { key: Permissions.PRODUCTS_READ, description: 'Visualizar produtos' },
  { key: Permissions.PRODUCTS_UPDATE, description: 'Editar produtos' },
  { key: Permissions.PRODUCTS_STATUS, description: 'Ativar e inativar produtos' },
  { key: Permissions.PRODUCTS_CATEGORIES, description: 'Gerenciar categorias de produtos' },
  { key: Permissions.PRODUCTS_STOCK, description: 'Registrar movimentações de estoque' },
  { key: Permissions.PRODUCTS_SETTINGS, description: 'Configurar regras de estoque' },
  { key: Permissions.APPOINTMENTS_READ, description: 'Visualizar agenda' },
  { key: Permissions.APPOINTMENTS_UPDATE, description: 'Editar e reagendar compromissos' },
  { key: Permissions.APPOINTMENTS_STATUS, description: 'Alterar status de agendamentos' },
  { key: Permissions.CUSTOMERS_CREATE, description: 'Cadastrar clientes' },
  { key: Permissions.SERVICES_CREATE, description: 'Cadastrar serviços' },
  { key: Permissions.PRODUCTS_CREATE, description: 'Cadastrar produtos' },
  { key: Permissions.APPOINTMENTS_CREATE, description: 'Criar agendamentos' },
  { key: Permissions.SALES_READ, description: 'Visualizar atendimentos e vendas' },
  { key: Permissions.SALES_CREATE, description: 'Iniciar atendimentos' },
  { key: Permissions.SALES_UPDATE, description: 'Editar itens do atendimento' },
  { key: Permissions.SALES_DISCOUNT, description: 'Aplicar descontos em atendimentos' },
  { key: Permissions.SALES_FINALIZE, description: 'Finalizar vendas e pagamentos' },
  { key: Permissions.COMMISSIONS_READ, description: 'Visualizar comissões' },
  { key: Permissions.COMMISSIONS_UPDATE, description: 'Ajustar comissões pendentes' },
  { key: Permissions.COMMISSIONS_PAY, description: 'Registrar pagamentos de comissões' },
  { key: Permissions.FINANCE_READ, description: 'Visualizar caixas e lançamentos financeiros' },
  { key: Permissions.CASH_REGISTER_MANAGE, description: 'Abrir e fechar caixas' },
  {
    key: Permissions.FINANCIAL_TRANSACTIONS_MANAGE,
    description: 'Criar, editar e cancelar lançamentos manuais',
  },
  { key: Permissions.ACCOUNTS_READ, description: 'Visualizar contas a pagar e receber' },
  {
    key: Permissions.ACCOUNTS_MANAGE,
    description: 'Gerenciar fornecedores, categorias e contas',
  },
  { key: Permissions.ACCOUNTS_SETTLE, description: 'Registrar pagamentos e recebimentos' },
  { key: Permissions.REPORTS_READ, description: 'Visualizar e exportar relatórios' },
  { key: Permissions.SETTINGS_READ, description: 'Visualizar configurações da barbearia' },
  { key: Permissions.SETTINGS_MANAGE, description: 'Editar configurações da barbearia' },
  { key: Permissions.NOTIFICATIONS_READ, description: 'Visualizar notificações' },
  { key: Permissions.NOTIFICATIONS_MANAGE, description: 'Gerenciar notificações' },
  { key: Permissions.AUDIT_READ, description: 'Consultar registros de auditoria' },
];

export const DEFAULT_ROLE_PERMISSIONS: Record<Role, readonly PermissionKey[]> = {
  [Role.SUPER_ADMIN]: [],
  [Role.ADMIN]: Object.values(Permissions),
  [Role.RECEPTIONIST]: [
    Permissions.DASHBOARD_READ,
    Permissions.CUSTOMERS_READ,
    Permissions.EMPLOYEES_READ,
    Permissions.SERVICES_READ,
    Permissions.PRODUCTS_READ,
    Permissions.APPOINTMENTS_READ,
    Permissions.CUSTOMERS_CREATE,
    Permissions.APPOINTMENTS_CREATE,
    Permissions.SALES_READ,
    Permissions.SALES_CREATE,
    Permissions.SALES_UPDATE,
    Permissions.SALES_FINALIZE,
    Permissions.FINANCE_READ,
    Permissions.CASH_REGISTER_MANAGE,
    Permissions.FINANCIAL_TRANSACTIONS_MANAGE,
    Permissions.ACCOUNTS_READ,
    Permissions.ACCOUNTS_MANAGE,
    Permissions.ACCOUNTS_SETTLE,
    Permissions.NOTIFICATIONS_READ,
    Permissions.NOTIFICATIONS_MANAGE,
  ],
  [Role.BARBER]: [
    Permissions.DASHBOARD_READ,
    Permissions.CUSTOMERS_READ,
    Permissions.SERVICES_READ,
    Permissions.PRODUCTS_READ,
    Permissions.APPOINTMENTS_READ,
    Permissions.APPOINTMENTS_CREATE,
    Permissions.SALES_READ,
    Permissions.SALES_CREATE,
    Permissions.SALES_UPDATE,
    Permissions.NOTIFICATIONS_READ,
    Permissions.NOTIFICATIONS_MANAGE,
  ],
};

const ROLES_KEY = 'rbac:roles';
const PERMISSIONS_KEY = 'rbac:permissions';
const ALLOW_SUPER_ADMIN_KEY = 'rbac:allow-super-admin';

export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
export const RequirePermissions = (...permissions: PermissionKey[]) =>
  SetMetadata(PERMISSIONS_KEY, [...new Set(permissions)]);
export const AllowSuperAdmin = () => SetMetadata(ALLOW_SUPER_ADMIN_KEY, true);

function allowsSuperAdmin(reflector: Reflector, context: ExecutionContext): boolean {
  return Boolean(
    reflector.getAllAndOverride<boolean>(ALLOW_SUPER_ADMIN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]),
  );
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) throw new UnauthorizedException('Usuário não autenticado');
    if (request.user.role === Role.SUPER_ADMIN && allowsSuperAdmin(this.reflector, context)) {
      return true;
    }
    if (!roles.includes(request.user.role as Role)) {
      throw new ForbiddenException('Perfil sem acesso a este recurso');
    }
    return true;
  }
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly db: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permissions = this.reflector.getAllAndOverride<PermissionKey[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!permissions?.length) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) throw new UnauthorizedException('Usuário não autenticado');
    if (request.user.role === Role.SUPER_ADMIN && allowsSuperAdmin(this.reflector, context)) {
      return true;
    }

    const [rolePermissions, overrides] = await Promise.all([
      this.db.rolePermission.findMany({
        where: { role: request.user.role as Role, permission: { key: { in: permissions } } },
        select: { permission: { select: { key: true } } },
      }),
      this.db.userPermission.findMany({
        where: { userId: request.user.sub, permission: { key: { in: permissions } } },
        select: { granted: true, permission: { select: { key: true } } },
      }),
    ]);
    const effective = new Set(rolePermissions.map(({ permission }) => permission.key));
    for (const override of overrides) {
      if (override.granted) effective.add(override.permission.key);
      else effective.delete(override.permission.key);
    }
    if (permissions.some((permission) => !effective.has(permission))) {
      throw new ForbiddenException('Permissão insuficiente para este recurso');
    }
    return true;
  }
}
