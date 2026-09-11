import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Permissions, PermissionsGuard, RolesGuard } from './rbac';

function context(user?: { role: Role; sub?: string }) {
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
    const db = { rolePermission: { findMany: jest.fn() } };
    const guard = new PermissionsGuard(reflector as any, db as any);

    await expect(guard.canActivate(context())).resolves.toBe(true);
    expect(db.rolePermission.findMany).not.toHaveBeenCalled();
  });

  it('permite quando todas as permissões foram concedidas', async () => {
    const required = [Permissions.DASHBOARD_READ, Permissions.CUSTOMERS_READ];
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(required) };
    const db = {
      rolePermission: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { permission: { key: Permissions.DASHBOARD_READ } },
            { permission: { key: Permissions.CUSTOMERS_READ } },
          ]),
      },
      userPermission: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const guard = new PermissionsGuard(reflector as any, db as any);

    await expect(guard.canActivate(context({ role: Role.ADMIN, sub: 'user-1' }))).resolves.toBe(
      true,
    );
    expect(db.rolePermission.findMany).toHaveBeenCalledWith({
      where: {
        role: Role.ADMIN,
        permission: { key: { in: required } },
      },
      select: { permission: { select: { key: true } } },
    });
  });

  it('rejeita quando uma permissão está ausente', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([Permissions.EMPLOYEES_READ]),
    };
    const db = {
      rolePermission: { findMany: jest.fn().mockResolvedValue([]) },
      userPermission: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const guard = new PermissionsGuard(reflector as any, db as any);

    await expect(
      guard.canActivate(context({ role: Role.BARBER, sub: 'user-1' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejeita requisição sem usuário autenticado', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([Permissions.DASHBOARD_READ]),
    };
    const guard = new PermissionsGuard(
      reflector as any,
      { rolePermission: { findMany: jest.fn() } } as any,
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
    const db = { rolePermission: { findMany: jest.fn() } };
    const guard = new PermissionsGuard(reflector as any, db as any);

    await expect(guard.canActivate(context({ role: Role.SUPER_ADMIN }))).resolves.toBe(true);
    expect(db.rolePermission.findMany).not.toHaveBeenCalled();
  });

  it('aplica bloqueio individual sobre permissão do perfil', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([Permissions.DASHBOARD_READ]),
    };
    const db = {
      rolePermission: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ permission: { key: Permissions.DASHBOARD_READ } }]),
      },
      userPermission: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ granted: false, permission: { key: Permissions.DASHBOARD_READ } }]),
      },
    };
    const guard = new PermissionsGuard(reflector as any, db as any);

    await expect(
      guard.canActivate(context({ role: Role.BARBER, sub: 'user-1' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
