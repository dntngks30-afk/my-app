# PR-RF-STRUCT-11C — Readiness / Setup Source Routing Cleanup

> This PR follows `docs/REFACTORING_SSOT_2026_04.md`, `docs/REFACTORING_SSOT_2026_04_STRUCTURAL_TOP10.md`, and the STRUCT-11 series documents. It is a **design SSOT only** for behavior-preserving boundary cleanup.

## 1. Title

**PR-RF-STRUCT-11C — Readiness / Setup Source Routing Cleanup**

Behavior-preserving structural freeze for the **readiness/setup input routing** consumed by the squat post-owner / pre-latch gate.

---

## 2. Problem Statement

PR-RF-STRUCT-11A unified the owner-truth read boundary.
PR-RF-STRUCT-11B then froze the squat **post-owner / pre-latch** layer as:

**owner truth → UI progression gate → final blocker chain → latch handoff**

That boundary is now materially present in `src/lib/camera/auto-progression.ts`:

- `computeSquatPostOwnerPreLatchGateLayer(...)`
- `applySquatFinalBlockerVetoLayer(...)`
- `getSquatPostOwnerFinalPassBlockedReason(...)`

This means 11B successfully moved the main squat path away from inline late-blocker mutation and into a named post-owner layer.

However, the **inputs** to that layer are still sourced through multiple overlapping routes:

- evaluator-side setup truth (`squatSetupPhaseTrace`)
- completion-state setup mirrors (`readinessStableDwellSatisfied`, `setupMotionBlocked`, `setupMotionBlockReason`, `attemptStartedAfterReady`)
- auto-progression-side live readiness recomputation (`getLiveReadinessSummary(...)`)
- page-side live readiness recomputation for UI (`page.tsx`)
- observability mirrors stamped back into `squatCycleDebug`

So 11B froze the gate boundary, but **11C is still required** because the readiness/setup facts that feed that boundary do not yet have a single explicit routing contract.

This PR does **not** change readiness/setup behavior.
It only locks:

- which readiness/setup facts are canonical gate inputs
- where each fact is allowed to come from
- which copies are mirrors only
- which route is gate-only versus page-display-only

---

## 3. Scope

This PR is limited to **source routing cleanup** for readiness/setup-related squat gate inputs.

Included:

- Freeze the canonical source route for `liveReadinessNotReady`
- Freeze the canonical source route for `readinessStableDwellSatisfied`
- Freeze the canonical source route for `setupMotionBlocked`
- Freeze the canonical source route for `setupMotionBlockReason`
- Freeze the canonical source route for `attemptStartedAfterReady`
- Clarify which readiness/setup data is:
  - evaluator/setup truth
  - live-readiness truth
  - gate input adapter output
  - debug/trace mirror only
- Keep the 11B post-owner / pre-latch gate ordering intact

Excluded:

- any threshold changes in `live-readiness.ts`
- any threshold changes in `setup-framing.ts`
- any change to `computeSquatUiProgressionLatchGate(...)` logic meaning
- any change to completion/pass-core/evaluator semantics
- any change to page navigation/success ownership
- any change to trace payload meaning
- any change to UI copy or timing

---

## 4. Non-goals

This PR must **not**:

- change `MIN_READY_VALID_FRAMES`, `MIN_READY_VISIBLE_JOINTS_RATIO`, `MIN_READY_CRITICAL_AVAILABILITY`, or related readiness thresholds
- change `computeSquatReadinessStableDwell(...)` behavior
- change `computeSquatSetupMotionBlock(...)` behavior
- change `getSetupFramingHint(...)` behavior
- change `getLiveReadinessSummary(...)` behavior
- change `computeSquatUiProgressionLatchGate(...)` blocker ordering or strings
- change owner truth semantics
- change final blocker semantics
- change `page.tsx` navigation/success timing
- turn trace/debug mirrors into gate owners

11C is **routing cleanup only**.

---

## 5. 11B Result Review

### 5.1 What 11B got right

11B should be considered **structurally successful** for its intended layer.

Current main-path evidence:

- `computeSquatPostOwnerPreLatchGateLayer(...)` exists and now bundles owner truth + UI gate + final blocker exposure in one named layer.
- `applySquatFinalBlockerVetoLayer(...)` sits after `computeSquatUiProgressionLatchGate(...)`, making the late blocker chain an explicit veto step instead of an inline mutation blob.
- `progressionPassed` for squat now reads from the bundled post-owner layer.
- `finalPassBlockedReason` for squat now also reads from the bundled post-owner layer.
- the smoke guard explicitly checks that the main block uses `computeSquatPostOwnerPreLatchGateLayer(...)` and no longer applies `shouldBlockSquat*` inline in the main path.

### 5.2 What 11B intentionally did not solve

11B did **not** solve readiness/setup source duplication, and it was correct not to.

Today the post-owner gate still receives setup/readiness facts through mixed upstream routes:

- evaluator writes `squatSetupPhaseTrace`
- evaluator also stamps mirrored setup fields into `squatCompletionState`
- auto-progression recomputes live readiness from `guardrail + framingHint`
- page recomputes live readiness again for UI state
- auto-progression then mirrors some of those values into `squatCycleDebug`

So 11B froze the **gate boundary**, but not the **source routing** of readiness/setup inputs.
That remaining debt belongs to 11C.

### 5.3 Review verdict

**Verdict: PASS with residual routing debt intentionally left for 11C.**

11B does not need rollback or redesign.
It needs a follow-up that freezes readiness/setup provenance without reopening owner/gate ordering.

---

## 6. User-visible Truth To Preserve

The following user-facing truth must remain unchanged:

1. Standing/setup 상태에서 pass가 열리면 안 된다.
2. Meaningful descend → ascend/recovery 이후에만 통과가 열려야 한다.
3. Readiness RED / setup-motion block / dwell-not-met은 여전히 gate를 막아야 한다.
4. Readiness 표시 UI는 그대로 유지되어야 한다.
5. Shallow legitimate pass는 readiness/setup source drift 때문에 구조적으로 더 막히면 안 된다.
6. 11B에서 잠근 owner truth → UI gate → final blocker → latch handoff ordering은 그대로 유지되어야 한다.

---

## 7. Current Readiness / Setup Source Routing Map

## 7.1 Evaluator-side setup truth

`src/lib/camera/evaluators/squat.ts` currently owns the primary setup-phase evaluation work.

It computes:

- `computeSquatReadinessStableDwell(validRaw)`
- `computeSquatSetupMotionBlock(valid)`
- `squatSetupPhaseTrace = {`
  - `readinessStableDwellSatisfied`
  - `setupMotionBlocked`
  - `setupMotionBlockReason`
  - `attemptStartedAfterReady`
  `}`

Then it also stamps mirrored setup fields into `squatCompletionState`:

- `readinessStableDwellSatisfied`
- `setupMotionBlocked`
- `setupMotionBlockReason`
- `attemptStartedAfterReady`

So evaluator already creates **two adjacent representations** of the same setup truth:

- `debug.squatSetupPhaseTrace`
- `debug.squatCompletionState.<setup fields>`

## 7.2 Auto-progression gate-side setup/live-readiness route

In `src/lib/camera/auto-progression.ts`, squat step C currently does all of the following:

1. reads `squatSetupPhaseTrace`
2. reads `squatCompletionState`
3. builds `setupMotionBlockedForGate` as a mixed-source value
4. recomputes `squatLiveSummaryForGate = getLiveReadinessSummary(...)`
5. computes `liveReadinessNotReady` from that summary
6. routes those facts into `buildSquatUiProgressionLatchGateInput(...)`

So gate inputs are not coming from one route. They are coming from a **mixed adapter inside auto-progression**.

## 7.3 Page-side readiness display route

`src/app/movement-test/camera/squat/page.tsx` separately computes:

- `setupFramingHint = getSetupFramingHint(landmarks)`
- `liveReadinessSummary = getLiveReadinessSummary({ success, guardrail, framingHint })`
- `primaryReadinessBlocker`
- `liveReadiness`
- `readinessTraceSummary`

This page route is primarily UI/readability/orchestration-facing, not pass-owner-facing.

But because it reuses the same vocabulary (`liveReadiness`, `blocker`, `framingHint`), the current structure makes it easy to confuse:

- page-display readiness
nwith
- gate-input readiness

## 7.4 Observability mirrors

Auto-progression later stamps the following into `squatCycleDebug`:

- `liveReadinessSummaryState`
- `readinessStableDwellSatisfied`
- `setupMotionBlocked`
- `setupMotionBlockReason`
- `attemptStartedAfterReady`

These are useful mirrors.
But they are **not** currently protected by an explicit sink-only routing rule.

---

## 8. Structural Bottlenecks

### Bottleneck 1 — Same setup truth exists in two evaluator outputs

The evaluator emits setup truth both as:

- `squatSetupPhaseTrace`
- setup-related fields inside `squatCompletionState`

This is compatible, but without a routing freeze it leaves ambiguity over which one the gate is actually supposed to trust first.

### Bottleneck 2 — Gate input adapter is mixed-source rather than route-locked

Auto-progression currently composes gate inputs from:

- evaluator setup trace
- completion-state mirrors
- live-readiness recomputation

This is structurally workable but not locked.
The result is that readiness/setup gate input provenance is implicit instead of explicit.

### Bottleneck 3 — Page readiness and gate readiness reuse the same language with different jobs

The page computes live readiness for:

- UI color/state
- voice/readiness feedback
- debug display

The gate consumes readiness for:

- vetoing pass opening

Those are related, but they are not the same ownership surface.
11C must prevent page-display readiness from being read mentally or structurally as gate truth.

### Bottleneck 4 — Framing hint is recomputed independently at page and gate boundaries

Both page and auto-progression call `getSetupFramingHint(landmarks)`.
That is not automatically wrong, but without a routing freeze it obscures which framing hint path is:

- gate-input source
- page-display source
- debug mirror only

### Bottleneck 5 — Observability mirrors sit close to runtime gate input names

`liveReadinessSummaryState`, `setupMotionBlocked`, `readinessStableDwellSatisfied` appear in `squatCycleDebug` and debug panels.
Without a sink-only rule, future code can accidentally start reading mirrors back as gate inputs.

### Bottleneck 6 — This is not a threshold problem

The issue is not whether readiness thresholds are too strict or too weak.
The issue is **which route owns the input**.
Threshold tuning would not fix provenance ambiguity.

---

## 9. Boundary Freeze Proposal

## 9.1 Freeze target

11C freezes a new sub-boundary inside the existing 11B chain:

**readiness/setup source routing → post-owner gate input adapter**

This sub-boundary lives **before** `computeSquatUiProgressionLatchGate(...)`, but **inside** the broader pre-latch stage.

## 9.2 Canonical source classes

11C defines exactly three source classes:

### A. Evaluator setup truth (canonical for setup facts)

Canonical facts:

- `readinessStableDwellSatisfied`
- `setupMotionBlocked`
- `setupMotionBlockReason`
- `attemptStartedAfterReady`

Primary source:

- `debug.squatSetupPhaseTrace`

Compatibility mirror:

- `debug.squatCompletionState.<same fields>`

Rule:

- Gate input adapter must treat `squatSetupPhaseTrace` as first-class source.
- `squatCompletionState` setup fields are compat mirrors/fallback only.
- Neither page nor debug surface may redefine these facts.

### B. Live-readiness truth (canonical for live readiness state)

Canonical facts:

- `liveReadinessNotReady`
- `primary readiness blocker`
- `framingHint` used by live-readiness summary

Primary source:

- `getLiveReadinessSummary({ success: false, guardrail, framingHint })`

Rule:

- Gate input adapter may consume only the resulting summary output.
- `squatCompletionState` and `squatSetupPhaseTrace` must not redefine live-readiness state.
- Page-level stabilized readiness remains UI-only and must not become gate truth.

### C. Observability mirrors (sink-only)

Mirror-only fields:

- `squatCycleDebug.liveReadinessSummaryState`
- `squatCycleDebug.readinessStableDwellSatisfied`
- `squatCycleDebug.setupMotionBlocked`
- `squatCycleDebug.setupMotionBlockReason`
- `squatCycleDebug.attemptStartedAfterReady`

Rule:

- They are stamped from routed source values.
- They are not allowed to become future gate owners.

## 9.3 Page UI route classification

Page-level readiness remains allowed, but it must be explicitly classified as:

**UI/display/orchestration route only**

Allowed uses:

- readiness color/state display
- guidance/voice display
- debug panel presentation

Forbidden uses:

- redefining gate input truth
- bypassing routed gate readiness inputs
- mutating post-owner gate meaning

---

## 10. Locked Ordering

11C freezes the following order.

### 10.1 Domain/setup path

raw frames/landmarks
→ evaluator setup analysis (`computeSquatReadinessStableDwell`, `computeSquatSetupMotionBlock`)
→ `squatSetupPhaseTrace`
→ compat mirror into `squatCompletionState`

### 10.2 Live-readiness path

landmarks + guardrail
→ framing hint
→ `getLiveReadinessSummary(...)`
→ live-readiness summary

### 10.3 Gate input routing path

setup truth route + live-readiness route
→ single readiness/setup gate-input adapter
→ `buildSquatUiProgressionLatchGateInput(...)`
→ `computeSquatUiProgressionLatchGate(...)`
→ final blocker chain

### 10.4 Observability path

routed source values
→ `squatCycleDebug` mirrors
→ trace/debug/panel consumption

### 10.5 Page display path

landmarks + gate.guardrail + local phase/success state
→ page readiness display summary
→ UI/voice/debug presentation only

### Frozen statement

The gate may consume only **routed source values**.
The page may consume only **page-display readiness values**.
The mirrors may consume only **already-routed values**.
None of these three routes may silently replace one another.

---

## 11. What 11C Should Lock Explicitly

1. `readinessStableDwellSatisfied` is evaluator/setup truth first, not page truth.
2. `setupMotionBlocked` is evaluator/setup truth first, not page truth.
3. `setupMotionBlockReason` is evaluator/setup truth first, not final blocker truth.
4. `liveReadinessNotReady` is live-readiness summary truth first, not completion-state truth.
5. `framingHint` used by live-readiness summary is part of the live-readiness route, not completion/setup truth.
6. `attemptStartedAfterReady` is setup-trace/completion mirror truth, not page-phase truth.
7. `squatCycleDebug` copies are mirrors only.
8. 11B post-owner gate ordering stays exactly as-is.

---

## 12. File Impact Surface

### Primary

- `src/lib/camera/auto-progression.ts`
  - gate-input routing freeze surface

### Upstream sources

- `src/lib/camera/evaluators/squat.ts`
  - setup trace producer
- `src/lib/camera/squat-completion-state.ts`
  - setup-related compat mirrors already carried in completion state
- `src/lib/camera/live-readiness.ts`
  - canonical live-readiness summary producer
- `src/lib/camera/setup-framing.ts`
  - framing-hint source for live-readiness route

### Downstream/UI consumers (out of scope for semantic change)

- `src/app/movement-test/camera/squat/page.tsx`
  - page-display readiness route
- `src/components/camera/TraceDebugPanel.tsx`
  - debug/observability consumers
- `src/lib/camera/camera-trace.ts`
  - sink-side mirrors

---

## 13. Regression Proof Strategy

### A. Meaning lock

Implementation PR for 11C must prove no change in meaning for:

- `live_readiness_not_ready`
- `readiness_stable_dwell_not_met`
- `setup_motion_blocked`
- setup framing hint display
- readiness blocker UI wording

### B. Routing lock

Implementation PR for 11C must prove:

- gate input adapter reads setup truth from one locked route
- gate input adapter reads live-readiness truth from one locked route
- mirrors are stamped from routed values only
- page-display readiness does not become gate truth

### C. Existing behavior lock

All existing squat behavior must remain unchanged for:

- standing false positive prevention
- descent false positive prevention
- bottom false positive prevention
- too-early-ascent prevention
- shallow legitimate pass path
- readiness/setup blocker behavior

### D. Tests / proof surfaces

Minimum expectation for future implementation PR:

- narrow smoke for readiness/setup routing precedence
- existing 11A / 11B smoke compatibility
- selected squat camera smokes that cover setup/readiness false-pass defense
- no new page navigation assertions in 11C

---

## 14. Residual Risks

1. Page and auto-progression may still both compute live readiness for different purposes even after routing freeze.
   That is acceptable if their ownership is explicitly separated.

2. `squatCompletionState` will likely continue to carry setup mirrors for compatibility.
   11C should not try to delete them.

3. `getSetupFramingHint(...)` may still be called in more than one place.
   11C is about routing/ownership, not necessarily single-call deduplication.

4. `getSquatPostOwnerFinalPassBlockedReason(...)` still mixes owner-not-passed exposure and gate-veto exposure.
   That unresolved policy question belongs to the 11B residual and should not be reopened in 11C.

---

## 15. Follow-up PR Handoff

### 11D — success latch ↔ page navigation contract

Keep for 11D:

- `effectivePassLatched`
- `passLatched`
- `latchPassEvent()`
- auto-advance timers
- `router.push(...)`
- debug modal hold and route handoff

### 11E — observability sink-only cleanup

Keep for 11E:

- trace/debug panel provenance labeling
- sink-only field normalization
- bundle/export cleanup

11C must not touch navigation ownership or sink-format redesign.

---

## 16. Approval Questions

1. Should 11C formally lock `debug.squatSetupPhaseTrace` as the **primary** source for setup-truth gate inputs, with `squatCompletionState` setup fields downgraded to compat mirrors/fallback only?

2. Is it acceptable that page-level live readiness continues to exist as a separate UI-only route, as long as the design explicitly forbids it from becoming gate truth?

3. Should 11C include a named routing adapter surface (same-file helper or equivalent) to make source precedence explicit, or should the document stay purely boundary-level and leave helper naming to implementation?

4. Should `framingHint` used by gate live-readiness be explicitly classified as part of the live-readiness route rather than the setup-truth route?

5. Is there any known runtime caller that still consumes `squatCompletionState` setup mirrors directly as if they were canonical gate inputs? If yes, implementation PR must preserve compat carefully.

---

## Final design conclusion

11B already froze the squat **post-owner / pre-latch** layer successfully.

What remains is not another gate redesign.
It is a **source routing freeze**:

- evaluator/setup truth must have one canonical route
- live readiness must have one canonical route
- page display readiness must remain UI-only
- observability copies must remain sink-only

So 11C is the narrow structural PR that prevents readiness/setup duplication from re-opening owner/gate ambiguity without changing a single threshold or pass meaning.
