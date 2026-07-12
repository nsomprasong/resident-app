ALTER TABLE "charges" ADD COLUMN "inspection_id" UUID;

CREATE UNIQUE INDEX "charges_inspection_id_key" ON "charges"("inspection_id");

ALTER TABLE "charges"
ADD CONSTRAINT "charges_inspection_id_fkey"
FOREIGN KEY ("inspection_id") REFERENCES "room_inspections"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
