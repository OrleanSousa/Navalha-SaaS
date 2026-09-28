ALTER TABLE "AccountPayable" ADD COLUMN "recurrenceDueDate" TIMESTAMP(3);

CREATE UNIQUE INDEX "AccountPayable_recurrenceId_recurrenceDueDate_key"
  ON "AccountPayable"("recurrenceId", "recurrenceDueDate");

INSERT INTO "Permission" ("id", "key", "description", "createdAt", "updatedAt") VALUES
  (gen_random_uuid(), 'accounts.read', 'Visualizar contas a pagar e receber', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'accounts.manage', 'Gerenciar fornecedores, categorias e contas', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'accounts.settle', 'Registrar pagamentos e recebimentos', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET "description" = EXCLUDED."description", "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "RolePermission" ("role", "permissionId", "createdAt")
SELECT role_name::"Role", permission."id", CURRENT_TIMESTAMP
FROM (VALUES ('ADMIN'), ('RECEPTIONIST')) roles(role_name)
CROSS JOIN "Permission" permission
WHERE permission."key" IN ('accounts.read', 'accounts.manage', 'accounts.settle')
ON CONFLICT ("role", "permissionId") DO NOTHING;
