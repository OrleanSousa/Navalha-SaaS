import { AuditService, maskSensitive } from './audit';

describe('AuditService', () => {
  it('mascara segredos e dados pessoais inclusive em estruturas aninhadas', () => {
    expect(
      maskSensitive({
        name: 'Cliente',
        password: 'insegura',
        profile: { cpf: '123', phone: '11999999999' },
        items: [{ token: 'abc', amount: 10 }],
      }),
    ).toEqual({
      name: 'Cliente',
      password: '[REDACTED]',
      profile: { cpf: '[REDACTED]', phone: '[REDACTED]' },
      items: [{ token: '[REDACTED]', amount: 10 }],
    });
  });

  it('persiste somente snapshots sanitizados', async () => {
    const db = { auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) } };
    const audit = new AuditService(db as never);
    await audit.record({
      action: 'UPDATED',
      entity: 'CUSTOMER',
      barbershopId: 'shop-1',
      before: { email: 'cliente@example.com', name: 'Antes' },
      after: { email: 'novo@example.com', name: 'Depois' },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        before: { email: '[REDACTED]', name: 'Antes' },
        after: { email: '[REDACTED]', name: 'Depois' },
      }),
    });
  });
});
