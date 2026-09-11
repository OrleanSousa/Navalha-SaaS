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
  EMPLOYEES_READ: 'employees.read',
  EMPLOYEES_CREATE: 'employees.create',
  SERVICES_READ: 'services.read',
  PRODUCTS_READ: 'products.read',
  APPOINTMENTS_READ: 'appointments.read',
  CUSTOMERS_CREATE: 'customers.create',
  SERVICES_CREATE: 'services.create',
  PRODUCTS_CREATE: 'products.create',
  APPOINTMENTS_CREATE: 'appointments.create',
} as const;

export type PermissionKey = (typeof Permissions)[keyof typeof Permissions];

export const PERMISSION_CATALOG: ReadonlyArray<{
  key: PermissionKey;
  description: string;
}> = [
  { key: Permissions.DASHBOARD_READ, description: 'Visualizar o dashboard' },
  { key: Permissions.CUSTOMERS_READ, description: 'Visualizar clientes' },
  { key: Permissions.EMPLOYEES_READ, description: 'Visualizar colaboradores' },
  { key: Permissions.EMPLOYEES_CREATE, description: 'Cadastrar colaboradores' },
  { key: Permissions.SERVICES_READ, description: 'Visualizar serviços' },
  { key: Permissions.PRODUCTS_READ, description: 'Visualizar produtos' },
  { key: Permissions.APPOINTMENTS_READ, description: 'Visualizar agenda' },
  { key: Permissions.CUSTOMERS_CREATE, description: 'Cadastrar clientes' },
  { key: Permissions.SERVICES_CREATE, description: 'Cadastrar serviços' },
  { key: Permissions.PRODUCTS_CREATE, description: 'Cadastrar produtos' },
  { key: Permissions.APPOINTMENTS_CREATE, description: 'Criar agendamentos' },
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
  ],
  [Role.BARBER]: [
    Permissions.DASHBOARD_READ,
    Permissions.CUSTOMERS_READ,
    Permissions.SERVICES_READ,
    Permissions.PRODUCTS_READ,
    Permissions.APPOINTMENTS_READ,
    Permissions.APPOINTMENTS_CREATE,
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

    const granted = await this.db.rolePermission.count({
      where: {
        role: request.user.role as Role,
        permission: { key: { in: permissions } },
      },
    });
    if (granted !== permissions.length) {
      throw new ForbiddenException('Permissão insuficiente para este recurso');
    }
    return true;
  }
}
