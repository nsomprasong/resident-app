-- Product option groups/options + food set item sort/require flags

CREATE TABLE "product_option_groups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_option_groups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_option_groups_product_id_name_key"
  ON "product_option_groups"("product_id", "name");
CREATE INDEX "product_option_groups_product_id_sort_order_idx"
  ON "product_option_groups"("product_id", "sort_order");

CREATE TABLE "product_options" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "group_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_options_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_options_group_id_label_key"
  ON "product_options"("group_id", "label");
CREATE INDEX "product_options_group_id_sort_order_idx"
  ON "product_options"("group_id", "sort_order");

ALTER TABLE "product_option_groups"
  ADD CONSTRAINT "product_option_groups_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_options"
  ADD CONSTRAINT "product_options_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "product_option_groups"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "food_set_items"
  ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "require_options" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "food_set_items_food_set_id_sort_order_idx"
  ON "food_set_items"("food_set_id", "sort_order");

ALTER TABLE "tour_group_food_set_items"
  ADD COLUMN "option_note" TEXT;
