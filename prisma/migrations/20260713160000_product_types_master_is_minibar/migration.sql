-- Create product_types master
CREATE TABLE "product_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "requires_food_category" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_types_name_key" ON "product_types"("name");
CREATE INDEX "product_types_is_active_name_idx" ON "product_types"("is_active", "name");

INSERT INTO "product_types" ("name", "requires_food_category") VALUES
  ('อาหาร', true),
  ('เครื่องดื่ม', false),
  ('เสื้อผ้า', false),
  ('ของใช้', false)
ON CONFLICT ("name") DO NOTHING;

-- Add new product columns
ALTER TABLE "products" ADD COLUMN "type_id" UUID;
ALTER TABLE "products" ADD COLUMN "is_minibar" BOOLEAN NOT NULL DEFAULT false;

UPDATE "products" AS p
SET
  "type_id" = pt."id",
  "is_minibar" = CASE WHEN p."type"::text = 'MINIBAR' THEN true ELSE false END
FROM "product_types" AS pt
WHERE pt."name" = CASE p."type"::text
  WHEN 'FOOD' THEN 'อาหาร'
  WHEN 'MINIBAR' THEN 'เครื่องดื่ม'
  WHEN 'OTHER' THEN 'ของใช้'
  ELSE 'ของใช้'
END;

-- Fallback any unmapped rows to ของใช้
UPDATE "products" AS p
SET "type_id" = pt."id"
FROM "product_types" AS pt
WHERE p."type_id" IS NULL AND pt."name" = 'ของใช้';

ALTER TABLE "products" ALTER COLUMN "type_id" SET NOT NULL;

ALTER TABLE "products"
  ADD CONSTRAINT "products_type_id_fkey"
  FOREIGN KEY ("type_id") REFERENCES "product_types"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX IF EXISTS "products_type_is_active_idx";
DROP INDEX IF EXISTS "products_type_category_id_is_active_idx";

ALTER TABLE "products" DROP COLUMN "type";
DROP TYPE IF EXISTS "ProductType";

CREATE INDEX "products_type_id_is_active_idx" ON "products"("type_id", "is_active");
CREATE INDEX "products_is_minibar_is_active_idx" ON "products"("is_minibar", "is_active");
CREATE INDEX "products_type_id_category_id_is_active_idx"
  ON "products"("type_id", "category_id", "is_active");
