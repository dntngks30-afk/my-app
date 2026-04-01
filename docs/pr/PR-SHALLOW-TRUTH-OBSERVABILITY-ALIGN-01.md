# PR-SHALLOW-TRUTH-OBSERVABILITY-ALIGN-01

Date: 2026-04-01  
Aligned to: `docs/SHALLOW_SQUAT_TRUTH_SSOT_2026_04_01.md`, `docs/SHALLOW_SQUAT_PR_PROMPTS_2026_04_01.md` (PR-1 only)

## Working note (docs confirmation)

- **Canonical diagnosis:** multi-stage **contract fragmentation** across admission, reversal authority, ultra-low policy, standing finalize, and event-cycle — not a single-cause bug (SSOT §3–4).
- **PR-1 scope:** **observability alignment only** — no pass/threshold/policy/finalize/event-promotion behavior change.
- **Safe for Composer 2.0:** additive fields + one pure function attach; no gate edits.

## Files changed

| File | Role |
|------|------|
| `src/lib/camera/squat-completion-state.ts` | Defines `SquatAuthoritativeShallowStage`, `attachShallowTruthObservabilityAlign01`, extends `SquatCompletionState`; wraps `evaluateSquatCompletionState` returns |
| `src/lib/camera/evaluators/squat.ts` | Re-attaches observability after setup-motion state patch; surfaces fields in `highlightedMetrics` |
| `src/lib/camera/auto-progression.ts` | Extends `SquatCycleDebug`; copies fields from `squatCompletionState` (pass-through only) |
| `docs/pr/PR-SHALLOW-TRUTH-OBSERVABILITY-ALIGN-01.md` | This document |

## New fields (exact names)

### On `SquatCompletionState` (and mirrored on `SquatCycleDebug` where noted)

| Field | Meaning |
|-------|---------|
| `shallowAuthoritativeStage` | Single label from **authoritative** `completionBlockedReason` + flags: `pre_attempt` \| `admission_blocked` \| `reversal_blocked` \| `policy_blocked` \| `standing_finalize_blocked` \| `closed` |
| `shallowObservationLayerReversalTruth` | Timeline heuristic: `committedAtMs != null && reversalAtMs != null` (same basis as legacy `SquatCycleDebug.reversalConfirmedAfterDescend` derivation) |
| `shallowAuthoritativeReversalTruth` | **Owner** reversal: `reversalConfirmedAfterDescend === true` |
| `shallowObservationLayerRecoveryTruth` | Timeline: `standingRecoveredAtMs != null && reversalAtMs != null` |
| `shallowAuthoritativeRecoveryTruth` | **Owner** recovery: `recoveryConfirmedAfterReversal === true` |
| `shallowProvenanceOnlyReversalEvidence` | Rescue/bridge provenance (trajectory / tail / stream-bridge / ultra-shallow rescue / `reversalConfirmedBy === 'trajectory'`) — **not** authoritative reversal by itself |
| `truthMismatch_reversalTopVsCompletion` | Observation reversal truth ≠ authoritative reversal truth |
| `truthMismatch_recoveryTopVsCompletion` | Observation recovery truth ≠ authoritative recovery truth |
| `truthMismatch_shallowAdmissionVsClosure` | `officialShallowPathAdmitted` && !`officialShallowPathClosed` && !`completionSatisfied` |
| `truthMismatch_provenanceReversalWithoutAuthoritative` | Provenance reversal signals on, authoritative reversal off |
| `truthMismatch_recoveryBandHitWithoutAuthoritativeRecovery` | `standingRecoveredAtMs` set but authoritative recovery false |

### `evaluators/squat.ts` `highlightedMetrics`

Same semantics; booleans exposed as `0`/`1` for JSON parity (except `shallowAuthoritativeStage` string).

## Contradictions now visible

1. **Top-level timeline “reversal” vs completion owner reversal** — when `truthMismatch_reversalTopVsCompletion === true`.
2. **Top-level timeline “recovery” vs completion owner recovery** — when `truthMismatch_recoveryTopVsCompletion === true`.
3. **Shallow admitted but not closed** — `truthMismatch_shallowAdmissionVsClosure`.
4. **Rescue/provenance present without owner reversal** — `truthMismatch_provenanceReversalWithoutAuthoritative`.
5. **Standing band timestamp without authoritative recovery** — `truthMismatch_recoveryBandHitWithoutAuthoritativeRecovery`.
6. **Single stage bucket** — `shallowAuthoritativeStage` collapses blocker family for shallow debugging.

## Intentionally not changed

- `computeBlockedAfterCommitment`, `normalizeCompletionBlockedReasonForTerminalStage`, ultra-low policy, event promotion eligibility, UI latch / final pass conditions, arming, pose phase algorithms, thresholds, confidence.
- Legacy `SquatCycleDebug.reversalConfirmedAfterDescend` / `recoveryConfirmedAfterReversal` **assignments** (still `committedAtMs && reversalAtMs` etc.) — unchanged so existing consumers keep behavior; new fields document the split.

## Verification

- Typecheck / lint on touched files.
- Manual: export JSON and confirm `shallowAuthoritativeStage` + mismatch flags appear alongside `squatCompletionState` and `squatCycleDebug`.
- Regression: existing squat smoke scripts should show **no** pass/fail delta (observability only).
