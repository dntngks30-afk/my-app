# Design Prompt — PR-CAM-SQUAT-SHALLOW-TEMPORAL-EPOCH-ORDER-REALIGN

Use GPT-5.4 or an equivalently strong reasoning model.

This session is **design-only**.
It is **not** an implementation session.
It is **not** a P4 / E1 promotion session.
It is **not** an authority-law rewrite session.
It is **not** a P2 / P3 cleanup session.

The immediate problem is no longer Source #4 activation, baseline seeding, or arming/cycle-timing visibility by itself. Those layers are now in place. The current blocker is that canonical shallow timing can see an earlier same-rep pre-arming descent epoch, but canonical close still stops later at a **temporal epoch ordering** guard. The next move is to design a narrow structural solution for that temporal ordering problem without relaxing thresholds, reviving pass-core-first authority, widening skip markers, or cheating fixtures.

---

## Required reading order

Read these files first and treat them as binding, in this order:

1. `docs/SSOT_SQUAT_COMPLETION_FIRST_QUALITY_STRICT_2026_04.md`
2. `docs/pr/PR-SQUAT-COMPLETION-FIRST-QUALITY-STRICT-TRUTH-MAP-01.md`
3. `docs/pr/PR-01-SQUAT-COMPLETION-FIRST-AUTHORITY-FREEZE.md`
4. `docs/pr/PR-CAM-SQUAT-SHALLOW-AUTHORITY-SAFE-DESCENT-SOURCE-EXPANSION.md`
5. `docs/pr/PR-CAM-SQUAT-SHALLOW-AUTHORITY-SAFE-DESCENT-SOURCE-FOLLOWUP-FIX-REPORT.md`
6. `docs/pr/PR-E1-P4-SHALLOW-PROMOTION-BLOCKED-REPORT.md`
7. `docs/pr/PR-CAM-SQUAT-SHALLOW-ARMING-CYCLE-TIMING-REALIGN.md`
8. `docs/pr/PR-CAM-SQUAT-SHALLOW-ARMING-CYCLE-TIMING-REALIGN-IMPLEMENTATION-PROMPT.md`
9. Current relevant code paths for grounding only:
   - `src/lib/camera/squat-completion-arming.ts`
   - `src/lib/camera/evaluators/squat.ts`
   - `src/lib/camera/squat-completion-state.ts`
   - `src/lib/camera/squat/squat-completion-core.ts`
   - `src/lib/camera/auto-progression.ts`
   - `scripts/camera-pr-cam-squat-shallow-arming-cycle-timing-realign-smoke.mjs`
   - `scripts/camera-pr-01-squat-completion-first-authority-freeze-smoke.mjs`
   - `scripts/camera-pr-e1-shallow-lock-promotion-registry-smoke.mjs`

Then inspect the current repo only as needed to write the design.

---

## Mission

Produce exactly one new design SSOT document for the next branch of work:

**`PR-CAM-SQUAT-SHALLOW-TEMPORAL-EPOCH-ORDER-REALIGN`**

Recommended output path:
- `docs/pr/PR-CAM-SQUAT-SHALLOW-TEMPORAL-EPOCH-ORDER-REALIGN.md`

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
- comparing prior blocked reports / design docs / implementation outcomes
- reasoning about temporal ordering, normalized epoch coordinates, same-rep proof, and canonical close guards
- writing one design doc in `docs/pr/*`

If you want to patch runtime code, stop. That is out of scope.

---

## Simple explanation of the problem

The system can now see the earlier shallow-descent start.
That fixed the old cycle-length visibility problem.

But pass is still blocked because the system does not yet have a fully correct way to order:
- the earlier pre-arming descent epoch,
- the slice-local peak,
- reversal,
- recovery,
- and final canonical close

inside one same-rep temporal contract.

So this session is **not** about inventing a new shallow detector.
It is **not** about making the squat easier.
It is about deciding how the earlier pre-arming epoch should participate in the **temporal ordering contract** safely.

---

## Fixed facts from predecessor sessions

Treat the following as already established and do not reopen them:

1. Branch A was falsified; fixture calibration is not the next move.
2. Source #4 baseline-sourcing bug was real and has already been fixed.
3. Source #4 now fires on the representative shallow fixtures for the right reason.
4. Structured arming epoch handoff is now implemented.
5. Canonical timing can now select `pre_arming_kinematic_descent_epoch` for the representative shallow fixtures.
6. `cycleDurationMs >= 800` is now reachable on the representative shallow fixtures without threshold relaxation.
7. The old blocker `minimum_cycle_timing_blocked` is no longer the first blocker for the representative shallow fixtures.
8. Promotion is still blocked because canonical close later fails at a temporal epoch ordering guard.
9. E1 registry remains unchanged: `shallow_92deg` and `ultra_low_rom_92deg` are still `conditional_until_main_passes`.

Do not reopen source-activation design, fixture design, or registry promotion in this session.

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

**How should canonical shallow completion order a pre-arming descent epoch against peak, reversal, recovery, and close so that legitimate shallow reps can pass canonical temporal ordering without reopening split-brain authority or mixed-rep contamination?**

This is specifically about the relation among:
- the selected canonical descent timing epoch
- peak ownership and peak coordinate system
- reversal ordering
- standing recovery ordering
- canonical close legality
- same-rep integrity across the arming boundary

The design must NOT drift into unrelated cleanup or broad camera-stack rewrite.

---

## Required design outputs

Your design doc must include all of the following sections.

### 1. Problem statement
Describe exactly why cycle timing is no longer the first blocker, yet canonical close still stops.
State clearly that the remaining problem is temporal epoch ordering, not source nullability or timing visibility.

### 2. Current failure map
Explain, using current code-path semantics, how shallow reps are still blocked:
- a pre-arming descent epoch can now be selected canonically
- peak / reversal / recovery still live partly in slice-local logic
- the normalized ordering contract is still incomplete or too conservative
- canonical shallow close therefore still fails at a temporal ordering guard

### 3. Candidate design families
Evaluate at least 2 and preferably 3 candidate solution families. Examples include:

- **A. Structured normalized epoch-order ledger (Preferred candidate example)**
  Carry all ordering-critical epochs in one normalized valid-buffer coordinate system and derive temporal legality from that ledger only after same-rep proof.

- **B. Peak/reversal/recovery epoch rebasing**
  Keep descent epoch handoff as-is, but explicitly rebase slice-local peak/reversal/recovery into valid-buffer coordinates before canonical ordering checks.

- **C. Canonical close ordering sub-contract**
  Keep existing state fields, but define a new dedicated ordering sub-contract that consumes local + pre-arming epochs and yields one authoritative temporal-order result.

You do not need to commit to code, but you must rank the candidates and choose one preferred direction.

### 4. Preferred design
For the chosen direction, define:
- which epochs are canonical inputs
- what coordinate system they use
- how peak / reversal / recovery are normalized relative to the pre-arming epoch
- how same-rep integrity is proven
- where the ordering contract runs
- how `temporal_epoch_order_blocked` is derived after the change

### 5. Proof obligations / safety constraints
Explicitly enumerate what the design must remain safe against:
- standing still pass
- setup-motion contaminated pass
- no real descent
- contaminated early-peak false pass
- stale prior rep leakage
- mixed-rep timestamp contamination
- no real reversal
- no real recovery
- hidden split-brain where completion truth is false but final pass becomes true

### 6. Split-brain and authority guards
Define exactly how the new ordering design avoids reopening:
- `completionTruthPassed === false` + final pass true
- assist-only reopening
- pre-arming descent from one rep pairing with peak/recovery from another rep
- pass-core-driven semantic drift
- ordering success being mistaken for pass ownership

### 7. Boundary / ownership spec
This section is mandatory.
Define, in plain terms, which layer owns each piece after the redesign:
- arming layer
- evaluator handoff layer
- completion-core ordering layer
- canonical close layer
- final pass surface
- debug / diagnostics layer

Be explicit about what remains canonical and what remains sink-only.

### 8. Coexistence with current diagnostics
This section is mandatory.
Specify how the design coexists with and/or extends existing diagnostics such as:
- `seedBaselineKneeAngleAvg`
- `legitimateKinematicShallowDescentOnsetFrameIndex`
- `preArmingKinematicDescentEpoch*`
- `selectedCanonicalDescentTimingEpoch*`
- `effectiveDescentStartFrameSource`
- `descentAnchorCoherent`
- `normalizedDescentAnchorCoherent`
- `canonicalShallowContractDrovePass`

Do not redesign all diagnostics; state only what must remain, what may be extended, and why.

### 9. Validation plan
Define what a future implementation must prove before E1 promotion is revisited:
- which current smokes must remain green
- what new temporal-order replay smoke or fixture family is needed
- what illegal states must stay locked
- what exact evidence would justify moving `shallow_92deg` / `ultra_low_rom_92deg` to `permanent_must_pass`

### 10. Out-of-scope list
Explicitly ban in the design doc:
- threshold relaxation
- pass-core opener revival
- fixture re-derivation
- fake `phaseHint` injection
- P4 registry promotion in the same session
- P3 registry normalization
- P2 naming/comment cleanup
- broad camera-stack rewrite

---

## Required decision standard

Do not produce a vague brainstorm.
You must choose **one preferred temporal epoch ordering realign direction** and explain why the others are secondary or riskier.

If evidence is insufficient to fully rank them, state exactly what is missing, but you must still produce a preferred direction plus its proof obligations.

---

## Hard prohibitions for this session

- do not reopen Branch A
- do not propose fixture re-derivation
- do not soften `SHALLOW_OFFICIAL_CLOSE_MIN_CYCLE_MS`
- do not lower `attemptAdmissionFloor`
- do not widen Source #4 parameter bands
- do not convert pass-core into an opener
- do not turn this into an implementation patch plan without first locking the ordering ownership model
- do not unblock P2/P3/P4

---

## Final lock

This is a docs-only design session. Write one design SSOT that explains how canonical shallow completion should realign temporal epoch ordering across pre-arming descent, peak, reversal, and recovery so legitimate shallow reps can eventually satisfy canonical promotion without threshold relaxation, fixture cheats, or authority-law drift.