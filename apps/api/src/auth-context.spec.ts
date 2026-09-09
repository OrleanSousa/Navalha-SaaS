import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuthenticatedRequest, TenantContext } from './auth-context';

describe('TenantContext', () => {
  it('expõe o usuário e o tenant autenticados', () => {
    const request = {
      user: {
        sub: 'user-1',
        barbershopId: 'shop-1',
        role: 'ADMIN',
        name: 'Administrador',
        permissions: [],
      },
    } as unknown as AuthenticatedRequest;
    const context = new TenantContext(request);

    expect(context.user).toBe(request.user);
    expect(context.userId).toBe('user-1');
    expect(context.barbershopId).toBe('shop-1');
  });

  it('rejeita uma requisição sem usuário autenticado', () => {
    const context = new TenantContext({} as AuthenticatedRequest);

    expect(() => context.user).toThrow(UnauthorizedException);
  });

  it('rejeita acesso tenant-aware sem barbearia', () => {
    const context = new TenantContext({
      user: {
        sub: 'super-1',
        barbershopId: null,
        role: 'SUPER_ADMIN',
        name: 'Super Admin',
        permissions: [],
      },
    } as unknown as AuthenticatedRequest);

    expect(() => context.barbershopId).toThrow(ForbiddenException);
  });
});
