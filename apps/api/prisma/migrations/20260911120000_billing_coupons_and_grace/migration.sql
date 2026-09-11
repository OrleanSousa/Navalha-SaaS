CREATE TYPE "CouponDiscountType" AS ENUM ('PERCENTAGE', 'FIXED');

ALTER TABLE "Subscription" ADD COLUMN "graceEndsAt" TIMESTAMP(3);

CREATE TABLE "BillingCoupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "discountType" "CouponDiscountType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "maxRedemptions" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BillingCoupon_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillingCouponRedemption" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "barbershopId" TEXT NOT NULL,
    "actorId" TEXT,
    "discount" DECIMAL(10,2) NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BillingCouponRedemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingCoupon_code_key" ON "BillingCoupon"("code");
CREATE INDEX "BillingCoupon_active_validFrom_validUntil_idx" ON "BillingCoupon"("active", "validFrom", "validUntil");
CREATE UNIQUE INDEX "BillingCouponRedemption_invoiceId_key" ON "BillingCouponRedemption"("invoiceId");
CREATE UNIQUE INDEX "BillingCouponRedemption_couponId_barbershopId_key" ON "BillingCouponRedemption"("couponId", "barbershopId");
CREATE INDEX "BillingCouponRedemption_barbershopId_redeemedAt_idx" ON "BillingCouponRedemption"("barbershopId", "redeemedAt");

ALTER TABLE "BillingCouponRedemption" ADD CONSTRAINT "BillingCouponRedemption_couponId_fkey"
FOREIGN KEY ("couponId") REFERENCES "BillingCoupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BillingCouponRedemption" ADD CONSTRAINT "BillingCouponRedemption_invoiceId_fkey"
FOREIGN KEY ("invoiceId") REFERENCES "SubscriptionInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BillingCouponRedemption" ADD CONSTRAINT "BillingCouponRedemption_barbershopId_fkey"
FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
