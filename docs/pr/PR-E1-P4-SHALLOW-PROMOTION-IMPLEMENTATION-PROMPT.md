# Implementation Prompt — P4 / E1 Shallow Promotion After Branch B

Use GPT-5.4 or an equivalently strong reasoning model.

This session is a **narrow promotion / hardening implementation session**.
It is **not** a new Branch B source-design session.
It is **not** an authority-law reconciliation session.
It is **not** a P2 naming cleanup session.
It is **not** a P3 registry-normalization session.

Branch B source implementation is already landed on canonical ref/main. The next task is to determine whether the representative shallow fixtures now satisfy the canonical shallow contract strongly enough to be promoted out of conditional state, and if so, harden that result into executable regression locks.

---

## Required reading order

Read these files first and treat them as binding, in this order:

1. `docs/SSOT_SQUAT_COMPLETION_FIRST_QUALITY_STRICT_2026_04.md`
2. `docs/pr/PR-SQUAT-COMPLETION-FIRST-QUALITY-STRICT-TRUTH-MAP-01.md`
3. `docs/pr/PR-01-SQUAT-COMPLETION-FIRST-AUTHORITY-FREEZE.md`
4. `docs/pr/P4-SQUAT-REGRESSION-HARNESS-HARDENING.md`
5. `docs/pr/PR-CAM-SQUAT-SHALLOW-AUTHORITY-SAFE-DESCENT-SOURCE-EXPANSION.md`
6. `docs/pr/PR-CAM-SQUAT-SHALLOW-AUTHORITY-SAFE-DESCENT-SOURCE-EXPANSION-IMPLEMENTATION-PROMPT.md`
7. `scripts/camera-pr-e1-shallow-lock-promotion-registry-smoke.mjs`
8. the current Branch B implementation on main:
   - `src/lib/camera/squat/squat-completion-core.ts`
   - `src/lib/camera/squat-completion-state.ts`
   - `src/lib/camera/auto-progression.ts`

Then inspect the current shallow-related smokes before editing.

---

## Mission

Implement the next safe post-Branch-B step:

**Promote representative shallow fixtures from `conditional_until_main_passes` to hard executable green ONLY if the canonical shallow contract now truly drives pass on current head.**

That means this session must do one of two things:

### Success path
If the representative shallow fixtures now truly pass canonically, then:
- harden them in the E1/P4 harness
- retire their temporary conditional status
- prove the promotion with executable smokes

### Stop path
If they still do not pass canonically, then:
- do NOT force promotion
- do NOT widen skip markers
- do NOT fake pass through assist-path wording
- stop and leave a narrow stop report instead of broadening scope

---

## Non-negotiable product law

Do not violate any of the following:

1. completion-owner truth is the only opener of final pass
2. pass-core / shallow-assist / closure-proof / bridge / event-cycle are not openers
3. absurd-pass registry remains block-only
4. threshold relaxation is forbidden
5. quality truth remains separate from pass truth

This session is about promotion and hardening, not changing the pass law.

---

## Simple product intent

Branch B added a new shallow-descent detector so the system can notice a real shallow squat earlier.

This session asks a much simpler yes/no question:

- **Do the two representative shallow fixtures now pass through the real canonical path?**

If yes:
- lock them as must-pass fixtures

If no:
- do not lie, do not promote, stop and report

---

## What counts as a real promotion

A fixture may be promoted only if all of the following are true on current head:

1. `completionTruthPassed === true`
2. `finalPassEligible === true`
3. `finalPassLatched === true`
4. the pass is not merely a `pass_core_detected` assist ambiguity
5. `canonicalShallowContractDrovePass === true`
6. PR-01 illegal states remain impossible
7. absurd-pass regression smokes remain green

If those conditions are not met, promotion is forbidden.

---

## Allowed scope

Primary expected files:

- `scripts/camera-pr-e1-shallow-lock-promotion-registry-smoke.mjs`
- one or more narrow shallow/promotion smokes if genuinely needed
- very narrow additive smoke helpers if required

Allowed product-code scope only if strictly necessary to expose already-landed canonical truth more accurately in diagnostics:

- `src/lib/camera/auto-progression.ts`
- `src/lib/camera/squat-completion-state.ts`

But prefer harness changes over runtime changes.

### Strong default
Assume this is primarily a **harness / promotion-state PR**, not a runtime-logic PR.

---

## Forbidden scope

Do **not** do any of the following:

- no new Branch B source redesign
- no threshold changes
- no fixture re-derivation
- no fake phaseHint injection
- no pass-core opener revival
- no authority-law rewrite
- no P2 naming/comment cleanup
- no P3 registry normalization
- no skip-marker expansion in PR-F as a substitute for promotion
- no broad non-squat work
- no UI / route / page changes

If promotion cannot be proven without doing those things, stop.

---

## Required decision rule before editing

You must first decide which of the two paths is true on current head.

### Path A — promotion is now valid
Choose this only if the representative fixtures satisfy the real canonical conditions listed above.

### Path B — promotion is still blocked
Choose this if either fixture still depends on conditional posture, assist ambiguity, or non-canonical pass semantics.

Do not mix these paths.

---

## Success-path requirements (only if Path A is true)

If promotion is valid, implement all of the following:

### 1. Promote the two representative fixtures in E1 registry
In `scripts/camera-pr-e1-shallow-lock-promotion-registry-smoke.mjs`, change the two representative entries:
- `shallow_92deg`
- `ultra_low_rom_92deg`

from:
- `conditional_until_main_passes`

to:
- `permanent_must_pass`

and remove the temporary skip reasoning that belonged only to the post-PR-01 residual-risk phase.

### 2. Make the promotion assertions canonical, not cosmetic
The hard-pass assertions must require at least:
- `completionTruthPassed === true`
- `finalPassEligible === true`
- `isFinalPassLatched('squat', gate) === true`
- `canonicalShallowContractDrovePass === true`

Do not allow promotion to pass on weaker wording.

### 3. Keep downgrade protection intact
The E1 harness must still hard-fail if a promoted fixture later stops passing.

### 4. Keep PR-01 invariants green
No `completion false / final pass true` drift may reappear.

### 5. Keep absurd-pass regressions green
No standing / seated / contaminated / stale / mixed-rep class may reopen.

---

## Stop-path requirements (only if Path B is true)

If promotion is still blocked, do NOT promote anything.

Instead:
- leave the E1 registry states unchanged
- create one narrow stop-report doc in `docs/pr/*`
- explain exactly which promotion precondition failed
- confirm that no runtime or harness broadening was landed

Recommended stop-report path:
- `docs/pr/PR-E1-P4-SHALLOW-PROMOTION-BLOCKED-REPORT.md`

The stop report must explicitly state whether the blocker is:
- canonical shallow contract still not driving pass, or
- `canonicalShallowContractDrovePass` not yet trustworthy for promotion, or
- assist-path ambiguity still unresolved for representative fixtures

---

## Mandatory smoke bundle for this session

Whether you promote or stop, you must run and report at minimum:

1. `scripts/camera-pr-cam-squat-shallow-authority-safe-descent-source-expansion-smoke.mjs`
2. `scripts/camera-pr-01-squat-completion-first-authority-freeze-smoke.mjs`
3. `scripts/camera-pr-e1-shallow-lock-promotion-registry-smoke.mjs`
4. the relevant absurd-pass regression smoke(s)

If promotion succeeds, these must all be green with no new conditional shortcuts.

If promotion fails, report which exact condition prevented safe promotion.

---

## Required promotion-proof checklist

Before promoting, prove all of the following for BOTH fixtures:

1. the fixture reaches a real canonical shallow pass on current head
2. `effectiveDescentStartFrameSource` may use the Branch B source when appropriate, but pass is still owned by completion truth
3. `canonicalShallowContractDrovePass === true`
4. `completionOwnerReason === 'pass_core_detected'` is not the only explanation for success
5. no PR-01 illegal state is observed in the resulting debug surface

If any of these fail for either fixture, promotion is forbidden.

---

## Explicit stop conditions

Stop immediately, rollback promotion edits, and emit only a stop report if any of these occur:

1. either representative fixture still fails canonical promotion criteria
2. promotion only works if you weaken assertions away from canonical truth
3. promotion only works if you broaden skip markers or preserve a hidden conditional state
4. promotion introduces any PR-01 illegal-state regression
5. promotion reopens any absurd-pass family
6. promotion depends on unresolved `pass_core_detected` ambiguity without `canonicalShallowContractDrovePass === true`

Do not compensate for failed promotion by widening harness semantics.

---

## Output requirements

When you finish, provide:

### If promotion succeeds
1. exact files changed
2. which registry entries were promoted
3. the exact hard-pass conditions now asserted
4. smoke results
5. confirmation that `canonicalShallowContractDrovePass === true` is part of the promotion proof
6. residual risks left for the later authority-law / P3 / P2 sessions

### If promotion is blocked
1. exact stop reason
2. which promotion-proof condition failed
3. confirmation that promotion edits were rolled back or not applied
4. path of the stop-report doc

---

## One-line lock

Promote `shallow_92deg` and `ultra_low_rom_92deg` out of conditional state only if the current head now yields true canonical shallow pass (`completionTruthPassed`, `finalPassEligible`, `finalPassLatched`, `canonicalShallowContractDrovePass`); otherwise stop cleanly and do not fake promotion.