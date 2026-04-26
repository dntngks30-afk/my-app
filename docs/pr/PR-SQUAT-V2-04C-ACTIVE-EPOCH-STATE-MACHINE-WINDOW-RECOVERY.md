# PR-SQUAT-V2-04C — Active Epoch State Machine / Window Recovery

**상태:** CURRENT_IMPLEMENTED  
**선행 PR:** PR04B (Active Epoch Baseline Guard)  
**목적:** V2가 peak-at-tail stall 조건에서도 전체 스쿼트 주기(하강 → peak → 상승반전 → 시작점 복귀)를 평가할 수 있도록 active epoch/window를 상태 기반으로 회복시킨다.

---

## 1. PR04B 이후 no-pass 원인 요약

PR04B 이후 실기기 2대에서 동일한 패턴이 반복됐다.

```
usableMotionEvidence=false
motionPattern=descent_only | bottom_hold
blockReason=no_reversal | no_return_to_start
cycleCapExceeded=true
inputWindowDurationMs≈5170~5500ms
peakFrameIndex=inputFrameCount-1
framesAfterPeak=0
```

진단: V2에 전달되는 `v2EvalFrames` 창 안에서 peak가 마지막 프레임에 붙어 있다. post-peak 프레임이 0개이므로 reversal / return 계산 자체가 불가능하다. 이것이 **peak-at-tail stall**이다.

---

## 2. peak-at-tail stall 확정 증거

실기기 JSON에서 직접 확인된 필드:

| 필드 | 값 |
|------|-----|
| `peakFrameIndex` | `inputFrameCount - 1` |
| `peakDistanceFromTailFrames` | `0` |
| `framesAfterPeak` | `0` |
| `reversalFrameIndex` | `null` |
| `nearStartReturnFrameIndex` | `null` |
| `cycleCapExceeded` | `true` |
| `inputWindowDurationMs` | `5170 ~ 5500ms` |

V2는 post-peak 프레임이 없으면 reversal 여부를 계산하지 못한다. `no_reversal`은 탐지 실패가 아니라 입력창 기하학 실패다.

---

## 3. 04B guard가 직접 원인이 아니라는 설명

PR04B Guard A / B / C는 모두 `motion.reversal === true` 이후 단계에서만 실행된다.

- **Guard A** (`no_pre_descent_baseline`): reversal 이후 shallow ROM + preDescentBaselineFrameCount=0 차단
- **Guard B** (`return_not_after_reversal`): reversal 이후 same-frame reversal/return 차단
- **Guard C** (`insufficient_post_peak_evidence`): reversal 이후 ultra-short post-peak 차단

이번 실패는 reversal 이전 단계에서 `blockReason=no_reversal`로 종료된다. Guard A/B/C는 실행조차 되지 않는다. 따라서 04B guard를 제거하거나 완화해도 문제가 해결되지 않는다.

---

## 4. depth source mismatch가 1순위가 아닌 이유

- 실기기 데이터에서 `relativePeak`는 V2 기준으로 정상 범위 (shallow/deep) 안에 있었다.
- completion 판정(`completionSatisfied`)의 depth 기준과 V2의 depth 기준 사이에 편차가 존재하나, 이 편차가 `no_reversal` 실패를 직접 유발하지는 않는다.
- 직접 원인은 post-peak 프레임 부재다. depth source 통합은 이번 PR의 범위가 아니다.

---

## 5. Active attempt state machine 설계

### 상태 정의

```
idle                      — 스쿼트 시도 없음 / 리셋 대기
descending                — 하강 중 (V2가 meaningful descent 감지)
awaiting_ascent_after_peak — peak-at-tail stall: V2가 post-peak 프레임을 기다리는 중
ascending                 — reversal 후 상승 중 (post-peak 프레임 존재)
returned                  — near-start return 도달
terminal_pass             — usableMotionEvidence=true
terminal_reset            — 명시적 실패 (stale_closure, false-positive 차단 등)
```

### 상태 관리 위치

`evaluateSquatFromPoseFrames` (`src/lib/camera/evaluators/squat.ts`) 내에서 V2 출력 기반 **stateless derivation**으로 매 tick 재계산한다. 순수 함수 구조를 유지하며 `validRaw` 버퍼와 V2 output 필드만 사용한다.

### 상태 전이 로직

```typescript
if (usableMotionEvidence) {
  activeAttemptState = 'terminal_pass';
} else if (peakAtTailStall && !usableMotionEvidence) {
  activeAttemptState = 'awaiting_ascent_after_peak';
  awaitingAscentAfterPeak = true;
  activeAttemptStillLive = true;
} else if (motionPattern === 'descent_only' || motionPattern === 'bottom_hold') {
  activeAttemptState = 'descending';
  activeAttemptStillLive = true;
} else if (/* framesAfterPeak > 0 && reversal detected */) {
  activeAttemptState = 'ascending';
  activeAttemptStillLive = true;
} else if (blockReason in staleReasons) {
  activeAttemptState = 'terminal_reset';
} else {
  activeAttemptState = 'idle';
}
```

`activeAttemptStateSinceMs`는 관련 motion event의 타임스탬프 기반으로 근사 추정된다.

---

## 6. no_reversal 장기 지속 시 window recovery 설계

### 문제

`computeActiveAttemptEpoch`가 `first_descent_candidate`를 anchor로 고정하면, 사용자가 느리게 하강할수록 peak가 항상 tail에 붙어 cycle cap을 초과한다.

### 해결 — slow-descent exception

`evaluateSquatMotionEvidenceV2` 내 `activeAttemptWindowSatisfied` 로직에 예외 조건을 추가했다:

```typescript
const activeAttemptWindowSatisfied =
  returnMs == null ||
  returnMs <= MAX_SQUAT_CYCLE_MS ||
  // Slow-descent exception
  (motion.startDepth <= MEANINGFUL_DESCENT_MIN * 0.5 &&  // 창이 서있는 위치에서 시작
    peakToReturnMs != null &&
    peakToReturnMs <= MAX_SQUAT_CYCLE_MS &&              // 상승 구간은 정상 속도
    closureFreshAtTail);                                 // 최근 완료 (stale 아님)
```

**조건 의미:**

| 조건 | 역할 |
|------|------|
| `motion.startDepth <= MEANINGFUL_DESCENT_MIN * 0.5` | 창이 standing 위치에서 시작됐음을 확인 (rolling fallback mid-descent 창 제외) |
| `peakToReturnMs <= MAX_SQUAT_CYCLE_MS` | 상승 구간만 따로 cap: 느린 하강이어도 상승은 정상 속도여야 함 |
| `closureFreshAtTail` | stale 기록된 과거 사이클 재사용 방지 |

**`preDescentBaselineSatisfied`를 사용하지 않는 이유:** V2 내부 `findMotionWindow`가 baseline 프레임이 포함돼도 `startIndex=0`을 반환하는 구조적 특성상 이 필드는 항상 `false`다. `motion.startDepth`가 더 신뢰할 수 있는 대리 지표다.

---

## 7. cycle cap 의미 재정의

기존 `cycleCapExceeded=true`는 느린 valid attempt와 stale window를 구분하지 못했다. PR04C에서 추가된 구분 필드:

| 필드 | 의미 |
|------|------|
| `cycleCapExceeded` | returnMs > MAX_SQUAT_CYCLE_MS (기존 그대로) |
| `cycleCapExceededButLiveAttempt` | cycleCapExceeded이지만 activeAttemptStillLive=true인 경우 |
| `staleWindowRejected` | blockReason이 stale_closure_not_at_tail인 경우 |
| `activeAttemptStillLive` | 현재 attempt가 아직 진행 중 (pass/fail terminal 아님) |

`cycleCapExceeded=true`여도 `cycleCapExceededButLiveAttempt=true`이면 slow-descent exception이 적용될 수 있다. `staleWindowRejected=true`이면 pass 불가.

---

## 8. 04B false-positive guard 유지 증거

다음 guard는 PR04C에서 수정하지 않았다:

| Guard | 코드 위치 | 상태 |
|-------|-----------|------|
| Guard A: `no_pre_descent_baseline` (shallow + no baseline) | `squat-motion-evidence-v2.ts` L640~660 | **유지** |
| Guard B: `return_not_after_reversal` (same-frame reversal=return) | `squat-motion-evidence-v2.ts` L660~680 | **유지** |
| Guard C: `insufficient_post_peak_evidence` (ultra-short post-peak) | `squat-motion-evidence-v2.ts` L680~700 | **유지** |
| `stale_closure_not_at_tail`: 이전 사이클 closure 재사용 차단 | `closureFreshAtTail` logic | **유지** |
| `no_meaningful_descent` / `micro_bounce` | 하강 크기 필터 | **유지** |
| `descentStartFrameIndex=0` shallow pass 차단 | Guard A 조건 | **유지** |

PR04C smoke test 8 (`same_frame_reversal_return_must_fail`)에서 Guard B가 여전히 작동함을 검증.

---

## 9. 추가된 debug fields

`SquatMotionEvidenceDecisionV2.metrics` 에 추가:

| 필드 | 타입 | 설명 |
|------|------|------|
| `peakAtTailStall` | `boolean?` | peak가 마지막 프레임에 위치 |
| `peakAtTailStallSinceMs` | `number?` | stall 시작 시점 (근사) |
| `peakAtTailStallDurationMs` | `number?` | stall 지속 시간 (근사) |
| `awaitingAscentAfterPeak` | `boolean?` | 상승 프레임 대기 중 |
| `postPeakFrameCount` | `number?` | framesAfterPeak 별칭 |
| `activeAttemptState` | `string?` | 현재 attempt 상태 |
| `activeAttemptStateSinceMs` | `number?` | 상태 진입 시각 (근사) |
| `activeAttemptStillLive` | `boolean?` | attempt 진행 중 |
| `cycleCapExceededButLiveAttempt` | `boolean?` | cap 초과 but live |
| `staleWindowRejected` | `boolean?` | stale 차단 여부 |
| `windowRecoveryApplied` | `boolean?` | slow-descent exception 적용 여부 |
| `windowRecoveryReason` | `string?` | exception 적용 이유 |
| `epochResetReason_v2` | `string?` | epoch 리셋 이유 |
| `peakToReturnMs` | `number?` | peak→return 상승 구간 ms |
| `v2EvalDepthsSample` | `object?` | **debug only** — 깊이 샘플 |

`v2EvalDepthsSample`은 pass logic에 사용하지 않는다. 실기기 트레이스 디버깅 전용이다.

---

## 10. 추가된 fixtures / smoke

### 신규 fixtures (`fixtures/camera/squat/observations/`)

| 파일명 | 목적 | expected |
|--------|------|----------|
| `pr04c_peak_at_tail_stall_must_not_pass_but_wait.json` | pure descent, peak=tail | fail + peakAtTailStall |
| `pr04c_peak_at_tail_then_ascent_return_must_pass.json` | slow shallow, returnMs>4500 | pass via exception |
| `pr04c_slow_shallow_descent_then_ascent_return_must_pass.json` | slow shallow | pass |
| `pr04c_slow_deep_descent_then_ascent_return_must_pass.json` | slow deep | pass + romBand=deep |
| `pr04c_no_reversal_long_descent_must_wait_not_terminal.json` | long descent, no reversal | fail + awaitingAscent |
| `pr04c_setup_translation_stale_window_must_fail.json` | setup phase stale | fail |
| `pr04c_same_frame_reversal_return_must_fail.json` | guard B 회귀 보조 | fail |

### 신규 smoke script

`scripts/camera-squat-v2-04c-peak-tail-window-recovery-smoke.mjs`

10개 테스트, 33개 assertions.

---

## 11. acceptance command 결과

```
npx tsx scripts/camera-squat-v2-04c-peak-tail-window-recovery-smoke.mjs
→ 33 passed, 0 failed ✓

npx tsx scripts/camera-squat-v2-01-motion-evidence-engine-smoke.mjs
→ 233 passed, 0 failed ✓

npx tsx scripts/camera-squat-v2-00-golden-trace-harness.mjs --strict
→ STRICT: all required contracts satisfied ✓

npx tsx scripts/camera-squat-v2-01b-shadow-compare.mjs --strict
→ --strict: all V2 results match expected ✓

npx tsx scripts/camera-squat-v2-02b-runtime-owner-truth-smoke.mjs
→ All PR5-FIX runtime owner truth checks passed ✓

npx tsx scripts/camera-squat-v2-04-active-epoch-report.mjs
→ 정상 실행 ✓
```

---

## 12. 실기기 재검증 항목

실기기에서 다음 시나리오를 직접 확인해야 한다:

1. **얕은 스쿼트 3회** — 최소 2회 자연 통과
2. **딥스쿼트 1회** — 자연 통과
3. **느린 얕은 스쿼트** (하강 3~4초) — 통과 (slow-descent exception 활성화 확인)
4. **느린 딥스쿼트** (하강 3~4초) — 통과
5. **하강 시작 직후 일시정지** — pass 금지 (peakAtTailStall 상태에서 대기)
6. **상승/복귀 후** — 통과
7. **standing small movement** — 통과 금지
8. **seated/bottom hold 유지** — 통과 금지
9. **arm-only / upper-body-only** — 통과 금지

각 시나리오에서 `peakAtTailStall`, `activeAttemptState`, `windowRecoveryApplied` 트레이스 확인 권장.

---

## 13. PR5 / PR6 / PR7 진행 가능 조건

### PR04C 완료 기준 (CURRENT_IMPLEMENTED)

- [x] `peakAtTailStall` 감지 구현
- [x] `activeAttemptState` stateless derivation
- [x] slow-descent exception (`windowRecoveryApplied`)
- [x] cycle cap 구분 필드 (`cycleCapExceededButLiveAttempt`, `staleWindowRejected`, `activeAttemptStillLive`)
- [x] PR04B guard 전체 보존
- [x] debug fields 전체 추가
- [x] fixtures 7개 + smoke 33 assertions 전부 PASS
- [x] 기존 acceptance 전부 PASS (regression 없음)

### PR7 진행 가능 조건

다음이 모두 충족되면 PR7 진행:

1. 실기기에서 얕은 스쿼트 ≥2/3 통과
2. 실기기에서 딥스쿼트 ≥1회 통과
3. 실기기에서 standing small movement / bottom hold 차단 유지
4. 느린 스쿼트(하강 3초 이상)에서 `windowRecoveryApplied=true` 트레이스 확인
5. `peakAtTailStall=true` 상태에서 즉시 pass 없음 확인

---

## 최종 보고서 — 15문항 답변

### 1. peak-at-tail stall을 감지하는가?

**예.** `src/lib/camera/evaluators/squat.ts`에서 V2 output을 기반으로 매 tick 감지:

```typescript
const peakAtTailStall =
  peakFrameIndex_v2 !== null &&
  (peakFrameIndex_v2 >= inputFrameCount_v2 - 1 ||
    (vm.framesAfterPeak ?? 0) <= 0 ||
    (vm.peakDistanceFromTailFrames ?? 0) <= 0);
```

### 2. peakAtTailStall=true일 때 pass가 열리지 않는가?

**열리지 않는다.** `peakAtTailStall=true`는 V2 output의 `usableMotionEvidence=false`와 함께 발생한다. slow-descent exception은 `returnIndex != null` (post-peak 복귀 확인)과 `closureFreshAtTail=true` (최근 완료)를 요구하므로 stall 상태에서 pass될 수 없다.

### 3. peakAtTailStall 이후 post-peak 상승/복귀 frame이 들어오면 같은 attempt에서 pass 가능한가?

**가능하다.** 다음 tick에서 V2가 post-peak 프레임이 포함된 창을 받으면:
- `framesAfterPeak > 0` → reversal 계산 가능
- `motion.startDepth <= MEANINGFUL_DESCENT_MIN * 0.5` 이면 slow-descent exception 적용
- `closureFreshAtTail=true` 이면 `activeAttemptWindowSatisfied=true`
- Guard A/B/C 통과 시 `usableMotionEvidence=true`

### 4. activeAttemptState는 무엇이고 어디에서 관리되는가?

**정의:** 현재 스쿼트 attempt의 진행 단계 (`idle` / `descending` / `awaiting_ascent_after_peak` / `ascending` / `terminal_pass` / `terminal_reset`)

**관리 위치:** `src/lib/camera/evaluators/squat.ts` — V2 output 기반 stateless derivation. 매 tick 재계산. `squatMotionEvidenceV2.metrics.activeAttemptState` 에 기록.

### 5. no_reversal 장기 지속 시 epoch/window recovery가 실제로 발생하는가?

**발생한다.** slow-descent exception이 `activeAttemptWindowSatisfied` 조건을 완화한다. `peakAtTailStall=true` + `cycleCapExceeded=true` 상태에서도 다음 tick에 post-peak 프레임이 들어오면 window recovery가 적용되고 `windowRecoveryApplied=true`로 트레이스된다.

### 6. cycleCapExceeded와 live current attempt를 구분하는가?

**구분한다.** `cycleCapExceededButLiveAttempt` 필드가 이를 명시적으로 구분한다. `staleWindowRejected=true`이면 stale 차단, `activeAttemptStillLive=true`이면 live attempt 유지.

### 7. 04B guard를 제거하지 않았는가?

**제거하지 않았다.** Guard A/B/C 코드는 그대로 유지. PR04C smoke test 8에서 Guard B (`return_not_after_reversal`) 작동 검증.

### 8. standing small movement false-positive는 여전히 막히는가?

**막힌다.** PR04C smoke test 6 (`standing_small_movement_after_prior_pass_must_fail`)에서 `usableMotionEvidence=false`, `blockReason=no_meaningful_descent|micro_bounce` 확인.

### 9. slow shallow down-up-return은 pass하는가?

**pass한다.** PR04C smoke test 2 (`peak_at_tail_then_ascent_return_must_pass`, returnMs>4500ms), test 3 (`slow_shallow_descent_then_ascent_return_must_pass`) 모두 통과.

### 10. slow deep down-up-return은 pass하는가?

**pass한다.** PR04C smoke test 4 (`slow_deep_descent_then_ascent_return_must_pass`, romBand=deep), synthetic test 10 (returnMs=5700ms, closureFreshAtTail=true) 모두 통과.

### 11. V2 threshold만 완화하지 않았는가?

**완화하지 않았다.** `MEANINGFUL_DESCENT_MIN`, `SHALLOW_ROM_MAX`, `STANDARD_ROM_MAX`, `RETURN_TOLERANCE_MIN`, `STABLE_RETURN_FRAMES`, `MAX_SQUAT_CYCLE_MS`, `MAX_TAIL_CLOSURE_LAG_MS` 상수 전부 변경 없음. slow-descent exception은 threshold 완화가 아니라 조건부 cap bypass다.

### 12. legacy owner를 복구하지 않았는가?

**복구하지 않았다.** auto-progression owner는 여전히 `squat_motion_evidence_v2`이며 `usableMotionEvidence` 소비 구조 변경 없음.

### 13. auto-progression owner는 여전히 squat_motion_evidence_v2인가?

**예.** `src/lib/camera/auto-progression.ts`에서 `v2RuntimeOwnerDecision.usableMotionEvidence`가 pass 판정 source.

### 14. consumed field는 여전히 usableMotionEvidence인가?

**예.** `squatMotionEvidenceV2.usableMotionEvidence`가 유일한 pass gate.

### 15. 실기기 acceptance 결과는 무엇인가?

실기기 검증은 별도 진행 필요 (smoke test 완료 후 단계). acceptance criteria:

1. 얕은 스쿼트 3회 중 ≥2회 자연 통과
2. 딥스쿼트 1회 자연 통과
3. 하강 시작 직후 pass 금지
4. peak-at-tail 상태에서 즉시 pass 금지
5. post-peak 상승/복귀 후 통과
6. standing small movement 통과 금지
7. seated/bottom hold 통과 금지
8. arm-only/upper-body-only 통과 금지

---

## 수정 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `src/lib/camera/squat/squat-motion-evidence-v2.types.ts` | PR04C 진단 필드 17개 추가 |
| `src/lib/camera/squat/squat-motion-evidence-v2.ts` | slow-descent exception, `peakToReturnMs`, `postPeakFrameCount` 추가 |
| `src/lib/camera/evaluators/squat.ts` | PR04C 진단 annotation block, stateless state machine, v2EvalDepthsSample 추가 |
| `fixtures/camera/squat/observations/pr04c_*.json` (7개) | 신규 PR04C 테스트 fixture |
| `scripts/camera-squat-v2-04c-peak-tail-window-recovery-smoke.mjs` | 신규 smoke script |
| `docs/pr/PR-SQUAT-V2-04C-ACTIVE-EPOCH-STATE-MACHINE-WINDOW-RECOVERY.md` | 본 문서 |
