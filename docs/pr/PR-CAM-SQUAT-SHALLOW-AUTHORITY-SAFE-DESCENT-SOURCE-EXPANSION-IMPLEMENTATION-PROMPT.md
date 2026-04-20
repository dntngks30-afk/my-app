# Implementation Prompt — PR-CAM-SQUAT-SHALLOW-AUTHORITY-SAFE-DESCENT-SOURCE-EXPANSION

Use GPT-5.4 or an equivalently strong reasoning model.

This session is an **implementation session for Branch B only**.
It is **not** a design session.
It is **not** an authority-law session.
It is **not** a P2 / P3 / P4 session.

The design SSOT is already locked. Your job is to implement the preferred source exactly within that design envelope and land only the first required implementation bundle.

---

## Required reading order

Read these files first and treat them as binding, in this order:

1. `docs/SSOT_SQUAT_COMPLETION_FIRST_QUALITY_STRICT_2026_04.md`
2. `docs/pr/PR-SQUAT-COMPLETION-FIRST-QUALITY-STRICT-TRUTH-MAP-01.md`
3. `docs/pr/PR-01-SQUAT-COMPLETION-FIRST-AUTHORITY-FREEZE.md`
4. `docs/pr/P1-SQUAT-LEGITIMATE-SHALLOW-EVIDENCE-RECOVERY.md`
5. `docs/pr/P1-DIAGNOSIS-SHALLOW-FIXTURES.md`
6. `docs/pr/P1-DIAGNOSIS-V2-SHALLOW-SIGNAL-SHAPE-BLOCKER.md`
7. `docs/pr/P1-FOLLOWON-CLASSIFICATION-DECISION.md`
8. `docs/pr/P1-CALIBRATION-STUDY-RESULT.md`
9. `docs/pr/PR-CAM-SQUAT-SHALLOW-AUTHORITY-SAFE-DESCENT-SOURCE-EXPANSION.md`

Then inspect the real current code before editing, especially:

- `src/lib/camera/squat/squat-completion-core.ts`
- `src/lib/camera/squat/squat-completion-state.ts`
- `src/lib/camera/evaluators/squat.ts`
- any narrow helper files directly touched by the preferred source wiring
- existing PR-01 and shallow-related smokes

---

## Mission

Implement the preferred Branch B source from the design SSOT:

**`legitimateKinematicShallowDescentOnsetFrame`**

as the **4th candidate** in `effectiveDescentStartFrame` resolution, while preserving PR-01 completion-first authority and all existing absurd-pass protections.

This session must implement only the first safe bundle described in the design SSOT:

- source implementation
- source wiring
- parameter freeze within allowed band
- smoke coverage #1–#4
- additive diagnostics required by the SSOT

This session must **not** perform E1 promotion.
This session must **not** unblock P2 / P3 / P4.

---

## Non-negotiable product law

These are absolute. Do not violate them.

1. completion-owner truth is the only opener of final pass
2. pass-core / shallow-assist / closure-proof / bridge / event-cycle are not openers
3. absurd-pass registry remains block-only
4. threshold relaxation is forbidden
5. quality truth remains separate from pass truth

If your implementation requires violating any of the above, stop and do not patch around it.

---

## Exact implementation target

Implement the preferred source exactly as defined by the design SSOT:

- new source name: `legitimateKinematicShallowDescentOnsetFrame`
- source basis: `kneeAngleAvg` monotonic-descent onset with kinematic gating
- role: additive 4th candidate in `effectiveDescentStartFrame`
- behavior: may move descent anchor earlier when valid, may never become a standalone opener

Conceptually, the result must behave like:

```ts
effectiveDescentStartFrame = earliestByIndex([
  descentFrame,
  trajectoryDescentStartFrame,
  sharedDescentEpochFrame,
  legitimateKinematicShallowDescentOnsetFrame,
])
```

The new source may only make the canonical shallow contract viable earlier. It may not bypass any downstream gate.

---

## Exact source conditions to implement

A candidate frame is a valid `legitimateKinematicShallowDescentOnsetFrame` only if all of the following hold:

1. `index >= baselineFreezeFrame.index`
2. `index < peakFrame.index`
3. `baselineKneeAngleAvg` is resolvable from the standing baseline window using the median
4. `kneeAngleAvg <= baselineKneeAngleAvg - KNEE_DESCENT_ONSET_EPSILON_DEG`
5. over a sustain window, `kneeAngleAvg[j] - kneeAngleAvg[j+1] >= 0`
6. `baselineFrozen === true`
7. `attemptAdmissionSatisfied === true`
8. `descentConfirmed === true` somewhere in the current rep window by or before `peakFrame.index`

Do not broaden these conditions.
Do not weaken them for convenience.

---

## Parameter freeze rules

You must choose and freeze the new source parameters within the allowed band from the design SSOT:

- `KNEE_DESCENT_ONSET_EPSILON_DEG` in `[3.0, 7.0]`
- `KNEE_DESCENT_ONSET_SUSTAIN_FRAMES` in `[2, 3]`

Rules:

1. pick one value for each
2. define them as named constants
3. document the chosen values in code comments or nearby notes if helpful
4. do not tune outside the band
5. do not leave the values dynamic or half-decided

If the source cannot satisfy proof obligations within this band, stop and rollback rather than stretching the band.

---

## Allowed scope

Primary expected files:

- `src/lib/camera/squat/squat-completion-core.ts`
- `src/lib/camera/squat/squat-completion-state.ts`
- `src/lib/camera/evaluators/squat.ts`

Optional narrow helper files only if genuinely needed:

- a helper for baseline knee-angle extraction
- a helper for kinematic shallow onset candidate search
- a helper for additive debug payload construction

Allowed test/smoke scope:

- a new source-focused smoke
- narrow updates to absurd-pass regression smoke(s)
- narrow updates to split-brain / PR-01 invariant smoke(s)

---

## Forbidden scope

Do not do any of the following in this session:

- no threshold relaxation
- no lowering `SHALLOW_OFFICIAL_CLOSE_MIN_CYCLE_MS`
- no lowering `attemptAdmissionFloor`
- no fixture re-derivation
- no fake `phaseHint === 'descent'` injection
- no pass-core opener revival
- no authority-law rewrite
- no P2 naming/comment cleanup
- no P3 registry normalization
- no P4 fixture promotion
- no PR-F skip-marker expansion
- no broad non-squat work
- no pose-feature system redesign
- no UI / route / page changes

If you discover adjacent issues, document them as residual risk instead of broadening scope.

---

## Mandatory additive diagnostics

You must add the diagnostics required by the design SSOT.

### Required debug boolean

Add:

- `canonicalShallowContractDrovePass`

Definition:

- `true` iff `finalPassLatched === true` AND `completionTruthPassed === true` on the current rep

Purpose:

- future authority-law sessions must be able to separate canonical shallow passes from `pass_core_detected` assist passes

### Required coherence / trace support

Add whatever narrow additive debug fields are needed to make the new source diagnosable, such as:

- `baselineKneeAngleAvg`
- `legitimateKinematicShallowDescentOnsetAtMs`
- `legitimateKinematicShallowDescentOnsetIndex`
- `kneeDescentOnsetSustainSatisfied`
- `descentAnchorCoherent`

Do not remove or rename existing fields unless absolutely necessary.
Prefer additive trace over churn.

### Required coexistence comment

Add a code comment near the new source wiring that cites the design SSOT's coexistence deferral:

- this branch does not resolve the `pass_core_detected` authority ambiguity
- it only exposes the diagnostics needed for a later authority-law session

Do not fix the coexistence issue here.

---

## Mandatory proof obligations

Your implementation must preserve all absurd-pass obligations from the design SSOT.
At minimum, it must remain safe against:

- standing still
- setup-motion contaminated
- no real descent
- contaminated blended early peak false pass
- stale prior rep
- mixed-rep leakage
- no real reversal
- seated / quasi-seated nonsense pass

The new source may fire earlier on legitimate shallow reps, but it may not make any absurd-pass family newly pass.

---

## Required smoke bundle for this session

You must land smoke coverage #1–#4 from the design SSOT.

### Smoke #1 — new-source unit smoke
Assert the source conditions on a small focused fixture family.
Recommended new file:
- `scripts/camera-pr-cam-squat-legit-kinematic-shallow-descent-source-smoke.mjs`

### Smoke #2 — absurd-pass regression smoke
Assert the source does not reopen the absurd-pass families listed above.
Use the narrowest extension possible to an existing smoke, or a focused dedicated smoke if cleaner.

### Smoke #3 — split-brain guard smoke
Assert the new source does not create new cross-layer contradictions and that `descentAnchorCoherent` stays true when expected.

### Smoke #4 — PR-01 invariant smoke
The existing PR-01 authority freeze smoke must remain green.
No new conditional skip markers.
No accepted regression drift.

Do not land smoke #5 or #6 in this session if that would force fixture promotion or proof-gate policy changes. Those belong later.

---

## Explicit stop conditions

Stop immediately, rollback runtime changes, and produce a stop report instead of forcing the implementation if any of these occur:

1. the preferred source cannot satisfy the absurd-pass proof obligations inside the allowed parameter band
2. the source only works if pass-core effectively becomes an opener again
3. the source only works if `completionTruthPassed === false` can still yield canonical pass semantics in a widened way
4. the source requires fixture cheats or fake phaseHint injection
5. the source reopens any known absurd-pass family
6. the PR-01 illegal-state smoke regresses

Do not compensate for a failed earlier property by weakening a later guard.

---

## Required validation before completion

Before you finish, validate at minimum:

1. new source smoke is green
2. absurd-pass regression smoke is green
3. split-brain guard smoke is green
4. PR-01 authority freeze smoke is green
5. the new source is actually being selected as earlier descent anchor on the target shallow fixture(s) when valid
6. no new conditional skip markers were introduced
7. no P2/P3/P4 scope leaked into the diff

Nice-to-have but not mandatory in this session:

- verify the two E1 shallow fixtures are closer to canonical pass
- but do not broaden into promotion logic or registry status changes here

---

## Output requirements

When you finish, provide:

1. exact files changed
2. chosen values for `KNEE_DESCENT_ONSET_EPSILON_DEG` and `KNEE_DESCENT_ONSET_SUSTAIN_FRAMES`
3. where the new source was wired in
4. what additive diagnostics were added
5. what smokes were added or updated
6. validation results for smoke #1–#4
7. whether the E1 fixtures now reach `completionTruthPassed === true` in local validation, without promoting them
8. residual risks left for the next session

If you stop, provide:

1. exact stop reason
2. which proof obligation failed
3. confirmation that runtime edits were rolled back
4. the path of the stop-report doc

---

## One-line lock

Implement only the Branch B preferred source `legitimateKinematicShallowDescentOnsetFrame` as the 4th canonical descent-anchor candidate, keep PR-01 authority intact, land smoke #1–#4 plus additive diagnostics, and do not drift into authority-law fixes, fixture promotion, registry normalization, or threshold relaxation.