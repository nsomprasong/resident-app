-- Tour-group-only custom dishes (not stored in products master)

ALTER TABLE "tour_group_food_set_items"
  ALTER COLUMN "product_id" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "custom_name" TEXT,
  ADD COLUMN IF NOT EXISTS "custom_unit_price" DECIMAL(10, 2);

ALTER TABLE "tour_group_food_set_items"
  DROP CONSTRAINT IF EXISTS "tour_group_food_set_items_tour_group_food_set_id_product_id_key";

CREATE INDEX IF NOT EXISTS "tour_group_food_set_items_tour_group_food_set_id_idx"
  ON "tour_group_food_set_items"("tour_group_food_set_id");

ALTER TABLE "tour_group_food_set_items"
  DROP CONSTRAINT IF EXISTS "tour_group_food_set_items_source_chk";

ALTER TABLE "tour_group_food_set_items"
  ADD CONSTRAINT "tour_group_food_set_items_source_chk" CHECK (
    (
      "product_id" IS NOT NULL
      AND "custom_name" IS NULL
      AND "custom_unit_price" IS NULL
    )
    OR (
      "product_id" IS NULL
      AND "custom_name" IS NOT NULL
      AND "custom_unit_price" IS NOT NULL
    )
  );

ALTER TABLE "order_items"
  ALTER COLUMN "product_id" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "custom_name" TEXT;

CREATE INDEX IF NOT EXISTS "order_items_order_id_idx" ON "order_items"("order_id");
CREATE INDEX IF NOT EXISTS "order_items_product_id_idx" ON "order_items"("product_id");

ALTER TABLE "order_items"
  DROP CONSTRAINT IF EXISTS "order_items_source_chk";

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_source_chk" CHECK (
    (
      "product_id" IS NOT NULL
      AND "custom_name" IS NULL
    )
    OR (
      "product_id" IS NULL
      AND "custom_name" IS NOT NULL
    )
  );
