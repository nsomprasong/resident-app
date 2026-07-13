-- CreateTable
CREATE TABLE "food_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "food_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "food_categories_name_key" ON "food_categories"("name");
CREATE INDEX "food_categories_is_active_name_idx" ON "food_categories"("is_active", "name");

-- Seed default categories (and any already used enum values)
INSERT INTO "food_categories" ("name") VALUES
  ('ต้ม'),
  ('ผัดเผ็ด'),
  ('ยำ'),
  ('อาหารจานเดียว'),
  ('อาหารสำหรับกรุ๊ปทัวร์')
ON CONFLICT ("name") DO NOTHING;

-- Add FK column
ALTER TABLE "products" ADD COLUMN "category_id" UUID;

UPDATE "products" AS p
SET "category_id" = fc."id"
FROM "food_categories" AS fc
WHERE p."category" IS NOT NULL
  AND fc."name" = CASE p."category"::text
    WHEN 'TOM' THEN 'ต้ม'
    WHEN 'SPICY_STIR' THEN 'ผัดเผ็ด'
    WHEN 'YUM' THEN 'ยำ'
    WHEN 'ONE_DISH' THEN 'อาหารจานเดียว'
    WHEN 'TOUR_GROUP' THEN 'อาหารสำหรับกรุ๊ปทัวร์'
    ELSE NULL
  END;

ALTER TABLE "products"
  ADD CONSTRAINT "products_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "food_categories"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX IF EXISTS "products_type_category_is_active_idx";
ALTER TABLE "products" DROP COLUMN "category";
DROP TYPE "FoodCategory";

CREATE INDEX "products_type_category_id_is_active_idx"
  ON "products"("type", "category_id", "is_active");
