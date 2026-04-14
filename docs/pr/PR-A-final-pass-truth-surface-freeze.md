# PR-A — Final Pass Truth Surface Freeze

> This PR follows `docs/SSOT_SHALLOW_SQUAT_PASS_TRUTH_MAP_2026_04.md` as the parent SSOT.
> This is a design-only PR doc. It freezes the **product success surface** for post-owner squat pass without changing thresholds, pass-core logic, setup/readiness policy, or shallow pass rate.

---

## 1. Why this PR exists

The current repo has already crossed the hardest line:

- `readSquatPassOwnerTruth(...)` is now pass-core-first for squat motion truth.
- `getSquatPostOwnerFinalPassBlockedReason(...)` skips the legacy completion-state veto chain when `completionOwnerReason === 'pass_core_detected'`.
- `computeSquatPostOwnerPreLatchGateLayer(...)` already computes the actual squat pass decision from owner truth + UI gate.
- `ExerciseGateResult` already surfaces `finalPassEligible` and `finalPassBlockedReason`.
- `isFinalPassLatched('squat', gate)` already returns `gate.finalPassEligible === true` when available.

So the runtime product success path is already effectively operating on **final pass truth**, not on `completionTruthPassed`.

But that truth is still not frozen as one explicit contract.

Today the repo still has a split surface:

- `progressionPassed` is local runtime truth.
- `finalPassEligible` / `finalPassBlockedReason` are exposed on the gate result.
- `finalPassLatched` is page-owned and derived downstream.
- `completionTruthPassed` is still present on debug/snapshot surfaces and remains easy for downstream consumers to misread as product success truth.

That ambiguity is the remaining structural risk.

The purpose of PR-A is to freeze one explicit rule:

> **For squat, product success truth after RF-STRUCT-12 is the post-owner final pass surface, not completion-state truth.**

This PR does **not** rebind severity/snapshot consumers yet. That is PR-B.

---

## 2. Core diagnosis to lock

This PR is not about opening a new pass path.
The pass path is already open.

The real remaining problem is that the repo still exposes multiple success-looking fields with different meanings:

- `completionTruthPassed`
- `progressionPassed`
- `finalPassEligible`
- `finalPassLatched`

Only one of these may act as product success truth.

The parent SSOT already locks that answer:

- `completionTruthPassed` is debug / compat / sink only.
- `progressionPassed`, `finalPassEligible`, `finalPassBlockedReason`, `finalPassLatched` are the product-truth chain.

PR-A exists to make that contract explicit in code structure so PR-B cannot accidentally keep reading the wrong surface.

---

## 3. Goal

Freeze the squat **final pass truth surface** so that downstream code has one canonical product-success input to read.

Preferred result:

- a single explicit squat final-pass surface exists,
- it is derived only from the already-frozen post-owner gate chain,
- it is additive and behavior-preserving,
- it does not change thresholds,
- it does not change pass-core authority,
- it does not change setup/readiness veto behavior,
- it does not change shallow/ultra-low-ROM success rate.

---

## 4. Scope

### In scope

- Freeze squat product success truth around the already-existing post-owner gate chain.
- Make the relationship between these fields explicit and invariant:
  - `progressionPassed`
  - `finalPassEligible`
  - `finalPassBlockedReason`
  - page-level `finalPassLatched`
- Optionally add a narrow typed surface for downstream consumers such as:
  - `finalPassGranted`
  - `finalPassTruthSource`
  - `finalPassGrantedReason`
- Ensure squat-only consumers have a canonical field to read in PR-B without consulting completion-state truth.

### Out of scope

- No threshold changes.
- No pass-core detection changes.
- No `readSquatPassOwnerTruth(...)` meaning changes.
- No setup/readiness veto changes.
- No `computeSquatUiProgressionLatchGate(...)` semantic changes.
- No `completionTruthPassed` removal.
- No `buildSquatResultSeveritySummary(...)` rebind yet.
- No `camera-success-diagnostic.ts` result-interpretation rewrite yet.
- No snapshot severity change yet.
- No overhead reach changes.
- No public/app flow changes.

---

## 5. Locked truth for this PR

### 5.1 Canonical product success truth

For squat, the canonical product success truth is the post-owner final pass surface:

- owner truth passed,
- setup/readiness/UI gate passed,
- hard blocker absent,
- final pass not blocked.

At runtime this is already represented by:

- `computeSquatPostOwnerPreLatchGateLayer(...)`
- `progressionPassed`
- `finalPassEligible`
- `finalPassBlockedReason`
- page-level `finalPassLatched`

### 5.2 Non-canonical legacy/debug truth

These fields are **not** product success truth:

- `completionTruthPassed`
- `completionPassReason`
- `completionBlockedReason`
- `cycleComplete`

They may remain for debug, diagnostics, compat, and forensics.
They must not be re-elevated as success owner inputs.

### 5.3 Latch relationship

`finalPassLatched` remains page-owned.
PR-A must not move latch ownership into the evaluator or completion-state layer.

But the page latch must be explicitly understood as:

> `finalPassLatched` may open only from the frozen final-pass truth surface.

It must never be allowed to outrun or contradict that surface.

---

## 6. Required design changes

### A. Introduce one canonical squat final-pass contract

Preferred implementation is to add one narrow typed surface for squat, for example:

```ts
export interface SquatFinalPassTruthSurface {
  finalPassGranted: boolean;
  finalPassBlockedReason: string | null;
  finalPassTruthSource: 'post_owner_ui_gate';
  motionOwnerSource: 'pass_core' | 'completion_state' | 'none';
}
```

Meaning:

- `finalPassGranted` = product truth for squat pass/fail at the gate layer.
- `finalPassBlockedReason` = exact reason pass is blocked at that same layer.
- `finalPassTruthSource` = documents that this truth comes from the post-owner gate, not completion-state.
- `motionOwnerSource` = additive traceability only; it does not redefine product truth.

Field names may differ, but these meanings must remain.

### B. Make existing exposed fields formally equal to that surface

For squat, the following must be locked as equivalent views of the same product truth:

- `progressionPassed`
- `finalPassEligible`
- `squatFinalPassTruth.finalPassGranted` (if additive surface is introduced)

And:

- `finalPassBlockedReason` must equal the blocked reason on that same final-pass surface.

This PR is allowed to centralize these relations into one helper, but it must not alter the underlying decision chain.

### C. Freeze `isFinalPassLatched('squat', gate)` to the same truth surface

`isFinalPassLatched(...)` for squat is already effectively tied to `finalPassEligible`.
PR-A should lock this relationship explicitly so later work cannot drift.

Allowed result:

- keep current implementation if it already reads the frozen surface, or
- switch to the new additive surface if introduced.

Forbidden result:

- any new squat latch path that re-reads `completionTruthPassed`, `cycleComplete`, or `completionBlockedReason` as authoritative success truth.

### D. Keep debug sink fields additive-only

If PR-A needs to expose more traceability, it may add pass-through fields.
But those fields must remain additive-only and must not become new gate inputs.

Examples of allowed additive-only trace:

- `finalPassTruthSource`
- `motionOwnerSource`
- `finalPassGrantedReason`

Examples of forbidden new gate inputs:

- any new dependency on `completionTruthPassed`
- any new dependency on `completionBlockedReason`
- any new dependency on `cycleComplete`
- any new dependency on raw `eventCycle*` fields outside the frozen owner/UI path

---

## 7. Files allowed

Minimum allowed files:

- `src/lib/camera/auto-progression.ts`
- `docs/pr/PR-A-final-pass-truth-surface-freeze.md`

Optional additional file only if it materially clarifies the contract without broadening scope:

- `src/lib/camera/squat/squat-final-pass-truth.ts`

### Files explicitly forbidden in this PR

- `src/lib/camera/squat-result-severity.ts`
- `src/lib/camera/camera-success-diagnostic.ts`
- any page / route file
- any evaluator threshold file
- any readiness/setup contract file
- any overhead module

Reason:
Those files belong to PR-B or later. PR-A must freeze the truth surface first, not start consumer rebinding.

---

## 8. Behavior-preserving requirements

This PR is additive / boundary-freezing only.
It must preserve the currently working squat pass path exactly.

### Must remain true

1. A legitimate shallow squat that currently passes must still pass.
2. A legitimate ultra-low-ROM real down → reversal → recovery pass that currently passes must still pass.
3. Deep/standard successful squat must still pass.
4. Standing still must still fail.
5. Sitting still must still fail.
6. Sitting down only must still fail.
7. Standing up only must still fail.
8. Setup step-back / camera tilt / unstable bbox false pass must still fail.
9. `pass_core_detected` success must never be re-vetoed by completion-state.

### Must not change

- pass rate
- blocked-reason ordering
- owner source priority
- pass-core stale-rep guard behavior
- setup/readiness veto strength
- final blocker veto layer behavior

---

## 9. Required invariants after PR-A

For squat only, the following combinations become hard invariants:

### Equality invariants

- `progressionPassed === finalPassEligible`
- `finalPassEligible === (finalPassBlockedReason == null)`
- if additive surface exists:
  - `squatFinalPassTruth.finalPassGranted === finalPassEligible`
  - `squatFinalPassTruth.finalPassBlockedReason === finalPassBlockedReason`

### Latch invariants

- `isFinalPassLatched('squat', gate) === finalPassEligible`
  - or `=== squatFinalPassTruth.finalPassGranted` if the additive surface is used directly.

### Illegal states

These combinations must be treated as illegal after PR-A:

- `finalPassEligible === true` and `finalPassBlockedReason != null`
- `finalPassEligible === false` and `finalPassBlockedReason == null` in a completed squat gate result
- `progressionPassed !== finalPassEligible`
- `isFinalPassLatched('squat', gate) !== finalPassEligible`
- additive final-pass surface says success while `finalPassBlockedReason` is non-null

### Consumption invariant

No squat downstream consumer added in or after PR-A may claim product success from:

- `completionTruthPassed`
- `completionPassReason`
- `completionBlockedReason`
- `cycleComplete`

Those fields may explain success/failure history, but they may not own final product pass truth.

---

## 10. Regression proof checklist

Minimum regression checks for implementation:

1. **Shallow success preservation**
   - known working shallow squat still returns:
     - `progressionPassed=true`
     - `finalPassEligible=true`
     - `finalPassBlockedReason=null`

2. **Setup false-pass preservation**
   - known setup-motion or not-ready case still returns:
     - `finalPassEligible=false`
     - blocked reason in setup/readiness/UI gate family

3. **No completion-state re-veto**
   - reproduce a case where owner truth is `pass_core_detected` while debug still contains non-canonical completion fields.
   - confirm final-pass surface still says success.

4. **Latch equivalence**
   - confirm `isFinalPassLatched('squat', gate)` matches the frozen final-pass truth surface exactly.

5. **Negative FP preservation**
   - standing / seated / frame-jump / setup-step-back remain blocked.

---

## 11. Done when

PR-A is complete when all of the following are true:

1. The repo has one explicitly frozen squat final-pass truth surface.
2. `progressionPassed`, `finalPassEligible`, and `finalPassBlockedReason` are visibly tied to that single surface.
3. `isFinalPassLatched('squat', gate)` is explicitly locked to the same surface.
4. `completionTruthPassed` remains available only as debug/compat/sink truth.
5. No downstream severity/snapshot consumer is changed yet.
6. Current shallow squat success remains intact.

---

## 12. Residual risks intentionally left for PR-B

PR-A does **not** solve the semantic split-brain by itself.
After PR-A lands, the repo may still contain cases like:

- product pass surface says success,
- debug/snapshot severity helper still says `failed`,
- result interpretation still says `movement_not_completed`.

That is acceptable for PR-A.
It is precisely why PR-B exists.

The value of PR-A is that after it lands, PR-B can rebind semantics to one frozen product truth surface instead of guessing between multiple fields.

---

## 13. Follow-up ordering

- **PR-A**: Final Pass Truth Surface Freeze
- **PR-B**: Result Semantics Rebind
- **PR-C**: Owner Naming Normalization
- **PR-D**: Regression Harness Lock

This order is mandatory.
PR-B must not be allowed to invent its own product success source.
It must consume the truth surface frozen here.

---

## 14. Model recommendation

This PR is a narrow contract-freeze / boundary-clarification doc-and-implementation task.

- **Recommended**: Composer 2.0
- **Use Sonnet 4.6 only if** implementation starts broadening into severity/snapshot consumer rewiring or shared cross-file contract churn.

---

## 15. One-line lock

**For squat, the only product success truth after RF-STRUCT-12 is the post-owner final pass surface; completion-state truth may remain visible, but it may never again own final pass.**
