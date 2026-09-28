ALTER TABLE "Commission"
  ADD COLUMN "paidById" TEXT,
  ADD COLUMN "paymentMethod" "PaymentMethod",
  ADD COLUMN "financialTransactionId" TEXT,
  ADD COLUMN "calculation" JSONB;

ALTER TABLE "Commission"
  ADD CONSTRAINT "Commission_paidById_fkey"
  FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Commission"
  ADD CONSTRAINT "Commission_financialTransactionId_fkey"
  FOREIGN KEY ("financialTransactionId") REFERENCES "FinancialTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Commission_employeeId_status_createdAt_idx" ON "Commission"("employeeId", "status", "createdAt");
CREATE INDEX "Commission_financialTransactionId_idx" ON "Commission"("financialTransactionId");

INSERT INTO "Permission" ("id", "key", "description", "createdAt", "updatedAt") VALUES
  (gen_random_uuid(), 'commissions.read', 'Visualizar comissões', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'commissions.update', 'Ajustar comissões pendentes', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'commissions.pay', 'Registrar pagamentos de comissões', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET "description" = EXCLUDED."description", "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "RolePermission" ("role", "permissionId", "createdAt")
SELECT 'ADMIN'::"Role", permission."id", CURRENT_TIMESTAMP
FROM "Permission" permission
WHERE permission."key" IN ('commissions.read', 'commissions.update', 'commissions.pay')
ON CONFLICT ("role", "permissionId") DO NOTHING;
