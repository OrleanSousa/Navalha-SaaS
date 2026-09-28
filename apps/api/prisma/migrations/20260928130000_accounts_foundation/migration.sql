ALTER TYPE "FinancialOrigin" ADD VALUE 'ACCOUNT_PAYABLE';
ALTER TYPE "FinancialOrigin" ADD VALUE 'ACCOUNT_RECEIVABLE';

CREATE TYPE "AccountStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');
CREATE TYPE "FinancialCategoryType" AS ENUM ('EXPENSE', 'INCOME');
CREATE TYPE "RecurrenceFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'YEARLY');

CREATE TABLE "Supplier" (
  "id" TEXT NOT NULL,
  "barbershopId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "document" TEXT,
  "contactName" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "notes" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinancialCategory" (
  "id" TEXT NOT NULL,
  "barbershopId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "FinancialCategoryType" NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinancialCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExpenseRecurrence" (
  "id" TEXT NOT NULL,
  "barbershopId" TEXT NOT NULL,
  "supplierId" TEXT,
  "categoryId" TEXT,
  "description" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "frequency" "RecurrenceFrequency" NOT NULL,
  "intervalCount" INTEGER NOT NULL DEFAULT 1,
  "nextDueDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "lastGeneratedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExpenseRecurrence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExpenseRecurrence_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "ExpenseRecurrence_intervalCount_check" CHECK ("intervalCount" > 0),
  CONSTRAINT "ExpenseRecurrence_dates_check" CHECK ("endDate" IS NULL OR "endDate" >= "nextDueDate")
);

CREATE TABLE "AccountPayable" (
  "id" TEXT NOT NULL,
  "barbershopId" TEXT NOT NULL,
  "supplierId" TEXT,
  "categoryId" TEXT,
  "recurrenceId" TEXT,
  "description" TEXT NOT NULL,
  "documentNumber" TEXT,
  "amount" DECIMAL(10,2) NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "status" "AccountStatus" NOT NULL DEFAULT 'PENDING',
  "paidAt" TIMESTAMP(3),
  "paymentMethod" "PaymentMethod",
  "financialTransactionId" TEXT,
  "paidById" TEXT,
  "notes" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "cancellationReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccountPayable_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AccountPayable_amount_check" CHECK ("amount" > 0)
);

CREATE TABLE "AccountReceivable" (
  "id" TEXT NOT NULL,
  "barbershopId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "categoryId" TEXT,
  "description" TEXT NOT NULL,
  "documentNumber" TEXT,
  "amount" DECIMAL(10,2) NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "status" "AccountStatus" NOT NULL DEFAULT 'PENDING',
  "receivedAt" TIMESTAMP(3),
  "paymentMethod" "PaymentMethod",
  "financialTransactionId" TEXT,
  "receivedById" TEXT,
  "notes" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "cancellationReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccountReceivable_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AccountReceivable_amount_check" CHECK ("amount" > 0)
);

CREATE UNIQUE INDEX "Supplier_barbershopId_document_key" ON "Supplier"("barbershopId", "document");
CREATE INDEX "Supplier_barbershopId_name_idx" ON "Supplier"("barbershopId", "name");
CREATE INDEX "Supplier_barbershopId_active_idx" ON "Supplier"("barbershopId", "active");
CREATE UNIQUE INDEX "FinancialCategory_barbershopId_type_name_key" ON "FinancialCategory"("barbershopId", "type", "name");
CREATE INDEX "FinancialCategory_barbershopId_type_active_idx" ON "FinancialCategory"("barbershopId", "type", "active");
CREATE INDEX "ExpenseRecurrence_barbershopId_active_nextDueDate_idx" ON "ExpenseRecurrence"("barbershopId", "active", "nextDueDate");
CREATE INDEX "ExpenseRecurrence_supplierId_idx" ON "ExpenseRecurrence"("supplierId");
CREATE INDEX "ExpenseRecurrence_categoryId_idx" ON "ExpenseRecurrence"("categoryId");
CREATE UNIQUE INDEX "AccountPayable_financialTransactionId_key" ON "AccountPayable"("financialTransactionId");
CREATE INDEX "AccountPayable_barbershopId_status_dueDate_idx" ON "AccountPayable"("barbershopId", "status", "dueDate");
CREATE INDEX "AccountPayable_supplierId_idx" ON "AccountPayable"("supplierId");
CREATE INDEX "AccountPayable_categoryId_idx" ON "AccountPayable"("categoryId");
CREATE INDEX "AccountPayable_recurrenceId_idx" ON "AccountPayable"("recurrenceId");
CREATE UNIQUE INDEX "AccountReceivable_financialTransactionId_key" ON "AccountReceivable"("financialTransactionId");
CREATE INDEX "AccountReceivable_barbershopId_status_dueDate_idx" ON "AccountReceivable"("barbershopId", "status", "dueDate");
CREATE INDEX "AccountReceivable_customerId_idx" ON "AccountReceivable"("customerId");
CREATE INDEX "AccountReceivable_categoryId_idx" ON "AccountReceivable"("categoryId");

ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinancialCategory" ADD CONSTRAINT "FinancialCategory_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExpenseRecurrence" ADD CONSTRAINT "ExpenseRecurrence_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExpenseRecurrence" ADD CONSTRAINT "ExpenseRecurrence_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExpenseRecurrence" ADD CONSTRAINT "ExpenseRecurrence_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinancialCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccountPayable" ADD CONSTRAINT "AccountPayable_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountPayable" ADD CONSTRAINT "AccountPayable_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccountPayable" ADD CONSTRAINT "AccountPayable_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinancialCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccountPayable" ADD CONSTRAINT "AccountPayable_recurrenceId_fkey" FOREIGN KEY ("recurrenceId") REFERENCES "ExpenseRecurrence"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccountPayable" ADD CONSTRAINT "AccountPayable_financialTransactionId_fkey" FOREIGN KEY ("financialTransactionId") REFERENCES "FinancialTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccountPayable" ADD CONSTRAINT "AccountPayable_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccountReceivable" ADD CONSTRAINT "AccountReceivable_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountReceivable" ADD CONSTRAINT "AccountReceivable_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountReceivable" ADD CONSTRAINT "AccountReceivable_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinancialCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccountReceivable" ADD CONSTRAINT "AccountReceivable_financialTransactionId_fkey" FOREIGN KEY ("financialTransactionId") REFERENCES "FinancialTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccountReceivable" ADD CONSTRAINT "AccountReceivable_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
