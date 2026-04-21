# PR-CAM-SQUAT-SHALLOW-CURRENT-HANDOFF-SSOT-FOR-P4-E1

> **Session type:** docs-only handoff SSOT.
>
> **Purpose:** summarize **current main** shallow-squat camera state after **E1 representative promotion has landed**, so the next room does not re-run a completed verification-first promotion loop.
>
> **Status lock (current main):** `shallow_92deg` and `ultra_low_rom_92deg` are **`permanent_must_pass`** in `scripts/camera-pr-e1-shallow-lock-promotion-registry-smoke.mjs`, with the full canonical authority bundle asserted in that smoke. Authoritative one-page summary: `docs/pr/PR-E1-shallow-representative-must-pass-landed-status-lock.md`.

---

## 1. Scope Lock For This Handoff

This document is a carry-forward SSOT only.
It does **not** authorize:

- threshold relaxation
- fixture edits or fixture re-derivation
- authority-law rewrite
- pass-core opener revival
- proof-gate skip-marker expansion beyond the allowlist in `camera-pr-f-regression-proof-gate.mjs`
- P2 naming/comment cleanup
- P3 registry normalization
- unrelated camera-stack rewrites

The **completed** promotion step was **verification / registry lock**, not a new runtime broadening PR.

---

## 2. Locked History Up To Current Head

### 2.1 Branch A was falsified

The old hypothesis that the synthetic shallow fixtures were the primary problem
was rejected. Real shallow data did not outperform the fixture path in the way
Branch A required. The project moved to Branch B.

### 2.2 Branch B detector expansion was implemented

A new shallow detector family was added so that legitimate shallow descent could
be seen earlier without changing pass ownership.

Key rule that remains locked:

- the detector is timing evidence only
- it is **not** a final-pass opener

### 2.3 Source #4 baseline bug was fixed

A baseline-sourcing bug caused the shallow detector to evaluate from a descent
median instead of a standing baseline. That bug was fixed by seeding the
standing knee-angle baseline across the gate boundary.

### 2.4 Structured arming epoch handoff was implemented

A structured pre-arming descent epoch was carried across the arming boundary so
canonical timing could use the true same-rep descent start instead of only the
slice-local start.

Result:

- `minimum_cycle_timing_blocked` stopped being the first blocker for the two
  representative shallow fixtures.

### 2.5 Structured normalized temporal epoch-order ledger was implemented

Temporal ordering was addressed with a structured normalized epoch-order ledger so canonical shallow close could reason about descent, peak, reversal, and recovery inside one same-rep valid-buffer coordinate system.

This direction remains locked by design SSOT: **ordering success is a close guard only**, not pass ownership.

### 2.6 E1 representative promotion **landed** (current main)

Verification and harness work **promoted** both representatives from the earlier conditional posture to **`permanent_must_pass`**, with executable assertions for:

- `completionTruthPassed`
- `finalPassEligible`
- `isFinalPassLatched('squat', gate)`
- `canonicalShallowContractDrovePass`
- `canonicalTemporalEpochOrderSatisfied`
- `canonicalShallowContractBlockedReason == null`

`scripts/camera-pr-f-regression-proof-gate.mjs` continues to enforce the full bundle; **unexplained** `SKIP` is forbidden. The sole recognized non-representative skip marker in that gate remains **`no PR-D broadening`**.

---

## 3. Current Locked Product Law

The following remain absolute:

1. completion-owner truth is the only opener of final pass
2. pass-core / shallow-assist / closure-proof / bridge / event-cycle are not openers
3. absurd-pass registry remains block-only
4. threshold relaxation is forbidden
5. quality truth remains separate from pass truth

`canonicalTemporalEpochOrderSatisfied` is **close-order / guard** input when present; it does **not** replace completion-owner pass ownership.

---

## 4. Current Technical Truth To Carry Forward

### 4.1 Canonical timing truth

- selected canonical descent timing may come from `pre_arming_kinematic_descent_epoch`
- cycle timing visibility across the arming boundary is implemented
- `minimum_cycle_timing_blocked` is not expected to be the first blocker on the representative shallow fixtures on main

### 4.2 Canonical temporal ordering truth

- canonical close has a normalized same-rep epoch-order result available
- `canonicalTemporalEpochOrderSatisfied` is the preferred close-order input when present

### 4.3 Promotion boundary truth (**landed**)

The two E1 representatives are **`permanent_must_pass`** on main. The next room must **preserve** that lock, not re-litigate whether promotion is still “pending verification.”

---

## 5. What The Next Room Is **Not** Being Asked To Do

Obsolete framing (do **not** use as current work):

- “Verification-first E1 promotion” as the **next** branch — that loop completed on main.
- “Registry still says `conditional_until_main_passes` for the two representatives” — false on current main.

---

## 6. Exact Allowed Scope For The Next Room (default)

Strong default:

- **no** new shallow runtime redesign
- **no** registry downgrade
- **no** skip-marker expansion

If a regression appears, the correct response is **fix the regression** inside existing law or **stop with a narrow report** — not conditionalize the representatives again without an explicit, law-compliant SSOT decision.

---

## 7. Exact Forbidden Scope For The Next Room

The next room must not do any of the following:

- threshold relaxation
- fixture edits or fixture cheat
- pass-core opener revival
- authority-law rewrite
- proof-gate skip-marker expansion (beyond what `camera-pr-f-regression-proof-gate.mjs` already allows)
- P2 cleanup (unless a dedicated P2 prompt authorizes it)
- P3 registry normalization (unless a dedicated P3 prompt authorizes it)
- broad camera-stack rewrite
- new Source #4 redesign
- new arming/cycle-timing redesign
- new temporal-order redesign

---

## 8. Success Path For Maintenance

Keep these green on current head:

1. `scripts/camera-pr-e1-shallow-lock-promotion-registry-smoke.mjs`
2. `scripts/camera-pr-f-regression-proof-gate.mjs`
3. PR-01 authority freeze smoke and absurd-pass perimeter as already required by the proof bundle

---

## 9. Stop Path For Regressions

If either representative fails the E1 smoke’s permanent path:

1. do not silently demote to conditional skip
2. do not widen skip markers to hide the failure
3. write a narrow blocked or regression report naming the first missing proof bit

---

## 10. Required Reading For The Next Room

1. `docs/pr/PR-E1-shallow-representative-must-pass-landed-status-lock.md`
2. `docs/SSOT_SQUAT_COMPLETION_FIRST_QUALITY_STRICT_2026_04.md`
3. `docs/pr/PR-SQUAT-COMPLETION-FIRST-QUALITY-STRICT-TRUTH-MAP-01.md`
4. `docs/pr/PR-01-SQUAT-COMPLETION-FIRST-AUTHORITY-FREEZE.md`
5. `docs/pr/PR-CAM-SQUAT-SHALLOW-AUTHORITY-SAFE-DESCENT-SOURCE-EXPANSION.md`
6. `docs/pr/PR-CAM-SQUAT-SHALLOW-ARMING-CYCLE-TIMING-REALIGN.md`
7. `docs/pr/PR-CAM-SQUAT-SHALLOW-TEMPORAL-EPOCH-ORDER-REALIGN.md`
8. `docs/pr/PR-CAM-SQUAT-SHALLOW-CURRENT-HANDOFF-SSOT-FOR-P4-E1.md` (this file)

---

## 11. Final Lock

The next room starts from this truth:

- Branch B shallow visibility, baseline fix, arming handoff, and temporal epoch-order ledger are **landed**
- E1 representative registry promotion to **`permanent_must_pass`** is **landed**
- **Remaining** authorized follow-ons are **authority-law clarity**, then **P3**, then **P2** — not re-running the completed E1 promotion verification handoff
