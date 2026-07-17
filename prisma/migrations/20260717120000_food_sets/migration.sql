-- Food set masters + per-tour-group customization (copy-on-write)

CREATE TABLE "food_sets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "food_sets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "food_sets_name_key" ON "food_sets"("name");
CREATE INDEX "food_sets_is_active_name_idx" ON "food_sets"("is_active", "name");

CREATE TABLE "food_set_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "food_set_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "food_set_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "food_set_items_food_set_id_product_id_key" ON "food_set_items"("food_set_id", "product_id");
CREATE INDEX "food_set_items_product_id_idx" ON "food_set_items"("product_id");

CREATE TABLE "tour_group_food_sets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tour_group_id" UUID NOT NULL,
    "source_food_set_id" UUID,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tour_group_food_sets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tour_group_food_sets_tour_group_id_key" ON "tour_group_food_sets"("tour_group_id");
CREATE INDEX "tour_group_food_sets_source_food_set_id_idx" ON "tour_group_food_sets"("source_food_set_id");

CREATE TABLE "tour_group_food_set_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tour_group_food_set_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "is_extra" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tour_group_food_set_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tour_group_food_set_items_tour_group_food_set_id_product_id_key"
  ON "tour_group_food_set_items"("tour_group_food_set_id", "product_id");
CREATE INDEX "tour_group_food_set_items_product_id_idx" ON "tour_group_food_set_items"("product_id");

ALTER TABLE "food_set_items"
  ADD CONSTRAINT "food_set_items_food_set_id_fkey"
  FOREIGN KEY ("food_set_id") REFERENCES "food_sets"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "food_set_items"
  ADD CONSTRAINT "food_set_items_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tour_group_food_sets"
  ADD CONSTRAINT "tour_group_food_sets_tour_group_id_fkey"
  FOREIGN KEY ("tour_group_id") REFERENCES "tour_groups"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tour_group_food_sets"
  ADD CONSTRAINT "tour_group_food_sets_source_food_set_id_fkey"
  FOREIGN KEY ("source_food_set_id") REFERENCES "food_sets"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tour_group_food_set_items"
  ADD CONSTRAINT "tour_group_food_set_items_tour_group_food_set_id_fkey"
  FOREIGN KEY ("tour_group_food_set_id") REFERENCES "tour_group_food_sets"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tour_group_food_set_items"
  ADD CONSTRAINT "tour_group_food_set_items_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
