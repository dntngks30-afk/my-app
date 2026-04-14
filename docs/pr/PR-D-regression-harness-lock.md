# PR-D — Regression Harness Lock

> This PR follows `docs/SSOT_SHALLOW_SQUAT_PASS_TRUTH_MAP_2026_04.md` as the parent SSOT and assumes PR-A + PR-B + PR-C have landed on `main`.
>
> Locked progression so far:
>
> - **PR-A** froze squat product success truth at the post-owner final-pass surface.
> - **PR-B** rebound severity and result interpretation to that frozen truth.
> - **PR-C** normalized final-pass semantics naming and introduced a single authoritative read boundary plus mismatch visibility.
>
> PR-D does **not** change engine logic.
> PR-D freezes the resulting truth contract with regression fixtures and executable checks so future PRs cannot silently reopen split-brain, false pass, or source-of-truth drift.

---

## 1. Why this PR exists

By the time PR-C lands, the main structural work is done.

The remaining risk is no longer “we do not know the truth.”
The remaining risk is:

- future refactors silently reading the wrong field,
- future tweaks reopening OR-union truth,
- future camera PRs restoring completion-state veto or semantics split-brain,
- future low-ROM/shallow work breaking must-pass or must-block behavior without immediate detection.

So PR-D is the lock PR.

Its job is to convert the current truth map into executable regression proof.

---

## 2. Review conclusion on PR-C

PR-C should be treated as accepted.

It correctly did the following:

- introduced `readSquatFinalPassSemanticsTruth(...)` as a single read boundary,
- removed OR-union truth reads from diagnosis and success snapshot consumers,
- added canonical consumer fields:
  - `finalPassGranted`
  - `finalPassSemanticsSource`
  - `finalPassSemanticsMismatchDetected`
  - `passSemanticsTruth: 'final_pass_surface'`
- kept `finalPassGrantedForSemantics` only as a deprecated compat alias,
- surfaced mismatch instead of silently widening to success when gate and truth disagree. fileciteturn24file0

That means PR-D can now lock the final state without inventing new semantics.

---

## 3. Goal

Freeze the squat post-PR-C truth contract as regression harnesses.

After PR-D:

- must-pass scenarios are pinned,
- must-block scenarios are pinned,
- illegal state combinations are pinned,
- canonical final-pass semantics source selection is pinned,
- diagnosis / success snapshot / bundle cross-surface alignment is pinned,
- legacy compat behavior is pinned where still intentionally supported.

---

## 4. Scope

### In scope

- Add or update narrow smoke/regression scripts for squat-only truth locking.
- Add fixture-style mocked gate payloads where sufficient.
- Add light helper assertions for canonical final-pass semantics invariants.
- Lock consumer-surface alignment after PR-C.
- Document the regression matrix in this PR doc.

### Out of scope

- No gate logic changes.
- No threshold changes.
- No evaluator changes.
- No new semantics logic.
- No readiness/setup changes.
- No overhead reach changes.
- No page/route/app changes.
- No data migration for old localStorage payloads.

PR-D is verification-only.
If product logic changes are required, that means the work belongs in a new PR after PR-D, not inside PR-D itself.

---

## 5. Locked truth to verify

### 5.1 Final product pass truth

For squat, final product pass truth is still:

- `finalPassEligible`
- `finalPassBlockedReason`
- the PR-A frozen final-pass surface
- page latch derived from that surface

### 5.2 Semantics truth

For squat, result semantics truth is still:

- `finalPassGranted`
- `finalPassSemanticsSource`
- `finalPassSemanticsMismatchDetected`
- `passSemanticsTruth: 'final_pass_surface'`

`completionTruthPassed` remains debug / compat / sink-only.

### 5.3 Single read boundary

The single authoritative consumer read boundary remains:

- `readSquatFinalPassSemanticsTruth(...)`

It must not be bypassed by OR-union truth reads in future PRs.

### 5.4 Historical labels

`cycleDecisionTruth: 'completion_state'` is now a legacy/historical label only.
It must not be read as current pass-semantics authority.

---

## 6. What PR-D must lock

### A. Must-pass family lock

The following families must continue to pass when they already pass today:

1. **Shallow real squat pass**
   - meaningful descend → reversal → recovery
   - currently valid shallow / low-ROM pass path remains green

2. **Ultra-low-ROM real pass that is currently valid**
   - only if that path is already valid in current `main`
   - PR-D must lock the truth that exists, not invent a broader one

3. **Moderate / deep standard successful squat**
   - standard pass path remains green

### B. Must-block family lock

The following families must continue to fail:

1. standing still
2. seated still
3. sitting down only
4. standing up only
5. setup step-back / early setup motion
6. frame jump / unstable bbox / camera tilt false-pass family
7. non-squat sway / noise-only motion

### C. PR-A equality invariants

These must be mechanically checked:

- `progressionPassed === finalPassEligible`
- `finalPassEligible === (finalPassBlockedReason == null)`
- if `squatFinalPassTruth` exists:
  - `squatFinalPassTruth.finalPassGranted === finalPassEligible`
  - or mismatch is explicitly surfaced where the test intentionally injects disagreement

### D. PR-B semantics invariants

These must be mechanically checked:

- `finalPassGranted=true` must never serialize as `passSeverity='failed'`
- `finalPassGranted=true` must never serialize as `resultInterpretation='movement_not_completed'`
- `finalPassGranted=false` must serialize as `failed / movement_not_completed`
- quality warnings may downgrade successful passes to
  - `warning_pass`
  - `low_quality_pass`
  but never to `failed`

### E. PR-C source-selection invariants

These must be mechanically checked:

- `readSquatFinalPassSemanticsTruth(...)` chooses `finalPassEligible` when present
- it falls through to `squatFinalPassTruth.finalPassGranted` only when gate value is unavailable
- it never OR-merges two truth fields
- when both are boolean and disagree:
  - `mismatchDetected === true`
  - chosen value is gate value

### F. Cross-surface alignment invariants

For the same successful or failed attempt, the following surfaces must agree on canonical semantics fields where applicable:

- diagnosis summary squat cycle
- success snapshot
- bundle summary

At minimum they must align on:

- `finalPassGranted`
- `finalPassSemanticsSource`
- `finalPassSemanticsMismatchDetected` when the source exists on that surface
- severity not contradicting canonical final-pass truth

### G. Compat alias invariants

While `finalPassGrantedForSemantics` remains as deprecated compat alias, PR-D must lock:

- when canonical `finalPassGranted === true`, alias is also `true`
- bundle readers prefer canonical `finalPassGranted`
- alias is only fallback for older payload shapes, not the primary canonical field

---

## 7. Required regression matrix

PR-D must lock at least the following matrix.

### Matrix group 1 — gate truth

| Case | Expected |
|---|---|
| shallow real pass | `finalPassEligible=true`, blockedReason null |
| standard real pass | `finalPassEligible=true`, blockedReason null |
| setup motion | `finalPassEligible=false` |
| standing still | `finalPassEligible=false` |
| frame jump / unstable | `finalPassEligible=false` |

### Matrix group 2 — semantics truth

| Case | Expected |
|---|---|
| final-pass success + completionTruthPassed false | severity non-failed |
| final-pass fail + completionTruthPassed true | severity failed |
| final-pass success + low quality | `low_quality_pass` |
| final-pass success + limitation only | `warning_pass` |

### Matrix group 3 — source selection

| Case | Expected |
|---|---|
| gate=true, truth=true | source gate, mismatch false |
| gate=false, truth=true | source gate, mismatch true, value false |
| gate undefined, truth=true | source truth, mismatch false |
| gate undefined, truth undefined | source none, value undefined |

### Matrix group 4 — cross-surface agreement

| Case | Expected |
|---|---|
| successful diagnosis | canonical fields present, severity non-failed |
| successful snapshot | canonical fields present, severity non-failed |
| bundle from successful diagnosis | reads canonical field first |
| mismatch-injected diagnosis | mismatch flag true, no OR-widened success |

---

## 8. Files allowed

Allowed implementation files:

- `scripts/camera-pr-b-semantics-rebind-smoke.mjs`
- `scripts/camera-pr-c-final-pass-semantics-smoke.mjs`
- new narrow squat regression smoke files under `scripts/`
- optional narrow helper assertion files under `src/lib/camera/squat/` only if needed for non-production test support
- `docs/pr/PR-D-regression-harness-lock.md`

Optional if already used as smoke entry points and modified only to extend assertions, not product logic:

- existing squat smoke scripts already used in PR-A/PR-B/PR-C validation

### Files forbidden in this PR

- `src/lib/camera/auto-progression.ts`
- `src/lib/camera/squat-result-severity.ts`
- `src/lib/camera/trace/camera-trace-diagnosis-summary.ts`
- `src/lib/camera/camera-success-diagnostic.ts`
- `src/lib/camera/camera-trace-bundle.ts`
- evaluator files
- readiness/setup files
- any route/page/UI file

Reason:
PR-D must lock current truth, not revise it.
If a test reveals a bug, that should be handled in a follow-up fix PR, not inside PR-D itself.

---

## 9. Design requirements

### A. Prefer narrow smoke guards over broad unstable integration tests

PR-D should build on the current smoke style already used in PR-A/B/C.
The goal is fast, deterministic, contract-focused checks.

### B. Mocked mismatch cases are required

Some illegal states are intentionally hard to reproduce from normal runtime.
PR-D must include mocked payload checks for those cases rather than waiting for organic runtime drift.

### C. Real runtime must-pass/must-block checks are also required

At least one real gate-path smoke should remain in the matrix for:

- known shallow success
- known setup / false-pass prevention

### D. Surface alignment must be checked explicitly

Do not assume that if helper tests pass, diagnosis/snapshot/bundle stay aligned.
PR-D must assert that these surfaces serialize the same canonical semantics truth.

### E. No production behavior branching in test code paths

PR-D may add test helpers or scripts, but must not add production logic branches solely to satisfy tests.

---

## 10. Acceptance criteria

### A. Must-pass preserved

Known current pass cases continue to pass.

### B. Must-block preserved

Known false-pass families continue to fail.

### C. Equality invariants preserved

PR-A invariants still hold.

### D. Semantics invariants preserved

PR-B invariants still hold.

### E. Source-selection invariants preserved

PR-C invariants still hold.

### F. Cross-surface alignment preserved

Diagnosis / snapshot / bundle do not contradict one another on canonical final-pass semantics.

### G. Compat alias behavior documented and pinned

Deprecated alias remains only compat fallback, not primary truth.

---

## 11. Illegal states PR-D must detect automatically

PR-D should fail loudly when any of the following appear in a regression script:

- `finalPassEligible=true` and `finalPassBlockedReason != null`
- final-pass success and `passSeverity='failed'`
- final-pass success and `resultInterpretation='movement_not_completed'`
- OR-union truth read causing mismatch case to serialize as success
- `finalPassSemanticsMismatchDetected=false` when injected gate/truth values disagree
- bundle reading deprecated alias when canonical field is present
- canonical field absent on a surface where PR-C said it should exist

---

## 12. Suggested smoke layout

A reasonable PR-D smoke set is:

1. **keep existing**
   - `camera-pr-b-semantics-rebind-smoke.mjs`
   - `camera-pr-c-final-pass-semantics-smoke.mjs`

2. **add one gate-contract smoke**
   - verifies PR-A equality invariants on current squat gate payloads

3. **add one cross-surface alignment smoke**
   - diagnosis → success snapshot → bundle summary consistency

4. **add one must-block regression smoke**
   - standing/setup/frame-jump family remains blocked

5. **add one compat smoke**
   - canonical field preferred, deprecated alias only fallback

The exact filenames may vary, but the matrix above must be covered.

---

## 13. Residual risks intentionally left after PR-D

PR-D is the lock, not the end of all camera work.
Remaining future work may still include:

- deeper real-device fixture capture,
- overhead reach regression expansion,
- legacy payload cleanup / removal of deprecated alias,
- optional owner-role JSDoc refinement for `passOwner` / `finalSuccessOwner` / `motionOwnerSource`.

Those are outside PR-D unless they are strictly needed for the lock itself.

---

## 14. Follow-up rule after PR-D

After PR-D lands, any future squat camera PR that touches:

- final-pass truth,
- semantics source selection,
- diagnosis/snapshot/bundle semantics,
- false-pass prevention,
- shallow pass preservation

must update or extend the PR-D regression matrix in the same PR.

That becomes the working rule.

---

## 15. Model recommendation

PR-D is mostly deterministic regression work.

- **Recommended**: Composer 2.0
- **Use Sonnet 4.6 only if** the regression scope expands into subtle cross-surface fixture design or flaky contract reduction across many scripts

This is exactly the kind of bounded lock work Composer should handle well.

---

## 16. One-line lock

**PR-D must turn the PR-A/B/C squat truth contract into executable regression proof so future work cannot silently reintroduce false pass, split-brain semantics, or source-of-truth drift.**
