# PR-RF-STRUCT-11D — Success Latch ↔ Page Navigation Contract

> This PR follows `docs/REFACTORING_SSOT_2026_04.md`, `docs/REFACTORING_SSOT_2026_04_STRUCTURAL_TOP10.md`, and the STRUCT-11 series documents. It is a **design SSOT only** for behavior-preserving boundary cleanup.

## 1. Title

**PR-RF-STRUCT-11D — Success Latch ↔ Page Navigation Contract**

Behavior-preserving structural freeze for the handoff boundary between **library latch truth** and **page-level success/navigation orchestration** in the squat camera step.

---

## 2. Problem Statement

PR-RF-STRUCT-11A unified the squat owner-truth read boundary.
PR-RF-STRUCT-11B froze the **post-owner / pre-latch** gate layer.
PR-RF-STRUCT-11C then froze the readiness/setup source routing that feeds that gate.

That means the upstream decision path is now sufficiently separated as:

**owner truth → UI gate → final blocker chain → latch truth candidate**

What remains unresolved is the next boundary:

**when a success/latch condition exists, how is that truth handed off to page-level orchestration without page logic silently becoming a second pass owner?**

Today the squat page still owns a substantial amount of success-side behavior:

- `finalPassLatched`
- `effectivePassLatched = finalPassLatched || passLatched`
- `latchPassEvent()`
- `passLatchedStepKeyRef`
- `scheduledAdvanceStepKeyRef`
- `triggeredAdvanceStepKeyRef`
- `advanceLockRef`
- `autoAdvanceTimerRef`
- `navigationTriggered`
- diagnostic freeze branching
- modal hold branching
- `router.push(nextPath)` handoff

This is not automatically wrong.
But the contract is not yet frozen as a distinct layer, so the current structure still risks blur between:

- **domain success truth**
- **UI success freeze state**
- **auto-advance scheduling state**
- **actual route transition state**

11D does **not** redesign the user flow.
It freezes the boundary so the page remains an orchestration consumer only.

---

## 3. Scope

This PR is limited to the **success latch ↔ page navigation handoff** for the squat capture page.

Included:

- Freeze the handoff boundary from library latch truth into page success orchestration
- Clarify ownership of:
  - `finalPassLatched`
  - `passLatched`
  - `effectivePassLatched`
  - `latchPassEvent()`
  - success freeze overlays
  - auto-advance scheduling refs/state
  - actual `router.push(nextPath)` transition
- Separate:
  - truth that success is allowed/open
  - truth that the page has latched that success for the current step key
  - truth that auto-advance has been scheduled
  - truth that navigation was actually triggered
- Preserve current route destinations and timing values

Excluded:

- pass/fail semantics
- owner truth semantics
- UI gate/final blocker semantics
- readiness/setup input semantics
- route flow redesign
- voice cue redesign
- success/failure overlay redesign
- modal UX redesign
- trace schema redesign

---

## 4. Non-goals

This PR must **not**:

- change `evaluateExerciseAutoProgress(...)` meaning
- change `isFinalPassLatched(...)` meaning
- change `finalPassEligible` / `finalPassBlockedReason` meaning
- change navigation timing constants such as `SQUAT_AUTO_ADVANCE_MS`
- change route destinations (`nextPath`, fallback paths)
- change diagnostic freeze semantics
- change debug modal semantics
- change voice behavior semantics
- change readiness/setup routing again
- change page copy/UI text

11D is **contract freeze only**.

---

## 5. 11C Result Review

### 5.1 What 11C got right

11C should be treated as structurally successful for its intended layer.

Current repo state now contains explicit routing helpers in `src/lib/camera/auto-progression.ts`:

- `readSquatSetupTruthWithCompatFallback(...)`
- `resolveSquatReadinessSetupGateInputs(...)`

And squat main-path gate input assembly now consumes routed readiness/setup values instead of inline mixed-source composition.
That means 11D does **not** need to reopen source provenance questions from 11C.

### 5.2 What 11C intentionally did not solve

11C stopped at the gate-input boundary.
It did not change page-level orchestration ownership for:

- `finalPassLatched`
- `passLatched`
- `effectivePassLatched`
- `latchPassEvent()`
- timer scheduling
- route push conditions

That is correct.
This remaining page-side contract belongs to 11D.

### 5.3 Review verdict

**Verdict: PASS with page handoff/orchestration debt intentionally left for 11D.**

11C does not need rollback.
It narrows 11D by removing readiness/setup ambiguity from the handoff problem.

---

## 6. User-visible Truth To Preserve

The following user-facing behavior must remain unchanged:

1. Once a real squat pass is opened, the page may visually freeze success and move to the next step.
2. The page must not navigate before a valid pass/latch condition exists.
3. The page must not navigate twice for the same capture step.
4. Diagnostic freeze mode must still be able to hold on the success scene instead of auto-advancing.
5. Debug modal hold must still be able to delay navigation in dev flow without redefining pass truth.
6. Retry/fail flows must remain unchanged.
7. Route destinations and timer values must remain unchanged.

---

## 7. Current Handoff Contract Map

## 7.1 Library-side truth surfaces

From `src/lib/camera/auto-progression.ts`, the library currently produces the domain-side success candidate:

- `progressionPassed`
- `finalPassEligible`
- `finalPassBlockedReason`
- `isFinalPassLatched(...)`

For squat, `isFinalPassLatched(...)` returns `finalPassEligible` when present, which makes the library the domain source for “success may open now.”

## 7.2 Page-side latch/orchestration surfaces

From `src/app/movement-test/camera/squat/page.tsx`, the page currently owns:

- `const finalPassLatched = isFinalPassLatched(STEP_ID, gate)`
- `const effectivePassLatched = finalPassLatched || passLatched`
- `latchPassEvent()`
- `passLatchedStepKeyRef`
- `scheduledAdvanceStepKeyRef`
- `triggeredAdvanceStepKeyRef`
- `navigationTriggered`
- `advanceLockRef`
- `autoAdvanceTimerRef`
- success freeze overlay branch
- debug modal hold branch
- final `router.push(nextPath)`

So the page currently owns both:

- **success orchestration state**
- **route execution state**

That is acceptable only if the contract is explicit.

## 7.3 Current phase sequence

Current squat success sequence is effectively:

1. page computes `gate`
2. page computes `finalPassLatched`
3. page derives `effectivePassLatched = finalPassLatched || passLatched`
4. if capture-phase and `effectivePassLatched`, page calls or reuses `latchPassEvent()`
5. `latchPassEvent()` stamps pass-latched state, snapshots, terminal bundle, stop capture, and success state
6. another effect schedules auto-advance if not diagnostic-freeze and not already triggered
7. timer callback eventually executes `router.push(nextPath)` unless held by modal/freeze/step-key guards

The important observation is:

- page is not deciding whether squat motion passed
- but page **is** deciding whether and when that pass becomes a one-shot success event and route transition

That page-side decision must be structurally frozen as orchestration only.

---

## 8. Structural Bottlenecks

### Bottleneck 1 — `effectivePassLatched` blends domain truth and local page truth

`effectivePassLatched = finalPassLatched || passLatched` is practical, but it mixes:

- library-side current latch truth
with
- page-side already-latched memory

Without an explicit contract, it is easy for future code to treat `effectivePassLatched` as if it were a new success owner.

### Bottleneck 2 — `latchPassEvent()` is both state latch and side-effect bundle

`latchPassEvent()` currently does multiple jobs at once:

- guards step-key idempotency
- sets page latch state
- stops capture
- records snapshots/bundles
- updates UI state
- may indirectly drive later navigation

This is workable, but it obscures which part is:

- truth consumption
- idempotent page latch
- observability side effect

### Bottleneck 3 — Scheduling truth and navigation truth are separate but not formally named

There are at least three distinct truths on page:

- success is allowed/open
- success was latched for this step key
- navigation was scheduled / triggered

Today these are spread across several refs/states. The behavior is mostly correct, but the ownership boundary is still implicit.

### Bottleneck 4 — Dev/diagnostic branches sit on the same handoff path

Diagnostic freeze mode and debug modal hold are legitimate orchestration consumers.
But because they sit on the same path as normal auto-advance, they can blur whether they are:

- delaying navigation only
or
- redefining pass truth

11D must lock that they are **navigation consumers only**.

### Bottleneck 5 — Step-key idempotency is operationally present but not yet frozen as contract

The page already uses:

- `currentStepKey`
- `passLatchedStepKeyRef`
- `scheduledAdvanceStepKeyRef`
- `triggeredAdvanceStepKeyRef`

These are effectively the page’s one-shot/idempotency contract.
11D must freeze that contract explicitly rather than leaving it as incidental implementation detail.

### Bottleneck 6 — This is not a route redesign problem

The problem is not what next page should be.
The problem is **who owns the handoff between domain latch and page orchestration**.
Changing routes or timers would not solve that.

---

## 9. Boundary Freeze Proposal

## 9.1 Freeze target

11D freezes the boundary:

**library latch truth → page success event latch → page navigation scheduler → route push**

This sits strictly **after** 11B/11C.
It must not reopen owner truth, UI gate, final blocker, or readiness routing.

## 9.2 Canonical contract classes

11D defines four contract classes.

### A. Domain latch truth

Canonical facts:

- `finalPassEligible`
- `finalPassBlockedReason`
- `isFinalPassLatched(...)`

Owner:

- library (`auto-progression.ts` + `isFinalPassLatched`)

Rule:

- page consumes these values
- page may not reinterpret or recompute their meaning

### B. Page success-event latch

Canonical facts:

- `passLatched`
- `passLatchedStepKeyRef`
- `passLatchedAt`
- `passDetectedAt`

Owner:

- page orchestration layer

Rule:

- this layer does not decide whether motion passed
- it decides only whether the current step key has already consumed a valid success signal

### C. Page navigation scheduler state

Canonical facts:

- `autoAdvanceScheduled`
- `scheduledAdvanceStepKeyRef`
- `advanceLockRef`
- `nextScheduledAt`
- `nextTriggerReason`

Owner:

- page orchestration layer

Rule:

- scheduling may only happen after page success-event latch is established for the current step key
- scheduling state may delay route push but may not redefine pass truth

### D. Route execution state

Canonical facts:

- `navigationTriggered`
- `triggeredAdvanceStepKeyRef`
- `nextTriggeredAt`
- actual `router.push(nextPath)`

Owner:

- page orchestration layer

Rule:

- route execution is the final consumer of already-latched success
- it must be idempotent per step key
- it must remain downstream of modal/freeze/diagnostic holds

---

## 10. Locked Ordering

11D freezes the following order.

### 10.1 Domain success path

library gate result
→ `isFinalPassLatched(...)`
→ domain latch truth available

### 10.2 Page success-event path

domain latch truth
→ `latchPassEvent()` eligible
→ page step-key latch recorded
→ success-side snapshots / terminal bundle / stop capture

### 10.3 Page scheduling path

page step-key latch recorded
→ schedule auto-advance or hold by diagnostic/modal conditions
→ timer / hold state only

### 10.4 Route execution path

scheduled success transition
→ final guards for step key / hold state
→ `router.push(nextPath)`

### Frozen statement

The page may:

- consume domain latch truth
- record one-shot success consumption for the current step
- schedule navigation
- execute navigation

The page may **not**:

- redefine whether squat pass truth exists
- reopen owner/gate/final-blocker semantics
- treat modal/freeze state as pass owner

---

## 11. What 11D Should Lock Explicitly

1. `finalPassLatched` is domain latch truth, not page-owned truth.
2. `passLatched` is page-consumed success-event memory, not domain truth.
3. `effectivePassLatched` is a convenience handoff value, not an independent pass owner.
4. `latchPassEvent()` is a page consumption/orchestration action, not a pass decision function.
5. debug modal hold may delay navigation, but may not alter success truth.
6. diagnostic freeze may delay navigation, but may not alter success truth.
7. timer scheduling may delay route push, but may not alter success truth.
8. step-key refs form the idempotency contract for page consumption and navigation.

---

## 12. File Impact Surface

### Primary

- `src/app/movement-test/camera/squat/page.tsx`
  - success latch, step-key idempotency, auto-advance scheduling, route push handoff

### Upstream domain truth producers

- `src/lib/camera/auto-progression.ts`
  - gate result / final pass eligibility
- `src/lib/camera/auto-progression.ts` (`isFinalPassLatched`)
  - domain latch truth surface

### Downstream sink/consumer surfaces

- `src/lib/camera/camera-trace.ts`
- `src/lib/camera/camera-trace-bundle.ts`
- `src/lib/camera/camera-success-diagnostic.ts`
- success/failure overlay components

11D should not redesign these sinks.
It should only clarify that they consume already-latched success state.

---

## 13. Regression Proof Strategy

### A. Meaning lock

Implementation PR for 11D must prove no change in meaning for:

- pass opening
- retry/fail opening
- `finalPassEligible`
- `finalPassBlockedReason`
- `isFinalPassLatched(...)`
- route destination
- auto-advance delay value

### B. Contract lock

Implementation PR for 11D must prove:

- domain latch truth remains upstream of page latch
- page latch remains upstream of scheduling
- scheduling remains upstream of route push
- modal/freeze branches delay navigation only
- page does not become a second pass owner

### C. Idempotency lock

Implementation PR for 11D must prove no double-consumption for the same step key:

- no duplicate `latchPassEvent()` effect for same key
- no duplicate scheduling for same key
- no duplicate `router.push(nextPath)` for same key

### D. Behavior lock

All current user-visible behavior must remain unchanged for:

- normal success auto-advance
- diagnostic success freeze hold
- debug modal hold
- retry/fail branches
- unmount/cleanup behavior

---

## 14. Residual Risks

1. Page still contains a large amount of orchestration logic even after contract freeze.
   11D is about boundary clarity, not total code size reduction.

2. Observability and terminal bundle calls remain interleaved with latch consumption.
   That is acceptable if ownership is explicit.

3. `effectivePassLatched` may still exist after 11D for compatibility/readability.
   The important part is to prevent it from being treated as an independent pass owner.

4. If future flows add more post-pass branches, 11D’s contract must be preserved so those branches remain downstream consumers only.

---

## 15. Follow-up PR Handoff

### 11E — observability sink-only cleanup

Keep for 11E:

- debug/trace provenance labeling
- sink-only normalization for pass/gate/latch state
- bundle/export cleanup
- mirror field cleanup

11D must not redesign trace schema or export formatting.

---

## 16. Approval Questions

1. Should 11D formally classify `effectivePassLatched` as a **handoff convenience value only**, not a truth owner?

2. Should `latchPassEvent()` be documented as the single page-level success-consumption action for the current step key, even if its internal implementation remains multi-purpose?

3. Is it acceptable to leave diagnostic freeze and debug modal hold behavior unchanged as long as the document explicitly classifies them as navigation-delay consumers only?

4. Should the step-key refs (`passLatchedStepKeyRef`, `scheduledAdvanceStepKeyRef`, `triggeredAdvanceStepKeyRef`) be treated as the explicit page idempotency contract in the implementation PR?

5. Is there any existing path where page code can navigate without first consuming domain latch truth for the same step key? If yes, implementation PR must preserve compatibility carefully.

---

## Final design conclusion

11A solved owner read boundary.
11B solved post-owner / pre-latch gate ordering.
11C solved readiness/setup source routing.

So 11D should now do one narrow thing:

**freeze the contract between domain latch truth and page-level success/navigation orchestration**

That keeps the page as a downstream consumer of success truth,
not a second pass owner,
while preserving all current routes, timers, diagnostic holds, and UX behavior.
