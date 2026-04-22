# PR-CAM-SQUAT-OFFICIAL-SHALLOW-OWNER-LOCK-SSOT

> Design-only SSOT. This document creates no runtime change.
>
> Scope: squat camera shallow-pass ownership only.
>
> Parent context:
>
> - `docs/SHALLOW_SQUAT_TRUTH_SSOT_2026_04_01.md`
> - `docs/pr/PR-F-shallow-real-path-permanent-lock-truth-map.md`
> - `docs/pr/PR-E-residual-risk-closure-truth-map.md`
> - `docs/pr/PR-E1-conditional-shallow-lock-promotion-map.md`
> - `docs/pr/PR-CAM-SQUAT-AUTHORITY-LAW-RESOLUTION.md`
> - `docs/pr/PR-SHALLOW-OWNER-SPLIT-TRUTH-MAP-01.md`
> - `docs/pr/PR-SHALLOW-SAME-REP-ADMISSION-CLOSE-RECOVERY-01.md`
> - `docs/pr/shallow_squat_truth_map_design.md`

---

## 0. Status Labels

### CURRENT_IMPLEMENTED

The repo already has a completion-first squat authority model, post-owner final-pass surface, false-pass perimeter, shallow representative promotion machinery, and multiple shallow/epoch/provenance docs. Existing current-main representative fixtures such as `shallow_92deg` / `ultra_low_rom_92deg` remain governed by their landed SSOTs and promotion registry.

### LOCKED_DIRECTION

The new device JSON family must be solved as an owner / closure conflict, not as a broad threshold problem. Legitimate shallow reps should pass easily, while standing / seated / seated-hold / jitter / setup-motion / cross-epoch false passes must remain impossible.

### NOT_YET_IMPLEMENTED

This document does not implement the lock. It defines the SSOT that future PRs must follow when implementing official shallow owner freeze, false-pass guard separation, admission promotion, closure rewrite, quality split, and regression harness lock.

---

## 1. Purpose

This SSOT locks the next shallow squat design truth:

> The current shallow failure is not "threshold too high" and not "just lower shallow criteria." It is an owner / closure conflict where observation, admission, closure proof, completion owner, pass-core, UI gate, final eligibility, and false-pass defense can disagree about the same device motion.

The target behavior is narrow:

1. legitimate shallow squat reps pass 10/10 when performed as a real down-up-recover cycle;
2. standing, seated, seated-hold, jitter-only, setup-motion, and weird cross-epoch false passes remain hard-failed;
3. pass remains easy, but judgment remains strict;
4. depth remains quality, not completion.

---

## 2. Core Diagnosis

Current device JSON failure families include:

1. shallow is observed but not admitted strongly enough:
   - `not_armed`
   - `peak_not_latched`
   - `baselineFrozen=false`
   - `peakLatched=false`
2. shallow is admitted and closure proof exists, but standard veto closes it again:
   - `descent_span_too_short`
   - `ascent_recovery_span_too_short`
   - standard peak / reversal / standing vetoes
3. pass-core and completion owner disagree, so UI and final latch stay closed.
4. standing / seated weird-pass defenses are mixed into the same bucket as shallow success gating.
5. quality / robustness reasons contaminate pass gate.

Canonical reading:

> This is a multi-owner truth split. Do not diagnose it as a single threshold, a single reversal rule, a single span rule, or a single UI gate issue.

---

## 3. Product Law

### 3.1 Easy Pass / Strict Judgment

PASS must be easy for legitimate shallow reps.
Judgment must remain strict.
Weird false pass must remain impossible.

### 3.2 Depth Is Quality, Not Completion

Depth may classify quality, interpretation, ROM label, coaching, or downgrade.
Depth alone must not decide whether a real rep cycle completed.

### 3.3 Owner Semantics Over Broad Relaxation

Shallow pass must be solved by owner semantics:

- correct observation layer,
- correct admission layer,
- correct closure layer,
- independent false-pass guard,
- frozen final owner sink.

It must not be solved by broad threshold relaxation.

---

## 4. Truth Layers

### 4.1 Observation Truth

Observation truth says only what camera evidence appeared.
It is not pass ownership.

Canonical fields / meanings:

- `shallowCandidateObserved`
- `attemptLikeMotionObserved`
- shallow band observation
- downward commitment
- descend / reversal / recovery hints

Rules:

- Observation may start the conversation.
- Observation may feed admission.
- Observation may remain diagnostic.
- Observation must never directly open final pass.

### 4.2 Admission Truth

Admission truth determines whether the current epoch is an official shallow attempt.

Admission must require:

- ready-after-start;
- intentional descent;
- same motion epoch;
- not standing-still;
- not seated-hold;
- not setup motion.

Admission must not require as baseline shallow admission conditions:

- standard peak latch;
- standard span;
- standard standing hold.

These standard signals may remain diagnostics or supporting evidence, but they must not be the baseline gate that prevents official shallow admission when same-epoch shallow attempt evidence is already valid.

### 4.3 Closure Truth

Closure truth determines whether an admitted shallow attempt completed a real rep cycle.

Closure must be defined around:

- descend existence;
- reversal existence;
- recovery existence;
- recovery proof;
- same-epoch provenance.

Once shallow closure truth itself is proven, the following must not be used as final shallow vetoes:

- `descent_span_too_short`
- `ascent_recovery_span_too_short`
- `peak_not_latched`
- `no_reversal_after_peak`
- `no_standing_recovery`

Those may remain diagnostic, quality, or standard-path blocker reasons for non-shallow-owner paths. They may not overturn a proven official shallow closure.

### 4.4 False-Pass Guard

False-pass guard is independent from the shallow success path.
It is a hard-fail layer, not a quality layer and not a standard shallow-span veto.

It must hard-fail:

- no descent;
- no reversal;
- no recovery;
- still seated at pass;
- seated hold;
- standing still / jitter-only;
- setup-motion-blocked;
- ready-before-start violations;
- cross-epoch stitched proof;
- synthetic / assist-only closure without raw epoch provenance.

### 4.5 Final Owner Sink

Once:

```text
officialShallowPathClosed == true
AND false-pass guard is clear
```

then the final owner snapshot is frozen:

```text
completionOwnerPassed = true
uiProgressionAllowed = true
finalPassEligible = true
finalPassLatched = true
```

After this freeze, standard vetoes may remain as diagnostics only. They may not overturn shallow owner truth.

---

## 5. Same-Epoch Provenance Law

Same-epoch provenance is mandatory.

The following must belong to the same motion epoch:

- descend;
- reversal;
- recovery;
- upward return;
- seated-state-at-pass;
- recovery proof.

Boolean export agreement alone is not sufficient.

For example, a state where exported booleans say `descendConfirmed=true`, `reversalConfirmedAfterDescend=true`, and `recoveryConfirmedAfterReversal=true` is still not pass ownership unless those facts share raw same-epoch provenance.

Assist / bridge / backfill may help expose evidence. They may not create pass ownership without raw epoch provenance.

Illegal same-epoch states:

- descent from one rep plus recovery from another;
- shallow admission from one epoch plus closure proof from a later tail;
- seated-state check from a different moment than final pass;
- synthetic closure proof with no owned raw epoch;
- backfilled reversal that cannot be tied to the admitted shallow epoch.

---

## 6. Sink-Only After Freeze Law

After official shallow owner freeze, these consumers must all read the same frozen owner snapshot:

- UI gate;
- final pass eligibility;
- final latch.

They must not re-derive pass from secondary standard logic.

Forbidden after freeze:

- UI gate recomputes standard reversal and blocks;
- final eligibility recomputes standard standing recovery and blocks;
- final latch reads pass-core directly and disagrees with completion owner;
- standard span veto overwrites the frozen shallow owner.

Required after freeze:

- sink layers consume the frozen official shallow owner;
- standard blockers can be retained only as diagnostics;
- final visible state has no owner contradiction.

---

## 7. Official Shallow Closure Paths

Only two shallow closure families are acceptable.

### A. Strict Shallow Cycle

Required:

- descend confirmed;
- reversal confirmed;
- recovery confirmed;
- `stillSeatedAtPass = false`;
- near-standing or meaningful standing recovery proven;
- same-epoch provenance for all of the above.

### B. Shallow Ascent Equivalent

Required:

- descend confirmed;
- directional reversal confirmed;
- upward return magnitude sufficient;
- `stillSeatedAtPass = false`;
- recovery proof present;
- same-epoch provenance for all of the above.

Purpose:

- This path is for true low-ROM users whose rep is real but not deep.
- It is not a shortcut for standing drift, seated hold, jitter, setup motion, or cross-rep laundering.

---

## 8. Quality Semantics Split

Pass gate answers:

> Did a real same-epoch shallow rep complete?

Quality answers:

> How good was that completed rep?

Quality / robustness signals must not contaminate pass gate once official shallow closure and false-pass guard are settled.

Quality examples:

- low ROM;
- hard partial;
- weak recovery;
- low confidence;
- asymmetry;
- bottom weak;
- capture quality low.

These may downgrade interpretation, result severity, coaching, or diagnostic label. They must not fail a legitimate same-epoch shallow rep that has closed under the official shallow owner and cleared false-pass guard.

---

## 9. Forbidden Solution Classes

Future PRs under this SSOT must not use:

- broad threshold lowering;
- hidden fixture-only pass exceptions;
- broad reopening shortcuts;
- second pass owner;
- UI-only owner;
- mocked pass;
- cross-rep laundering;
- standard veto re-overturning official shallow owner after freeze;
- pass-core opener revival;
- comment-only authority changes;
- registry-only success without real product path;
- quality downgrade as pass failure after official shallow closure.

---

## 10. Non-Goals

This SSOT does not authorize:

- runtime implementation in this document;
- threshold tuning;
- deep / standard squat redesign;
- overhead reach changes;
- public funnel changes;
- `/app` execution-core changes;
- UI copy changes;
- route / auth / pay / onboarding changes;
- fixture geometry edits to make cases easier;
- deletion or downgrade of existing promoted shallow representative locks.

---

## 11. Regression Lock Matrix

### Must-Pass

Primary shallow pass fixtures:

- `device_shallow_fail_01`
- `device_shallow_fail_02`
- `device_shallow_fail_03`
- `device_shallow_fail_04`
- `device_shallow_fail_05`
- `device_shallow_fail_06`
- `device_shallow_fail_07`
- `device_shallow_fail_08`
- `device_shallow_fail_09`
- `device_shallow_fail_10`

Deep pass preservation:

- `device_deep_01`
- `device_deep_02`

### Conditional / Reclassification Bucket

Keep separate until raw same-epoch provenance confirms they are true shallow reps and not false-pass boundary cases:

- `device_shallow_fail_11`
- `device_shallow_fail_12`
- `device_shallow_fail_13`

Rules for this bucket:

- do not silently promote;
- do not silently discard;
- classify only after raw same-epoch provenance review;
- if proven real, move into must-pass;
- if proven boundary / false-pass-like, move into must-fail or targeted guard.

### Must-Fail

- `device_standing_01`
- `device_standing_02`
- `device_seated_01`
- `device_seated_02`

---

## 12. Required Assertions

### 12.1 Primary Shallow Must-Pass Fixtures

For `device_shallow_fail_01` through `device_shallow_fail_10`:

- `officialShallowPathAdmitted == true`
- `officialShallowPathClosed == true`
- `completionOwnerPassed == true`
- `uiProgressionAllowed == true`
- `finalPassEligible == true`
- `finalPassLatched == true`
- `stillSeatedAtPass == false`
- standard veto cannot overturn the frozen shallow owner

### 12.2 Must-Fail Fixtures

For standing / seated must-fail fixtures:

- `finalPassEligible == false`
- `finalPassLatched == false`
- fail reason should come from false-pass guard semantics, not from shallow success semantics

### 12.3 All Fixtures

For every fixture in this SSOT:

- pass semantics and quality semantics remain split;
- no pass-core / completion-owner disagreement may reach final surface;
- no UI / final latch re-derivation may contradict frozen owner truth;
- same-epoch provenance must be inspectable for pass ownership;
- assist / bridge / backfill may not be the sole owner of pass.

---

## 13. Acceptance Checklist For Future Implementation PRs

Any future PR implementing this SSOT must prove:

1. legitimate primary shallow device fixtures pass through official shallow owner truth;
2. standing / seated device fixtures remain blocked;
3. deep fixtures remain passable;
4. official shallow owner freeze is the only final pass source for these shallow cases;
5. standard vetoes are diagnostics after freeze;
6. false-pass guard is independent and hard-failing;
7. quality downgrades are post-pass interpretation, not pass denial;
8. same-epoch provenance is required and visible.

---

## 14. One-Line Lock

Official shallow pass is legal only when one same motion epoch contains a real descend -> reversal -> recovery cycle, clears an independent false-pass guard, and freezes a single official shallow owner snapshot that UI, final eligibility, and final latch consume sink-only.

---

## 15. Recommended PR Split

Implement this SSOT in exactly this order:

1. PR-1 — Shallow Owner Authority Freeze
2. PR-2 — False Pass Guard Lock
3. PR-3 — Official Shallow Admission Promotion
4. PR-4 — Official Shallow Closure Rewrite
5. PR-5 — Quality Semantics Split
6. PR-6 — Regression Harness Lock
