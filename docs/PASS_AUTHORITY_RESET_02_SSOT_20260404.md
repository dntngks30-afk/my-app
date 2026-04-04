# PASS-AUTHORITY-RESET-02 SSOT
Date: 2026-04-04
Repo: dntngks30-afk/my-app
Locked main commit: `e361f656696961e8e88a6e9f5e328eb4b4702b99`

## 0. Verified baseline
This SSOT is based on commit `e361f656696961e8e88a6e9f5e328eb4b4702b99` only.
`main` is identical to that commit at the time of verification.

## 1. Why RESET-01 was not enough
RESET-01 reduced downstream revocation, but it did **not** create a truly independent shallow-friendly pass engine.

The current `src/lib/camera/squat/pass-core.ts` still depends on upstream completion-state verdict fields:
- `completionSatisfied`
- `completionBlockedReason`
- `descendConfirmed`
- `ownerAuthoritativeReversalSatisfied`
- `ownerAuthoritativeRecoverySatisfied`
- `standingFinalizeSatisfied`

That means if shallow reps fail upstream, pass-core cannot rescue or independently validate them.
It is still a **completion-state consumer**, not a true motion-truth engine.

## 2. Latest observed failure pattern
Current real-device behavior:
- shallow rep around relative depth ~0.06 repeatedly fails
- shallow path remains blocked with `no_reversal`, `freeze_or_latch_missing`, `descent_weak`, or setup contamination annotations
- eventual pass happens only after the user performs a real deeper squat and the system closes as `standard_cycle`

This means the product law is still broken:
- real shallow squats are not passing reliably
- deep squats can pass
- pass authority is still effectively constrained by upstream completion-state production

## 3. Product law (hard lock)
### 3.1 Pass law
A squat must pass if and only if the **same rep** contains all of the following:
1. meaningful descent
2. meaningful reversal / ascent
3. standing recovery

### 3.2 Easy-pass law
If the above three are present in the same rep, pass must open quickly and reliably.
Target product behavior:
- real shallow squat: 10/10 pass under stable capture
- real deep squat: 10/10 pass under stable capture

### 3.3 Never-pass law
The following must never pass:
- standing only
- descent only
- still descending
- sitting without recovery
- too-fast micro-bounce / dip spike / jitter spike
- unrelated motion
- setup camera reposition / framing translation / phone tilt during setup
- cross-rep stitched fake cycle
- peak/reversal from one rep and standing recovery from another

### 3.4 Separation law
Pass and internal interpretation are fully separated.

Pass answers only:
- "Did one valid squat rep happen?"

Interpretation answers only:
- shallow / low / standard / deep
- quality tier
- warnings
- explanation / policy / UI copy

Interpretation must never revoke a valid pass.

## 4. RESET-02 objective
RESET-02 replaces the pseudo-independent pass-core with a **truly independent motion pass core**.

New rule:
- pass-core must no longer require `completionSatisfied === true`
- pass-core must derive pass truth directly from raw/structural motion facts
- completion-state becomes an observer/interpreter, not the owner of pass truth

## 5. New authority model
### 5.1 One writer
Only one module may open motion pass truth:
- `src/lib/camera/squat/pass-core.ts`

### 5.2 Zero revokers
After pass-core returns `passDetected=true`, no downstream module may set motion truth to false.
Not evaluator.
Not policy.
Not auto-progression.
Not canonical shallow contract.
Not UI latch.

### 5.3 Downstream consumers only
The following become consumers only:
- `squat-completion-state.ts`
- evaluator late-setup annotation
- `applyUltraLowPolicyLock`
- canonical shallow contract
- owner trace
- auto-progression UI latch / celebration timing
- quality / policy / ROM labels

## 6. Required new pass-core inputs
The new pass-core must derive pass from motion facts, not completion-state verdicts.

Allowed inputs:
- per-frame depth stream (primary and/or blended, but one chosen truth per rep)
- timestamps
- setup-clear / readiness-clear signal
- baseline freeze signal or raw baseline window facts
- peak latch candidate facts
- reversal candidate facts
- standing recovery candidate facts
- current-rep segmentation facts
- anti-spike / anti-false-pass facts

Forbidden inputs as pass authority:
- `completionSatisfied`
- `completionPassReason`
- `completionBlockedReason`
- `official_shallow_cycle`
- `low_rom_cycle`
- `ultra_low_rom_cycle`
- canonical shallow contract satisfied
- ultra-low policy decision
- interpretation quality labels

## 7. Required new pass-core outputs
```ts
export type SquatPassCoreResult = {
  passDetected: boolean;
  passBlockedReason: string | null;
  repId: string | null;

  setupClear: boolean;
  readinessClear: boolean;
  baselineEstablished: boolean;
  peakLatched: boolean;

  descentDetected: boolean;
  reversalDetected: boolean;
  standingRecovered: boolean;

  sameRepOwnershipClear: boolean;
  antiSpikeClear: boolean;
  antiSetupClear: boolean;

  descentStartAtMs?: number;
  peakAtMs?: number;
  reversalAtMs?: number;
  standingRecoveredAtMs?: number;
  cycleDurationMs?: number;

  depthPeak?: number;
  trace: string;
}
```

## 8. Hard pass criteria
All of the following must be true for pass:
1. readiness/setup clear
2. baseline established for current rep
3. meaningful descent for current rep
4. meaningful reversal after that descent
5. standing recovery after that reversal
6. same-rep ownership clear
7. anti-spike / anti-false-pass clear

## 9. Hard never-pass criteria
Pass-core must block when any of these are true:
- setup motion active before rep is established
- no baseline / freeze / peak epoch yet
- no descent
- no reversal after descent
- no standing recovery after reversal
- reversal too early / bounce-only
- standing recovery absent
- same-rep ownership broken
- jitter-only spike
- seated or mid-rise at would-be open time
- currentDepth still indicates not recovered when pass would open

## 10. Mandatory architectural changes
### 10.1 `src/lib/camera/squat/pass-core.ts`
Must be rewritten to derive motion truth directly.
It must no longer read `completionSatisfied` as its primary gate.
If it still depends on completion-state final verdict fields, RESET-02 has failed.

### 10.2 `src/lib/camera/squat-completion-state.ts`
Must become upstream fact producer / interpretation packager only.
It may still compute traces and explanation helpers.
It may not be required for pass-core final truth.

### 10.3 `src/lib/camera/evaluators/squat.ts`
Must package:
- raw motion facts
- pass-core result
- interpretation/debug
No pass revocation.
No motion-truth rewrite.

### 10.4 `src/lib/camera/auto-progression.ts`
Must use `squatPassCore.passDetected` as immutable motion truth.
UI latch and celebration timing remain downstream only.
Any blocker here must be labeled as UI-only, not motion-truth failure.

## 11. Shallow-specific law
RESET-02 must explicitly make shallow reps pass without needing drift into deep/standard.

If a shallow rep shows:
- real descent
- real reversal
- real standing recovery
within one rep,
it must pass even if:
- quality is poor
- depth is shallow
- event-cycle helper does not promote a separate label
- later interpretation downgrades the result

## 12. Deep-specific law
Deep reps must remain stable.
RESET-02 must not break existing legitimate standard/deep passes.

## 13. Acceptance matrix
### Must pass
- shallow valid rep around ~0.05–0.08 relative depth band
- moderate rep
- deep rep
- low-quality but real rep

### Must never pass
- standing only
- descent only
- still descending
- micro-bounce
- setup reposition
- jitter spike
- unrelated motion
- cross-rep stitched motion

## 14. Required regression guards
1. No downstream revoker after pass-core
2. No `completionSatisfied` dependency inside pass-core final decision
3. No label-owned pass authority
4. No policy-owned pass authority
5. No UI-owned pass authority
6. No shallow-to-deep dependency for legitimate shallow success
7. Existing deep success preserved
8. Existing standing/setup false positives remain blocked

## 15. Immediate success definition
RESET-02 is successful only if:
- `main` still blocks fake/setup/noise cases
- real shallow squat can pass without needing drift into standard/deep
- pass-core is truly independent from completion-state verdict fields
- pass and interpretation are fully separated in practice, not just by naming
