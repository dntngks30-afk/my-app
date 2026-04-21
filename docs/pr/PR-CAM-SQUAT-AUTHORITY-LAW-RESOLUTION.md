# PR-CAM-SQUAT-AUTHORITY-LAW-RESOLUTION

> **PR scope lock:** authority-law resolution only. No threshold tuning, no
> shallow/timing/epoch/arming changes, no new opener paths, no P3 registry
> normalization, no P2 naming/comment sweep, no non-squat work, no proof-gate
> skip expansion.
>
> **Parent design:** `docs/pr/PR-CAM-SQUAT-AUTHORITY-LAW-AMBIGUITY-RESOLUTION-MAP.md`.
>
> **Parent SSOT:** `docs/SSOT_SQUAT_COMPLETION_FIRST_QUALITY_STRICT_2026_04.md`.
>
> **Parent authority freeze:** `docs/pr/PR-01-SQUAT-COMPLETION-FIRST-AUTHORITY-FREEZE.md`.

---

## 1. Purpose

The E1 shallow representative promotion (`permanent_must_pass` for
`shallow_92deg` and `ultra_low_rom_92deg`) has landed on current main. The
one remaining ambiguity flagged by the authority-law ambiguity resolution map
is the legal status of `completionOwnerReason === 'pass_core_detected'` and
the exact wording of the current opener law around
`completionTruthPassed`, `completionOwnerPassed`,
`finalPassEligible / finalPassGranted / finalPassLatched`,
`canonicalShallowContractDrovePass`, and `pass_core_detected`.

This PR formally closes that ambiguity against current repo truth. It does
not invent new law. It locks the single opener law that the code already
implements today, classifies the legacy `pass_core_detected` label, and
aligns narrow wording so future P3 registry normalization and P2 naming
cleanup do not relitigate the question.

One-line intent:

**Align the squat final-pass authority law wording (in narrow code comments,
in the PR-01 invariant smoke, and in this SSOT) with the single law that
current `src/` already implements, and classify the legacy
`pass_core_detected` owner-reason label as a formally closed legacy
marker with no production assigner.**

---

## 2. Non-goals

This PR is exclusively an authority-law resolution. It does not:

- change any threshold;
- change shallow detection, timing, epoch, or arming logic;
- change pass/fail semantics;
- broaden any final-pass opener;
- add a new grant path;
- promote `canonicalShallowContractDrovePass` to a gate input;
- promote ordering-success fields to owner or opener truth;
- revive `pass_core_detected` as an active canonical opener;
- normalize the absurd-pass registry (that is P3);
- perform the authority naming/comment sweep (that is P2);
- touch any non-squat step;
- expand the PR-F proof-gate skip-marker whitelist.

---

## 3. The single opener law (locked)

### 3.1 One-line law

The final-pass law, as the code already implements it in
`getSquatPostOwnerFinalPassBlockedReason(...)` and
`computeSquatPostOwnerPreLatchGateLayer(...)`, reads:

```text
completionTruthPassed
AND completionOwnerPassed
AND completionOwnerReason !== 'not_confirmed'
AND completionBlockedReason == null
AND cycleComplete
AND UI / progression gate clear
AND block-only vetoes clear
=> finalPassEligible / finalPassGranted / final latch may be true
```

Each conjunct is necessary. None of them is sufficient alone.
`completionOwnerReason` is an explanation label on top of this conjunction.
No reason label may substitute for the conjunction.

### 3.2 Role per field

| field | role | opener? |
|---|---|---|
| `completionTruthPassed` | required completion-state truth (derived from `completionSatisfied === true` and a valid non-`not_confirmed` `completionPassReason`) | necessary precondition only |
| `completionOwnerPassed` | required owner-adapter truth after completion-state invariants and contradiction enforcement | necessary precondition only |
| `completionOwnerReason` | explanation label attached to a passed owner truth | never an opener |
| `completionOwnerBlockedReason` | truthful cause when owner pass is not granted | never an opener |
| `finalPassEligible` | mirror of `progressionPassed` — final-pass surface output | final surface, not an upstream opener |
| `finalPassGranted` | `squatFinalPassTruth` mirror of the same final-pass surface | final surface, not an upstream opener |
| `finalPassLatched` / `isFinalPassLatched('squat', gate)` | progression latch consumer over the final-pass surface | consumes the surface, does not open |
| `canonicalShallowContractDrovePass` | sink-only diagnostic separating canonical shallow passes from the legacy assist label | explicitly never a gate input |
| `canonicalTemporalEpochOrderSatisfied` | close-guard truth consumed by the canonical close | close guard only, not pass ownership |

### 3.3 Where this law is enforced

The law is fully implemented in current `src/lib/camera`:

- `computeSquatCompletionOwnerTruth(...)`
  (`src/lib/camera/squat/squat-progression-contract.ts`) builds the
  completion-owner adapter from completion-state only. It never emits
  `completionOwnerReason === 'pass_core_detected'`.
- `readSquatPassOwnerTruth(...)`
  (`src/lib/camera/auto-progression.ts`) consumes that adapter and treats
  pass-core as a same-rep stale veto only, never as an opener.
- `enforceSquatOwnerContradictionInvariant(...)` fail-closes any
  owner-passed state that contradicts completion-state, including
  `not_confirmed`, a present `completionOwnerBlockedReason`, cycle not
  complete, and `completionTruthPassed !== true`.
- `getSquatPostOwnerFinalPassBlockedReason(...)` checks, in order,
  `completionTruthPassed`, `completionPassReason !== 'not_confirmed'`,
  `completionBlockedReason == null`, `cycleComplete`, owner-reason
  non-`not_confirmed`, `completionOwnerPassed`, and
  `uiGate.uiProgressionAllowed`. The first failing conjunct sets the
  truthful blocked reason.
- `computeSquatPostOwnerPreLatchGateLayer(...)` publishes
  `progressionPassed = (finalPassBlockedReason == null)` and
  `squatFinalPassTruth.finalPassGranted` over the same surface.
- `isFinalPassLatched('squat', gate)` consumes
  `gate.finalPassEligible` and `gate.finalPassBlockedReason`. It does
  not independently read completion-state, pass-core, or
  `canonicalShallowContractDrovePass`.

This PR does not change any of the above. It only aligns comment and
smoke wording so the law is stated once, consistently.

---

## 4. Classification of `pass_core_detected`

### 4.1 Locked classification

`completionOwnerReason === 'pass_core_detected'` is classified as
**Interpretation C** in the ambiguity resolution map
(§7 and §5 of `PR-CAM-SQUAT-AUTHORITY-LAW-AMBIGUITY-RESOLUTION-MAP.md`):

> Formally closed legacy label with no production assigner.

Concretely, this means:

1. No production code path in `src/` assigns
   `completionOwnerReason = 'pass_core_detected'`.
2. `computeSquatCompletionOwnerTruth(...)` only emits
   `completionPassReason` values (`'standard_cycle'`, `'low_rom_cycle'`,
   `'ultra_low_rom_cycle'`, event/recovery variants) plus the explicit
   shallow owner reasons `'shallow_complete_rule'` and
   `'ultra_low_rom_complete_rule'`.
3. `readSquatPassOwnerTruth(...)` propagates
   `completionOwnerTruth.completionOwnerReason` verbatim or returns
   `null`, and therefore never synthesizes `'pass_core_detected'` from
   pass-core-positive inputs.
4. The only surviving references to the string are:
   - narrow comments in `auto-progression.ts` and
     `squat-completion-core.ts` documenting the historical coexistence
     deferral;
   - the sink-only defensive guard in
     `canonicalShallowContractDrovePass` that excludes the label from
     the canonical-shallow-contract-drove-pass signal;
   - synthetic probes in the PR-01 authority-freeze smoke that use the
     label as an adversarial reason to prove it cannot open final pass;
   - synthetic probes in
     `scripts/camera-pr-cam-squat-blended-early-peak-false-pass-lock-01-smoke.mjs`
     with the same adversarial role.
5. Therefore `pass_core_detected` is not an active canonical opener,
   is not a sanctioned canonical owner reason, and is not a
   transitional coexistence reason in current code. It is a closed
   legacy marker retained solely for defense-in-depth and regression
   coverage.

### 4.2 What this classification forbids

Future PRs must not:

- treat `pass_core_detected` as a canonical opener reason;
- introduce a production assigner of
  `completionOwnerReason = 'pass_core_detected'`;
- weaken the `completionTruthPassed` requirement for any branch that
  carries this label;
- remove the PR-01 smoke coverage (`§5`, `§6`, `§10`, `§11`) that
  asserts the label cannot open final pass;
- rename or comment the label into a form that reads as an active
  production opener.

### 4.3 What this classification allows

Future PRs may:

- delete the label wholesale in a dedicated P2 cleanup PR once all
  defensive guards and smokes are explicitly confirmed redundant;
- tighten the defensive guard in `canonicalShallowContractDrovePass`
  once Interpretation C is considered exhaustively proved;
- keep the label as a historical trace/comment marker.

---

## 5. Illegal states (locked)

The following state combinations are illegal under current law and must
remain fail-closed by PR-01 smoke, the E1 representative smoke, and any
future smoke. This PR does not weaken them.

| illegal state | status |
|---|---|
| `completionTruthPassed === false` and `finalPassGranted === true` | absolute — PR-01 smoke §5 (including synthetic `pass_core_detected` owner reason) |
| `completionOwnerPassed !== true` and `finalPassEligible === true` | absolute — PR-01 smoke §2 |
| `completionOwnerReason === 'not_confirmed'` and owner pass true | absolute — PR-01 smoke §3 |
| `completionOwnerPassed === true` and `completionOwnerBlockedReason` non-null | absolute — PR-01 smoke §4 |
| `cycleComplete === false` and final pass true | absolute — PR-01 smoke §6 |
| `readSquatPassOwnerTruth(...)` emitting `completionOwnerReason === 'pass_core_detected'` from pass-core-positive inputs | absolute — PR-01 smoke §11 (new; locks Interpretation C) |
| `completionOwnerReason === 'pass_core_detected'` with synthetic owner pass and completion-false state opening final pass | absolute — PR-01 smoke §5, §10, §11d |
| `canonicalShallowContractDrovePass` read as a gate input | absolute — design SSOT §6.1 SL-1, PR-CAM-SQUAT-SHALLOW-AUTHORITY-SAFE-DESCENT-SOURCE-EXPANSION §6 |
| `canonicalTemporalEpochOrderSatisfied` used as pass ownership | absolute — PR-E1 landed status lock, PR-CAM-SQUAT-SHALLOW-TEMPORAL-EPOCH-ORDER-REALIGN |

---

## 6. What this PR changed

This PR is narrow. It does not change any runtime path.

### 6.1 Code comment alignment (no behavior change)

- `src/lib/camera/auto-progression.ts`
  - `canonicalShallowContractDrovePass` field doc: explicitly marks the
    `pass_core_detected` exclusion as a defensive diagnostic guard
    (Interpretation C) rather than a live separator between two
    production pass paths. Field remains sink-only.
  - `enforceSquatOwnerContradictionInvariant` header: explicitly
    states that `pass_core_detected` has no production assigner and is
    retained only as a synthetic probe in PR-01 smoke §5/§6/§10/§11.
  - `getSquatPostOwnerFinalPassBlockedReason` header: states the
    single opener law in one place and points to this resolution doc.
  - Inline `canonicalShallowContractDrovePass` computation comment:
    same Interpretation C note.
- `src/lib/camera/squat/squat-completion-core.ts`
  - `findLegitimateKinematicShallowDescentOnsetFrame` comment: marks
    the historical "coexistence deferral" as resolved by this PR and
    cites Interpretation C.
  - Branch B §7 inline comment: same resolution pointer, preserving
    the sink-only role of the exposed diagnostics.

These are documentation edits. No runtime semantics are altered.

### 6.2 PR-01 authority-freeze smoke (invariant lock)

- `scripts/camera-pr-01-squat-completion-first-authority-freeze-smoke.mjs`
  - Header: adds illegal state #7, pinning Interpretation C.
  - Adds §11 (Authority-law resolution), four new assertions:
    - §11a `readSquatPassOwnerTruth` with pass-core positive and valid
      standard completion state never emits
      `completionOwnerReason === 'pass_core_detected'`.
    - §11b `readSquatPassOwnerTruth` with pass-core positive and
      shallow completion state never emits the label.
    - §11c `readSquatPassOwnerTruth` with pass-core positive and
      completion truth false never emits the label, and owner pass
      stays false.
    - §11d synthetic `pass_core_detected` owner reason with
      completion-false state cannot open final pass via the post-owner
      pre-latch gate.
  - Total: 25/25 tests passing. No pre-existing assertion was weakened.

### 6.3 Documentation alignment

- This document (`docs/pr/PR-CAM-SQUAT-AUTHORITY-LAW-RESOLUTION.md`)
  is new. It is the single authority-law resolution SSOT.
- `docs/pr/PR-CAM-SQUAT-AUTHORITY-LAW-AMBIGUITY-RESOLUTION-MAP.md`
  receives a small "resolution landed" pointer at the top and in §10,
  so anyone reading the design map immediately knows the ambiguity is
  closed under Interpretation C.

No other docs are touched in this PR.

---

## 7. What this PR did not change

Nothing in runtime semantics changes. In particular:

- no threshold change;
- no shallow-detection, timing, epoch, or arming change;
- no pass/fail semantics change;
- no new opener path or widening of any existing opener;
- no change to `completionTruthPassed`, `completionOwnerPassed`,
  `completionOwnerReason`, `completionOwnerBlockedReason`,
  `completionBlockedReason`, `cycleComplete`, `finalPassEligible`,
  `finalPassGranted`, `finalPassLatched`, or
  `canonicalShallowContractDrovePass` production code;
- no change to the E1 representative promotion;
- no change to PR-F proof-gate skip markers;
- no change to any non-squat step;
- no change to any harness, fixture, or registry code.

---

## 8. Acceptance evidence

All of the following are green on current branch:

- `scripts/camera-pr-01-squat-completion-first-authority-freeze-smoke.mjs`
  — 25/25 tests passing (new §11 included).
- `scripts/camera-pr-e1-shallow-lock-promotion-registry-smoke.mjs`
  — 52/52 tests passing, both shallow representatives
  `permanent_must_pass` and the full six-bit canonical bundle locked.
- `scripts/camera-pr-f-regression-proof-gate.mjs`
  — all 11 mandatory proofs pass with no unexplained SKIP and the only
  permitted marker (`no PR-D broadening`) untouched.

No linter errors in the edited files.

---

## 9. Follow-on order (unchanged from design map §9)

1. **This PR — authority-law resolution** (landed by this change).
2. **P3 absurd-pass registry normalization**
   (`docs/pr/P3-SQUAT-ABSURD-PASS-REGISTRY-NORMALIZATION.md`) — may
   proceed now that the opener law is settled; must remain block-only
   and must not introduce any grant path.
3. **P2 authority naming/comment cleanup**
   (`docs/pr/P2-SQUAT-AUTHORITY-NAMING-COMMENT-CLEANUP.md`) — must
   preserve Interpretation C and the single opener law; cleanup may
   finalize legacy wording but may not relitigate the law.

---

## 10. Related reading

- `docs/SSOT_SQUAT_COMPLETION_FIRST_QUALITY_STRICT_2026_04.md`
- `docs/pr/PR-SQUAT-COMPLETION-FIRST-QUALITY-STRICT-TRUTH-MAP-01.md`
- `docs/pr/PR-01-SQUAT-COMPLETION-FIRST-AUTHORITY-FREEZE.md`
- `docs/pr/PR-CAM-SQUAT-AUTHORITY-LAW-AMBIGUITY-RESOLUTION-MAP.md`
- `docs/pr/PR-E1-shallow-representative-must-pass-landed-status-lock.md`
- `docs/pr/PR-F-shallow-real-path-permanent-lock-truth-map.md`
- `docs/pr/PR-E-residual-risk-closure-truth-map.md`
- `docs/pr/PR-CAM-SQUAT-SHALLOW-AUTHORITY-SAFE-DESCENT-SOURCE-EXPANSION.md`
- `docs/pr/PR-CAM-SQUAT-SHALLOW-ARMING-CYCLE-TIMING-REALIGN.md`
- `docs/pr/PR-CAM-SQUAT-SHALLOW-TEMPORAL-EPOCH-ORDER-REALIGN.md`
- `docs/pr/PR-CAM-SQUAT-SHALLOW-CURRENT-HANDOFF-SSOT-FOR-P4-E1.md`
- `docs/pr/P3-SQUAT-ABSURD-PASS-REGISTRY-NORMALIZATION.md`
- `docs/pr/P2-SQUAT-AUTHORITY-NAMING-COMMENT-CLEANUP.md`
