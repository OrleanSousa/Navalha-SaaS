CREATE TYPE "SubscriptionStatus" AS ENUM (
  'TRIAL',
  'ACTIVE',
  'PAST_DUE',
  'SUSPENDED',
  'CANCELLED',
  'EXPIRED'
);

ALTER TABLE "Subscription"
  ALTER COLUMN "status" TYPE "SubscriptionStatus"
  USING ("status"::"SubscriptionStatus"),
  ALTER COLUMN "status" SET DEFAULT 'TRIAL';

CREATE TABLE "SubscriptionHistory" (
  "id" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "barbershopId" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "fromPlanId" TEXT,
  "toPlanId" TEXT,
  "fromStatus" "SubscriptionStatus",
  "toStatus" "SubscriptionStatus",
  "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubscriptionHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SubscriptionHistory_barbershopId_createdAt_idx"
  ON "SubscriptionHistory"("barbershopId", "createdAt");

CREATE INDEX "SubscriptionHistory_subscriptionId_createdAt_idx"
  ON "SubscriptionHistory"("subscriptionId", "createdAt");

ALTER TABLE "SubscriptionHistory"
  ADD CONSTRAINT "SubscriptionHistory_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
