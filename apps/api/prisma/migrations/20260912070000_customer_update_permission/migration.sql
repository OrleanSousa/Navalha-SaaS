INSERT INTO "Permission" ("id", "key", "description", "createdAt", "updatedAt")
VALUES ('permission-customers-update', 'customers.update', 'Editar clientes', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET "description" = EXCLUDED."description", "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "RolePermission" ("role", "permissionId", "createdAt")
SELECT 'ADMIN'::"Role", "id", CURRENT_TIMESTAMP FROM "Permission" WHERE "key" = 'customers.update'
ON CONFLICT ("role", "permissionId") DO NOTHING;
