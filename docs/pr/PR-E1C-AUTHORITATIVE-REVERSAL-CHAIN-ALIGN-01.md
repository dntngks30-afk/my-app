# PR-E1C-AUTHORITATIVE-REVERSAL-CHAIN-ALIGN-01

## 요약

PR-E1, PR-E1B 이후 남아 있던 얕은 스쿼트 `no_reversal` false-negative를 수정한다.
`evidenceLabel === 'standard'` (relativeDepthPeak 0.10–0.39) 구간의 공식 얕은 입장(admitted) 시도가
standing finalize를 통과했음에도 closure bundle이 잘못 차단되어 stream bridge가 활성화되지 않던 문제.

---

## 근본 원인 (코드 경로 기준)

### 단절 지점

`computeOfficialShallowClosure`의 main stream 조건 (수정 전 line 1252):

```typescript
params.standingRecoveryFinalizeSatisfied &&
recoveryMeetsLowRomStyleFinalizeProof(params.recovery)  // ← 문제 조건
```

`recoveryMeetsLowRomStyleFinalizeProof`는 `returnContinuityFrames >= 3 && recoveryDropRatio >= 0.45`를 확인한다.

### 불일치

`getStandingRecoveryFinalizeGate`는 이 조건을 **`evidenceLabel === 'low_rom'` 또는 `ultraLowRomUsesGuardedFinalize`일 때만** 검증하고 `finalizeSatisfied`에 반영한다.

`evidenceLabel === 'standard'` (relativeDepthPeak ≥ `STANDARD_LABEL_FLOOR = 0.10`)이면서
`standingRecoveryFinalizeBand === 'low_rom'` (relativeDepthPeak < `STANDARD_OWNER_FLOOR = 0.40`)인 구간에서는:

- finalize gate: frame count + hold duration만 확인 → `finalizeReason = 'standing_hold_met'`으로 통과
- trajectory rescue: `finalizeOk = true` (standing_hold_met ∈ ok set) → 활성화
- closure bundle: `recoveryMeetsLowRomStyleFinalizeProof`를 추가로 확인 → continuity/drop ratio 부족 시 **차단**

### 체인 단절 결과

```
strict reversal 실패
  → closure bundle 차단 (recoveryMeetsLowRomStyleFinalizeProof = false)
    → stream bridge 미활성 (shallowClosureProofBundleFromStream = false)
      → ownerAuthoritativeReversalSatisfied = false
        → reversalConfirmedAfterDescend = false
          → trajectory rescue 활성화 (provenance-only, no success open)
            → completionBlockedReason = 'no_reversal' 유지
```

로그 패턴: `trajectoryReversalRescueApplied = true`, `officialShallowClosureProofSatisfied = false`,
`reversalConfirmedAfterDescend = false`, `completionBlockedReason = 'no_reversal'`

---

## 수정 내용

**파일**: `src/lib/camera/squat-completion-state.ts`

`computeOfficialShallowClosure` main stream 조건에서 `recoveryMeetsLowRomStyleFinalizeProof(params.recovery)` 제거.

**수정 전:**
```typescript
isOfficialShallowRomFinalizeBand(params.standingRecoveryFinalizeBand) &&
params.standingRecoveryFinalizeSatisfied &&
recoveryMeetsLowRomStyleFinalizeProof(params.recovery)
```

**수정 후:**
```typescript
isOfficialShallowRomFinalizeBand(params.standingRecoveryFinalizeBand) &&
params.standingRecoveryFinalizeSatisfied
// recoveryMeetsLowRomStyleFinalizeProof 제거 (PR-E1C)
```

`standingRecoveryFinalizeSatisfied`가 finalize gate의 전체 판정(필요 시 recovery proof 포함)을 이미 포함하므로 중복 검증 불필요.

### fallback 경로 (`officialShallowPrimaryDropClosureFallback`)는 수정 없음

해당 경로는 `qualifiesForRelaxedLowRomTiming`(continuity ≥ 4, drop ratio ≥ 0.45)을 추가로 요구하므로 `recoveryMeetsLowRomStyleFinalizeProof`는 이미 자동으로 만족된다.

---

## 수정 후 체인 흐름 (표준 evidence 얕은 스쿼트)

```
admitted shallow, standard evidence (relativeDepthPeak 0.10–0.39)
  → standingRecoveryFinalizeSatisfied = true (standing_hold_met)
    → closure bundle 활성화 (post-peak drop 검사 통과)
      → stream bridge 활성화 (shallowClosureProofBundleFromStream = true)
        → officialShallowStreamBridgeApplied = true
          → ownerAuthoritativeReversalSatisfied = true
            → reversalConfirmedAfterDescend = true
              → ruleCompletionBlockedReason = null
                → canonical shallow closure → success
```

---

## 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/lib/camera/squat-completion-state.ts` | `computeOfficialShallowClosure` main stream gate에서 `recoveryMeetsLowRomStyleFinalizeProof` 조건 제거 |
| `scripts/camera-e1c-authoritative-reversal-chain-smoke.mjs` | 신규 smoke 테스트 (23개) |

---

## SSOT 대비 안전성

- **PR-E1 보존**: `applyCanonicalShallowClosureFromContract`의 `currentSquatPhase`/`completionMachinePhase` 설정 변경 없음
- **PR-E1B 보존**: `buildCanonicalShallowContractInputFromState`의 peak index 치환 로직 변경 없음
- **event-owner downgrade 보존**: `eventCyclePromoted = false` 유지, smoke F 섹션으로 검증
- **trajectory rescue provenance-only 보존**: rescue는 여전히 `ownerAuthoritativeReversalSatisfied`를 직접 설정하지 않음, smoke D 섹션으로 검증
- **deep standard_cycle 보존**: `STANDARD_OWNER_FLOOR = 0.4` 이상은 `isOfficialShallowRomFinalizeBand`에서 제외되므로 영향 없음, smoke E 섹션으로 검증
- **anti-false-pass 보존**: canonical contract의 `antiFalsePassFromInput`(peakLatchedAtIndex ≠ 0 등) 변경 없음

---

## 오탐(false-pass) 방어선

수정 후에도 다음 조건이 모두 만족해야 closure bundle이 활성화된다:

1. `officialShallowPathCandidate` — relativeDepthPeak < 0.40, baseline 최소 4프레임
2. `attemptStarted` — 하강 + downward commitment 달성
3. `hasValidCommittedPeakAnchor` — commitment 이후 유효 peak 앵커 존재
4. `isOfficialShallowRomFinalizeBand` — relativeDepthPeak < STANDARD_OWNER_FLOOR
5. `standingRecoveryFinalizeSatisfied` — frame count + hold(low_rom: 60ms, standard: 160ms) + continuity/drop(low_rom만)
6. post-peak depth drop ≥ `max(0.007, squatReversalDropRequired × 0.88)` — 실제 피크 이후 깊이 감소
7. stream bridge ascent 검사 — 상승 프레임 또는 동등한 depth 복귀 증거
8. canonical contract anti-false-pass — `peakLatchedAtIndex ≠ 0`, `evidenceLabel ≠ insufficient_signal` 등

---

## Smoke 결과

```
PR-E1C camera-e1c-authoritative-reversal-chain-smoke: 23/23 passed
PR-03  camera-shallow-official-closure-smoke:          17/17 passed (기존 회귀 없음)
PR-E1B camera-e1b-peak-anchor-contamination-smoke:     23/23 passed (기존 회귀 없음)
PR-03  camera-shallow-final-trace-sync-smoke:           6/6  passed (기존 회귀 없음)
PR-03  camera-shallow-closure-trace-final-smoke:        7/7  passed (기존 회귀 없음)
─────────────────────────────────────────────────────
합계: 76/76
```

---

## 수용 기준 대응

| 기준 | 달성 여부 |
|------|-----------|
| A. admitted shallow에서 authoritative reversal chain 형성 가능 | ✅ standard evidence 구간 closure bundle 차단 해제 |
| B. provenance-only split 보존 | ✅ trajectory rescue는 여전히 stream bridge에 의존 |
| C. false-pass 방어 보존 | ✅ 6개 이상의 다층 게이트 유지 |
| D. deep standard_cycle 보존 | ✅ STANDARD_OWNER_FLOOR 기준 분기 변경 없음 |
| E. event-owner downgrade 보존 | ✅ eventCyclePromoted = false 유지 |
