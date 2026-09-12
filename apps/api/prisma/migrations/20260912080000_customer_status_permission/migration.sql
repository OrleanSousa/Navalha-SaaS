INSERT INTO "Permission" ("id", "key", "description", "createdAt", "updatedAt")
VALUES ('permission-customers-status', 'customers.status', 'Arquivar e restaurar clientes', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET "description" = EXCLUDED."description", "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "RolePermission" ("role", "permissionId", "createdAt")
SELECT 'ADMIN'::"Role", "id", CURRENT_TIMESTAMP FROM "Permission" WHERE "key" = 'customers.status'
ON CONFLICT ("role", "permissionId") DO NOTHING;
