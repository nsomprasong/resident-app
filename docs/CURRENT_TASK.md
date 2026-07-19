# Current Task

## Task

Fix attendance clock display timezone (Bangkok)

## Status

COMPLETED

## Evidence

- Clock-in/out display uses `formatAttendanceClockTime` (Asia/Bangkok)
- Schedule times still use wall-clock UTC via `formatShiftWallClockTime`
- Unit: `tests/unit/date-format.test.ts` covers 04:05Z → 11:05

## Next Action

—

