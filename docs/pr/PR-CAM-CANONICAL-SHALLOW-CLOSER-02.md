# PR-CAM-CANONICAL-SHALLOW-CLOSER-02

Date: 2026-04-02
Base: `main` (after PR-CAM-CANONICAL-SHALLOW-CONTRACT-01)
Type: structural / source-of-truth consolidation
Priority: P0

---

## Why PR-A alone was not enough

PR-CAM-CANONICAL-SHALLOW-CONTRACT-01 introduced `deriveCanonicalShallowCompletionContract(...)` as an observability layer — a single fact-aggregation view of whether a shallow squat cycle should be closed. However, it did **not** own completion writes. After PR-A, `official_shallow_cycle` was still written in at least three places:

| Closer | Location | Mechanism |
|--------|----------|-----------|
| Core direct closer | `evaluateSquatCompletionCore(...)` | `shallowAuthoritativeClosureDecision.satisfied` branch wrote `completionPassReason`, `completionSatisfied`, `officialShallowPathClosed` directly |
| Ticket closer | `evaluateSquatCompletionState()` tail | `applyShallowCompletionTicketPatch(...)` wrote `completionPassReason: 'official_shallow_cycle'` when `shallowCompletionTicket.satisfied` |
| Synthetic re-run | `evaluateSquatCompletionState()` tail | `guardedShallowTrajectoryClosureProofApply: true` option triggered a second call to `evaluateSquatCompletionCore(...)` which injected `officialShallowPrimaryDropClosureFallback = true` and activated the core direct closer |

PR-A surfaced the contract as observable truth. PR-B is the enforcement step: the contract becomes the **sole authority** to open `official_shallow_cycle`.

---

## What direct closers were removed

### 1. Core direct closer (`evaluateSquatCompletionCore`)

The branch:
```ts
if (shallowAuthoritativeClosureDecision.satisfied) {
  completionPassReason = 'official_shallow_cycle';
  completionSatisfied = true;
  ...
}
```
was removed. `shallowAuthoritativeClosureDecision` remains computed as an **observability fact** that feeds the canonical contract as evidence input, but it no longer directly writes completion fields.

### 2. Ticket closer (`applyShallowCompletionTicketPatch`)

`applyShallowCompletionTicketPatch(...)` previously wrote `completionPassReason: 'official_shallow_cycle'` and all related completion fields. The three-branch ticket dispatch (eligible+satisfied / eligible+failed / ineligible) is now **observability-only**: all branches only stamp `shallowCompletionTicket*` fields. No completion, passReason, or proof fields are mutated.

`applyShallowCompletionTicketEligibleFailureProjection(...)` is also no longer called; its proof-zeroing behavior was removed to prevent pre-emptive cancellation of canonical contract inputs.

### 3. Synthetic re-run path (`guardedShallowTrajectoryClosureProofApply`)

The option `guardedShallowTrajectoryClosureProofApply?: boolean` and all references were removed from:
- `EvaluateSquatCompletionStateOptions`
- `evaluateSquatCompletionCore(...)` (the `officialShallowPrimaryDropClosureFallback = true` injection and `officialShallowReversalSatisfied` OR)
- `evaluateSquatCompletionState(...)` tail (the core re-run block)

The guarded trajectory proof itself (`guardedShallowTrajectoryClosureProofSatisfied`) is preserved as an **observability/input fact** that flows into the canonical contract via `reversalEvidenceFromInput(...)` as an OR condition.

---

## What canonical contract now owns

`applyCanonicalShallowClosureFromContract(state: SquatCompletionState)` is the **only function** that writes `official_shallow_cycle`. It is called exactly once in `evaluateSquatCompletionState()`, after the canonical contract has been derived and merged into state.

**Guard conditions** (all must pass):
1. `state.canonicalShallowContractSatisfied === true`
2. `state.completionPassReason === 'not_confirmed'` (no other closer already fired)
3. `state.relativeDepthPeak < STANDARD_OWNER_FLOOR` (shallow owner zone)
4. `state.officialShallowPathCandidate === true`
5. `state.officialShallowPathAdmitted === true`

**Fields written on closure**:
- `completionPassReason: 'official_shallow_cycle'`
- `completionSatisfied: true`
- `completionBlockedReason: null`
- `cycleComplete: true`
- `successPhaseAtOpen: 'standing_recovered'`
- `officialShallowPathClosed: true`
- `officialShallowPathBlockedReason: null`
- `ownerAuthoritativeShallowClosureSatisfied: true`
- `shallowAuthoritativeClosureReason: 'canonical_shallow_contract' | 'canonical_shallow_contract_guarded_trajectory'`
- `shallowAuthoritativeClosureBlockedReason: null`
- `completionFinalizeMode: 'official_shallow_finalized'`
- `officialShallowClosureProofSatisfied: true`
- `canonicalShallowContractClosureApplied: true`
- `canonicalShallowContractClosureSource: 'canonical_authoritative' | 'canonical_guarded_trajectory'`

**Evaluation flow order** (PR-B):
1. Core evaluation (`evaluateSquatCompletionCore` + `resolveStandardDriftAfterShallowAdmission`)
2. Event-cycle / local peak / guarded trajectory observability
3. `mergeShallowTrajectoryAuthoritativeBridge` (observability-only stamp)
4. Ticket build + observability-only stamp
5. Event promotion observability
6. `buildShallowClosureProofTrace` observability
7. `deriveCanonicalShallowCompletionContract(...)` — exactly once
8. Merge contract fields into state (including `canonicalShallowContractClosureSource`)
9. `applyCanonicalShallowClosureFromContract(state)` — exactly once
10. `attachShallowTruthObservabilityAlign01(state)` — return

---

## What remains observability only

| Helper / Signal | Role after PR-B |
|-----------------|----------------|
| `shallowAuthoritativeClosureDecision` | Evidence input to canonical contract. No completion writes. |
| `mergeShallowTrajectoryAuthoritativeBridge(...)` | Stamps `shallowTrajectoryBridge*` fields only. |
| `buildShallowCompletionTicket(...)` | Evidence aggregation. Stamps `shallowCompletionTicket*` fields only. |
| `detectSquatEventCycle(...)` | Unchanged. `squatEventCycle` attached to state. |
| `guardedShallowTrajectoryClosureProofSatisfied` | Input fact fed into canonical contract's `reversalEvidenceFromInput`. |
| Event promotion (`deriveEventCyclePromotionObservability`) | Candidate/blocked-reason only. `eventCyclePromoted` always `false`. |
| `ultra-low policy lock` | Post-processing — can still block completion after canonical closer fires. |

---

## What this PR intentionally does NOT change

- Thresholds, constants, timing values — unchanged
- `evaluateSquatCompletionCore` rule engine logic (beyond closer removal) — unchanged
- Reversal detector (`squat-reversal-confirmation.ts`) — unchanged
- Event cycle detector (`squat-event-cycle.ts`) — unchanged
- Reversal confirmation (`squat-reversal-confirmation.ts`) — unchanged
- `auto-progression` gate formula, `getSquatProgressionCompletionSatisfied` pass logic — unchanged
- Standard / deep path (`standard_cycle`, `low_rom_cycle`, `ultra_low_rom_cycle`) — unchanged
- `attachShallowTruthObservabilityAlign01` internals — unchanged
- Ultra-low policy lock semantics — unchanged
- final pass / retry / confidence / pass confirmation policy — unchanged

---

## Files changed

| File | Change |
|------|--------|
| `src/lib/camera/squat/shallow-completion-contract.ts` | Added `guardedShallowTrajectoryClosureProofSatisfied` + `completionPassReason` to input; added `closureSource` + `closureWouldWriteOfficialShallowCycle` to output; updated `reversalEvidenceFromInput`; updated `authoritativeClosureWouldBeSatisfied`, `splitBrainDetected` logic |
| `src/lib/camera/squat-completion-state.ts` | Removed core direct closer; removed `guardedShallowTrajectoryClosureProofApply` option + all usages; removed ticket closer (observability-only); added `applyCanonicalShallowClosureFromContract()`; reordered evaluation flow tail; added `canonicalShallowContractClosureApplied` + `canonicalShallowContractClosureSource` to `SquatCompletionState` |
| `src/lib/camera/auto-progression.ts` | Added `canonicalShallowContractClosureApplied` + `canonicalShallowContractClosureSource` to `SquatCycleDebug`; added pass-through in `getSquatProgressionCompletionSatisfied` |
| `docs/pr/PR-CAM-CANONICAL-SHALLOW-CLOSER-02.md` | This document |

---

## Verification

### Grep verification

```
# official_shallow_cycle 직접 대입: applyCanonicalShallowClosureFromContract 1곳만
rg "official_shallow_cycle" src/lib/camera/squat-completion-state.ts

# guardedShallowTrajectoryClosureProofApply 문자열 0건
rg "guardedShallowTrajectoryClosureProofApply" src/lib/camera/

# applyShallowCompletionTicketPatch 더 이상 completion writer 아님 (함수 정의만 존재, 호출 없음)
rg "applyShallowCompletionTicketPatch" src/lib/camera/squat-completion-state.ts

# deriveCanonicalShallowCompletionContract 호출 1회만
rg "deriveCanonicalShallowCompletionContract\(" src/lib/camera/squat-completion-state.ts

# auto-progression 에 derive 호출 없음
rg "deriveCanonicalShallowCompletionContract" src/lib/camera/auto-progression.ts
```

### Semantic verification

| Scenario | Expected |
|----------|----------|
| `canonicalShallowContractSatisfied === false` | Shallow closure not opened. `applyCanonicalShallowClosureFromContract` returns state unchanged (with `closureApplied: false`). |
| `canonicalShallowContractSatisfied === true` + guard conditions met | `official_shallow_cycle` opened exactly once via canonical closer. |
| Guarded trajectory proof is the key reversal evidence | `closureSource === 'canonical_guarded_trajectory'`, `shallowAuthoritativeClosureReason === 'canonical_shallow_contract_guarded_trajectory'`. |
| Ultra-low policy lock fires after canonical closer | Policy lock in `attachShallowTruthObservabilityAlign01` can still block the completion post-hoc. |
| Standard / deep path squat | `relativeDepthPeak >= STANDARD_OWNER_FLOOR` → canonical guard fails → closer not applied → standard_cycle unchanged. |
| Event promotion candidate | `eventCyclePromotionCandidate` may be true; `eventCyclePromoted` always false. |

---

## Known follow-up (PR-C policy separation)

1. **Drift resolution regression** — `resolveStandardDriftAfterShallowAdmission` prefix scans call `evaluateSquatCompletionCore` which no longer produces `official_shallow_cycle`. Drift correction for the official_shallow path is now a no-op. The drift detection (`officialShallowDriftedToStandard`) still observes shallow admission on prefixes, but the substitution doesn't fire. This needs a dedicated PR-C fix.

2. **`shallowAuthoritativeClosureDecision` parallel existence** — This decision and the canonical contract both express a "should shallow close?" verdict. PR-C should clarify which is the final canonical debug truth and potentially retire the legacy decision fields.

3. **`attachShallowTruthObservabilityAlign01` naming** — Internal fields still use pre-PR-B naming conventions. Post-PR-B, the naming cleanup (removing `active_closer` semantics from field names) is a PR-C housekeeping task.

4. **Ultra-low policy lock position** — Policy lock is still embedded inside `attachShallowTruthObservabilityAlign01`, which runs after the canonical closer. Formally separating completion owner from product policy remains a PR-C goal.

5. **`applyShallowCompletionTicketPatch` dead code** — The function still exists but is no longer called. It should be removed or repurposed in PR-C.

---

## Most important single line

이번 PR은 shallow success 를 여는 쓰기 권한을 core / ticket / synthetic re-run 경로에서 제거하고, canonical shallow contract + 단일 closer(`applyCanonicalShallowClosureFromContract`) 한 곳으로만 고정하는 direct closer removal PR이다.
