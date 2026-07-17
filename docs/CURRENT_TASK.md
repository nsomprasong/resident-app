# Current Task

## Task

Fix production Application error after login (beebee)

## Status

IN_PROGRESS

## Evidence

- `test` vs `beebee`: role/permissions/auth gates identical (OWNER, 53 perms, canLoginGate true)
- Diff: beebee has Auth phone identity; `sessionEpoch` 4 vs 2; Thai display name
- User sees Next.js default "Application error: a client-side exception…" (not Thai boundary)
- Production serves `/images/person.svg` ~900KB via `next/image` on Header/UserNav after login
- Middleware employee-lookup failure returned plain-text 503 → App Router client can fatal

## Fix

- Replace `person.svg` with Lucide avatar in Header/UserNav
- Add `app/error.tsx` + `app/global-error.tsx`
- Wrap public routes in ClientErrorBoundary
- Middleware: redirect to `/access-denied` instead of plain-text 503
- ListMenu: skip invalid icon components

## Verify

- `npx tsc --noEmit` pass
- eslint on changed files pass

## Next Action

Deploy แล้วลอง login `beebee` บนมือถือ — ถ้ายังพัง ส่งข้อความจาก browser console หรือรหัส APP_ERROR / CLIENT_RENDER_ERROR / GLOBAL_ERROR
