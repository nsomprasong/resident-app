# Current Task

## Task

Tour-group-only custom food dishes with price

## Status

COMPLETED

## Evidence

- Schema: `TourGroupFoodSetItem` / `OrderItem` support nullable `productId` + `customName` (+ `customUnitPrice` on group set)
- Migration `20260719090000_custom_group_food_items` applied
- UI: BookingFoodSelect “เมนูพิเศษ” (group-scoped) — name + price, not saved to product master
- APIs: booking create, orders, tour-group food-set accept custom lines
- Tests: `food-sets` unit (custom dish parse) pass; `tsc --noEmit` pass

## Next Action

—
