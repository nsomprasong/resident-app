# Current Task

## Task

Align self-register / employee create with Settings auth principle

## Status

COMPLETED

## Evidence

- Shared `provisionUsernamePhoneAuth` used by Settings, HR create, and `/api/auth/register`
- Self-register: temp Auth password + `mustResetPassword` (no password on form); contact email is contact-only
- Activating in Settings forces set-password + ensures username Auth mailbox

## Next Action

—
