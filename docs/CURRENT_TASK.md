# Current Task

## Task

Fix production APP_ERROR after login (beebee)

## Status

IN_PROGRESS

## Evidence

- User confirms `APP_ERROR` / โหลดหน้าไม่สำเร็จ (error.tsx catching)
- test vs beebee auth gates identical; crash is post-login render
- Suspected: Server Component home + next/image on huge logo.png

## Fix (this round)

- Home → client `HomeBoard` using `/api/auth/me` permissions (same as Sidebar)
- Show error.message on APP_ERROR page + beacon to client-error
- Avoid next/image optimizer on critical logos (`img` / `unoptimized`)

## Next Action

Deploy แล้วลอง `beebee` อีกครั้ง — ถ้ายัง APP_ERROR ให้แคปข้อความรายละเอียดใต้หัวข้อ (กล่องสีเทา)
