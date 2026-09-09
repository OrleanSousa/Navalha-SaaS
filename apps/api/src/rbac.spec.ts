import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Permissions, PermissionsGuard, RolesGuard } from './rbac';

function context(user?: { role: Role }) {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as any;
}

describe('RolesGuard', () => {
  it('permite rota sem restrição de perfil', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) };
    const guard = new RolesGuard(reflector as any);

    expect(guard.canActivate(context())).toBe(true);
  });

  it('permite perfil autorizado', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue([Role.ADMIN]) };
    const guard = new RolesGuard(reflector as any);

    expect(guard.canActivate(context({ role: Role.ADMIN }))).toBe(true);
  });

  it('rejeita perfil não autorizado', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue([Role.ADMIN]) };
    const guard = new RolesGuard(reflector as any);

    expect(() => guard.canActivate(context({ role: Role.BARBER }))).toThrow(ForbiddenException);
  });

  it('libera Super Admin somente quando a exceção está declarada', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValueOnce([Role.ADMIN]).mockReturnValueOnce(true),
    };
    const guard = new RolesGuard(reflector as any);

    expect(guard.canActivate(context({ role: Role.SUPER_ADMIN }))).toBe(true);
  });
});

describe('PermissionsGuard', () => {
  it('permite rota sem permissão declarada', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) };
    const db = { rolePermission: { count: jest.fn() } };
    const guard = new PermissionsGuard(reflector as any, db as any);

    await expect(guard.canActivate(context())).resolves.toBe(true);
    expect(db.rolePermission.count).not.toHaveBeenCalled();
  });

  it('permite quando todas as permissões foram concedidas', async () => {
    const required = [Permissions.DASHBOARD_READ, Permissions.CUSTOMERS_READ];
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(required) };
    const db = { rolePermission: { count: jest.fn().mockResolvedValue(2) } };
    const guard = new PermissionsGuard(reflector as any, db as any);

    await expect(guard.canActivate(context({ role: Role.ADMIN }))).resolves.toBe(true);
    expect(db.rolePermission.count).toHaveBeenCalledWith({
      where: {
        role: Role.ADMIN,
        permission: { key: { in: required } },
      },
    });
  });

  it('rejeita quando uma permissão está ausente', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([Permissions.EMPLOYEES_READ]),
    };
    const db = { rolePermission: { count: jest.fn().mockResolvedValue(0) } };
    const guard = new PermissionsGuard(reflector as any, db as any);

    await expect(guard.canActivate(context({ role: Role.BARBER }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejeita requisição sem usuário autenticado', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([Permissions.DASHBOARD_READ]),
    };
    const guard = new PermissionsGuard(
      reflector as any,
      { rolePermission: { count: jest.fn() } } as any,
    );

    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('libera Super Admin somente quando a exceção está declarada', async () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValueOnce([Permissions.DASHBOARD_READ])
        .mockReturnValueOnce(true),
    };
    const db = { rolePermission: { count: jest.fn() } };
    const guard = new PermissionsGuard(reflector as any, db as any);

    await expect(guard.canActivate(context({ role: Role.SUPER_ADMIN }))).resolves.toBe(true);
    expect(db.rolePermission.count).not.toHaveBeenCalled();
  });
});
