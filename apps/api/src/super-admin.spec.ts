import { BadRequestException } from '@nestjs/common';
import { DocumentType, SuperAdminService } from './super-admin';

describe('SuperAdminService', () => {
  it('rejeita senhas que não coincidem antes de consultar o banco', async () => {
    const db = { plan: { findFirst: jest.fn() } };
    const service = new SuperAdminService(db as any);

    await expect(
      service.createBarbershop(
        {
          name: 'Nova Barbearia',
          ownerName: 'Proprietário',
          email: 'contato@example.com',
          documentType: DocumentType.CNPJ,
          document: '12345678000195',
          phone: '11999999999',
          planId: '82d63db5-24d2-45e8-8c19-bdb860dcc137',
          adminName: 'Administrador',
          adminEmail: 'admin@example.com',
          adminPassword: 'Senha@123',
          adminPasswordConfirmation: 'Outra@123',
        },
        'actor-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.plan.findFirst).not.toHaveBeenCalled();
  });

  it('rejeita documento incompatível com o tipo selecionado', async () => {
    const service = new SuperAdminService({} as any);

    await expect(
      service.createBarbershop(
        {
          name: 'Nova Barbearia',
          ownerName: 'Proprietário',
          email: 'contato@example.com',
          documentType: DocumentType.CPF,
          document: '12345678000195',
          phone: '11999999999',
          planId: '82d63db5-24d2-45e8-8c19-bdb860dcc137',
          adminName: 'Administrador',
          adminEmail: 'admin@example.com',
          adminPassword: 'Senha@123',
          adminPasswordConfirmation: 'Senha@123',
        },
        'actor-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
