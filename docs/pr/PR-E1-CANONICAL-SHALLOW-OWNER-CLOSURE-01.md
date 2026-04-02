# PR-E1-CANONICAL-SHALLOW-OWNER-CLOSURE-01

Date: 2026-04-02  
Base: `main`

## Root cause

`applyCanonicalShallowClosureFromContract()` is the single writer for
`official_shallow_cycle` success. When canonical shallow contract becomes
satisfied it writes the following owner-truth fields correctly:

```
completionPassReason  = 'official_shallow_cycle'
completionSatisfied   = true
completionBlockedReason = null
cycleComplete         = true
successPhaseAtOpen    = 'standing_recovered'
```

But it did **not** write:

```
currentSquatPhase     = 'standing_recovered'   ← missing
completionMachinePhase = 'completed'           ← missing
```

`computeSquatCompletionOwnerTruth()` checks four gates in sequence:

1. `completionBlockedReason == null`             ← passes (closer writes null)
2. `completionSatisfied === true`                ← passes (closer writes true)
3. **`currentSquatPhase === 'standing_recovered'`** ← **FAILED** — closer did not write it
4. `completionPassReason` not null/not_confirmed ← would pass

Gate 3 failure means owner truth always returned
`completionOwnerBlockedReason = 'not_standing_recovered'` even when the
canonical contract was fully satisfied and the closer had applied.

### Why `currentSquatPhase` was stale

`currentSquatPhase` is set inside `evaluateSquatCompletionCore`:

```typescript
if (ascendForProgression && standingRecoveryFinalize.finalizeSatisfied) {
    currentSquatPhase = 'standing_recovered';
}
```

The canonical closer activates specifically in the gap where the standard rule
path left `completionBlockedReason != null` (e.g. the normalizer converted
`no_reversal` → `not_standing_recovered` because `shallowClosureProofBundleFromStream`
was true but `reversalConfirmedAfterDescend` was false). In that gap
`ascendForProgression` may be false (no explicit reversal → no progression
reversal frame) or the standing finalize happened via canonical-only evidence
not visible to the phase updater. `currentSquatPhase` therefore remains at
`ascending` or `committed_bottom_or_downward_commitment`.

## Fix

In `applyCanonicalShallowClosureFromContract()` (single closer writer), add
the two missing fields to the authoritative success snapshot:

```typescript
currentSquatPhase: 'standing_recovered',
completionMachinePhase: 'completed',
```

This is safe because:
- The closer is guarded behind `canonicalShallowContractSatisfied === true` AND
  `completionPassReason === 'not_confirmed'` AND depth zone AND admission flags.
- `'standing_recovered'` is the correct phase for a finalized squat cycle.
- `'completed'` is what `deriveSquatCompletionMachinePhase` returns whenever
  `completionSatisfied = true`, making the field consistent.

## Files changed

| File | Change |
|------|--------|
| `src/lib/camera/squat-completion-state.ts` | Add `currentSquatPhase: 'standing_recovered'` and `completionMachinePhase: 'completed'` to `applyCanonicalShallowClosureFromContract` return object |
| `scripts/camera-e1-canonical-shallow-owner-closure-smoke.mjs` | New regression smoke (25 tests) |
| `docs/pr/PR-E1-CANONICAL-SHALLOW-OWNER-CLOSURE-01.md` | This note |

## Why deep standard squat is unaffected

`applyCanonicalShallowClosureFromContract` is gated behind:

- `canonicalShallowContractSatisfied === true`  → requires `officialShallowPathCandidate = true`
- `relativeDepthPeak < STANDARD_OWNER_FLOOR`    → deep squat has `relativeDepthPeak >= 0.4`

For deep standard squat, `officialShallowPathCandidate = false` so the closer
never runs. `standard_cycle` continues to originate from
`resolveSquatCompletionPath` inside `evaluateSquatCompletionCore`.

## Why event-owner downgrade is preserved

The closer has a hard guard `completionPassReason !== 'not_confirmed'`. Event
promotion previously wrote `completionPassReason` to a cycle value (removed by
PR-CAM-EVENT-OWNER-DOWNGRADE-01). With promotion disabled, the only way
`completionPassReason !== 'not_confirmed'` at closer-run time is if the
standard rule path already closed the squat — in which case the closer early-
returns without touching any fields. `eventCyclePromoted` remains `false` and
`official_shallow_cycle` cannot be written by the event path.

## Why provenance split is preserved

`shallowClosureProofBundleFromStream`, `guardedShallowTrajectoryClosureProofSatisfied`,
and other provenance signals feed **only into** `buildCanonicalShallowContractInputFromState`
as input facts for `deriveCanonicalShallowCompletionContract`. They do not
directly write `completionSatisfied` or `completionPassReason`. Success
ownership remains exclusively in `applyCanonicalShallowClosureFromContract`.

## Acceptance criteria status

| Criterion | Status |
|-----------|--------|
| A. Shallow owner closure — `official_shallow_cycle` + owner truth pass | ✓ B/E in smoke |
| B. No stale `no_reversal` after canonical closure | ✓ B2 guard smoke |
| C. No false owner leak (trajectory / event) | ✓ C/D smoke |
| D. Owner/UI split preserved | ✓ closer does not touch `auto-progression.ts` |
| E. Setup-phase behavior untouched | ✓ no change to setup/arming path |

## Regression smoke

```
npx tsx scripts/camera-e1-canonical-shallow-owner-closure-smoke.mjs
25 tests: 25 passed, 0 failed
```

Sections:

- A: `low_rom_cycle` path — `computeSquatCompletionOwnerTruth` passes
- B: `official_shallow_cycle` field alignment — all four owner-truth gates satisfied
- B2: stale `no_reversal` still blocks owner truth (negative guard)
- C: deep `standard_cycle` — unchanged, owner truth passes, not `official_shallow_cycle`
- D: event-cycle — `eventCyclePromoted = false`, pass reason contains no `event_cycle`
- E: `ultra_low_rom_cycle` owner truth alignment
- F: incomplete descent-only cycle — owner truth blocked
