-- AlterTable
ALTER TABLE "booking_rafts" ADD COLUMN     "is_extra" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "booking_rooms" ADD COLUMN     "is_extra" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "guest_count" INTEGER,
ADD COLUMN     "price_per_person" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "is_extra" BOOLEAN NOT NULL DEFAULT true;
