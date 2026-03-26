# PR-CAM-13 — Overhead Progression Typed State Parity

**Status:** IMPLEMENTED  
**Branch:** `main` (working tree)  
**Related:** PR-CAM-11A, PR-CAM-11B, PR-CAM-12

---

## Summary

Introduces an explicit typed `overheadProgressionState` object in the evaluator debug output, mirroring the squat-style ownership split (`squatCompletionState` / `squatInternalQuality`). Rewires ambiguous retry and overhead hold voice cue to read **progression truth first** rather than strict-machine truth.

**This is a structural ownership PR, not a threshold-change PR.**

---

## Problem

After PR-CAM-12 fixed the `peakCountAtEasyFloor` input bug, the remaining issue was architectural:

| Consumer | What it was reading | What it should read |
|----------|---------------------|---------------------|
| `overhead-ambiguous-retry.ts` | strict `completionBlockedReason` + strict `completionMachinePhase` only | `progressionBlockedReason` (easy-facing) first, strict as fallback |
| `voice-guidance.ts` hold cue | strict `hold_too_short` flag + strict `holdDurationMs` | easy `progressionPhase === 'easy_building_hold'` + `easyBestRunMs` also supported |
| Debug / trace | no typed progression object | typed `overheadProgressionState` (like squat's `squatCompletionState`) |

**Root cause:** `completionBlockedReason` and `completionMachinePhase` in `highlightedMetrics` were populated exclusively from `evaluateOverheadCompletionState` (strict+fallback machine). When easy progression was the active path, these fields still reflected strict machine state — causing retry reason and hold cue to give outdated/wrong feedback.

---

## Product Law Alignment

> **Progression/pass = easy.** Judgment/planning/internal quality = strict.

| Layer | Before | After |
|-------|--------|-------|
| Progression truth | Implicit OR in evaluator | **Explicit typed `overheadProgressionState`** |
| Retry reason | Strict blocked reason only | **Progression blocked reason first, strict fallback** |
| Hold cue | Only fires on strict `hold_too_short` | **Also fires on `easy_building_hold` phase** |
| Planning evidence | Strict dwell-based (unchanged) | Still strict dwell-based (unchanged) |
| Internal quality | Strict (unchanged) | Still strict (unchanged) |

---

## Changes

### 1. `src/lib/camera/evaluators/types.ts` (additional file)

- **Added** `OverheadProgressionState` interface — defined here to avoid circular imports (overhead-reach.ts imports from types.ts, not vice versa).
- **Added** `overheadProgressionState?: OverheadProgressionState` to `EvaluatorDebugSummary` — mirrors the existing `squatCompletionState` pattern.

**`OverheadProgressionState` fields:**
```typescript
{
  progressionSatisfied: boolean            // canonical progression gate truth
  progressionPath: 'strict'|'fallback'|'easy'|'none'
  progressionBlockedReason: string|null    // easy-facing first; single entry point for retry/cue
  progressionPhase: 'idle'|'raising'|'easy_top'|'easy_building_hold'|'strict_top_unstable'|'completed'
  easyCompletionSatisfied: boolean
  easyCompletionBlockedReason: string|null
  easyBestRunMs: number
  easyPeakCountAtFloor: number
  strictMotionCompletionSatisfied: boolean  // strict+fallback machine — planning/quality basis
  strictCompletionBlockedReason: string|null
  strictCompletionMachinePhase: string|null
}
```

### 2. `src/lib/camera/evaluators/overhead-reach.ts`

- **Added** `OverheadProgressionState` import from `'./types'`.
- **Added** `progressionBlockedReason` computation (raw-data-based, not dependent on easy progression's internal check order):
  - `raiseCount === 0` → `'easy_raise_incomplete'`
  - `easyTopZoneFrames.length === 0 && raiseCount > 0` → `'easy_top_not_reached'`
  - `easyBlocked === 'easy_hold_short'` → `'easy_hold_short'`
  - `easyBlocked === 'asymmetry_unacceptable'` → `'asymmetry_unacceptable'`
  - other easy blocked → `'easy_top_not_reached'`
  - no easy issue → strict `completionBlockedReason` fallback
- **Added** `progressionPhase` computation (easy-facing, with strict fallback):
  - `completed` → progression satisfied
  - `idle` → raiseCount === 0
  - `easy_top` → easy zone reached, hold not yet building
  - `easy_building_hold` → easy zone + `easyBestRunMs > 0` + `easy_hold_short` blocked
  - `strict_top_unstable` → strict machine at top_unstable, no easy zone
  - `raising` → default not-yet-in-zone
- **Added** `overheadProgressionState` object to `debug` output.
- **Preserved** all existing `highlightedMetrics` fields unchanged (backward-compatible).

### 3. `src/lib/camera/overhead/overhead-ambiguous-retry.ts`

- **Added** `PROGRESSION_RETRY_PHASES` set (includes `easy_top`, `easy_building_hold`, `strict_top_unstable`).
- **Added** `ps()` helper reading `gate.evaluatorResult.debug?.overheadProgressionState`.
- **Updated** `isOverheadAmbiguousRetryEligible`: progression phase checked first; `easyTopZoneFrameCount` also accepted as top evidence (not only strict `topDetected`); strict phase as fallback.
- **Updated** `deriveOverheadAmbiguousRetryReason`: reads `progressionBlockedReason` first, then maps to retry vocabulary; strict machine used only when progression state absent or unmapped.
- **Preserved** output vocabulary: `OverheadAmbiguousRetryReason` type unchanged.

**New mapping:**
| `progressionBlockedReason` | Retry reason |
|---------------------------|-------------|
| `easy_hold_short` | `no_hold` |
| `easy_top_not_reached` | `insufficient_height` |
| `easy_raise_incomplete` | `insufficient_height` |
| `progressionPhase === 'easy_top'` | `unstable_top` |
| `asymmetry_unacceptable` | `partial_raise` |
| strict fallback | (as before) |

### 4. `src/lib/camera/voice-guidance.ts`

- **Added** easy hold buildup cue block, inserted after existing strict `hold_too_short` block.
- **Fires** only when: `progressionPhase === 'easy_building_hold'` AND `!progressionSatisfied` AND `easyBestRunMs >= 150ms` AND `remaining > 200ms`.
- **Anti-spam**: same `dedupeKey` as strict hold cue (`correction:hold:overhead-reach`), `cooldownMs: 4200`.
- **Near-success suppression**: `remaining <= 200ms` → no cue.
- **One-frame-touch guard**: `easyBestRunMs < 150ms` → no cue.
- **No overlap with success**: `progressionSatisfied === true` → block never entered.
- Strict `hold_too_short` path is **unmodified**.

### 5. `scripts/camera-cam13-overhead-progression-state-smoke.mjs` (new)

8 scenario groups, 42 assertions total:
- A: Easy pass preserved
- B: Easy short hold → retry `no_hold`
- C: Below easy floor → `easy_top_not_reached`
- D: No raise → `easy_raise_incomplete`
- E: Strict success (strict-machine paths accepted)
- F: Strict interpretation unchanged by easy pass
- G: Voice eligibility signals (phase flags, anti-spam boundaries)
- H: CAM-12 regression assertions

---

## What Was NOT Changed

- `overhead-completion-state.ts` — strict+fallback math untouched
- `computeOverheadPlanningEvidenceLevel` — strict dwell-based, untouched
- `computeOverheadInternalQuality` — strict, untouched
- `highlightedMetrics.completionSatisfied` — still represents progression-complete truth (backward-compat)
- `highlightedMetrics.completionBlockedReason` / `completionMachinePhase` — still present as strict-machine fields
- Squat evaluator, MediaPipe, pages, result renderer, storage, auth, payments — untouched

---

## Narrowed Field Semantics (documented for audit)

| Field | Before | After |
|-------|--------|-------|
| `highlightedMetrics.completionBlockedReason` | "why completion failed" (mixed meaning) | **strict machine blocked reason** (alias preserved, explicitly labeled in overhead-reach.ts) |
| `highlightedMetrics.completionMachinePhase` | progression phase (implicit) | **strict machine phase** (labeled in overhead-reach.ts) |

New canonical fields for user-facing semantics: `overheadProgressionState.progressionBlockedReason` and `overheadProgressionState.progressionPhase`.

---

## Acceptance Test Results

```
CAM-13 smoke: 42 passed, 0 failed
CAM-12 smoke: 17 passed, 0 failed
CAM-11B smoke: 10 passed, 0 failed
CAM-11A smoke: 26 passed, 0 failed
```

---

## Real-Device Risks

1. **`easy_building_hold` voice cue real-device timing**: `easyBestRunMs` is computed from frame timestamps; camera FPS fluctuation on device may shift the 150ms / 200ms boundary slightly. The cooldown (4200ms) prevents spam, but if frames drop, the cue window may be narrower than expected.

2. **Progression phase on strict-dominant users**: Users who consistently reach 132°+ (strict zone) will have `progressionPhase` based on `easyTopZoneFrames.length > 0` (which is also true at 132°+), so they may see `easy_top` or `easy_building_hold` even when using the strict path. The `progressionSatisfied` / `progressionPath` fields are always accurate for gate decisions; only the phase naming may be "easy" for users at strict-level.

3. **`strict_top_unstable` phase coverage**: This phase requires `easyTopZoneFrames.length === 0` AND strict `completionMachinePhase === 'top_unstable'`. If a user reaches 126°+ (easy zone) but has jitter, they get `easy_top` not `strict_top_unstable`. This is correct behavior (easy zone has priority), but the labeling may feel unexpected in traces.

---

## Follow-Up (P2)

- Consider whether `highlightedMetrics.completionBlockedReason` should be deprecated in favor of `overheadProgressionState.strictCompletionBlockedReason` to avoid future confusion.
- Guardrail (`getMotionCompleteness`) still re-derives some fields from evaluator HM; long-term these should read `overheadProgressionState` directly.
