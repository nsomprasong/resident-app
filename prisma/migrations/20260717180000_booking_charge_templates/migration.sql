-- Booking charge templates: reusable extra fees with saved default prices

CREATE TABLE "booking_charge_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "type" "ChargeType" NOT NULL DEFAULT 'OTHER',
    "default_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_charge_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "booking_charge_templates_name_key" ON "booking_charge_templates"("name");
CREATE INDEX "booking_charge_templates_is_active_sort_order_name_idx" ON "booking_charge_templates"("is_active", "sort_order", "name");

INSERT INTO "booking_charge_templates" ("id", "name", "type", "default_amount", "is_active", "sort_order", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'ค่าทำความสะอาด', 'CLEANING', 0, true, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'ค่าแก๊ส', 'OTHER', 0, true, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'ค่าน้ำแข็ง', 'OTHER', 0, true, 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'ค่าถ่าน', 'OTHER', 0, true, 40, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
