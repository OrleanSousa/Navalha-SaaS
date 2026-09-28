CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Appointment" ADD COLUMN "cancellationReason" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "cancelledAt" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_positive_interval" CHECK ("endAt" > "startAt");
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_price_nonnegative" CHECK ("price" >= 0);
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_active_time_exclusion"
  EXCLUDE USING gist (
    "employeeId" WITH =,
    tsrange("startAt", "endAt", '[)') WITH &&
  ) WHERE ("status" IN ('SCHEDULED', 'CONFIRMED', 'IN_SERVICE'));

INSERT INTO "Permission" ("id", "key", "description", "createdAt", "updatedAt") VALUES
  ('permission-appointments-update', 'appointments.update', 'Editar e reagendar compromissos', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('permission-appointments-status', 'appointments.status', 'Alterar status de agendamentos', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("role", "permissionId", "createdAt")
SELECT role, permission."id", CURRENT_TIMESTAMP
FROM (VALUES ('ADMIN'::"Role"), ('RECEPTIONIST'::"Role")) AS roles(role)
CROSS JOIN "Permission" AS permission
WHERE permission."key" IN ('appointments.update', 'appointments.status')
ON CONFLICT ("role", "permissionId") DO NOTHING;
