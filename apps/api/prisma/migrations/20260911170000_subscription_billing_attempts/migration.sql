CREATE TYPE "BillingAttemptStatus" AS ENUM ('SCHEDULED', 'SUCCEEDED', 'FAILED', 'CANCELLED');

CREATE TABLE "SubscriptionBillingAttempt" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "actorId" TEXT,
    "sequence" INTEGER NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "attemptedAt" TIMESTAMP(3),
    "status" "BillingAttemptStatus" NOT NULL DEFAULT 'SCHEDULED',
    "method" "BillingPaymentMethod",
    "externalReference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SubscriptionBillingAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubscriptionBillingAttempt_invoiceId_sequence_key"
ON "SubscriptionBillingAttempt"("invoiceId", "sequence");
CREATE INDEX "SubscriptionBillingAttempt_status_scheduledAt_idx"
ON "SubscriptionBillingAttempt"("status", "scheduledAt");
CREATE INDEX "SubscriptionBillingAttempt_invoiceId_scheduledAt_idx"
ON "SubscriptionBillingAttempt"("invoiceId", "scheduledAt");

ALTER TABLE "SubscriptionBillingAttempt" ADD CONSTRAINT "SubscriptionBillingAttempt_invoiceId_fkey"
FOREIGN KEY ("invoiceId") REFERENCES "SubscriptionInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
