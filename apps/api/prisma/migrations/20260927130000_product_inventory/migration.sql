CREATE TABLE "ProductCategory" (
  "id" TEXT NOT NULL,
  "barbershopId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductCategory_barbershopId_name_key" ON "ProductCategory"("barbershopId", "name");
CREATE INDEX "ProductCategory_barbershopId_active_idx" ON "ProductCategory"("barbershopId", "active");

ALTER TABLE "Product" ADD COLUMN "categoryId" TEXT;
INSERT INTO "ProductCategory" ("id", "barbershopId", "name")
SELECT md5("barbershopId" || ':' || lower(trim("category"))), "barbershopId", min(trim("category"))
FROM "Product"
WHERE "category" IS NOT NULL AND trim("category") <> ''
GROUP BY "barbershopId", lower(trim("category"));
UPDATE "Product" AS product SET "categoryId" = category."id"
FROM "ProductCategory" AS category
WHERE category."barbershopId" = product."barbershopId"
  AND lower(category."name") = lower(trim(product."category"));
ALTER TABLE "Product" DROP COLUMN "category";

ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_barbershopId_fkey" FOREIGN KEY ("barbershopId") REFERENCES "Barbershop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");
CREATE UNIQUE INDEX "Product_barbershopId_barcode_key" ON "Product"("barbershopId", "barcode");

ALTER TABLE "Product" ADD CONSTRAINT "Product_cost_price_nonnegative" CHECK ("costPrice" >= 0);
ALTER TABLE "Product" ADD CONSTRAINT "Product_sale_price_positive" CHECK ("salePrice" > 0);
ALTER TABLE "Product" ADD CONSTRAINT "Product_minimum_stock_nonnegative" CHECK ("minimumStock" >= 0);
ALTER TABLE "Product" ADD CONSTRAINT "Product_commission_percent_range" CHECK ("commissionPercent" IS NULL OR ("commissionPercent" >= 0 AND "commissionPercent" <= 100));
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_quantity_nonzero" CHECK ("quantity" <> 0);

INSERT INTO "Permission" ("id", "key", "description", "createdAt", "updatedAt") VALUES
  ('permission-products-update', 'products.update', 'Editar produtos', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('permission-products-status', 'products.status', 'Ativar e inativar produtos', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('permission-products-categories', 'products.categories', 'Gerenciar categorias de produtos', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('permission-products-stock', 'products.stock', 'Registrar movimentações de estoque', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('permission-products-settings', 'products.settings', 'Configurar regras de estoque', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
INSERT INTO "RolePermission" ("role", "permissionId", "createdAt")
SELECT 'ADMIN'::"Role", "id", CURRENT_TIMESTAMP FROM "Permission"
WHERE "key" IN ('products.update', 'products.status', 'products.categories', 'products.stock', 'products.settings')
ON CONFLICT ("role", "permissionId") DO NOTHING;
