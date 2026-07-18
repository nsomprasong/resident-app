# Current Task

## Task

Fix group booking room picker locked red after check-in

## Status

COMPLETED

## Evidence

- Root cause: Add Group/Solo dialog always opened on **today**, while booking list date could be another night (e.g. 22) — tonight had many CHECKED_IN rooms so picker looked “all red”
- Dialogs now take `initialCheckIn` from booking page work date
- ZoneRoomSelect: lock only on API `booked === true`; default “แสดงเฉพาะห้องว่าง”; show free count
- AddBookingResourcesDialog passes `excludeBookingId`

## Next Action

—
