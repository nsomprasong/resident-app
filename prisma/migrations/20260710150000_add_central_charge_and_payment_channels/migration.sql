CREATE TABLE "inspection_catalogs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "type" "InspectionItemType" NOT NULL,
  "unit_price" DECIMAL(10,2) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "inspection_catalogs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "inspection_catalogs_name_key" ON "inspection_catalogs"("name");
CREATE INDEX "inspection_catalogs_type_is_active_idx" ON "inspection_catalogs"("type", "is_active");
ALTER TABLE "inspection_items" ADD COLUMN "catalog_id" UUID;
ALTER TABLE "inspection_items" ADD CONSTRAINT "inspection_items_catalog_id_fkey" FOREIGN KEY ("catalog_id") REFERENCES "inspection_catalogs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "payment_channels" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payment_channels_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "payment_channels_name_key" ON "payment_channels"("name");
CREATE INDEX "payment_channels_is_active_idx" ON "payment_channels"("is_active");
ALTER TABLE "payments" ADD COLUMN "channel_id" UUID;
ALTER TABLE "payments" ADD CONSTRAINT "payments_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "payment_channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
