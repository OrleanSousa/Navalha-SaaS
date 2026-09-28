-- Normalize service categories and support fixed commissions.
CREATE TABLE "ServiceCategory" (
  "id" TEXT NOT NULL,
  "barbershopId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServiceCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ServiceCategory_barbershopId_name_key"
  ON "ServiceCategory"("barbershopId", "name");
CREATE INDEX "ServiceCategory_barbershopId_active_idx"
  ON "ServiceCategory"("barbershopId", "active");

ALTER TABLE "Service" ADD COLUMN "categoryId" TEXT;
ALTER TABLE "Service" ADD COLUMN "commissionFixed" DECIMAL(10,2);

INSERT INTO "ServiceCategory" ("id", "barbershopId", "name")
SELECT md5("barbershopId" || ':' || lower(trim("category"))), "barbershopId", min(trim("category"))
FROM "Service"
WHERE "category" IS NOT NULL AND trim("category") <> ''
GROUP BY "barbershopId", lower(trim("category"));

UPDATE "Service" AS service
SET "categoryId" = category."id"
FROM "ServiceCategory" AS category
WHERE category."barbershopId" = service."barbershopId"
  AND lower(category."name") = lower(trim(service."category"));

ALTER TABLE "Service" DROP COLUMN "category";

ALTER TABLE "ServiceCategory" ADD CONSTRAINT "ServiceCategory_barbershopId_fkey"
  FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Service" ADD CONSTRAINT "Service_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Service_categoryId_idx" ON "Service"("categoryId");

ALTER TABLE "Service" ADD CONSTRAINT "Service_price_positive" CHECK ("price" > 0);
ALTER TABLE "Service" ADD CONSTRAINT "Service_duration_positive" CHECK ("durationMinutes" > 0 AND "durationMinutes" <= 1440);
ALTER TABLE "Service" ADD CONSTRAINT "Service_commission_percent_range" CHECK ("commissionPercent" IS NULL OR ("commissionPercent" >= 0 AND "commissionPercent" <= 100));
ALTER TABLE "Service" ADD CONSTRAINT "Service_commission_fixed_positive" CHECK ("commissionFixed" IS NULL OR "commissionFixed" >= 0);
ALTER TABLE "Service" ADD CONSTRAINT "Service_single_commission_type" CHECK ("commissionPercent" IS NULL OR "commissionFixed" IS NULL);
ALTER TABLE "EmployeeService" ADD CONSTRAINT "EmployeeService_commission_percent_range" CHECK ("commissionPercent" IS NULL OR ("commissionPercent" >= 0 AND "commissionPercent" <= 100));
ALTER TABLE "EmployeeService" ADD CONSTRAINT "EmployeeService_commission_fixed_positive" CHECK ("commissionFixed" IS NULL OR "commissionFixed" >= 0);
ALTER TABLE "EmployeeService" ADD CONSTRAINT "EmployeeService_single_commission_type" CHECK ("commissionPercent" IS NULL OR "commissionFixed" IS NULL);

INSERT INTO "Permission" ("id", "key", "description", "createdAt", "updatedAt") VALUES
  ('permission-services-update', 'services.update', 'Editar serviços', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('permission-services-status', 'services.status', 'Ativar e inativar serviços', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('permission-services-categories', 'services.categories', 'Gerenciar categorias de serviços', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('permission-services-professionals', 'services.professionals', 'Vincular profissionais e comissões aos serviços', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("role", "permissionId", "createdAt")
SELECT 'ADMIN'::"Role", "id", CURRENT_TIMESTAMP FROM "Permission"
WHERE "key" IN ('services.update', 'services.status', 'services.categories', 'services.professionals')
ON CONFLICT ("role", "permissionId") DO NOTHING;
