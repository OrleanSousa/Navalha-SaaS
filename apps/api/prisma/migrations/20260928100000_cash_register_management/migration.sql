CREATE TYPE "FinancialOrigin" AS ENUM ('MANUAL', 'SALE', 'COMMISSION');

ALTER TABLE "CashRegister"
  ADD COLUMN "closedById" TEXT,
  ADD COLUMN "closingNotes" TEXT;

ALTER TABLE "FinancialTransaction"
  ADD COLUMN "origin" "FinancialOrigin" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancelledById" TEXT,
  ADD COLUMN "cancellationReason" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Setting"
  ADD COLUMN "allowMultipleOpenCashRegisters" BOOLEAN NOT NULL DEFAULT false;

UPDATE "FinancialTransaction"
SET "origin" = 'SALE'
WHERE "saleId" IS NOT NULL;

UPDATE "FinancialTransaction"
SET "origin" = 'COMMISSION'
WHERE "category" = 'Comissões';

ALTER TABLE "CashRegister"
  ADD CONSTRAINT "CashRegister_closedById_fkey"
  FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FinancialTransaction"
  ADD CONSTRAINT "FinancialTransaction_cancelledById_fkey"
  FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "CashRegister_barbershopId_closedAt_openedAt_idx"
  ON "CashRegister"("barbershopId", "closedAt", "openedAt");

CREATE INDEX "FinancialTransaction_cashRegisterId_status_createdAt_idx"
  ON "FinancialTransaction"("cashRegisterId", "status", "createdAt");

INSERT INTO "Permission" ("id", "key", "description", "createdAt", "updatedAt") VALUES
  (gen_random_uuid(), 'finance.read', 'Visualizar caixas e lançamentos financeiros', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'cash-register.manage', 'Abrir e fechar caixas', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'financial-transactions.manage', 'Criar, editar e cancelar lançamentos manuais', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET "description" = EXCLUDED."description", "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "RolePermission" ("role", "permissionId", "createdAt")
SELECT role_name::"Role", permission."id", CURRENT_TIMESTAMP
FROM (VALUES ('ADMIN'), ('RECEPTIONIST')) roles(role_name)
CROSS JOIN "Permission" permission
WHERE permission."key" IN ('finance.read', 'cash-register.manage', 'financial-transactions.manage')
ON CONFLICT ("role", "permissionId") DO NOTHING;
