CREATE TYPE "BillingGatewayProvider" AS ENUM ('MANUAL', 'CUSTOM');
CREATE TYPE "BillingGatewayEnvironment" AS ENUM ('SANDBOX', 'PRODUCTION');

CREATE TABLE "BillingGatewayConfiguration" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "provider" "BillingGatewayProvider" NOT NULL DEFAULT 'MANUAL',
    "environment" "BillingGatewayEnvironment" NOT NULL DEFAULT 'SANDBOX',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "apiBaseUrl" TEXT,
    "webhookUrl" TEXT,
    "publicKey" TEXT,
    "secretEnvVar" TEXT NOT NULL DEFAULT 'BILLING_GATEWAY_API_KEY',
    "webhookSecretEnvVar" TEXT NOT NULL DEFAULT 'BILLING_GATEWAY_WEBHOOK_SECRET',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BillingGatewayConfiguration_pkey" PRIMARY KEY ("id")
);

INSERT INTO "BillingGatewayConfiguration" ("id", "createdAt", "updatedAt")
VALUES ('default', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
