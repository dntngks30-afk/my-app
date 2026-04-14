# PR-E3 — Setup / Framing False-Pass Fixture Lock

> This document follows `docs/SSOT_SHALLOW_SQUAT_PASS_TRUTH_MAP_2026_04.md` as the parent truth map and `docs/pr/PR-E-residual-risk-closure-truth-map.md` as the direct parent SSOT.
>
> Assumption lock:
>
> - PR-A froze squat product success truth at the post-owner final-pass surface.
> - PR-B rebound severity/result semantics to that frozen truth.
> - PR-C normalized final-pass semantics source selection and mismatch visibility.
> - PR-D locked the current squat truth contract with executable regression harnesses.
> - PR-E identified one remaining false-pass blind spot family not yet pinned with dedicated fixtures.
>
> This PR closes **only** that false-pass blind spot family.
>
> It does **not** make squat easier.
> It does **not** retune thresholds.
> It does **not** redesign readiness/setup UX.
>
> It adds dedicated fixture locks for setup/framing instability families whose main danger is premature success opening without a genuine squat rep.

---

## 1. Why this PR exists

Current main already blocks several nearby false-pass families in regression:

- standing still
- seated still
- sit-down-only
- stand-up-only
- micro-dip
- sway/noise

But four high-risk setup/framing families still are not pinned as their own dedicated contracts:

1. setup step-back
2. frame jump
3. unstable bbox / unstable landmark framing
4. camera tilt / framing drift

These are dangerous because they can reopen success before a meaningful descend → reversal → recovery cycle exists.

This PR exists to lock those four families as explicit no-success-opening fixtures.

---

## 2. Core law

> **The primary assertion is that canonical success never opens without a genuine rep.**

Blocked reason text is secondary.
Quality flags are secondary.
Retry guidance is secondary.

The first lock is always:

- `finalPassEligible === false`
- latch remains false
- canonical success semantics do not open

---

## 3. Scope

### In scope

- Add four dedicated narrow fixture/smoke families for squat false-pass prevention:
  1. setup step-back
  2. frame jump
  3. unstable bbox / unstable landmark framing
  4. camera tilt / framing drift
- Assert no-success-opening behavior per family.
- Assert these families do not become canonical success.
- Reuse existing smoke harness style where possible.
- Document the fixture family lock in this SSOT.

### Out of scope

- No threshold changes.
- No evaluator retuning.
- No readiness/setup UI changes.
- No attempt-quality redesign.
- No change to `readSquatFinalPassSemanticsTruth(...)`.
- No broad browser/device integration suite.
- No overhead reach work.

---

## 4. Parent truth that must remain frozen

### 4.1 Product success truth remains PR-A truth

This PR must not change:

- `finalPassEligible`
- `finalPassBlockedReason`
- final page latch ownership
- post-owner final-pass surface as product success truth

### 4.2 Semantics truth remains PR-B/PR-C truth

This PR must not change:

- `finalPassGranted`
- `finalPassSemanticsSource`
- `finalPassSemanticsMismatchDetected`
- severity/result semantics rules for successful vs failed attempts

### 4.3 PR-D false-pass lock remains preserved

Existing PR-D must-block families must remain green.
This PR extends that lock; it does not replace it.

---

## 5. Actual problem to solve

The remaining gap is not a missing pass path.
The remaining gap is missing dedicated lock ownership for specific framing-instability families that often regress during camera tuning.

The issue is not merely “bad capture quality.”
The issue is:

> **a non-rep framing event accidentally looking like a real rep strongly enough to open success.**

That is the exact class of regression this PR must pin.

---

## 6. Canonical fixture families

Each of the following must exist as its own dedicated fixture family.
They must not be collapsed into one generic invalid-framing case.

### 6.1 Family A — setup step-back

Meaning:

- subject changes distance/framing during setup or very early movement
- no genuine squat cycle exists yet

Required lock:

- no canonical success opening
- no final pass latch
- no final-pass success semantics

### 6.2 Family B — frame jump

Meaning:

- body position or timestamps shift abruptly
- apparent motion appears discontinuous
- no meaningful squat cycle is established

Required lock:

- no canonical success opening
- no final pass latch
- no final-pass success semantics

### 6.3 Family C — unstable bbox / unstable landmark framing

Meaning:

- tracking instability mimics depth or movement cues
- landmark/bbox noise creates false apparent motion

Required lock:

- no canonical success opening
- no final pass latch
- no final-pass success semantics

### 6.4 Family D — camera tilt / framing drift

Meaning:

- viewpoint shifts body projection or framing
- apparent shape changes without a genuine squat rep

Required lock:

- no canonical success opening
- no final pass latch
- no final-pass success semantics

---

## 7. Required assertion priority

For every family, assertions must be ordered conceptually like this:

### Priority 1 — canonical no-success opening

At minimum, each fixture must assert:

- `finalPassEligible === false`
- `isFinalPassLatched('squat', gate) === false` or equivalent final latch false
- canonical semantics do not indicate success

### Priority 2 — status remains non-pass

Each fixture must assert:

- `status !== 'pass'`

### Priority 3 — optional narrow blocked-reason check

A blocked reason may be checked only if it is already stable enough.
But blocked reason is not the primary lock.

This prevents future refactors from passing tests just by changing textual failure labels while accidentally reopening success.

---

## 8. Required implementation shape

### 8.1 One fixture family per risk family

Each of the four families must have its own dedicated fixture or smoke block.

Forbidden:

- one generic “bad framing” test covering all four
- one aggregated fixture where it is impossible to tell which family regressed

### 8.2 Prefer narrow deterministic synthetic fixtures

Preferred implementation:

- deterministic frame sequences or synthetic landmark sequences
- minimal shape needed to express the target instability
- no random/noisy non-reproducible generators

### 8.3 No hidden engine rewrite inside fixture work

This PR is a lock PR.
If a fixture reveals a real product bug that needs engine change, that engine change belongs in a separate follow-up PR, not inside the fixture lock PR.

### 8.4 Reuse current smoke style

Use the same deterministic smoke style already used in PR-D and related scripts.
Do not introduce a heavy new test framework for this PR.

---

## 9. Forbidden fixes

The following are forbidden:

- collapsing the four families into one generic fixture
- asserting only retry UI or quality flags instead of no-success-opening truth
- loosening thresholds so the fixture "passes the suite"
- over-mocking the instability so it no longer resembles the real risk family
- adding production logic branches just for fixture satisfaction
- changing success semantics instead of adding the missing lock

---

## 10. Files allowed

Allowed implementation files:

- existing squat smoke script(s) under `scripts/` extended narrowly, or
- one new narrow smoke file under `scripts/` that contains the four dedicated families
- `docs/pr/PR-E3-setup-framing-false-pass-fixture-lock.md`

Optional read-only imports used by the smoke:

- `src/lib/camera/auto-progression.ts`
- existing synthetic fixture helpers already used by squat smoke scripts

### Production files forbidden in this PR

- evaluator files
- `src/lib/camera/squat-result-severity.ts`
- `src/lib/camera/squat/squat-final-pass-semantics.ts`
- route/page/UI files
- readiness/setup product files

If a fixture exposes a product bug, that must become a separate engine fix PR after this lock PR.

---

## 11. Required regression matrix

### Matrix A — setup step-back

| Case | Expected |
|---|---|
| setup step-back fixture | `status !== 'pass'` |
| setup step-back fixture | `finalPassEligible === false` |
| setup step-back fixture | latch false |
| setup step-back fixture | no canonical success semantics |

### Matrix B — frame jump

| Case | Expected |
|---|---|
| frame jump fixture | `status !== 'pass'` |
| frame jump fixture | `finalPassEligible === false` |
| frame jump fixture | latch false |
| frame jump fixture | no canonical success semantics |

### Matrix C — unstable bbox / landmark instability

| Case | Expected |
|---|---|
| unstable bbox fixture | `status !== 'pass'` |
| unstable bbox fixture | `finalPassEligible === false` |
| unstable bbox fixture | latch false |
| unstable bbox fixture | no canonical success semantics |

### Matrix D — camera tilt / framing drift

| Case | Expected |
|---|---|
| tilt/drift fixture | `status !== 'pass'` |
| tilt/drift fixture | `finalPassEligible === false` |
| tilt/drift fixture | latch false |
| tilt/drift fixture | no canonical success semantics |

---

## 12. Acceptance criteria

This PR is complete only when all are true:

1. all four risk families have their own dedicated fixture ownership
2. each family explicitly locks no-success-opening behavior
3. no threshold or evaluator tuning was introduced
4. no product pass semantics changed
5. regressions in any one family fail independently and visibly

---

## 13. Residual risks intentionally left out

This PR does not solve:

- shallow/ultra-low-ROM promotion state management
- success snapshot storage-path lock
- overhead reach false-pass families
- broad browser/device E2E camera validation

Those belong elsewhere.

---

## 14. Model recommendation

- **Recommended**: Composer 2.0
- **Escalate to Sonnet 4.6 only if** synthetic frame-sequence design becomes tightly coupled to subtle pose-feature math and cannot be expressed safely in narrow deterministic fixtures

This is primarily fixture-lock work, not semantic redesign.

---

## 15. One-line lock

**PR-E3 must pin setup step-back, frame-jump, unstable-bbox, and tilt/drift as four independent squat false-pass fixture families whose primary invariant is simple: canonical success never opens without a genuine rep.**