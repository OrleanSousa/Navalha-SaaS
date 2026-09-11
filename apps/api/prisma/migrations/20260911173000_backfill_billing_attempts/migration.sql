INSERT INTO "SubscriptionBillingAttempt" (
    "id",
    "invoiceId",
    "sequence",
    "scheduledAt",
    "status",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    invoice."id",
    schedule."sequence",
    invoice."dueDate" + schedule."offset",
    'SCHEDULED'::"BillingAttemptStatus",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "SubscriptionInvoice" AS invoice
CROSS JOIN (
    VALUES
        (1, INTERVAL '-3 days'),
        (2, INTERVAL '0 days'),
        (3, INTERVAL '3 days'),
        (4, INTERVAL '7 days')
) AS schedule("sequence", "offset")
WHERE invoice."status" IN ('PENDING', 'OVERDUE')
  AND NOT EXISTS (
      SELECT 1
      FROM "SubscriptionBillingAttempt" AS attempt
      WHERE attempt."invoiceId" = invoice."id"
  );
