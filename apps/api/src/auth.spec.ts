import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { Request } from 'express';
import { AuthService } from './auth';

describe('AuthService login', () => {
  const request = {
    get: jest.fn().mockReturnValue('jest'),
    ip: '127.0.0.1',
  } as unknown as Request;
  let db: any;
  let jwt: any;
  let service: AuthService;
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash('Valid@123', 4);
  });

  beforeEach(() => {
    db = {
      user: { findUnique: jest.fn() },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      session: { create: jest.fn().mockResolvedValue({}) },
      rolePermission: { findMany: jest.fn().mockResolvedValue([]) },
      userPermission: { findMany: jest.fn().mockResolvedValue([]) },
    };
    jwt = { signAsync: jest.fn().mockResolvedValue('access-token') };
    service = new AuthService(db, jwt);
  });

  function user(overrides: Record<string, unknown> = {}) {
    return {
      id: 'user-1',
      barbershopId: 'shop-1',
      email: 'admin@example.com',
      name: 'Administrador',
      role: 'ADMIN',
      active: true,
      passwordHash,
      barbershop: {
        name: 'Barbearia',
        status: 'ACTIVE',
        subscription: { status: 'ACTIVE', expiresAt: null },
      },
      ...overrides,
    };
  }

  it('autentica credenciais corretas e cria uma sessão', async () => {
    db.user.findUnique.mockResolvedValue(user());

    const result = await service.login(
      { email: 'ADMIN@example.com', password: 'Valid@123' },
      request,
    );

    expect(result.accessToken).toBe('access-token');
    expect(result.user.email).toBe('admin@example.com');
    expect(db.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'admin@example.com' } }),
    );
    expect(db.session.create).toHaveBeenCalledTimes(1);
  });

  it('aplica concessões e bloqueios individuais na sessão', async () => {
    db.user.findUnique.mockResolvedValue(user());
    db.rolePermission.findMany.mockResolvedValue([
      { permission: { key: 'dashboard.read' } },
      { permission: { key: 'customers.read' } },
    ]);
    db.userPermission.findMany.mockResolvedValue([
      { granted: false, permission: { key: 'customers.read' } },
      { granted: true, permission: { key: 'employees.read' } },
    ]);

    const result = await service.login(
      { email: 'admin@example.com', password: 'Valid@123' },
      request,
    );

    expect(result.user.permissions).toEqual(['dashboard.read', 'employees.read']);
  });

  it('rejeita senha incorreta', async () => {
    db.user.findUnique.mockResolvedValue(user());

    await expect(
      service.login({ email: 'admin@example.com', password: 'Wrong@123' }, request),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(db.session.create).not.toHaveBeenCalled();
  });

  it('rejeita usuário inativo', async () => {
    db.user.findUnique.mockResolvedValue(user({ active: false }));

    await expect(
      service.login({ email: 'admin@example.com', password: 'Valid@123' }, request),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(db.session.create).not.toHaveBeenCalled();
  });

  it('rejeita barbearia suspensa', async () => {
    db.user.findUnique.mockResolvedValue(
      user({ barbershop: { name: 'Barbearia', status: 'SUSPENDED' } }),
    );

    await expect(
      service.login({ email: 'admin@example.com', password: 'Valid@123' }, request),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(db.session.create).not.toHaveBeenCalled();
  });

  it('rejeita assinatura expirada', async () => {
    db.user.findUnique.mockResolvedValue(
      user({
        barbershop: {
          name: 'Barbearia',
          status: 'ACTIVE',
          subscription: { status: 'ACTIVE', expiresAt: new Date(Date.now() - 1000) },
        },
      }),
    );

    await expect(
      service.login({ email: 'admin@example.com', password: 'Valid@123' }, request),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(db.session.create).not.toHaveBeenCalled();
  });

  it('permite acesso durante o periodo de cortesia', async () => {
    db.user.findUnique.mockResolvedValue(
      user({
        barbershop: {
          name: 'Barbearia',
          status: 'ACTIVE',
          subscription: {
            status: 'PAST_DUE',
            expiresAt: new Date(Date.now() - 1000),
            graceEndsAt: new Date(Date.now() + 86400000),
          },
        },
      }),
    );

    const result = await service.login(
      { email: 'admin@example.com', password: 'Valid@123' },
      request,
    );

    expect(result.accessToken).toBe('access-token');
    expect(db.session.create).toHaveBeenCalledTimes(1);
  });
});
