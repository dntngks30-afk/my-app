# Implementation Prompt — P4 / E1 Shallow Promotion Verification

> **HISTORICAL — SESSION COMPLETE ON MAIN.** The verification-first promotion pass this prompt described has **landed**: both representatives are **`permanent_must_pass`** with full canonical assertions in `scripts/camera-pr-e1-shallow-lock-promotion-registry-smoke.mjs`. Use **`docs/pr/PR-E1-shallow-representative-must-pass-landed-status-lock.md`** and the updated **`docs/pr/PR-CAM-SQUAT-SHALLOW-CURRENT-HANDOFF-SSOT-FOR-P4-E1.md`** for current work. Retain this file only as a record of the completed mission shape.

Use GPT-5.4 or an equivalently strong reasoning model.

This session is a **verification-first promotion implementation session**.
It is **not** a new detector-design session.
It is **not** a new arming/cycle-timing redesign session.
It is **not** a new temporal epoch-order redesign session.
It is **not** an authority-law rewrite session.
It is **not** a P2 / P3 cleanup session.

**Archival context:** When this prompt was authored, registry was still conditional while runtime was reported green; the session goal was verify-then-promote. **On current main that work is complete** — both representatives are `permanent_must_pass` with full canonical proof in `scripts/camera-pr-e1-shallow-lock-promotion-registry-smoke.mjs`. See `docs/pr/PR-E1-shallow-representative-must-pass-landed-status-lock.md`. The sections below record the proof bar and constraints for reference.

---

## Required reading order

Read these files first and treat them as binding, in this order:

1. `docs/SSOT_SQUAT_COMPLETION_FIRST_QUALITY_STRICT_2026_04.md`
2. `docs/pr/PR-SQUAT-COMPLETION-FIRST-QUALITY-STRICT-TRUTH-MAP-01.md`
3. `docs/pr/PR-01-SQUAT-COMPLETION-FIRST-AUTHORITY-FREEZE.md`
4. `docs/pr/PR-CAM-SQUAT-SHALLOW-AUTHORITY-SAFE-DESCENT-SOURCE-EXPANSION.md`
5. `docs/pr/PR-CAM-SQUAT-SHALLOW-ARMING-CYCLE-TIMING-REALIGN.md`
6. `docs/pr/PR-CAM-SQUAT-SHALLOW-TEMPORAL-EPOCH-ORDER-REALIGN.md`
7. `docs/pr/PR-CAM-SQUAT-SHALLOW-CURRENT-HANDOFF-SSOT-FOR-P4-E1.md`
8. `docs/pr/PR-E1-shallow-representative-must-pass-landed-status-lock.md` (current main registry + proof posture)
9. current relevant runtime files on main:
   - `src/lib/camera/squat/squat-completion-core.ts`
   - `src/lib/camera/squat/shallow-completion-contract.ts`
   - `src/lib/camera/squat/squat-completion-canonical.ts`
   - `src/lib/camera/auto-progression.ts`
10. current relevant smokes:
   - `scripts/camera-pr-cam-squat-shallow-authority-safe-descent-source-expansion-smoke.mjs`
   - `scripts/camera-pr-cam-squat-shallow-authority-safe-descent-source-followup-smoke.mjs`
   - `scripts/camera-pr-cam-squat-shallow-arming-cycle-timing-realign-smoke.mjs`
   - `scripts/camera-pr-cam-squat-shallow-temporal-epoch-order-realign-smoke.mjs`
   - `scripts/camera-pr-01-squat-completion-first-authority-freeze-smoke.mjs`
   - `scripts/camera-pr-e1-shallow-lock-promotion-registry-smoke.mjs`
   - `scripts/camera-pr-f-regression-proof-gate.mjs`

Then inspect the current head before editing.

---

## Session mission (archival — answered on main)

Answer one narrow question and act only within that answer:

**On current head, do `shallow_92deg` and `ultra_low_rom_92deg` now satisfy the full canonical promotion proof strongly enough to move from `conditional_until_main_passes` to `permanent_must_pass`?**

This session has only two valid outcomes:

### Outcome A — promotion is verified and lands
You prove that both representative fixtures satisfy the full canonical promotion proof on current head, and you promote them in the E1 harness.

### Outcome B — promotion remains blocked
You prove that one or more required proof bits are still missing for either fixture, and you do **not** promote anything. Instead, you leave registry unchanged and write one narrow blocked report.

There is no third path where you widen scope, weaken assertions, or silently preserve hidden conditionality.

---

## Simple explanation of the intended task

Earlier branches fixed:
- shallow detector visibility
- baseline seeding
- arming/cycle-timing handoff
- temporal epoch ordering

Now the only question is:
- are the representative shallow fixtures truly green on the real canonical path?

If yes, lock that in as must-pass.
If no, stop and say exactly why.

---

## Non-negotiable product law

These are absolute. Do not violate them.

1. completion-owner truth is the only opener of final pass
2. pass-core / shallow-assist / closure-proof / bridge / event-cycle are not openers
3. absurd-pass registry remains block-only
4. threshold relaxation is forbidden
5. quality truth remains separate from pass truth

Promotion verification must not weaken any of the above.

---

## Strong default scope

Treat this as a **harness / verification PR**, not a runtime-logic PR.

Primary expected files:
- `scripts/camera-pr-e1-shallow-lock-promotion-registry-smoke.mjs`
- one narrow promotion-verification smoke if genuinely needed
- one narrow blocked-report doc in `docs/pr/*` if promotion fails

### Runtime code changes are forbidden by default
Only if the runtime truth is already clearly green but one required proof bit is inaccessible to the harness due to a missing additive diagnostic mirror may you make a **very narrow additive diagnostics-only change**.
No runtime behavior changes are allowed in this session.

---

## Forbidden scope

Do **not** do any of the following:

- no threshold changes of any kind
- no fixture edits or fixture re-derivation
- no fake `phaseHint` injection
- no pass-core opener revival
- no authority-law rewrite
- no new detector redesign
- no new arming/cycle-timing redesign
- no new temporal-order redesign
- no P3 registry normalization
- no P2 naming/comment cleanup
- no PR-F skip-marker expansion
- no broad non-squat work
- no UI / route / page changes

If promotion cannot be verified without any of the above, stop.

---

## Exact promotion proof required

A fixture may be promoted only if **all** of the following are true on current head:

1. `completionTruthPassed === true`
2. `finalPassEligible === true`
3. `isFinalPassLatched('squat', gate) === true`
4. `canonicalShallowContractDrovePass === true`
5. `canonicalTemporalEpochOrderSatisfied === true`
6. `canonicalShallowContractBlockedReason == null` or equivalent full-close success state
7. no PR-01 illegal-state regression appears
8. no absurd-pass family flips to pass

These conditions must hold for **both** representative fixtures:
- `shallow_92deg`
- `ultra_low_rom_92deg`

If even one condition fails for either fixture, promotion is forbidden.

---

## Success-path implementation requirements

If the proof in the previous section is satisfied for both fixtures, implement all of the following:

### 1. Promote both representative fixtures in E1 registry
In `scripts/camera-pr-e1-shallow-lock-promotion-registry-smoke.mjs`, change:
- `shallow_92deg`
- `ultra_low_rom_92deg`

from:
- `conditional_until_main_passes`

to:
- `permanent_must_pass`

### 2. Make promotion assertions canonical, not cosmetic
The hard-pass assertions must require at least:
- `completionTruthPassed === true`
- `finalPassEligible === true`
- `isFinalPassLatched('squat', gate) === true`
- `canonicalShallowContractDrovePass === true`
- `canonicalTemporalEpochOrderSatisfied === true`

Do not allow weaker wording such as “timing improved” or “contract no longer blocked by X”.

### 3. Remove only temporary conditional wording
Remove only the temporary conditional wording / skip reasoning that belonged to the earlier residual-risk phase for these two representative entries.
Do not broaden or rewrite unrelated registry entries.

### 4. Keep downgrade protection intact
The harness must hard-fail if a promoted fixture later stops passing.

### 5. Keep all safety families green
PR-01 illegal states and absurd-pass families must remain green.

---

## Blocked-path implementation requirements

If promotion is still blocked, do NOT promote anything.

Instead:
- leave the E1 registry states unchanged
- land no weakened assertion
- land no new conditional skip state
- write one narrow blocked report only

Recommended blocked-report path:
- `docs/pr/PR-E1-P4-SHALLOW-PROMOTION-VERIFICATION-BLOCKED-REPORT.md`

The blocked report must explicitly say which required proof bit failed and for which fixture(s).

---

## Required smoke / validation bundle

Whether you promote or stop, you must run and report at minimum:

1. `scripts/camera-pr-cam-squat-shallow-authority-safe-descent-source-expansion-smoke.mjs`
2. `scripts/camera-pr-cam-squat-shallow-authority-safe-descent-source-followup-smoke.mjs`
3. `scripts/camera-pr-cam-squat-shallow-arming-cycle-timing-realign-smoke.mjs`
4. `scripts/camera-pr-cam-squat-shallow-temporal-epoch-order-realign-smoke.mjs`
5. `scripts/camera-pr-01-squat-completion-first-authority-freeze-smoke.mjs`
6. `scripts/camera-pr-e1-shallow-lock-promotion-registry-smoke.mjs`
7. `scripts/camera-pr-f-regression-proof-gate.mjs`

If promotion succeeds, all of these must be green with no new conditional shortcut.
If promotion fails, your report must show which exact proof condition prevented safe promotion.

---

## Explicit stop conditions

Stop immediately, rollback promotion edits, and emit only a blocked report if any of these are true:

1. either representative fixture fails any required proof bit
2. promotion only works if you weaken assertions away from canonical truth
3. promotion only works if you broaden skip markers or preserve hidden conditionality
4. promotion introduces any PR-01 illegal-state regression
5. promotion reopens any absurd-pass family
6. promotion depends on unresolved assist ambiguity without `canonicalShallowContractDrovePass === true`
7. promotion requires any runtime behavior change

Do not compensate for failed promotion by widening harness semantics.

---

## Output requirements

### If promotion succeeds
Provide:
1. exact files changed
2. which registry entries were promoted
3. the exact hard-pass conditions now asserted
4. smoke results
5. confirmation that `canonicalShallowContractDrovePass === true` and `canonicalTemporalEpochOrderSatisfied === true` are part of the promotion proof
6. residual risks left for later authority-law / P3 / P2 sessions

### If promotion is blocked
Provide:
1. exact stop reason
2. which promotion-proof condition failed
3. confirmation that promotion edits were rolled back or not applied
4. path of the blocked-report doc

---

## One-line lock

Promote `shallow_92deg` and `ultra_low_rom_92deg` out of conditional state only if current head now yields full canonical shallow proof (`completionTruthPassed`, `finalPassEligible`, `finalPassLatched`, `canonicalShallowContractDrovePass`, `canonicalTemporalEpochOrderSatisfied`); otherwise stop cleanly and do not fake promotion.