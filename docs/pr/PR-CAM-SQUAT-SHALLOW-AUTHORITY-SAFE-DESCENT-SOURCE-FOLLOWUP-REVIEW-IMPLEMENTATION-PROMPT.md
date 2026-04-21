# Implementation Prompt — Branch B Follow-up Source Logic Review / Narrow Fix

Use GPT-5.4 or an equivalently strong reasoning model.

This session is a **narrow follow-up review/fix session for Branch B source #4 only**.
It is **not** a new design session.
It is **not** a P4 promotion session.
It is **not** an authority-law session.
It is **not** a P2 / P3 session.

The immediate goal is to explain — and, if legally possible within the current SSOT, narrowly fix — why the Branch B source
`legitimateKinematicShallowDescentOnsetFrame` is not firing on the two representative shallow fixtures.

---

## Required reading order

Read these files first and treat them as binding, in this order:

1. `docs/SSOT_SQUAT_COMPLETION_FIRST_QUALITY_STRICT_2026_04.md`
2. `docs/pr/PR-SQUAT-COMPLETION-FIRST-QUALITY-STRICT-TRUTH-MAP-01.md`
3. `docs/pr/PR-01-SQUAT-COMPLETION-FIRST-AUTHORITY-FREEZE.md`
4. `docs/pr/PR-CAM-SQUAT-SHALLOW-AUTHORITY-SAFE-DESCENT-SOURCE-EXPANSION.md`
5. `docs/pr/PR-CAM-SQUAT-SHALLOW-AUTHORITY-SAFE-DESCENT-SOURCE-EXPANSION-IMPLEMENTATION-PROMPT.md`
6. `docs/pr/PR-E1-P4-SHALLOW-PROMOTION-BLOCKED-REPORT.md`
7. `scripts/camera-pr-cam-squat-shallow-authority-safe-descent-source-expansion-smoke.mjs`
8. `scripts/camera-pr-e1-shallow-lock-promotion-registry-smoke.mjs`
9. the current implementation files:
   - `src/lib/camera/squat/squat-completion-core.ts`
   - `src/lib/camera/squat-completion-state.ts`
   - `src/lib/camera/auto-progression.ts`

Then inspect the real current code before editing.

---

## Session mission

Answer one narrow question and act only within that answer:

**Why does `legitimateKinematicShallowDescentOnsetFrame` stay `null` on `shallow_92deg` and `ultra_low_rom_92deg`, and can that be fixed within the current Branch B SSOT without changing thresholds, authority law, or fixture semantics?**

This session has only two valid outcomes:

### Outcome A — narrow legal fix lands
You find a root cause that is a logic/sourcing issue **inside** the current Branch B design envelope, and you land the smallest fix that makes source #4 behave as designed.

### Outcome B — stop cleanly
You determine the source cannot be fixed within the current SSOT envelope without threshold relaxation, authority-law change, fixture cheat, or equivalent scope drift.
In that case you land **no broadening fix** and instead produce one narrow stop-report doc.

There is no third path where you silently widen scope.

---

## Simple explanation of the problem

Right now the system added a new way to notice a shallow squat earlier.
But on the two representative shallow fixtures, that new detector never turns on.
So the old detector still wins, the cycle is still judged too short, and promotion stays blocked.

This session is ONLY about the new detector itself:
- why it is not turning on
- whether that is a bug in how it reads baseline/onset
- and whether that bug can be fixed without changing the product law

---

## Non-negotiable product law

These are absolute. Do not violate them.

1. completion-owner truth is the only opener of final pass
2. pass-core / shallow-assist / closure-proof / bridge / event-cycle are not openers
3. absurd-pass registry remains block-only
4. threshold relaxation is forbidden
5. quality truth remains separate from pass truth

If your proposed change requires violating any of the above, stop.

---

## What the stop report already proved

Treat the following as fixed facts from the blocked-promotion session:

- both `shallow_92deg` and `ultra_low_rom_92deg` still fail canonical promotion
- `canonicalShallowContractBlockedReason === 'minimum_cycle_timing_blocked'`
- `effectiveDescentStartFrameSource === 'trajectory_descent_start'`
- `legitimateKinematicShallowDescentOnsetFrameIndex === null`
- `finalPassBlockedReason === 'completion_truth_not_passed'`
- PR-01 illegal-state regressions are NOT the issue
- the blocker is NOT P4 harness logic; it is source #4 not firing

Do not re-open P4 in this session.

---

## Allowed scope

Primary expected files:

- `src/lib/camera/squat/squat-completion-core.ts`

Optional narrow files only if genuinely required:

- `src/lib/camera/squat-completion-state.ts`
- a focused source-logic smoke file
- a narrow stop-report doc in `docs/pr/*`

Strong default:
Assume this should be solved in **one core logic file** plus the minimum smoke/doc surface.

---

## Forbidden scope

Do **not** do any of the following:

- no threshold changes of any kind
- no change to `KNEE_DESCENT_ONSET_EPSILON_DEG` band or value unless the current value was not actually the frozen one in main
- no change to `KNEE_DESCENT_ONSET_SUSTAIN_FRAMES` band or value unless the current value was not actually the frozen one in main
- no lowering `SHALLOW_OFFICIAL_CLOSE_MIN_CYCLE_MS`
- no lowering `attemptAdmissionFloor`
- no pass-core opener revival
- no authority-law rewrite
- no fixture re-derivation
- no fake `phaseHint` injection
- no P4 promotion edits
- no P3 registry normalization
- no P2 naming/comment cleanup
- no PR-F skip-marker expansion
- no non-squat work

If the only way to succeed is one of the above, stop.

---

## Root-cause targets you are allowed to investigate

You may investigate only these kinds of causes:

### Target 1 — baseline sourcing bug
Example shape:
- `baselineKneeAngleAvg` is being resolved from the wrong frames
- the so-called standing baseline window is actually sampling descending frames
- the median is therefore too low, which suppresses source #4 activation

### Target 2 — onset-window selection bug
Example shape:
- the source logic is looking at the wrong index set or wrong pre-peak boundary
- valid candidate frames are being skipped due to indexing/windowing mismatch

### Target 3 — sustain-check implementation bug
Example shape:
- monotonic non-increase is implemented more strictly than the design intended
- candidate frames that should satisfy the sustain rule are being rejected by code, not by SSOT

### Target 4 — baseline-freeze plumbing gap
Example shape:
- source #4 is gated on a freeze/baseline value that is unavailable on the real evaluation path for representative fixtures
- a narrow, additive plumbing fix could expose already-owned baseline truth without changing authority law

You may NOT invent a new target that is secretly threshold relaxation or fixture manipulation.

---

## Required investigation steps

Before changing code, prove the failure mode directly on current head.
At minimum, capture and compare for both representative fixtures:

- `baselineFreezeFrameIndex`
- `baselineKneeAngleAvg`
- actual `kneeAngleAvg` values across the intended baseline window
- the first frame where `kneeAngleAvg <= baselineKneeAngleAvg - 5.0` would be expected
- whether the sustain window would pass if that frame were selected
- why the code still returns `null`

Do not guess. Diagnose from the real current implementation path.

---

## Legal fix rule

A fix is legal only if it satisfies all of the following:

1. it stays within the current Branch B design envelope
2. it does NOT change any thresholds or frozen parameter values
3. it does NOT broaden authority law
4. it does NOT modify fixture data
5. it does NOT weaken absurd-pass protections
6. it explains why source #4 was null and makes it non-null for the representative shallow fixtures for the right reason

If all 6 cannot be satisfied, stop.

---

## Preferred fix shape if legal

If a legal fix exists, prefer one of these minimal shapes:

- fix the baseline window so it truly references standing-baseline frames
- fix the mapping between `depthFrames` and the baseline knee-angle sample set
- fix a pre-peak or sustain-loop indexing error
- add a narrow baseline seed/plumbing input only if that seed already belongs to the current authority-safe evaluation chain and does not rewrite authority law

Do not redesign the source family. This is a follow-up review/fix, not a new Branch B redesign.

---

## Mandatory smoke/validation for a legal fix

If you land a fix, you must run and report at minimum:

1. `scripts/camera-pr-cam-squat-shallow-authority-safe-descent-source-expansion-smoke.mjs`
2. `scripts/camera-pr-01-squat-completion-first-authority-freeze-smoke.mjs`
3. `scripts/camera-pr-e1-shallow-lock-promotion-registry-smoke.mjs`
4. any focused new source-logic smoke you add

And you must verify on current head that for BOTH representative fixtures:

- `legitimateKinematicShallowDescentOnsetFrameIndex !== null`
- `effectiveDescentStartFrameSource === 'legitimate_kinematic_shallow_descent_onset'` OR the new source still legitimately wins earliest-by-index when designed to do so
- canonical cycle timing is improved for the right reason
- no absurd-pass regressions appear
- no PR-01 illegal-state regressions appear

Important:
This session still does **not** promote the fixtures in E1 unless they fully satisfy the promotion criteria and the prompt explicitly says so. Default assumption: do not promote here; only unblock the source.

---

## Promotion boundary for this session

Strong default: **do not edit E1 registry states in this session.**

You may only touch promotion state if — and only if — all of the following become true as a direct consequence of the narrow legal fix:

1. both representative fixtures now satisfy
   - `completionTruthPassed === true`
   - `finalPassEligible === true`
   - `finalPassLatched === true`
   - `canonicalShallowContractDrovePass === true`
2. E1 smoke can be converted without weakening any assertion
3. PR-01 smoke remains green
4. absurd-pass smoke remains green

If any one of those is missing, do not promote. Leave E1 unchanged.

---

## Explicit stop conditions

Stop immediately, rollback runtime edits, and produce one stop-report doc if any of these are true:

1. the root cause points to threshold relaxation
2. the root cause points to fixture re-derivation or fixture cheat
3. the root cause points to authority-law rewrite
4. the root cause points to pass-core opener revival
5. a fix reopens any absurd-pass family
6. PR-01 illegal-state smoke regresses
7. you cannot prove why source #4 was null from the real code path

Recommended stop-report path:
- `docs/pr/PR-CAM-SQUAT-SHALLOW-AUTHORITY-SAFE-DESCENT-SOURCE-FOLLOWUP-BLOCKED-REPORT.md`

The stop report must say exactly which of the above stop conditions fired.

---

## Output requirements

### If a legal fix lands
Provide:
1. exact files changed
2. exact root cause
3. exact narrow fix applied
4. why it stays within Branch B SSOT
5. smoke results
6. whether source #4 now fires on both representative fixtures
7. whether promotion remains blocked or is now legitimately unblocked
8. residual risks left for later sessions

### If you stop
Provide:
1. exact stop reason
2. why the fix would have exceeded scope
3. confirmation that runtime edits were rolled back or not applied
4. path of the stop-report doc

---

## One-line lock

Investigate why `legitimateKinematicShallowDescentOnsetFrame` stays null on the two representative shallow fixtures, land only the smallest legal fix inside the current Branch B design envelope if one exists, and otherwise stop cleanly without changing thresholds, authority law, fixtures, or promotion state.