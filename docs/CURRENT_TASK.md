# Current Task

## Task

Fix production APP_ERROR after login (beebee)

## Status

IN_PROGRESS

## Evidence

- User: `APP_ERROR` detail = **An unexpected response was received from the server**
- Classic Next.js failure when Server Action / soft navigation gets middleware redirect/JSON
  while Set-Cookie + `sessionEpoch` are still settling (beebee epoch higher → more races)

## Fix

- LoginForm: `window.location.assign(nextPath)` instead of `router.replace` + `router.refresh`
- Middleware: do not JSON/redirect **Server Action** POSTs; allow `/login` during mustResetPassword

## Next Action

Deploy แล้วลอง login `beebee` อีกครั้ง (แนะนำเคลียร์ cookie ของไซต์ก่อนลอง)
