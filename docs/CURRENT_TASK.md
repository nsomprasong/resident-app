# Current Task

## Task

Fix beebee-only login APP_ERROR (unexpected server response)

## Status

IN_PROGRESS — Auth repaired; deploy code still required

## Evidence

- beebee Auth login succeeded server-side (`lastSignInAt`, `sessionEpoch`→10) but client got unexpected response
- Diff vs working `test`: beebee had **email+phone** Auth identities; test is **email-only**
- `updateUserById({ phone: "" })` does not remove phone identity

## Fix

- Recreated beebee Auth as email-only (`providers: [email]`, phone empty)
- `mustResetPassword=true` — login with username only to set password
- Login: clear Auth phone before sign-in; no `signOut(others)`; single refresh
- Stop attaching phone on new username Auth creates

## Next Action

1. Deploy code
2. บนมือถือ: เคลียร์ cookie ไซต์ → login `beebee` **ไม่ใส่รหัสผ่าน** → ตั้งรหัสใหม่ → เข้าใช้งาน
