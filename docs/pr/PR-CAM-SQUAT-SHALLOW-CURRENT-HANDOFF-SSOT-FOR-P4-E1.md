# PR-CAM-SQUAT-SHALLOW-CURRENT-HANDOFF-SSOT-FOR-P4-E1

> **Session type**: docs-only handoff SSOT.
>
> **Purpose**: summarize the currently locked shallow-squat camera state so the
> next room can start directly from **P4 / E1 promotion verification** without
> re-litigating earlier branches.
>
> **Current decision**: the next branch is **verification-first E1 promotion**.
> The representative shallow fixtures are reported to pass on the current real
> runtime path after the temporal epoch-order ledger work, but registry state is
> still intentionally left at `conditional_until_main_passes`. The next session
> must verify current-head truth and promote only if the full canonical proof is
> executable and green.

---

## 1. Scope Lock For This Handoff

This document is a carry-forward SSOT only.
It does **not** authorize:

- threshold relaxation
- fixture edits or fixture re-derivation
- authority-law rewrite
- pass-core opener revival
- proof-gate skip-marker expansion
- P2 naming/comment cleanup
- P3 registry normalization
- unrelated camera-stack rewrites

It exists only to transfer the current truth into the next room so that the
next room can execute **P4 / E1 promotion verification** cleanly.

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

The next blocker was temporal ordering. A structured normalized epoch-order
ledger was then designed and implemented so canonical shallow close could reason
about:
- descent
- peak
- reversal
- recovery

inside one same-rep valid-buffer coordinate system.

This direction is locked by the current design SSOT: ordering success is a
**close guard only**, not pass ownership.

### 2.6 Current reported runtime state

After the temporal epoch-order ledger implementation, the representative shallow
fixtures are reported to satisfy the real path rather than merely timing-only
subconditions. However, registry state was intentionally **not** promoted in the
same session.

So current head is in this state:

- runtime path reportedly passes for representative shallow fixtures
- registry still says `conditional_until_main_passes`
- next step must verify that the runtime proof is truly canonical and then, only
  if verified, promote to executable must-pass status

---

## 3. Current Locked Product Law

The following remain absolute:

1. completion-owner truth is the only opener of final pass
2. pass-core / shallow-assist / closure-proof / bridge / event-cycle are not openers
3. absurd-pass registry remains block-only
4. threshold relaxation is forbidden
5. quality truth remains separate from pass truth

Promotion verification must not violate any of the above.

---

## 4. Current Technical Truth To Carry Forward

The next room should assume the following as the current intended runtime shape:

### 4.1 Canonical timing truth
- selected canonical descent timing may come from `pre_arming_kinematic_descent_epoch`
- cycle timing visibility across the arming boundary is already implemented
- `minimum_cycle_timing_blocked` is no longer expected to be the first blocker on
  the representative shallow fixtures

### 4.2 Canonical temporal ordering truth
- canonical close now has a normalized same-rep epoch-order result available
- `canonicalTemporalEpochOrderSatisfied` is the preferred close-order input when present
- descent / peak / reversal / recovery should now be comparable in one valid-buffer
  coordinate system

### 4.3 Promotion boundary truth
The representative fixtures are **not yet promoted in registry** even if runtime
truth is now green.

That means the next room must not assume promotion is already earned.
It must verify the current head directly.

---

## 5. Exact Verification Question For The Next Room

The next room must answer exactly this:

> On current head, do `shallow_92deg` and `ultra_low_rom_92deg` now satisfy the
> full canonical promotion proof strongly enough to move from
> `conditional_until_main_passes` to `permanent_must_pass`?

The next room must not broaden beyond that question.

---

## 6. Promotion Proof Required In The Next Room

A fixture may be promoted only if **all** of the following are true on current
head for **both** representative fixtures:

1. `completionTruthPassed === true`
2. `finalPassEligible === true`
3. `isFinalPassLatched('squat', gate) === true`
4. `canonicalShallowContractDrovePass === true`
5. `canonicalTemporalEpochOrderSatisfied === true`
6. `canonicalShallowContractBlockedReason == null` or equivalent full-close state
7. no PR-01 illegal-state regression appears
8. no absurd-pass family flips to pass

If even one of these is missing for either fixture, promotion is blocked.

---

## 7. Exact Allowed Scope For The Next Room

Strong default:
- this should be a **verification / harness PR**, not a new runtime logic PR

Allowed by default:
- `scripts/camera-pr-e1-shallow-lock-promotion-registry-smoke.mjs`
- one narrow promotion-verification smoke if needed
- one stop-report doc if promotion fails

Runtime changes should be treated as out-of-scope by default.
Only if the verification room finds that current runtime truth is already green
but one required diagnostic is merely missing from the harness surface should a
very narrow additive diagnostic mirror be considered. Otherwise, runtime logic
should not be touched.

---

## 8. Exact Forbidden Scope For The Next Room

The next room must not do any of the following:

- no threshold relaxation
- no fixture edits or fixture cheat
- no pass-core opener revival
- no authority-law rewrite
- no proof-gate skip-marker expansion
- no P2 cleanup
- no P3 registry normalization
- no broad camera-stack rewrite
- no new Source #4 redesign
- no new arming/cycle-timing redesign
- no new temporal-order redesign

If promotion cannot be verified without any of the above, the correct action is
**stop and report**, not broaden.

---

## 9. Success Path For The Next Room

If both representative fixtures satisfy the full canonical promotion proof on
current head, the next room should:

1. promote `shallow_92deg` from `conditional_until_main_passes` to `permanent_must_pass`
2. promote `ultra_low_rom_92deg` from `conditional_until_main_passes` to `permanent_must_pass`
3. remove only the temporary conditional wording that belonged to the earlier
   residual-risk phase
4. keep PR-01 authority smokes green
5. keep absurd-pass smokes green
6. keep proof-gate green with no unexplained skip changes

Promotion assertions must stay canonical, not cosmetic.

---

## 10. Stop Path For The Next Room

If either representative fixture fails the proof in §6, the next room must:

1. leave registry unchanged
2. land no weakened assertion
3. land no skip-marker expansion
4. write one narrow blocked report only

Recommended blocked report path:
- `docs/pr/PR-E1-P4-SHALLOW-PROMOTION-VERIFICATION-BLOCKED-REPORT.md`

The report must say exactly which required proof bit was still missing.

---

## 11. Required Reading For The Next Room

The next room should begin from these files, in this order:

1. `docs/SSOT_SQUAT_COMPLETION_FIRST_QUALITY_STRICT_2026_04.md`
2. `docs/pr/PR-SQUAT-COMPLETION-FIRST-QUALITY-STRICT-TRUTH-MAP-01.md`
3. `docs/pr/PR-01-SQUAT-COMPLETION-FIRST-AUTHORITY-FREEZE.md`
4. `docs/pr/PR-CAM-SQUAT-SHALLOW-AUTHORITY-SAFE-DESCENT-SOURCE-EXPANSION.md`
5. `docs/pr/PR-CAM-SQUAT-SHALLOW-ARMING-CYCLE-TIMING-REALIGN.md`
6. `docs/pr/PR-CAM-SQUAT-SHALLOW-TEMPORAL-EPOCH-ORDER-REALIGN.md`
7. `docs/pr/PR-CAM-SQUAT-SHALLOW-CURRENT-HANDOFF-SSOT-FOR-P4-E1.md`
8. `docs/pr/PR-E1-P4-SHALLOW-PROMOTION-VERIFICATION-IMPLEMENTATION-PROMPT.md`

---

## 12. Final Lock

The next room starts from this truth:

- the shallow detector branch is already implemented
- the baseline bug is already fixed
- the arming/cycle-timing handoff is already implemented
- the normalized temporal epoch-order ledger is already implemented
- registry promotion has **not** yet been granted

So the next room must not redesign earlier layers.
It must do one thing only:

**verify current-head canonical shallow truth and promote E1 only if the full proof is green for both representative shallow fixtures.**
