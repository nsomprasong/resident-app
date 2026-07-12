-- CreateEnum
CREATE TYPE "InspectionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "InspectionItemType" AS ENUM ('MINIBAR', 'DAMAGE', 'STAIN', 'MISSING', 'OTHER');

-- CreateTable
CREATE TABLE "room_inspections" (
    "id" UUID NOT NULL,
    "booking_room_id" UUID NOT NULL,
    "status" "InspectionStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_items" (
    "id" UUID NOT NULL,
    "inspection_id" UUID NOT NULL,
    "type" "InspectionItemType" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspection_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "room_inspections_booking_room_id_key" ON "room_inspections"("booking_room_id");

-- CreateIndex
CREATE INDEX "room_inspections_status_idx" ON "room_inspections"("status");

-- AddForeignKey
ALTER TABLE "room_inspections" ADD CONSTRAINT "room_inspections_booking_room_id_fkey" FOREIGN KEY ("booking_room_id") REFERENCES "booking_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_items" ADD CONSTRAINT "inspection_items_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "room_inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
