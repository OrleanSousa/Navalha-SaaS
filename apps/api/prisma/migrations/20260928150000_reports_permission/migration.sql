INSERT INTO "Permission" ("id", "key", "description", "createdAt", "updatedAt") VALUES
  (gen_random_uuid(), 'reports.read', 'Visualizar e exportar relatórios', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET "description" = EXCLUDED."description", "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "RolePermission" ("role", "permissionId", "createdAt")
SELECT 'ADMIN'::"Role", permission."id", CURRENT_TIMESTAMP
FROM "Permission" permission
WHERE permission."key" = 'reports.read'
ON CONFLICT ("role", "permissionId") DO NOTHING;
