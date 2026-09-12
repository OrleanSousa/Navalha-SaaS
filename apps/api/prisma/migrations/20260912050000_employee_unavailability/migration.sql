CREATE TYPE "EmployeeUnavailabilityType" AS ENUM ('DAY_OFF', 'VACATION', 'LEAVE', 'BLOCK');

CREATE TABLE "EmployeeUnavailability" (
    "id" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "EmployeeUnavailabilityType" NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeUnavailability_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmployeeUnavailability_barbershopId_startAt_endAt_idx"
ON "EmployeeUnavailability"("barbershopId", "startAt", "endAt");

CREATE INDEX "EmployeeUnavailability_employeeId_startAt_endAt_idx"
ON "EmployeeUnavailability"("employeeId", "startAt", "endAt");

ALTER TABLE "EmployeeUnavailability"
ADD CONSTRAINT "EmployeeUnavailability_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmployeeUnavailability"
ADD CONSTRAINT "EmployeeUnavailability_barbershopId_fkey"
FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
