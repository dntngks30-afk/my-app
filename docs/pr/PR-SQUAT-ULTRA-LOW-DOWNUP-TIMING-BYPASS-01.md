# PR-SQUAT-ULTRA-LOW-DOWNUP-TIMING-BYPASS-01

**Status:** CURRENT_IMPLEMENTED  
**Date:** 2026-03-31  
**Scope:** `src/lib/camera/squat-completion-state.ts` (completion-state 레이어만)

---

## 1. Assumptions

- Ask 분석([ultra-shallow squat bottleneck analysis](3b6fbc07-830c-4e15-a32e-921b6fd0c275))으로 root cause 확정됨.
- `auto-progression.ts`는 건드리지 않는다 — completion truth 가 살면 기존 easy pass 경로가 열린다.
- 기존 LOW_ROM_TIMING_PEAK_MAX(0.1), MIN_DESCENT_TO_PEAK_MS_LOW_ROM(200ms), RELAXED_**(120ms) 전역 완화 없음.
- 새 threshold 없음 — 기존 `recoveryMeetsLowRomStyleFinalizeProof` 재사용.

---

## 2. Problem

실기기 symptom:
- `relativeDepthPeak ≈ 0.06`, `evidenceLabel = 'ultra_low_rom'`
- `officialShallowPathAdmitted = true`, `attemptStarted = true`, `descendConfirmed = true`
- `reversalConfirmedAfterDescend = true`, `recoveryConfirmedAfterReversal = true`
- 그런데도 `completionBlockedReason = 'descent_span_too_short'` 로 차단
- 결과: 깊게 앉아야만 `standard_cycle` 로 통과 (relativeDepthPeak ≈ 0.91)

ultra-low ROM 얕은 down-up이 "quality-limited success"로 닫히지 않고, 반복적으로 더 깊게 앉도록 강요됨.

---

## 3. Root Cause

**마지막 킬 포인트:** `evaluateSquatCompletionCore()` 내부의 지역 함수 `computeBlockedAfterCommitment(rf, asc)`.

```
if (relativeDepthPeak < LOW_ROM_TIMING_PEAK_MAX &&    // 0.06 < 0.1 ✓
    effectiveDescentStartFrame != null &&
    peakFrame.timestampMs - effectiveDescentStartFrame.timestampMs < minDescentToPeakMsForLowRom
) {
  return 'descent_span_too_short';   ← 마지막 블록
}
```

- deep squats(rel≈0.91)는 `relativeDepthPeak >= 0.1` 이므로 이 블록 자체를 건너뜀 → 통과
- ultra-low squats(rel≈0.06)는 항상 이 블록에 진입 → 타이밍이 짧으면 차단
- `resolveSquatCompletionPath`: `completionBlockedReason != null` → 즉시 `not_confirmed`
- `auto-progression`: `computeSquatCompletionOwnerTruth` 실패 → gate 열리지 않음

역전/복귀 proof(`reversalConfirmedAfterDescend`, `recoveryConfirmedAfterReversal`)는 이 타이밍 게이트 이후에 작동하지 않음. `computeBlockedAfterCommitment`는 trajectory rescue / ultra-shallow rescue 이후 재호출되어도 같은 타이밍 블록을 다시 평가함.

---

## 4. Files Changed

| 파일 | 변경 내용 |
|------|-----------|
| `src/lib/camera/squat-completion-state.ts` | `shouldBypassUltraLowRomShortDescentTiming` helper 추가 + `computeBlockedAfterCommitment` 내 bypass 조건 삽입 |
| `scripts/camera-squat-ultra-shallow-live-regression-01-smoke.mjs` | Fixture C (short descent timing bypass 클래스) 추가 |
| `scripts/camera-squat-ultra-shallow-pass-guarantee-01-smoke.mjs` | gate-level 주석 추가 (기존 케이스 유지) |

---

## 5. Patch Detail

### Helper: `shouldBypassUltraLowRomShortDescentTiming`

`recoveryMeetsLowRomStyleFinalizeProof` 직후에 배치 (`export` 함수).

**발동 조건 (ALL):**
1. `relativeDepthPeak < LOW_ROM_LABEL_FLOOR (0.07)` — ultra_low_rom 대역
2. `evidenceLabel === 'ultra_low_rom'`
3. `officialShallowPathCandidate === true`
4. `attemptStarted === true`
5. `descendConfirmed === true`
6. `reversalFrameExists === true` (rf != null — 상위 체크에서 보장되지만 재검사)
7. `ascendForProgression === true`
8. `standingRecoveredAtMs != null`
9. `standingRecoveryFinalizeSatisfied === true`
10. `recoveryMeetsLowRomStyleFinalizeProof(...)` — continuity ≥ 3 & dropRatio ≥ 0.45

### Bypass 적용: `computeBlockedAfterCommitment`

```typescript
if (
  relativeDepthPeak < LOW_ROM_TIMING_PEAK_MAX &&
  effectiveDescentStartFrame != null &&
  peakFrame.timestampMs - effectiveDescentStartFrame.timestampMs < minDescentToPeakMsForLowRom
) {
  if (!shouldBypassUltraLowRomShortDescentTiming({ ... })) {
    return 'descent_span_too_short';
  }
  // bypass: continue to next check
}
```

`computeBlockedAfterCommitment` 자체는 비공개 지역 함수이므로 시그니처 변경 없음. 외부 scope 변수를 그대로 참조함.

---

## 6. Why This Is Safe Relative to SSOT

- **카메라 = optional refine evidence** (SSOT §3): 이번 수정은 camera completion state 내부 동작이며, 공개 API / 결과 / auth / 결제 레이어에 영향 없음.
- **Squat lock** (AGENTS.md): "깊이는 quality이지 completion 아님" 정책과 일치. shallow 성공은 shallow truth(`ultra_low_rom_cycle`)로 닫힘. `standard_cycle`로 위장하지 않음.
- **Hard boundary** (AGENTS.md): `LOW_ROM_TIMING_PEAK_MAX`, `MIN_DESCENT_TO_PEAK_MS_LOW_ROM` 전역 완화 없음.
- bypass는 10개 조건이 동시 충족될 때만 발동 — standing jitter / fake dip / seated hold 차단 유지.
- `PR_04E3B_NO_EVENT_PROMOTION_BLOCKS`는 건드리지 않음 (rule path로 닫히면 event promotion 불필요).

---

## 7. Acceptance Tests

### 완료 검증

| 항목 | 결과 |
|------|------|
| Fixture C (short descent timing bypass) — `completionBlockedReason !== 'descent_span_too_short'` | ✓ PASS |
| Fixture C — `completionPassReason === 'ultra_low_rom_cycle'` | ✓ PASS |
| Fixture C — `officialShallowPathClosed === true` | ✓ PASS |
| Fixture C — `eventCyclePromoted !== true` | ✓ PASS |
| Fixture C — `completionPassReason !== 'standard_cycle'` | ✓ PASS |
| A_trunc / A_ext / A_runtime / A_runtime_ext — 기존 케이스 회귀 없음 | ✓ PASS (48 tests) |
| Fixture B — low_rom_cycle 회귀 없음 | ✓ PASS |
| gate-level: `status === 'pass'` / `isFinalPassLatched` | ✓ PASS (11 tests) |
| cam-23: relaxed timing / fake dip / deep squat / standing still | ✓ PASS (10 tests) |
| closure / reversal / admission contract smokes | ✓ PASS (25 tests) |

**전체 합계: 94 tests, 0 failures**

---

## 8. Bypass 발동 조건 요약

```
ultra-low ROM (rel < 0.07)
  + evidenceLabel = ultra_low_rom
  + officialShallowPathCandidate
  + attemptStarted + descendConfirmed
  + reversalFrame exists + ascendForProgression
  + standingRecoveredAtMs != null
  + standingRecoveryFinalizeSatisfied
  + recoveryMeetsLowRomStyleFinalizeProof (continuity≥3 & dropRatio≥0.45)
→ descent_span_too_short 를 반환하지 않고 다음 검사로 진행
```

이 10개 조건 중 하나라도 미충족이면 기존 동작 유지.

---

## 9. Why auto-progression Was Not Touched

- shallow passReason이 생기면 이미 `squatEasyOnly` 경로가 있음.
- `SQUAT_EASY_PASS_CONFIDENCE`, `SQUAT_EASY_LATCH_STABLE_FRAMES` 기반 easy gate가 이미 구현됨.
- completion truth(`completionSatisfied = true`, `completionPassReason = 'ultra_low_rom_cycle'`)가 먼저 열려야 gate가 동작. 이번 PR은 그 선행 조건을 해결함.
- `computeSquatCompletionOwnerTruth` (squat-progression-contract.ts)는 `completionBlockedReason != null` 이면 즉시 실패 → completion-state가 살면 자동으로 풀림.

---

## 10. Explicit Non-Goals

- `LOW_ROM_TIMING_PEAK_MAX` 전역 완화 금지
- `MIN_DESCENT_TO_PEAK_MS_LOW_ROM` 전역 완화 금지
- global confidence threshold 조정 금지
- `standard_cycle` / deep path 변경 금지
- standing jitter / fake dip / 1-frame spike pass 허용 금지
- event promotion 경로 변경 금지
- auto-progression.ts 수정 금지
- public / app / auth / payment / UI 레이어 수정 금지
