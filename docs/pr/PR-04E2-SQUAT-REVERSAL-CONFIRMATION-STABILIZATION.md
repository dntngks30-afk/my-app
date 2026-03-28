# PR-04E2 — Squat reversal confirmation stabilization

## Scope vs PR-04E1

- **PR-04E1** addressed **depth input stabilization before arming** (`squatDepthProxyBlended`, arming depth read). It reduces shallow `not_armed` noise; it does not own post-peak reversal truth.
- **PR-04E2** addresses **completion-state reversal confirmation** after commitment: detecting that the body has begun moving toward standing after the depth peak, without handing pass ownership to HMM or auto-progression.

## Why `no_reversal` persisted on real deep squats (CURRENT_IMPLEMENTED diagnosis)

On device, **relativeDepthPeak** and commitment were often already valid, but the prior rule was effectively a **strict primary-depth** check: a single post-peak sample had to cross `peak − reversalDropRequired` in one shot. Mobile pose noise and **gradual** ascent onset meant:

- Post-peak min depth could stay “close” to peak for several frames while phase hints already indicated ascent.
- **PR-04E1 blended depth** helped arming and interpretation, but reversal still needed a dedicated, completion-owned read path.

## Reversal rule vs HMM-assisted confirmation (LOCKED_DIRECTION)

- **Primary ownership:** `completionSatisfied`, `completionBlockedReason`, `completionPassReason` remain owned by `squat-completion-state.ts`.
- **Rule paths:** consecutive-frame primary/blended strict checks, short-window relaxed min drop (moderate+ ROM only), two-frame `phaseHint === 'ascent'` streak with a slightly relaxed drop floor.
- **HMM:** Never a standalone pass owner. When the blocked reason **would** be `no_reversal` and ROM is deep enough, **`detectSquatReversalConfirmation`** may use **`rule_plus_hmm`** only if HMM already exposes strong cycle evidence (`completionCandidate`, confidence floor, ascent counts) **and** post-peak blended/primary evidence clears a **separate** relaxed drop bar. Shallow cycles stay strict-only (no HMM bridge).

**PR-04D1** pass-vs-quality decouple and **PR-HMM-04B** `squat-reversal-assist.ts` thresholds are **not** modified by this PR.

## Why `recovery_hold_too_short` is untouched

Reversal confirmation answers “did we leave the bottom toward standing?” **Standing recovery hold** answers “did we stabilize long enough at the top?” Mixing them in one PR would blur failure modes and risk regressions on finalize contracts. **PR-04E2** only changes reversal evidence; **recovery hold tuning** is deferred to a follow-up PR.

## Observability

- **State:** `reversalConfirmedBy`, `reversalDepthDrop`, `reversalFrameCount` on `SquatCompletionState`.
- **Evaluator:** `squatReversalCalibration` debug block; `highlightedMetrics.squatReversalDepthDrop`, `squatReversalFrameCount`, `squatReversalSourceCode`.
- **Runtime:** `SquatCycleDebug`, camera trace `diagnosisSummary.squatCycle`, success/failed shallow diagnostics, squat dev panel (additive lines only).

## Acceptance

- Existing camera smokes listed in the PR checklist remain green.
- `scripts/camera-pr-04e2-squat-reversal-confirmation-stabilization-smoke.mjs` passes.
- Deep/moderate meaningful cycles: fewer false negatives on `no_reversal`.
- Bottom jitter / shallow ambiguous: no new early-reversal false positives beyond the stricter consecutive-frame strict path.

## Next PR (recommendation)

- **`recovery_hold_too_short`** and related standing-tail tuning for deep cycles after reversal is stable in the field.
