CREATE TABLE "UserPermission" (
  "userId" TEXT NOT NULL,
  "permissionId" TEXT NOT NULL,
  "granted" BOOLEAN NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserPermission_pkey" PRIMARY KEY ("userId", "permissionId")
);

CREATE INDEX "UserPermission_permissionId_idx" ON "UserPermission"("permissionId");
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "Permission" ("id", "key", "description", "createdAt", "updatedAt")
VALUES ('permission-employees-permissions', 'employees.permissions', 'Editar perfil e permissões', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE SET "description" = EXCLUDED."description", "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "RolePermission" ("role", "permissionId", "createdAt")
SELECT 'ADMIN'::"Role", "id", CURRENT_TIMESTAMP FROM "Permission" WHERE "key" = 'employees.permissions'
ON CONFLICT ("role", "permissionId") DO NOTHING;
