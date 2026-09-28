CREATE TYPE "MessageJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

ALTER TABLE "Notification"
  ADD COLUMN "dedupKey" TEXT,
  ADD COLUMN "actionUrl" TEXT,
  ADD COLUMN "metadata" JSONB;

CREATE UNIQUE INDEX "Notification_barbershopId_dedupKey_key" ON "Notification"("barbershopId", "dedupKey");
CREATE INDEX "Notification_barbershopId_createdAt_idx" ON "Notification"("barbershopId", "createdAt");

CREATE TABLE "MessageJob" (
  "id" TEXT NOT NULL,
  "barbershopId" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "template" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "MessageJobStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MessageJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MessageJob_status_scheduledAt_idx" ON "MessageJob"("status", "scheduledAt");
CREATE INDEX "MessageJob_barbershopId_createdAt_idx" ON "MessageJob"("barbershopId", "createdAt");
ALTER TABLE "MessageJob" ADD CONSTRAINT "MessageJob_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "Permission" ("id", "key", "description", "createdAt", "updatedAt") VALUES
  (gen_random_uuid(), 'notifications.read', 'Visualizar notificações', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'notifications.manage', 'Gerenciar notificações', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET "description" = EXCLUDED."description", "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "RolePermission" ("role", "permissionId", "createdAt")
SELECT roles.value::"Role", permission."id", CURRENT_TIMESTAMP
FROM (VALUES ('ADMIN'), ('RECEPTIONIST'), ('BARBER')) AS roles(value)
CROSS JOIN "Permission" permission
WHERE permission."key" IN ('notifications.read', 'notifications.manage')
ON CONFLICT ("role", "permissionId") DO NOTHING;
