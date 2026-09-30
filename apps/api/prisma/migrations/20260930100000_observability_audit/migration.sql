ALTER TABLE "AuditLog"
ADD COLUMN "userAgent" TEXT,
ADD COLUMN "correlationId" TEXT;

CREATE INDEX "AuditLog_correlationId_idx" ON "AuditLog"("correlationId");

INSERT INTO "Permission" ("id", "key", "description", "createdAt", "updatedAt") VALUES
  (gen_random_uuid(), 'audit.read', 'Consultar registros de auditoria', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET "description" = EXCLUDED."description", "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "RolePermission" ("role", "permissionId", "createdAt")
SELECT 'ADMIN'::"Role", permission."id", CURRENT_TIMESTAMP
FROM "Permission" permission
WHERE permission."key" = 'audit.read'
ON CONFLICT ("role", "permissionId") DO NOTHING;
