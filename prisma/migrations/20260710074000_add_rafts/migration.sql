-- CreateEnum
CREATE TYPE "RaftStatus" AS ENUM ('AVAILABLE', 'MAINTENANCE');

-- AlterEnum
ALTER TYPE "ChargeType" ADD VALUE 'RAFT';

-- CreateTable
CREATE TABLE "rafts" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 10,
    "base_price" DECIMAL(10,2) NOT NULL,
    "status" "RaftStatus" NOT NULL DEFAULT 'AVAILABLE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_rafts" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "raft_id" UUID NOT NULL,
    "rate" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "booking_rafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rafts_number_key" ON "rafts"("number");

-- CreateIndex
CREATE INDEX "rafts_status_idx" ON "rafts"("status");

-- CreateIndex
CREATE INDEX "booking_rafts_raft_id_idx" ON "booking_rafts"("raft_id");

-- CreateIndex
CREATE UNIQUE INDEX "booking_rafts_booking_id_raft_id_key" ON "booking_rafts"("booking_id", "raft_id");

-- AddForeignKey
ALTER TABLE "booking_rafts" ADD CONSTRAINT "booking_rafts_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_rafts" ADD CONSTRAINT "booking_rafts_raft_id_fkey" FOREIGN KEY ("raft_id") REFERENCES "rafts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
