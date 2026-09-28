CREATE TYPE "SaleStatus" AS ENUM ('DRAFT', 'COMPLETED', 'CANCELLED');

ALTER TABLE "Sale"
  ADD COLUMN "status" "SaleStatus" NOT NULL DEFAULT 'COMPLETED',
  ADD COLUMN "discountReason" TEXT,
  ADD COLUMN "completedAt" TIMESTAMP(3);

UPDATE "Sale" SET "completedAt" = "createdAt" WHERE "status" = 'COMPLETED';

ALTER TABLE "InventoryMovement" ADD COLUMN "saleId" TEXT;
ALTER TABLE "FinancialTransaction" ADD COLUMN "saleId" TEXT;

ALTER TABLE "InventoryMovement"
  ADD CONSTRAINT "InventoryMovement_saleId_fkey"
  FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FinancialTransaction"
  ADD CONSTRAINT "FinancialTransaction_saleId_fkey"
  FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Sale" ADD CONSTRAINT "Sale_values_check"
  CHECK ("subtotal" >= 0 AND "discount" >= 0 AND "total" >= 0 AND "discount" <= "subtotal");
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_values_check"
  CHECK ("quantity" > 0 AND "unitPrice" >= 0 AND "total" >= 0);
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_reference_check"
  CHECK (("serviceId" IS NOT NULL)::int + ("productId" IS NOT NULL)::int = 1);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_check" CHECK ("amount" > 0);

CREATE INDEX "Sale_barbershopId_status_createdAt_idx" ON "Sale"("barbershopId", "status", "createdAt");
CREATE INDEX "InventoryMovement_saleId_idx" ON "InventoryMovement"("saleId");
CREATE INDEX "FinancialTransaction_saleId_idx" ON "FinancialTransaction"("saleId");

INSERT INTO "Permission" ("id", "key", "description", "createdAt", "updatedAt") VALUES
  (gen_random_uuid(), 'sales.read', 'Visualizar atendimentos e vendas', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'sales.create', 'Iniciar atendimentos', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'sales.update', 'Editar itens do atendimento', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'sales.discount', 'Aplicar descontos em atendimentos', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'sales.finalize', 'Finalizar vendas e pagamentos', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET "description" = EXCLUDED."description", "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "RolePermission" ("role", "permissionId", "createdAt")
SELECT role::"Role", permission."id", CURRENT_TIMESTAMP
FROM (VALUES
  ('ADMIN', 'sales.read'), ('ADMIN', 'sales.create'), ('ADMIN', 'sales.update'),
  ('ADMIN', 'sales.discount'), ('ADMIN', 'sales.finalize'),
  ('RECEPTIONIST', 'sales.read'), ('RECEPTIONIST', 'sales.create'),
  ('RECEPTIONIST', 'sales.update'), ('RECEPTIONIST', 'sales.finalize'),
  ('BARBER', 'sales.read'), ('BARBER', 'sales.create'), ('BARBER', 'sales.update')
) AS grants(role, permission_key)
JOIN "Permission" permission ON permission."key" = grants.permission_key
ON CONFLICT ("role", "permissionId") DO NOTHING;
