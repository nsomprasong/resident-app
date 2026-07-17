# Current Task

## Task

Number inputs: allow clearing default digits while typing

## Status

COMPLETED

## Evidence

- Added `components/ui/NumberInput.tsx` (empty while editing, clamp on blur)
- Wired into group booking (guest/price), food qty picker, PayButton, PromptPay amount
- Avoids sticky `0` → `010` when retyping

## Next Action

—
