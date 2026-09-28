CREATE TYPE "OnboardingStep" AS ENUM ('BUSINESS', 'HOURS', 'TEAM', 'SERVICES', 'BOOKING');

ALTER TABLE "Barbershop" ADD COLUMN "primaryTextColor" TEXT NOT NULL DEFAULT '#FFFFFF';
ALTER TABLE "Setting" ADD COLUMN "allowCreditSales" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "OnboardingProgress" (
  "id" TEXT NOT NULL,
  "barbershopId" TEXT NOT NULL,
  "completedSteps" "OnboardingStep"[] DEFAULT ARRAY[]::"OnboardingStep"[],
  "dismissedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OnboardingProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OnboardingProgress_barbershopId_key" ON "OnboardingProgress"("barbershopId");
ALTER TABLE "OnboardingProgress" ADD CONSTRAINT "OnboardingProgress_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "Permission" ("id", "key", "description", "createdAt", "updatedAt") VALUES
  (gen_random_uuid(), 'settings.read', 'Visualizar configurações da barbearia', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'settings.manage', 'Editar configurações da barbearia', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET "description" = EXCLUDED."description", "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "RolePermission" ("role", "permissionId", "createdAt")
SELECT 'ADMIN'::"Role", permission."id", CURRENT_TIMESTAMP
FROM "Permission" permission
WHERE permission."key" IN ('settings.read', 'settings.manage')
ON CONFLICT ("role", "permissionId") DO NOTHING;
