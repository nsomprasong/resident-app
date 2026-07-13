-- AlterEnum
CREATE TYPE "FoodCategory" AS ENUM ('TOM', 'SPICY_STIR', 'YUM', 'ONE_DISH', 'TOUR_GROUP');

-- AlterTable
ALTER TABLE "products" ADD COLUMN "category" "FoodCategory";

-- CreateIndex
CREATE INDEX "products_type_category_is_active_idx" ON "products"("type", "category", "is_active");
