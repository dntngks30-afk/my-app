# Design Prompt — PR-CAM-SQUAT-SHALLOW-ARMING-CYCLE-TIMING-REALIGN

Use GPT-5.4 or an equivalently strong reasoning model.

This session is **design-only**.
It is **not** an implementation session.
It is **not** a P4/E1 promotion session.
It is **not** an authority-law rewrite session.
It is **not** a P2/P3 cleanup session.

The immediate problem is no longer Source #4 activation itself. The Branch B follow-up fix restored Source #4 firing on the representative shallow fixtures, but promotion remains blocked because the completion/arming slice still begins too late, so canonical shallow cycle timing remains below the required floor. The next move is to design a narrow structural solution for that arming/cycle-timing coupling without relaxing thresholds, reviving pass-core-first authority, or cheating fixtures.

---

## Required reading order

Read these files first and treat them as binding, in this order:

1. `docs/SSOT_SQUAT_COMPLETION_FIRST_QUALITY_STRICT_2026_04.md`
2. `docs/pr/PR-SQUAT-COMPLETION-FIRST-QUALITY-STRICT-TRUTH-MAP-01.md`
3. `docs/pr/PR-01-SQUAT-COMPLETION-FIRST-AUTHORITY-FREEZE.md`
4. `docs/pr/PR-CAM-SQUAT-SHALLOW-AUTHORITY-SAFE-DESCENT-SOURCE-EXPANSION.md`
5. `docs/pr/PR-E1-P4-SHALLOW-PROMOTION-BLOCKED-REPORT.md`
6. `docs/pr/PR-CAM-SQUAT-SHALLOW-AUTHORITY-SAFE-DESCENT-SOURCE-FOLLOWUP-FIX-REPORT.md`
7. `docs/pr/PR-CAM-SQUAT-SHALLOW-AUTHORITY-SAFE-DESCENT-SOURCE-FOLLOWUP-REVIEW-IMPLEMENTATION-PROMPT.md`
8. Current relevant code paths for grounding only:
   - `src/lib/camera/squat-completion-state.ts`
   - `src/lib/camera/squat/squat-completion-core.ts`
   - `src/lib/camera/evaluators/squat.ts`
   - `src/lib/camera/squat/squat-completion-arming.ts`

Then inspect the current repo only as needed to write the design.

---

## Mission

Produce exactly one new design SSOT document for the next branch of work:

**`PR-CAM-SQUAT-SHALLOW-ARMING-CYCLE-TIMING-REALIGN`**

Recommended output path:
- `docs/pr/PR-CAM-SQUAT-SHALLOW-ARMING-CYCLE-TIMING-REALIGN.md`

The session must end with a **design doc only**.
No runtime code, no smoke implementation, no threshold edits.

---

## Absolute scope lock

### Forbidden
- no `src/*` changes
- no `scripts/*` changes
- no threshold changes
- no engine behavior changes
- no fixture edits or re-derivation
- no proof-gate changes
- no E1 registry mutation
- no authority-law rewrite
- no pass-core opener revival
- no P2 / P3 / P4 work
- no runtime commits other than the single design doc if your environment writes directly

### Allowed
- reading repo files
- comparing prior diagnosis / blocked reports / fix reports
- reasoning about arming boundary, slice semantics, epoch handoff, and cycle-timing contracts
- writing one design doc in `docs/pr/*`

If you want to patch runtime code, stop. That is out of scope.

---

## Simple explanation of the problem

The new shallow detector now fires.
But the system still starts the "real squat window" too late.
That means even a correct shallow rep is measured from too far into the movement, so the full squat cycle still looks too short.

So this session is **not** about inventing a new shallow detector.
It is about deciding how the system should carry earlier standing/descent timing truth across the arming boundary without breaking the product law.

---

> **HISTORICAL DESIGN PROMPT.** The numbered “fixed facts” below describe the machine **at authoring time** for this design session. **Current main:** both E1 representatives are **`permanent_must_pass`** with full canonical proof; **`docs/pr/PR-E1-shallow-representative-must-pass-landed-status-lock.md`**. Items that mention conditional registry or blocked promotion reflect pre-landing state and are not current facts.

## Fixed facts from predecessor sessions

Treat the following as already established and do not reopen them:

1. Branch A (fixture-calibration explanation) was falsified; Branch B was confirmed.
2. Source #4 baseline-sourcing bug was real and has already been fixed.
3. Source #4 now fires on the representative shallow fixtures for the right reason.
4. Promotion is still blocked because canonical shallow cycle timing is still not satisfied.
5. The blocker is no longer “Source #4 is null”; it is the broader coupling between arming truncation and cycle timing.
6. **(Authoring time)** E1 registry was unchanged: `shallow_92deg` and `ultra_low_rom_92deg` were still `conditional_until_main_passes`. **Current main:** both are `permanent_must_pass` — `docs/pr/PR-E1-shallow-representative-must-pass-landed-status-lock.md`.

The follow-up fix report explicitly states that source #4 firing alone did not reopen the canonical cycle-timing gate because the slice still begins mid-descent, so the earliest local anchor cannot move earlier than slice start fileciteturn65file0

---

## Non-negotiable product law

Your design must preserve all of the following:

1. completion-owner truth is the only opener of final pass
2. pass-core / shallow-assist / closure-proof / bridge / event-cycle are not openers
3. absurd-pass registry remains block-only
4. threshold relaxation is forbidden
5. quality truth remains separate from pass truth

Any design that weakens these is invalid.

---

## What the design must solve

The design must answer this narrow structural question:

**How should earlier standing/descent timing truth be handed across the arming boundary so that legitimate shallow reps can satisfy canonical cycle timing without changing thresholds or reopening split-brain authority?**

This is specifically about the relation among:
- arming slice start
- standing baseline semantics
- earliest descent anchor semantics
- canonical cycle-duration measurement
- completion-owner truth

The design must NOT drift into unrelated cleanup or broad architecture rewrite.

---

## Required design outputs

Your design doc must include all of the following sections.

### 1. Problem statement
Describe exactly why source #4 firing did not unblock promotion.
State clearly that the remaining problem is the arming/cycle-timing boundary, not source #4 detection nullability.

### 2. Current failure map
Explain, using current code-path semantics, how shallow reps are still blocked:
- arming slice begins mid-descent
- local slice index 0 becomes the earliest available descent anchor
- cycle duration is still measured too late
- canonical shallow contract therefore still fails with `minimum_cycle_timing_blocked`

### 3. Candidate design families
Evaluate at least 2 and preferably 3 candidate solution families. Examples include:

- **A. Arming epoch handoff**
  Carry a pre-arming standing/descent epoch into completion-state so cycle timing may reference an earlier authority-safe timestamp without widening who owns pass.

- **B. Pre-arming canonical timing seed**
  Seed an authority-safe `descentStartAtMs` or equivalent epoch into completion-core while keeping final pass owned by completion truth.

- **C. Dual-window canonical timing model**
  Keep the existing completion slice for most logic, but define a separate authority-safe pre-arming timing window used only for cycle-duration legality.

You do not need to commit to code, but you must rank the candidates and choose one preferred direction.

### 4. Preferred design
For the chosen direction, define:
- what earlier timing truth is handed off
- where it is sourced from
- how it crosses the arming boundary
- which fields remain sink-only observability and which become canonical inputs
- how same-rep integrity is preserved
- how cycleDurationMs is derived after the change

### 5. Proof obligations / safety constraints
Explicitly enumerate what the design must remain safe against:
- standing still pass
- setup-motion contaminated pass
- no real descent
- contaminated early-peak false pass
- stale prior rep leakage
- mixed-rep timestamp contamination
- no real reversal / no recovery
- hidden split-brain where completion truth is false but final pass becomes true

### 6. Split-brain and authority guards
Define exactly how the new handoff avoids reopening:
- `completionTruthPassed === false` + final pass true
- assist-only reopening
- pre-arming timestamps from one rep mixing with later recovery of another rep
- pass-core-driven semantic drift

### 7. Boundary / ownership spec
This section is mandatory.
Define, in plain terms, which layer owns each piece after the redesign:
- arming layer
- completion-core layer
- evaluator handoff layer
- final pass surface
- debug / diagnostics layer

Be explicit about what remains canonical and what remains sink-only.

### 8. Coexistence with current diagnostics
This section is mandatory.
Specify how the design coexists with and/or extends existing diagnostics such as:
- `seedBaselineKneeAngleAvg`
- `legitimateKinematicShallowDescentOnsetFrameIndex`
- `effectiveDescentStartFrameSource`
- `descentAnchorCoherent`
- `canonicalShallowContractDrovePass`

Do not redesign all diagnostics; state only what must remain, what may be extended, and why.

### 9. Validation plan
Define what a future implementation must prove before E1 promotion is revisited:
- which smokes must remain green
- what new smoke or replay family is needed
- what illegal states must stay locked
- what exact evidence would justify moving `shallow_92deg` / `ultra_low_rom_92deg` to `permanent_must_pass`

### 10. Out-of-scope list
Explicitly ban in the design doc:
- threshold relaxation
- pass-core opener revival
- fixture re-derivation
- fake phaseHint injection
- P4 registry promotion in the same session
- P3 registry normalization
- P2 naming/comment cleanup
- broad camera-stack rewrite

---

## Required decision standard

Do not produce a vague brainstorm.
You must choose **one preferred arming/cycle-timing realign direction** and explain why the others are secondary or riskier.

If evidence is insufficient to fully rank them, state exactly what is missing, but you must still produce a preferred direction plus its proof obligations.

---

## Hard prohibitions for this session

- do not re-open Branch A
- do not propose fixture re-derivation
- do not soften `SHALLOW_OFFICIAL_CLOSE_MIN_CYCLE_MS`
- do not lower `attemptAdmissionFloor`
- do not widen Source #4 parameter bands
- do not convert pass-core into an opener
- do not turn this into an implementation patch plan without first locking the ownership model
- do not unblock P2/P3/P4

---

## Final lock

This is a docs-only design session. Write one design SSOT that explains how shallow cycle timing should be realigned across the arming boundary so legitimate shallow reps can eventually satisfy canonical promotion without threshold relaxation, fixture cheats, or authority-law drift.