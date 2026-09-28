ALTER TABLE "Notification" DROP CONSTRAINT "Notification_barbershopId_fkey";
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
