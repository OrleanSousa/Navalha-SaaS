ALTER TABLE "Plan"
ADD COLUMN "delinquencyGraceDays" INTEGER NOT NULL DEFAULT 7;

ALTER TABLE "Subscription"
ADD COLUMN "delinquencyStartedAt" TIMESTAMP(3),
ADD COLUMN "delinquencySuspendedAt" TIMESTAMP(3);
