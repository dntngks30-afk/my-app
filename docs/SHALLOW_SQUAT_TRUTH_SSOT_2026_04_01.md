# MOVE RE CAMERA — SHALLOW SQUAT PASS BOTTLENECK SSOT

Date: 2026-04-01  
Scope: squat only / shallow-to-low-ROM pass bottleneck only  
Audience: Composer 2.0-first implementation agent, human reviewer, Sonnet fallback only when explicitly noted

---

## 0. Why this document exists

This document locks the **single problem surface** for the current squat bottleneck:

> "A meaningful shallow squat should be able to pass when the product contract is satisfied, but today the same shallow attempt is being rejected by multiple different layers at different times."

This document is intentionally **not** a general camera SSOT. It is a **problem-local SSOT** to prevent broad, unfocused edits and to keep Composer 2.0 operating inside narrow, regression-resistant PR boundaries.

---

## 1. Canonical product truth for this work

### 1.1 Non-negotiable product law

For squat, the product law remains:

- **Pass easily, judge strictly.**
- Pass is about **meaningful cycle completion**.
- Quality/interpretation is separate from pass.
- Standing / seated hold / jitter / single-frame peak must never pass.

### 1.2 What counts as a meaningful shallow squat

A meaningful shallow squat is **not** defined by deep depth.
It is defined by the following sequence:

1. valid attempt entry
2. meaningful downward motion
3. meaningful reversal or ascent-equivalent evidence
4. meaningful recovery toward standing
5. final close under the shallow/low-ROM contract

### 1.3 What this project is NOT trying to do in this work

This work is **not** trying to:

- improve quality scoring
- improve voice guidance
- improve live readiness UX
- tune deep squat scoring
- redesign overhead reach
- add ML confidence heads
- refactor the entire camera system

If a change is not directly required for shallow squat pass truth, it is out of scope.

---

## 2. Repo truth map for the shallow squat bottleneck

### 2.1 Files that currently participate in the bottleneck

Primary files:

- `src/lib/camera/squat-completion-state.ts`
- `src/lib/camera/squat/squat-completion-arming.ts`
- `src/lib/camera/squat/squat-reversal-confirmation.ts`
- `src/lib/camera/squat/squat-event-cycle.ts`
- `src/lib/camera/pose-features.ts`
- `src/lib/camera/auto-progression.ts`
- `src/lib/camera/evaluators/squat.ts`

### 2.2 Observed structure from current code

#### A. `pose-features.ts`
Owns shallow descent/ascent hints and the phase-label layer.
It already has guarded shallow descent/ascent helpers and uses shallow-specific thresholds.
This means the system is **not completely blind** to shallow motion.

#### B. `squat-completion-arming.ts`
Owns when the completion state machine is even allowed to begin.
This means a shallow attempt can be visible as motion but still fail before attempt truth is fully admitted.

#### C. `squat-completion-state.ts`
This is the main bottleneck hub.
It owns or touches:

- admission
- evidence label
- reversal contract
- standing finalize
- shallow path admission/closure
- trajectory rescue / tail backfill provenance
- event-cycle promotion
- completion blocked reason
- completion pass reason

This file is the system bottleneck because too many shallow-specific decisions converge here.

#### D. `squat-reversal-confirmation.ts`
Owns strict reversal and several guarded reversal assists.
This means reversal can be "seen" in one layer without being cleanly accepted by completion authority.

#### E. `squat-event-cycle.ts`
Owns shallow/low-ROM event-cycle detection, but **not** pass ownership.
This means it can detect a candidate cycle without actually producing success.

#### F. `auto-progression.ts`
Owns final UI/pass gating.
For the current uploaded observations, the main failures happen **before** final success emission.
So this file is downstream, not the primary root.

---

## 3. Observed truths from the uploaded shallow squat JSON

The uploaded JSON shows that the failure is **multi-stage**, not single-cause.

### 3.1 Blocker distribution

Observed blocker counts in the uploaded observation set:

- `not_armed`: 8
- `no_reversal`: 8
- `ultra_low_rom_not_allowed`: 8
- `not_standing_recovered`: 4
- `low_rom_standing_finalize_not_satisfied`: 3

This means the same shallow attempt family is being blocked by **different gates at different stages**.

### 3.2 Important meaning of those counts

This proves the issue is **not**:

- only phase detection
- only reversal
- only standing finalize
- only policy

It is a **contract-fragmentation problem**.

### 3.3 Critical contradiction observed in the JSON

In multiple observations:

- top-level observation shows `reversalConfirmedAfterDescend: true`
- nested completion observability shows `completion.reversalConfirmedAfterDescend: false`
- top-level recovery is true at the same time

This is a truth-alignment defect.

### 3.4 What the JSON proves the system already can do

The system already can, at least in some shallow attempts:

- observe shallow motion
- admit attempt start
- detect descend
- detect reversal-related evidence
- detect recovery-related evidence
- detect shallow event-cycle candidates

Therefore the current failure is **not** "shallow squat is invisible."  
It is: **the shallow pass path does not close consistently.**

---

## 4. Locked interpretation of the bottleneck

### 4.1 Canonical diagnosis

The current bottleneck is:

> The shallow squat path is fragmented across admission, reversal authority, ultra-low policy, standing finalize, and event-cycle promotion, so a meaningful shallow attempt can survive one layer and still die in the next under a different contract.

### 4.2 What must not be claimed

Agents must **not** claim any of the following as the sole cause:

- "arming is the cause"
- "reversal is the cause"
- "event-cycle is the cause"
- "low ROM finalize is the cause"
- "ultra-low policy is the cause"

Those are all participating layers. None is sufficient as a single-cause diagnosis.

### 4.3 Canonical failure families

The problem should be read as **three failure families**:

#### Family A — pre-attempt / admission fragmentation
Symptoms:

- shallow motion observed
- attempt-like motion observed
- but blocked as `not_armed`

#### Family B — ultra-low ROM closure fragmentation
Symptoms:

- shallow path admitted
- reversal/recovery-related evidence appears
- but final blocker becomes `ultra_low_rom_not_allowed`

#### Family C — low-ROM / shallow standard finalize fragmentation
Symptoms:

- reversal becomes strict/cleaner
- evidence may move to `standard`
- but final blocker becomes `not_standing_recovered` or `low_rom_standing_finalize_not_satisfied`

---

## 5. Hard scope lock for implementation

### 5.1 Allowed scope

Allowed:

- squat-only observability alignment
- shallow/low-ROM contract narrowing
- ultra-low policy clarification
- low-ROM finalize contract refinement
- event-cycle reliance reduction for shallow closure
- regression fixtures and invariants

### 5.2 Forbidden scope

Forbidden:

- overhead reach changes
- wall angel changes
- single-leg balance changes
- live readiness product redesign
- audio/voice changes
- full evaluator rewrites
- ML additions
- global confidence formula changes unrelated to squat bottleneck
- broad camera architecture refactor

### 5.3 Files that are default-locked unless explicitly listed in a PR

Do not modify unless a PR section explicitly allows it:

- any public UI routes
- any onboarding/auth/pay files
- any non-squat evaluator files
- database files
- unrelated docs

---

## 6. Global invariants for every PR in this roadmap

Every PR below must preserve all invariants unless the PR explicitly says otherwise.

### 6.1 Safety invariants

Must never introduce:

- pass without descend
- pass while standing still
- pass from seated hold only
- pass from jitter/noise
- single-frame peak pass

### 6.2 Ownership invariants

Must preserve:

- pass ownership must remain explicit and debuggable
- event-cycle must not silently become success owner unless the PR explicitly says so
- provenance and ownership must not be conflated

### 6.3 Scope invariants

Must preserve:

- quality interpretation remains separate from pass
- live readiness semantics remain separate from completion semantics
- setup-phase gating remains separate from quality scoring

### 6.4 PR discipline invariants

Each PR must:

- change only the listed files
- state what truth it owns
- state what it does **not** change
- include fixture/acceptance checks specific to that PR

---

## 7. Composer-first PR roadmap

This roadmap is designed so that **most work can be done in Composer 2.0 safely**, provided the agent stays inside the file locks and acceptance rules.

---

# PR-1 — SHALLOW TRUTH OBSERVABILITY ALIGNMENT

## Goal

Do not change pass thresholds.  
Do not change product policy.  
Only make shallow squat truth contradictions explicit and deterministic.

## Why this PR exists

Right now the JSON can say:

- top-level reversal = true
- nested completion reversal = false

That makes later PRs unstable because the agent cannot trust which field is authoritative.

## Allowed files only

- `src/lib/camera/squat-completion-state.ts`
- `src/lib/camera/evaluators/squat.ts`
- `src/lib/camera/auto-progression.ts`
- `docs/pr/PR-SHALLOW-TRUTH-OBSERVABILITY-ALIGN-01.md`

## Forbidden in this PR

- no threshold changes
- no policy changes
- no event-cycle gate relaxation
- no finalize logic changes
- no pass outcome changes by design

## Required changes

1. Add explicit observability fields that distinguish:
   - authoritative completion reversal truth
   - top-level observation reversal truth
   - provenance-only reversal evidence

2. Add invariant trace fields for mismatches:
   - `truthMismatch_reversalTopVsCompletion`
   - `truthMismatch_recoveryTopVsCompletion`
   - `truthMismatch_shallowAdmissionVsClosure`

3. Ensure JSON/debug output can show, in one place:
   - admitted shallow path?
   - closure proof present?
   - closure blocked by policy/finalize/reversal?

## Acceptance

- existing pass/fail behavior should remain unchanged
- contradiction cases become explicit in trace/debug output
- no new squat pass appears from this PR alone

## Composer suitability

**Composer 2.0 recommended.**  
This is a narrow observability PR, not a threshold PR.

---

# PR-2 — SHALLOW CONTRACT AUTHORITY SEPARATION

## Goal

Separate **shallow path contract** from broad standard-cycle logic without changing ultra-low policy yet.

## Why this PR exists

Currently shallow path admission and shallow path closure are spread across a very large completion file.  
The agent needs a tighter contract boundary before policy or finalize work can be changed safely.

## Allowed files only

- `src/lib/camera/squat-completion-state.ts`
- `src/lib/camera/squat/squat-reversal-confirmation.ts`
- `docs/pr/PR-SHALLOW-CONTRACT-AUTHORITY-02.md`

## Forbidden in this PR

- no ultra-low policy change
- no event-cycle promotion relaxation
- no auto-progression final gate change
- no arming algorithm rewrite

## Required changes

1. Extract or clearly isolate shallow contract checkpoints inside completion flow:
   - shallow admission
   - shallow reversal satisfaction
   - shallow closure proof
   - shallow policy blocker
   - shallow standing finalize blocker

2. Ensure one deterministic shallow close path exists in code structure, even if it still fails.

3. Prevent shallow attempts from drifting across multiple unrelated blocker families without an explicit stage label.

## Acceptance

For a shallow admitted attempt, the trace/debug chain must show exactly one of:

- blocked at reversal stage
- blocked at policy stage
- blocked at standing finalize stage
- shallow closed

No ambiguous mixed-stage blocker reporting.

## Composer suitability

**Composer 2.0 possible but requires strict file discipline.**  
Use Sonnet only if Composer keeps broadening scope.

---

# PR-3 — ULTRA-LOW-ROM POLICY LOCK

## Goal

Freeze the product truth for ultra-low ROM instead of leaving it half-admitted, half-blocked.

## Why this PR exists

The current repo already shows ultra-low path admission combined with final `ultra_low_rom_not_allowed` blocking.  
That ambiguity wastes debugging cycles.

## Product decision for this roadmap

For now:

- **ultra_low_rom remains non-passable**
- but it must fail **deterministically and early in policy stage**, not drift between reversal/finalize/promotion states first

This is a deliberate temporary truth to stabilize the system.

## Allowed files only

- `src/lib/camera/squat-completion-state.ts`
- `docs/pr/PR-ULTRA-LOW-ROM-POLICY-LOCK-03.md`

## Forbidden in this PR

- no low-ROM finalize retuning
- no event-cycle promotion retuning
- no auto-progression changes

## Required changes

1. Make ultra-low policy blocking explicit as a dedicated stage outcome.
2. Prevent ultra-low attempts from oscillating between:
   - `no_reversal`
   - `ultra_low_rom_not_allowed`
   - `not_standing_recovered`
   when the real terminal reason is policy.
3. Ensure debug/trace distinguishes:
   - ultra-low candidate seen
   - ultra-low closure proof possibly present
   - pass denied because policy lock, not because proof was invisible

## Acceptance

- ultra-low failures terminate as policy-blocked when appropriate
- blocker transition noise is reduced
- no new ultra-low pass is introduced

## Composer suitability

**Composer 2.0 strongly recommended.**  
This is a narrow policy-lock PR.

---

# PR-4 — LOW-ROM STANDING FINALIZE REWORK

## Goal

Allow meaningful shallow/low-ROM reps in the `~0.10–0.13` family to close without reopening standing/seated false positives.

## Why this PR exists

The uploaded observations show that even after cleaner reversal appears and evidence moves out of ultra-low, attempts still die at:

- `not_standing_recovered`
- `low_rom_standing_finalize_not_satisfied`

This is a separate bottleneck from ultra-low policy.

## Allowed files only

- `src/lib/camera/squat-completion-state.ts`
- `src/lib/camera/pose-features.ts` **only if absolutely required for finalize evidence alignment**
- `docs/pr/PR-LOW-ROM-STANDING-FINALIZE-REWORK-04.md`

## Forbidden in this PR

- no ultra-low policy change
- no event-cycle ownership change
- no auto-progression confidence change

## Required changes

1. Make low-ROM standing finalize a clearly separate contract from standard standing finalize.
2. Reuse existing evidence as much as possible:
   - recovery return continuity
   - recovery drop ratio
   - timing relations already present
3. Do not allow standard/deep seated shortcuts to leak through low-ROM logic.

## Acceptance

A shallow-but-meaningful attempt in the low-ROM family should be able to reach closure if:

- descend is real
- reversal is real
- recovery toward standing is real
- low-ROM finalize proof is satisfied

At the same time, the following must still fail:

- standing sway
n- seated hold without meaningful recovery
- single spike / fake reversal

## Composer suitability

**Composer 2.0 possible, but this is the highest-risk Composer PR so far.**  
Use the locked acceptance checks strictly.

---

# PR-5 — SHALLOW CLOSURE DECOUPLE FROM EVENT PROMOTION

## Goal

Reduce dependence on event-cycle promotion for shallow closure.

## Why this PR exists

Current observations show:

- event-cycle may detect something
- but promotion still fails
- shallow closure may already have meaningful proof

That means shallow pass may be over-coupled to a canonical event path that is too brittle for short shallow reps.

## Allowed files only

- `src/lib/camera/squat-completion-state.ts`
- `src/lib/camera/squat/squat-event-cycle.ts`
- `docs/pr/PR-SHALLOW-CLOSURE-DECOUPLE-EVENT-05.md`

## Forbidden in this PR

- no ultra-low policy change
- no low-ROM standing finalize retuning
- no global confidence/latch changes

## Required changes

1. Make it explicit whether shallow closure requires event promotion.
2. If shallow closure proof is already sufficient, allow closure without waiting on event promotion.
3. Keep event-cycle as observability/support if needed, but do not let it remain the accidental choke point.

## Acceptance

For shallow admitted, non-ultra-low attempts:

- failure due solely to `descent_weak` / `series_too_short` in event-cycle must not override already-satisfied shallow closure proof
- event-cycle may remain diagnostic/supporting, but not the sole blocker where shallow closure is otherwise complete

## Composer suitability

**Composer 2.0 recommended with strict file lock.**

---

# PR-6 — REGRESSION MATRIX AND FIXTURE LOCK

## Goal

Make future PRs safe by freezing the shallow squat failure families in fixtures.

## Why this PR exists

Without fixed regression cases, each future PR may repair one layer and silently break another.

## Allowed files only

- squat-related test/smoke/fixture files only
- `docs/pr/PR-SHALLOW-REGRESSION-MATRIX-06.md`

## Required fixture families

At minimum include these families:

1. **Family A** — shallow observed but `not_armed`
2. **Family B** — shallow admitted, reversal evidence present, ultra-low policy blocked
3. **Family C1** — low-ROM/shallow standard, reversal present, `not_standing_recovered`
4. **Family C2** — low-ROM/shallow standard, reversal + recovery present, `low_rom_standing_finalize_not_satisfied`
5. **Negative FP** — standing / seated hold / jitter must not pass

## Required assertions

- no contradictory reversal/recovery truth fields
- no silent blocker-family drift
- no pass for negative FP fixtures
- expected blocker family for each fixture remains stable

## Composer suitability

**Composer 2.0 strongly recommended.**
This is exactly the kind of deterministic, bounded work Composer handles well.

---

## 8. Execution order lock

Mandatory order:

1. PR-1 observability alignment
2. PR-2 shallow contract authority separation
3. PR-3 ultra-low policy lock
4. PR-4 low-ROM standing finalize rework
5. PR-5 shallow closure decouple from event promotion
6. PR-6 regression matrix lock

Why this order is mandatory:

- PR-1 gives trustworthy diagnostics
- PR-2 reduces multi-stage ambiguity
- PR-3 freezes policy truth before finalize work
- PR-4 fixes passable shallow reps
- PR-5 removes brittle dependency
- PR-6 locks the whole system against regression

---

## 9. Composer operating rules for this roadmap

### 9.1 Mandatory prompt style

Every Composer PR prompt must include:

- exact allowed files
- exact forbidden files
- what truth this PR owns
- what this PR explicitly does not change
- acceptance rules
- regression cases to preserve

### 9.2 Mandatory review rule

If the implementation changes any non-listed file, the PR is invalid.

### 9.3 Mandatory success rule

A PR is not considered complete because it "seems better."  
It is complete only when its acceptance rules are met **without violating the global invariants**.

---

## 10. Final working truth

The shallow squat bottleneck is not a single threshold bug.
It is a **multi-layer contract fragmentation bug**.

Therefore the correct recovery strategy is:

- narrow scope
- lock truth per layer
- separate policy from proof
- separate proof from ownership
- separate ownership from final UI gating
- freeze failure families in regression fixtures

This document is the working SSOT for that recovery.
