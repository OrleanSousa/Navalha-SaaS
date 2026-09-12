UPDATE "Customer"
SET
  "phone" = regexp_replace("phone", '\D', '', 'g'),
  "whatsapp" = CASE
    WHEN "whatsapp" IS NULL THEN NULL
    ELSE regexp_replace("whatsapp", '\D', '', 'g')
  END,
  "cpf" = CASE
    WHEN "cpf" IS NULL THEN NULL
    ELSE regexp_replace("cpf", '\D', '', 'g')
  END;
