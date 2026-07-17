# Current Task

## Task

Fix booking charge template edit (Prisma client stale)

## Status

COMPLETED

## Evidence

- Root cause: `prisma.bookingChargeTemplate` undefined → API 500; UI fell back to local presets that could not be edited
- Ran `prisma generate`; panel now shows load error + retry instead of fake local rows
- Inline edit row + sync selected booking lines after catalog save

## Next Action

Restart Next.js dev server so the new Prisma client is loaded
