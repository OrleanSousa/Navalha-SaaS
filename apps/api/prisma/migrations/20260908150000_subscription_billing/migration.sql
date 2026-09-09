CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED');
CREATE TYPE "BillingPaymentStatus" AS ENUM ('CONFIRMED', 'REFUNDED');
CREATE TYPE "BillingPaymentMethod" AS ENUM ('PIX', 'BOLETO', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'OTHER');

CREATE TABLE "SubscriptionInvoice" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SubscriptionInvoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubscriptionPayment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "actorId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "BillingPaymentMethod" NOT NULL,
    "status" "BillingPaymentStatus" NOT NULL DEFAULT 'CONFIRMED',
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "externalReference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubscriptionInvoice_number_key" ON "SubscriptionInvoice"("number");
CREATE INDEX "SubscriptionInvoice_barbershopId_dueDate_idx" ON "SubscriptionInvoice"("barbershopId", "dueDate");
CREATE INDEX "SubscriptionInvoice_status_dueDate_idx" ON "SubscriptionInvoice"("status", "dueDate");
CREATE INDEX "SubscriptionInvoice_subscriptionId_idx" ON "SubscriptionInvoice"("subscriptionId");
CREATE INDEX "SubscriptionPayment_invoiceId_paidAt_idx" ON "SubscriptionPayment"("invoiceId", "paidAt");
CREATE INDEX "SubscriptionPayment_externalReference_idx" ON "SubscriptionPayment"("externalReference");

ALTER TABLE "SubscriptionInvoice" ADD CONSTRAINT "SubscriptionInvoice_subscriptionId_fkey"
FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SubscriptionInvoice" ADD CONSTRAINT "SubscriptionInvoice_barbershopId_fkey"
FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_invoiceId_fkey"
FOREIGN KEY ("invoiceId") REFERENCES "SubscriptionInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
