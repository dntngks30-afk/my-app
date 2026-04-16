# PR1-B Implementation Memo — Timing Law Lock

## Scope
- Selection layer only (claimed public result ranking).
- Keeps PR1-A stage/currentness-window ownership unchanged.

## Locked timing meaning
1. `claimedAt` (`claimed_at`) = when a result entered authenticated execution path.
2. `createdAt` (`created_at`) = when the analysis artifact was generated.
3. They are not interchangeable.

## Deterministic tie-break order (code-level)
After PR1-A resolves stage/currentness bucket:
1. compare `claimed_at` (desc)
2. if tie, compare `created_at` (desc)
3. if tie, compare `id` (desc stable key)

## Why this stays inside PR1-B
- No execution suitability expansion.
- No generator/session quality logic change.
- No fallback redesign.
- No UI/auth/readiness/payment changes.
