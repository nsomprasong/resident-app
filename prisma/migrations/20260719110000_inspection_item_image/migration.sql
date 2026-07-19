-- Optional photo evidence per housekeeping inspection line item

ALTER TABLE "inspection_items"
  ADD COLUMN IF NOT EXISTS "image_url" TEXT;
