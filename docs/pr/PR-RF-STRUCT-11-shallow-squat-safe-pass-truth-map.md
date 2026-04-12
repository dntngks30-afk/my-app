# PR-RF-STRUCT-11 — Shallow Squat Safe-Pass Truth Map (Structural Bottleneck Analysis)

## Document scope / mapping note
- Requested upstream docs and key code entrypoints were present under the same names.
- This document is **design SSOT only** for structural boundary cleanup and truth consolidation.
- This document does **not** propose threshold tuning, semantic changes, or implementation details.

---

## 1) Title

**PR-RF-STRUCT-11 — Shallow Squat Safe-Pass Truth Map (Behavior-Preserving Boundary Cleanup + Truth Consolidation)**

---

## 2) Problem Statement

### CURRENT_IMPLEMENTED
- Squat pass-related truths are currently spread across multiple layers: `pass-core`, `squat-completion-state`, evaluator post-processing, `auto-progression` UI gate/final blockers, and page-level success/navigation effects.
- The repository already contains explicit attempts to separate “completion truth” vs “UI progression gate” vs “observability/debug,” but the runtime decision chain still has overlapping ownership surfaces.
- In particular, owner truth is read from different sources in different paths (`squatPassCore.passDetected` inline in main path vs `computeSquatCompletionOwnerTruth` in fallback path), and “final pass eligible” depends on additional UI-layer blockers that are independent of completion.

### LOCKED_DIRECTION
- Product lock requires squat completion to reflect a meaningful full cycle and prohibits standing/descent/bottom premature pass.
- Pass must remain accessible for shallow ROM users, but only after meaningful descend→ascend→recovery semantics and short stability window.

### NOT_YET_IMPLEMENTED
- A single, unambiguous structural owner for the end-to-end contract “meaningful descent → ascent/recovery → short stabilization → pass” is not yet fully consolidated at boundary level.
- The current design still allows layered truth drift and requires structural cleanup PRs to reduce split-brain risk.

---

## 3) User-visible Truth To Preserve

1. **No false-positive pass timing**
   - Never pass while standing still.
   - Never pass during descent.
   - Never pass while seated/bottom hold.
   - Never pass at too-early mid-ascent without meaningful recovery.
2. **Shallow-user accessibility with integrity**
   - Legitimate shallow users can pass without being forced into deeper ROM.
   - But pass must still require meaningful cycle evidence (not noisy micro-bend).
3. **Semantic separation must remain**
   - Completion truth is not equal to quality score.
   - UI gating/navigation behavior must not silently redefine motion completion truth.
4. **Behavior-preserving refactor constraint**
   - No threshold value changes.
   - No pass/fail meaning changes.
   - No blocked reason semantic changes.

---

## 4) Observed Failure Modes To Eliminate

This design targets structural prevention of the following code-path-level failure classes:

1. **standing false positive** (standing pose closes pass)
2. **descent-phase pass** (pass during downward movement)
3. **seated/bottom pass** (pass without ascent/recovery)
4. **ascent-too-early pass** (mid-rise pass before recovery contract)
5. **no-meaningful-cycle pass** (micro/noisy movement promoted)
6. **safe shallow blocked** (legitimate shallow cycle blocked by another layer despite completion evidence)

---

## 5) Current Truth Map

## 5.1 File-by-file responsibility map

### A. Motion pass-core truth owner
- `src/lib/camera/squat/pass-core.ts`
  - Declares itself as squat motion pass authority (`passDetected`, `passBlockedReason`) with descent/reversal/standing sequence gates.
  - Uses pass-window-owned depth stream + baseline; adds descent-span and reversal-span anti-thin-evidence guards.

### B. Completion-state truth & shallow contract writer
- `src/lib/camera/squat-completion-state.ts`
  - Runs completion core evaluation + canonical shallow contract derivation.
  - Calls `applyCanonicalShallowClosureFromContract` as single writer for `official_shallow_cycle` in completion state layer.
  - Exposes completion fields (`completionSatisfied`, `completionPassReason`, `completionBlockedReason`, phase, reversal/recovery flags) plus extensive observability fields.

### C. Completion policy annotation layer
- `src/lib/camera/squat/squat-completion-policy.ts`
  - `applyUltraLowPolicyLock` annotates ultra-low policy status/trace.
  - Designed as annotation-only (no completion field rewrite).

### D. Evaluator orchestration boundary
- `src/lib/camera/evaluators/squat.ts`
  - Sequencing: readiness/setup stamp → pass-core derivation → late-setup suppression annotation → observability restamp → ultra-low policy annotation.
  - Provides `squatPassCore` and `squatCompletionState` together downstream.

### E. Final progression and pass-latch gate layer
- `src/lib/camera/auto-progression.ts`
  - Reads evaluator outputs and applies progression contract.
  - For squat main path, owner truth is sourced inline from `squatPassCore.passDetected` + completion reason/blocked reason.
  - Applies `computeSquatUiProgressionLatchGate(...)`.
  - Applies two additional final-pass blockers:
    - `shouldBlockSquatUltraLowTrajectoryRescueShortCycleFinalPass`
    - `shouldBlockSquatUltraLowSetupSeriesStartFalsePassFinalPass`
  - Produces `finalPassEligible`, `finalPassBlockedReason`, and `isFinalPassLatched` behavior.

### F. UI runtime navigation owner (capture step)
- `src/app/movement-test/camera/squat/page.tsx`
  - Computes gate every render via `evaluateExerciseAutoProgress`.
  - Uses `isFinalPassLatched` and local `passLatched` to trigger success side effects, snapshoting, and route transition.
  - Owns navigation timing lock/auto-advance and diagnostic freeze behavior.

### G. Trace/observability surfaces
- `src/lib/camera/camera-trace.ts`
- `src/lib/camera/camera-observability-squat-session.ts`
- `src/components/camera/TraceDebugPanel.tsx`
  - Provide detailed debug/observation exports of owner truth, UI gate truth, blocked reasons, phase signals, and session terminal snapshots.

## 5.2 Pass ownership flow (actual runtime)

1. `evaluateSquatCompletionState` creates completion-state truth.
2. evaluator computes `squatPassCore` (declared motion pass authority) before policy annotation.
3. `evaluateExerciseAutoProgress` (squat branch):
   - Step A: reads completion result context (`squatCompletionState`).
   - Step B: materializes owner truth primarily from `squatPassCore.passDetected`.
   - Step C: computes UI progression gate.
   - Step D: overlays final-pass-specific blockers.
   - Step E: stamps debug fields.
4. `progressionPassed` for squat = owner truth pass AND UI gate allow.
5. `finalPassEligible` mirrors progression pass, then `isFinalPassLatched` returns this (or fallback path).
6. Squat page uses final latch to trigger pass side effects and navigation.

## 5.3 phase / progression / hold / latch / navigation flow

- **Phase/recovery facts**: primarily completion-state + pass-core.
- **Hold/arming/debounce-like gating**:
  - capture arming (`captureArmingSatisfied`, minimum-cycle timing semantics)
  - pass confirmation frame count
  - live readiness stable dwell + setup motion block
  - integrity/hard blockers
- **Latch**:
  - `isFinalPassLatched` for squat delegates to `finalPassEligible` when available.
- **Navigation**:
  - page-level local latch + effect scheduling (`passLatched`, `effectivePassLatched`, timer-based route push).

## 5.4 shallow path vs standard path relationship

- Completion-state exposes pass reasons (`standard_cycle`, `low_rom_cycle`, `ultra_low_rom_cycle`, event-cycle variants, `official_shallow_cycle`).
- Pass-core authority is independent from completion blocked reason semantics.
- Auto-progression applies easy-path confidence/frame requirements for shallow pass reasons, but then still applies separate UI/final blockers.
- Therefore shallow success can be blocked late by UI-layer blockers despite motion completion evidence.

---

## 6) Structural Bottlenecks

> 아래 병목은 단일 원인으로 환원되지 않는다. 각각 독립적으로 오판정/불통과를 만들 수 있다.

### Bottleneck 1 — Pass ownership is split across at least 3 effective writers/readers
- Layers: pass-core (`passDetected`), completion-state fields, auto-progression UI/final blockers.
- Risk:
  - Same attempt can look “passed” in one truth surface and “blocked” in another.
  - Increases split-brain for standing/descent/bottom/early-ascent failure forensics.
- Why threshold tuning cannot solve:
  - Ownership conflict is topological (which layer decides), not numeric.

### Bottleneck 2 — Main path owner source vs fallback owner source inconsistency
- Main squat path in `evaluateExerciseAutoProgress` uses inline owner truth from pass-core.
- Squat fallback in `isFinalPassLatched` can call `computeSquatCompletionOwnerTruth` (completion-state-based interpretation).
- Risk:
  - Different owner truth interpretation depending on entry path.
  - Can produce latent mismatches in edge/debug/replay paths.
- Why threshold tuning cannot solve:
  - Same thresholds with different owners still diverge.

### Bottleneck 3 — UI progression gate and final-pass blockers form a secondary policy layer
- `computeSquatUiProgressionLatchGate` + two additional blocker functions in auto-progression.
- Risk:
  - Motion truth may be valid, but final pass is vetoed by separate late blockers.
  - Can create “safe shallow never passes” if blockers and owner semantics drift.
- Why threshold tuning cannot solve:
  - Blocking chain order/ownership is the issue; thresholds only alter one condition.

### Bottleneck 4 — Readiness/setup truth enters both evaluator and auto-progression gate with duplicated semantics
- Evaluator stamps setup/readiness context; auto-progression also computes live readiness summary and setup gating signals.
- Risk:
  - Duplicate semantics allow divergence in no-ready/setup states, including premature or delayed pass gating.
- Why threshold tuning cannot solve:
  - Gating predicates are duplicated; number changes do not unify semantic ownership.

### Bottleneck 5 — Phase/recovery truth appears in multiple abstractions with different strictness
- completion-state phase and recovery flags, pass-core structural proofs, event-cycle/evidence traces, UI gate outputs.
- Risk:
  - Mid-ascent / seated / no-meaningful-cycle states can be represented differently across layers.
  - Debug can show strong evidence while progression remains blocked (or vice versa).
- Why threshold tuning cannot solve:
  - Contradiction comes from layered meaning overlap, not one threshold.

### Bottleneck 6 — Latch and navigation ownership is partly in library, partly in page effects
- Library decides `finalPassEligible`; page owns `passLatched`, scheduling, and route transition effects.
- Risk:
  - Success gating and success navigation can drift conceptually.
  - “evaluation success” vs “navigated success” may be conflated in regressions.
- Why threshold tuning cannot solve:
  - This is ownership boundary between domain gate and UI orchestration.

### Bottleneck 7 — Observability layer is very rich and near-runtime; boundary discipline is required
- Trace surfaces mirror many gate fields and are reused in diagnostics and terminal snapshots.
- Risk:
  - Without strict sink-only contract, debug/trace fields may re-enter runtime gate decisions over time.
- Why threshold tuning cannot solve:
  - Architectural contamination risk is independent of numeric gates.

---

## 7) Refactoring Target Boundaries

## 7.1 Responsibilities to consolidate

1. **Single pass authority contract surface (read-side consolidation)**
   - Define one canonical read model in auto-progression for squat owner truth.
   - Main path and fallback path must consume the same owner-truth adapter (behavior-preserving mapping).

2. **Single UI gate chain boundary**
   - Keep UI gate + final-pass blocker chain as one explicit layer with fixed ordering.
   - Ensure it is clearly “post-owner, pre-latch” and never writes completion truth.

3. **Single success handoff boundary to page navigation**
   - Library owns pass eligibility/latch truth.
   - Page owns transition scheduling only; no reinterpretation of pass truth.

4. **Readiness/setup signal authority routing cleanup**
   - Explicitly lock which readiness/setup facts are sourced from evaluator output vs live-readiness recomputation.
   - Preserve behavior but remove ambiguous double meaning.

## 7.2 Responsibilities that must NOT live in those layers

- **Completion truth writes** must not happen in auto-progression/UI gate/page.
- **Policy annotation fields** must not become gate owners.
- **Trace/debug fields** must not become runtime decision inputs.
- **Navigation layer** must not decide pass semantics.

---

## 8) Locked Non-goals

1. No threshold adjustments (confidence, timing, hold, frame counts, ROM bands).
2. No semantic change to pass/fail/retry/blocked reason meanings.
3. No response contract changes for camera gate results.
4. No change to product-level next_action semantics.
5. No rewrite of execution core or unrelated `/app` surfaces.
6. No quality/pass re-coupling.
7. No conversion of observability fields into gate input.

---

## 9) Proposed PR Split

## PR-RF-STRUCT-11A — Squat pass owner read-boundary unification (behavior-preserving)

- **Scope**
  - Consolidate squat owner-truth read adapter used by both main path and fallback latch path.
  - Make ownership source explicit and singular at read boundary.
- **Out of scope**
  - Any threshold/logic changes in pass-core or completion-state.
- **Truth preserved**
  - Existing pass outcomes and blocked reasons remain identical.
- **Expected effect**
  - Removes split between inline owner truth and fallback owner computation path.

## PR-RF-STRUCT-11B — Squat UI progression/final-blocker chain boundary freeze

- **Scope**
  - Isolate and freeze ordering of UI gate + final-pass blocker chain as one dedicated layer.
  - Keep as post-owner gate only.
- **Out of scope**
  - Completion writer changes, pass-core changes, threshold changes.
- **Truth preserved**
  - `uiProgressionAllowed`, `uiProgressionBlockedReason`, `finalPassBlockedReason` semantics preserved.
- **Expected effect**
  - Prevents implicit intermixing of owner truth and UI veto logic; improves descent/bottom/early-ascent false-pass safety auditability.

## PR-RF-STRUCT-11C — Readiness/setup gate input single-route cleanup

- **Scope**
  - Clarify and centralize source routing for readiness/setup-related gate inputs consumed in squat auto-progression.
  - Remove semantic duplication points while preserving values.
- **Out of scope**
  - Live-readiness threshold changes or setup-motion detection rule changes.
- **Truth preserved**
  - Existing readiness/setup blocker behavior and messages preserved.
- **Expected effect**
  - Reduces “safe shallow blocked by another layer” caused by duplicated readiness/setup semantics.

## PR-RF-STRUCT-11D — Success latch to page navigation contract boundary

- **Scope**
  - Freeze explicit handoff contract between library latch truth and page-level navigation scheduler.
  - Keep page as orchestration consumer only.
- **Out of scope**
  - Route flow redesign, timing value changes, modal behavior redesign.
- **Truth preserved**
  - Existing transition timing and route destinations preserved.
- **Expected effect**
  - Prevents evaluator success vs navigation success conflation and race-style regressions.

## PR-RF-STRUCT-11E — Observability sink-only hardening for squat pass chain

- **Scope**
  - Formalize sink-only boundary for squat trace/diagnostic fields related to pass owner/gate/latch.
  - Ensure debug bundle/snapshot codepaths remain read-only against runtime pass decisions.
- **Out of scope**
  - Trace schema redesign, dashboard redesign.
- **Truth preserved**
  - Existing runtime pass decisions unchanged; observability payload continuity maintained.
- **Expected effect**
  - Stops debug-to-runtime contamination drift while preserving diagnosis power.

---

## 10) Regression Proof Strategy

### A. Contract-level diff checks (pre/post per PR)
- owner truth outputs (`completionOwnerPassed`, reason, blocked reason)
- UI gate outputs (`uiProgressionAllowed`, blocker)
- final outputs (`progressionPassed`, `finalPassEligible`, `finalPassBlockedReason`)
- latch output (`isFinalPassLatched('squat', gate)`)

### B. Failure-mode lock matrix
For each PR, verify explicit no-regression on:
1. standing false positive
2. descent-phase pass
3. seated/bottom pass
4. ascent-too-early pass
5. no-meaningful-cycle pass
6. legitimate shallow pass blocked

### C. Existing smoke compatibility gates
- Run existing squat camera smoke suites referenced by current PR docs (event-cycle, ultra-low early-pass guard, CAM-29A/CAM-30 family, authoritative shallow closure chain).
- Require unchanged expected outcomes for behavior-preserving PRs.

### D. Device dogfooding gate
- Maintain real-device validation as mandatory final check for in-session camera progression behavior.

---

## 11) Residual Risks

1. Legacy compatibility surfaces may still expose mixed terminology (`completion`, `owner`, `event`, `policy`) even after boundary cleanup.
2. Page-level effect complexity (voice/debug/freeze/navigation) can still introduce orchestration regressions unrelated to pass truth core.
3. Extensive diagnostic fields can still create maintenance overhead unless sink-only discipline remains enforced.
4. Historical docs/scripts may encode assumptions tied to current split owners; migration communication is needed even when runtime behavior is preserved.

---

## 12) Approval Questions

> 아래 항목은 구현 전 사용자 승인 필요 쟁점만 정리한다.

1. **Multi-owner conflict handling priority**
   - When owner truth and UI final-blocker truth disagree, do we formally lock diagnostic precedence as:
     - “owner truth first, UI veto second” in all exported summaries?
2. **Fallback owner path policy**
   - Approve removing/aligning fallback owner recomputation path so latch fallback and main path use identical owner adapter?
3. **Readiness/setup single-route source**
   - Approve locking one canonical source route (with adapter) for readiness/setup gate inputs to prevent duplicated semantics?
4. **Navigation handoff contract strictness**
   - Approve explicit contract that page may schedule/animate only, but may not reinterpret pass/latch truth under any diagnostic mode?
5. **Observability sink-only enforcement scope**
   - Approve hard rule that new diagnostic fields in squat pass chain cannot be used as runtime gate inputs without separate logic-change PR?

---

## Final design conclusion

This is not a threshold-tuning problem.

The structural risk is distributed ownership across motion pass truth, completion-state truth, UI veto layers, and navigation orchestration. The safe path for shallow users requires not only permissive shallow logic but also strict ownership boundaries that guarantee:

- no pass while standing/descent/bottom/mid-ascent,
- no no-cycle pass,
- and no unjust shallow block due to cross-layer drift.

Therefore the required work is a staged **behavior-preserving truth-ownership consolidation** split into narrow PRs by layer.
