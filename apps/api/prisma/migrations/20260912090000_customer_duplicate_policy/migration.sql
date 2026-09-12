ALTER TABLE "Setting"
ADD COLUMN "allowDuplicateCustomerPhone" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "allowDuplicateCustomerCpf" BOOLEAN NOT NULL DEFAULT false;
