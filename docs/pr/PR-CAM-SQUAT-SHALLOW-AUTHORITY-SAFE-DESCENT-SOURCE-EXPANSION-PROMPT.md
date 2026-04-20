# Prompt — Branch B Design Session

Use GPT-5.4 or an equivalently strong reasoning model.

This session is **design-only**.
It is **not** an implementation session.
It is **not** a calibration session.
It is **not** a P2/P3/P4 session.

The calibration study has already falsified Branch A and confirmed Branch B. Real shallow recordings under the current PR-01 engine show that the synthetic fixture is not the abnormal element, the real primary depth channel is even more saturated than the synthetic one, `phaseHint === 'descent'` is not emitted on real shallow reps either, and short-cadence real reps hit the same blocker family as the synthetic fixtures. Therefore the next move is a new authority-safe descent-source design only.

---

## Required reading order

Read these files first and treat them as binding:

1. `docs/SSOT_SQUAT_COMPLETION_FIRST_QUALITY_STRICT_2026_04.md`
2. `docs/pr/PR-SQUAT-COMPLETION-FIRST-QUALITY-STRICT-TRUTH-MAP-01.md`
3. `docs/pr/PR-01-SQUAT-COMPLETION-FIRST-AUTHORITY-FREEZE.md`
4. `docs/pr/P1-SQUAT-LEGITIMATE-SHALLOW-EVIDENCE-RECOVERY.md`
5. `docs/pr/P1-DIAGNOSIS-SHALLOW-FIXTURES.md`
6. `docs/pr/P1-DIAGNOSIS-V2-SHALLOW-SIGNAL-SHAPE-BLOCKER.md`
7. `docs/pr/P1-FOLLOWON-CLASSIFICATION-DECISION.md`
8. `docs/pr/P1-CALIBRATION-STUDY-RESULT.md`

Then inspect the current repo only as needed for design grounding.

---

## Mission

Produce exactly one new design SSOT document for the next branch of work:

**`PR-CAM-SQUAT-SHALLOW-AUTHORITY-SAFE-DESCENT-SOURCE-EXPANSION`**

Recommended output path:
- `docs/pr/PR-CAM-SQUAT-SHALLOW-AUTHORITY-SAFE-DESCENT-SOURCE-EXPANSION.md`

If you need a slightly different filename, keep the meaning and scope identical.

This session must end with a **design doc only**.

---

## Absolute scope lock

### Forbidden
- no `src/*` changes
- no `scripts/*` changes
- no threshold changes
- no engine behavior changes
- no fixture changes or re-derivation
- no proof-gate changes
- no blocker rewiring in code
- no naming cleanup
- no P2 / P3 / P4 work
- no runtime commits other than the single design doc if your environment writes directly

### Allowed
- reading repo files
- comparing prior diagnosis and calibration docs
- reasoning about candidate descent-source families
- writing one design doc in `docs/pr/*`

If you want to patch runtime code, stop. That is out of scope.

---

## Non-negotiable product law

Your design must preserve all of the following:

1. completion-owner truth is the only opener of final pass
2. pass-core / shallow-assist / closure-proof / bridge / event-cycle are not openers
3. absurd-pass registry is block-only
4. threshold relaxation is forbidden
5. quality truth is separate from pass truth

Any design that violates those laws is invalid.

---

## What the design must solve

The current canonical shallow contract cannot pass realistic shallow reps under the present source family because:

- real `rawDepthPeakPrimary` is saturated at approximately `10^-7`
- `phaseHint === 'descent'` is absent on real shallow reps
- short-cadence real reps trigger the same timing-blocker family as the synthetic fixtures
- real shallow "passes" currently route through `completionOwnerReason === 'pass_core_detected'` while `completionTruthPassed === false`

The design must propose a **new authority-safe descent source family** that can make canonical shallow contract truth viable without reviving pass-core-first authority and without weakening absurd-pass protections.

---

## Required design outputs

Your design doc must include all of the following sections.

### 1. Problem statement
Summarize exactly why Branch B is now confirmed.
Do not re-argue Branch A.

### 2. Current-source failure map
Name the current sources that fail on real shallow reps and why:
- phaseHint source
- primary-depth threshold source
- current timing gate interactions
- pass-core coexistence issue

### 3. Candidate new descent-source families
Evaluate at least 2 and preferably 3 candidate families. Examples include:
- `kneeAngleAvg` monotonic-descent onset with kinematic gating
- `squatDepthProxyBlended` promotion to authority-safe source with proof obligations
- `downwardCommitmentReached + baselineFrozen + kinematic plausibility` as a modeled descent epoch

You do not need to commit to code, but you must rank the candidates and pick one preferred direction.

### 4. Preferred source definition
For the chosen direction, define:
- what signal opens descent evidence
- what preconditions must be true
- how it stays same-rep truthful
- how it avoids standing, setup, stale, mixed-rep, and contaminated-peak false passes

### 5. Absurd-pass proof obligations
Explicitly enumerate the blocker families the new source must remain safe against:
- standing still
- setup-motion contaminated
- no real descent
- contaminated blended early peak false pass
- stale prior rep
- mixed-rep leakage
- seated / quasi-seated nonsense pass if applicable

### 6. Split-brain guard design
Define how the new source coexists with the completion-owner hierarchy without reopening:
- `completionTruthPassed === false` + final pass true
- assist-only pass reopening
- cross-layer contradiction drift

### 7. Coexistence spec with `pass_core_detected`
This section is mandatory.
The calibration study surfaced a production reality where real shallow reps show:
- `completionTruthPassed === false`
- `finalPassEligible === true`
- `finalPassLatched === true`
- `completionOwnerReason === "pass_core_detected"`

Your design doc must explicitly state one of these:
- whether this is sanctioned by the current authority ladder and needs wording reconciliation, or
- whether this is an authority gap that the new design must eventually eliminate

Do **not** fix it in code. Just specify how the new design must account for it.

### 8. Validation plan
Define what future implementation must prove before E1 shallow fixtures can be promoted:
- which smokes must pass
- which illegal states must stay locked
- which real shallow replay captures are required

### 9. Out-of-scope list
Explicitly ban in the design doc:
- threshold relaxation
- pass-core opener revival
- fake phaseHint injection
- fixture-side cheat
- fixture re-derivation as a recovery tactic
- advancing to P2/P3/P4 before this design branch resolves

---

## Required decision standard

You must not write a vague brainstorm.
You must choose one preferred authority-safe descent-source direction and explain why the others are secondary.

If evidence is still insufficient to rank candidates, say exactly what missing data blocks the ranking, but still produce the full proof-obligation and coexistence skeleton.

---

## Hard prohibitions for this session

- do not reopen Branch A
- do not recommend fixture re-derivation
- do not soften `SHALLOW_OFFICIAL_CLOSE_MIN_CYCLE_MS`
- do not lower `attemptAdmissionFloor`
- do not convert pass-core into an opener
- do not move into implementation details beyond design-level contracts
- do not un-block P2/P3/P4

---

## Final lock

This is a docs-only Branch B design session. Write one design SSOT that defines the next authority-safe shallow descent-source expansion branch, its proof obligations, its split-brain guard, and its coexistence requirements with the currently observed `pass_core_detected` completion-owner path.