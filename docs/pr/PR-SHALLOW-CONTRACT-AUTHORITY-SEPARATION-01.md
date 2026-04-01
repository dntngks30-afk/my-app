# PR-SHALLOW-CONTRACT-AUTHORITY-SEPARATION-01

Date: 2026-04-01  
Reads: `docs/SHALLOW_SQUAT_TRUTH_SSOT_2026_04_01.md` §PR-2, `docs/SHALLOW_SQUAT_PR_PROMPTS_2026_04_01.md` §PR-2  
**Note:** This implementation follows the **user prompt file list** (completion-state + evaluator + auto-progression + this doc), not the older SSOT file list that named `squat-reversal-confirmation.ts`.

## Working summary (PR-2 constraints)

- PR-2 is **not** a threshold-tuning PR.
- PR-2 is **not** an ultra-low policy PR.
- PR-2 is **not** a standing-finalize redesign PR.
- PR-2 separates **authoritative shallow contract ownership** in one place: `squat-completion-state.ts`.
- PR-2 keeps pass behavior stable by **only classifying** existing `completionBlockedReason` / `officialShallowPath*` truth — no changes to `computeBlockedAfterCommitment`, `resolveSquatCompletionPath`, promotion, finalize gates, or UI latch.

## Files changed

| File | Change |
|------|--------|
| `src/lib/camera/squat-completion-state.ts` | Types, `mapCompletionBlockedReasonToShallowNormalizedBlockerFamily`, `deriveShallowAuthoritativeContractStatusForPr2`, extend `attachShallowTruthObservabilityAlign01` |
| `src/lib/camera/evaluators/squat.ts` | `highlightedMetrics` pass-through |
| `src/lib/camera/auto-progression.ts` | `SquatCycleDebug` + pass-through from `squatCompletionState` |
| `docs/pr/PR-SHALLOW-CONTRACT-AUTHORITY-SEPARATION-01.md` | This document |

## New normalized fields

| Field | Type | Meaning |
|-------|------|---------|
| `shallowNormalizedBlockerFamily` | `admission` \| `reversal` \| `policy` \| `standing_finalize` \| `closed` \| `none` | Normalized bucket from **authoritative** `completionBlockedReason` + `completionSatisfied` |
| `shallowAuthoritativeContractStatus` | `not_in_shallow_contract` \| `admission_blocked` \| `reversal_blocked` \| `policy_blocked` \| `standing_finalize_blocked` \| `closed` | Single shallow **contract** position from `officialShallowPathCandidate` / `officialShallowPathAdmitted` + normalized family |
| `shallowContractAuthoritativeClosure` | boolean | Same meaning as `officialShallowPathClosed` (explicit Q4: closed through shallow contract?) |
| `shallowContractAuthorityTrace` | string | `candidate|admitted|reversalAuth|normalizedFamily|contractStatus` (0/1 for first three) |

Exported helper (for tests/docs only; evaluators must not re-derive):

- `mapCompletionBlockedReasonToShallowNormalizedBlockerFamily(reason, completionSatisfied)`

## Detailed blocker → normalized family

| Normalized family | `completionBlockedReason` values |
|-------------------|-----------------------------------|
| **closed** | `completionSatisfied === true` (ignores reason string) |
| **admission** | `not_armed`, `no_descend`, `insufficient_relative_depth`, `no_commitment`, `freeze_or_latch_missing`, any `setup_motion:*` prefix |
| **reversal** | `no_reversal`, `no_ascend` |
| **policy** | `ultra_low_rom_not_allowed`, `trajectory_rescue_not_allowed`, `event_promotion_not_allowed` |
| **standing_finalize** | `not_standing_recovered`, `recovery_hold_too_short`, `low_rom_standing_finalize_not_satisfied`, `ultra_low_rom_standing_finalize_not_satisfied`, `descent_span_too_short`, `ascent_recovery_span_too_short` |
| **none** | `null` / empty, or any other string not listed (see below) |

**Admitted + `none`:** contract status maps to `standing_finalize_blocked` (label-only; does not change underlying reason).

## Authoritative vs provenance-only (unchanged semantics)

- **Authoritative for contract:** `completionBlockedReason`, `completionSatisfied`, `officialShallowPathCandidate`, `officialShallowPathAdmitted`, `officialShallowPathClosed`, `reversalConfirmedAfterDescend` (also exposed as `shallowAuthoritativeReversalTruth` in PR-1 attach).
- **Provenance-only (explain, not owner):** `trajectoryReversalRescueApplied`, `reversalTailBackfillApplied`, `officialShallowStreamBridgeApplied`, `ultraShallowMeaningfulDownUpRescueApplied`, `reversalConfirmedBy === 'trajectory'`, event-cycle notes — still traced via PR-1 `shallowProvenanceOnlyReversalEvidence` / mismatch flags.

## What was intentionally not changed

- All numeric thresholds and blocker **emission** logic in completion core.
- `officialShallowPath*` computation semantics (only additional derived fields).
- `shallowAuthoritativeStage` (PR-1) — kept alongside PR-2 contract status for backward compatibility.

## Composer safety

Additive classification + debug fields only; single owner module; no gate consumption of new fields in this PR.

## Verification

- Run existing squat smoke scripts; expect same pass/fail counts.
- Inspect JSON: `shallowNormalizedBlockerFamily`, `shallowAuthoritativeContractStatus`, `shallowContractAuthorityTrace` present on `squatCompletionState` / `highlightedMetrics` / `squatCycleDebug`.
