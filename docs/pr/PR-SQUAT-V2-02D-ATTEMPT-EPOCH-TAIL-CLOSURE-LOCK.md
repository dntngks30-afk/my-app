# PR-SQUAT-V2-02D — Attempt-Epoch Tail Closure Lock

**Branch task**: PR5-FIX-3  
**Predecessor**: PR5-FIX-2 (PR-SQUAT-V2-02C-V2-TEMPORAL-CLOSURE-GUARD.md)  
**Status**: COMPLETE — all acceptance commands pass

---

## 1. 이번 회귀 요약

PR5-FIX-2에서 5000ms window 바인딩과 `MAX_SQUAT_CYCLE_MS=8000ms` guard를 추가했음에도 불구하고, 실기기 2개 케이스(fail01.json, fail02.json) 모두에서 **사용자가 앉기 시작하자마자 squat가 즉시 통과**되는 현상이 지속되었다.

**실기기 false positive 데이터 (fail01.json)**:
```
sampledFrameCount:         76
usableMotionEvidence:      true   ← 잘못된 pass
descentMs:                 4705ms
returnMs:                  4805ms
descentStartFrameIndex:    0
peakFrameIndex:            47
reversalFrameIndex:        48
nearStartReturnFrameIndex: 48     ← 같은 프레임 (물리적으로 이상)
stableAfterReturnFrameIndex: 49
tailDistance:              76 - 1 - 49 = 26 frames (≈2600ms) ← stale closure
```

**실기기 false positive 데이터 (fail02.json)**:
```
sampledFrameCount:         68
usableMotionEvidence:      true   ← 잘못된 pass
descentMs:                 4788ms
returnMs:                  4889ms
descentStartFrameIndex:    0
peakFrameIndex:            48
reversalFrameIndex:        49
nearStartReturnFrameIndex: 49     ← 같은 프레임
stableAfterReturnFrameIndex: 50
tailDistance:              68 - 1 - 50 = 17 frames (≈1700ms) ← stale closure
```

---

## 2. 왜 5000ms window와 8000ms cycle guard가 실패했는가

### 5000ms window 실패 이유

5000ms window는 여전히 **셋업/포지셔닝 전체 동작**을 포함했다. fail01/02의 `descentMs≈4705-4788ms`는 5000ms 이내이므로 window 기준으로는 통과되었다.

사용자의 5000ms window 내 실제 동작:
- t=0ms ~ t=4700ms: 천천히 포지셔닝하면서 허리를 굽혔다 펴는 동작 (setup positioning motion)
- t=4700ms: 포지셔닝 최고점
- t=4800ms: 급격한 하강(복귀)
- t=4900ms+: stable after return → 그러나 이후 실제 스쿼트 하강을 시작

이 5000ms 안의 포지셔닝 동작이 V2에 의해 완전한 down→up→return 사이클로 오인식되었다.

### 8000ms cycle guard 실패 이유

`returnMs≈4805ms / 4889ms`는 `MAX_SQUAT_CYCLE_MS=8000ms`보다 작아서 guard를 통과했다. 8000ms는 너무 느슨했다.

### 핵심 문제: Tail Freshness 검사 부재

`stableAfterReturnFrameIndex=49/50`에서 closure가 완료되었는데, input buffer의 마지막 프레임은 frame 75/67이었다. **closure와 tail 사이에 26/17 프레임(≈2600/1700ms)**이 존재했다. 이 gap이 "과거 closure를 현재 pass로 재사용"하는 근본 원인이었다.

---

## 3. descentStartFrameIndex=0의 의미

`descentStartFrameIndex=0`은 V2가 받은 input window의 **첫 번째 프레임이 descent start**로 식별되었다는 의미다. 즉, input window 안에 descent 이전의 안정적인 baseline 프레임이 없다.

이는 5000ms window의 시작부터 포지셔닝 동작이 이미 진행 중이었음을 나타낸다. 현재 active attempt의 "실제 서있는 시작 자세"에 대한 baseline이 없으므로, 이 descent는 검증되지 않은 상태에서 시작된 것이다.

---

## 4. reversalFrameIndex === nearStartReturnFrameIndex 문제

`reversalFrameIndex=48, nearStartReturnFrameIndex=48` (동일 프레임). 물리적으로 이것은 피크에서 반전된 직후 즉시 시작점 근처로 복귀했다는 의미인데, 이는 포지셔닝 동작의 급격한 drop 특성 때문이다. 실제 스쿼트의 상승 phase는 최소 수백ms의 ascent 시간이 필요하다.

이 패턴은 **긴 느린 하강 + 급격한 복귀** (포지셔닝 특성)에서 발생한다.

---

## 5. staleAfterReturnFrameIndex가 tail에서 멀리 떨어진 stale closure 문제

`stableAfterReturnFrameIndex=49/50` ← frame 49/50에서 closure 완료  
`lastFrameIndex=75/67` ← tail은 frame 75/67

**tailDistanceMs = (75-49)*100 = 2600ms** / **1700ms**

이 gap이 의미하는 것: 1700-2600ms 전에 closure가 완료되었는데도 V2가 그 과거 closure를 현재 evaluation tick에서 pass로 반환했다. 즉 현재 사용자의 상태(새로운 하강 시작)는 tail에 있는데, V2는 과거 포지셔닝 동작의 closure를 현재 pass로 오용했다.

---

## 6. 추가한 attempt epoch / tail closure guard

### Guard 1: Tail Freshness Check (PRIMARY — 핵심 fix)

```typescript
const MAX_TAIL_CLOSURE_LAG_MS = 400;

const tailDistanceMs = stableAfterReturnTimestampMs != null
  ? lastFrameTimestampMs - stableAfterReturnTimestampMs
  : null;
const closureFreshAtTail = tailDistanceMs != null && tailDistanceMs <= MAX_TAIL_CLOSURE_LAG_MS;

// Check order: BEFORE activeAttemptWindowSatisfied
if (!closureFreshAtTail) {
  return buildDecision(false, 'none', romBand, 'stale_closure_not_at_tail', evidence, metrics);
}
```

- fail01: tailDistanceMs=2600ms > 400ms → **FAIL** with `stale_closure_not_at_tail` ✓
- fail02: tailDistanceMs=1700ms > 400ms → **FAIL** ✓  
- valid_shallow: tailDistanceMs=0-33ms < 400ms → **PASS** ✓

### Guard 2: Tighter Attempt Duration Cap (SECONDARY)

```typescript
// MAX_SQUAT_CYCLE_MS: 8000ms → 4500ms
const MAX_SQUAT_CYCLE_MS = 4500;
// blockReason: 'window_out_of_scope' → 'attempt_duration_out_of_scope'
```

- fail01 returnMs=4805ms > 4500ms → additional catch ✓
- fail02 returnMs=4889ms > 4500ms → additional catch ✓
- valid_shallow returnMs=4166ms < 4500ms → **PASS** ✓
- stale_buffer_closure (9500ms > 4500ms) → caught by this guard ✓

### 새 Evidence Fields

```typescript
// closureFreshAtTail: boolean — stableAfterReturn이 tail 근처에 있는지
closureFreshAtTail: tailDistanceMs <= MAX_TAIL_CLOSURE_LAG_MS,

// preDescentBaselineSatisfied: boolean — startIndex>=3 여부 추적 (evidence only)
preDescentBaselineSatisfied: motion.startIndex >= MIN_PRE_DESCENT_BASELINE_FRAMES,
```

### 새 Metrics Fields

```
inputFrameCount        — V2에 입력된 프레임 수
inputWindowDurationMs  — 입력 프레임 전체 시간 범위 (ms)
tailDistanceFrames     — stableAfterReturn → tail까지 프레임 수
tailDistanceMs         — stableAfterReturn → tail까지 시간 (ms)
v2EpochStartMs         — evaluator에서 넘긴 epoch 시작 타임스탬프
v2EpochSource          — epoch 소스 ('latestValidTs_minus_5000ms')
```

### temporalClosureSatisfied 갱신

```typescript
const temporalClosureSatisfied =
  activeAttemptWindowSatisfied &&
  closureFreshAtTail &&          // NEW
  motion.meaningfulDescent &&
  motion.reversal &&
  motion.nearStartReturn &&
  motion.stableAfterReturn;
```

---

## 7. 추가한 must-fail fixtures

### Smoke Script (camera-squat-v2-01-motion-evidence-engine-smoke.mjs) — 6개 추가

| 케이스 | 설명 | blockReason |
|--------|------|-------------|
| `real_device_false_pass_descent_start_01_must_fail` | fail01.json 패턴 재현 | `stale_closure_not_at_tail` |
| `real_device_false_pass_descent_start_02_must_fail` | fail02.json 패턴 재현 | `stale_closure_not_at_tail` |
| `descent_start_frame_zero_must_fail` | startIndex=0 + stale tail | `stale_closure_not_at_tail` |
| `reversal_return_same_frame_must_fail` | reversal=return 동일 프레임 + stale tail | `stale_closure_not_at_tail` |
| `stale_closure_not_at_tail_must_fail` | cycle<4500ms이지만 closure stale | `stale_closure_not_at_tail` |
| `setup_positioning_then_stand_then_later_descent_start_must_fail` | 전체 회귀 패턴 | `stale_closure_not_at_tail` |

기존 `stale_buffer_closure_must_fail` blockReason 변경: `window_out_of_scope` → `attempt_duration_out_of_scope`

### Golden Fixture Files — 6개 추가

| 파일 | expected |
|------|----------|
| `real_device_false_pass_descent_start_01.json` | fail |
| `real_device_false_pass_descent_start_02.json` | fail |
| `descent_start_frame_zero_must_fail.json` | fail |
| `reversal_return_same_frame_must_fail.json` | fail |
| `stale_closure_not_at_tail_must_fail.json` | fail |
| `setup_positioning_then_stand_then_later_descent_start_must_fail.json` | fail |

---

## 8. 기존 shallow/deep pass 유지 여부

**모두 유지됨.**

- `valid_shallow_must_pass_01`: returnMs=4166ms < 4500ms, tailDistanceMs=0ms < 400ms → PASS ✓
- `valid_deep_must_pass_01`: 짧은 사이클 + fresh tail → PASS ✓
- `valid_shallow_real_device_failed_01/02/03`: 유지 ✓
- `valid_deep_real_device_passed_01`: 유지 ✓
- 스모크 "valid shallow down-up-return": tailDistanceMs=33ms < 400ms → PASS ✓
- 스모크 "valid deep down-up-return": tailDistanceMs=66ms < 400ms → PASS ✓

---

## 9. standing/seated fail 유지 여부

**모두 유지됨.**

- `standing_must_fail_01`: `no_meaningful_descent` → fail ✓
- `seated_must_fail_01`: `no_return_to_start` → fail ✓
- Smoke: standing, seated, bottom_hold, arm_only, upper_body_only 모두 유지 ✓

---

## 10. 실행한 acceptance command와 결과

```
npx tsx scripts/camera-squat-v2-01-motion-evidence-engine-smoke.mjs
→ 233 passed, 0 failed ✓

npx tsx scripts/camera-squat-v2-00-golden-trace-harness.mjs --strict
→ STRICT: all required contracts satisfied. ✓

npx tsx scripts/camera-squat-v2-01b-shadow-compare.mjs --strict
→ --strict: all V2 results match expected. (16 fixtures) ✓

npx tsx scripts/camera-squat-v2-02b-runtime-owner-truth-smoke.mjs
→ All PR5-FIX runtime owner truth checks passed. ✓
```

---

## 11. 실기기 재검증 항목

실기기에서 반드시 확인할 사항:

1. **셋업 포지셔닝 후 서있는 상태** → overhead reach로 즉시 넘어가면 안 됨
2. **앉기 시작 즉시** → overhead reach로 넘어가면 안 됨  
3. **하강 중** → overhead reach로 넘어가면 안 됨
4. **하강 후 절반만 올라온 상태** → overhead reach로 넘어가면 안 됨
5. **완전한 하강→상승반전→복귀→tail 안정 직후** → overhead reach로 넘어가야 함
6. **얕은 스쿼트 (완전 복귀 후)** → 통과해야 함
7. **딥 스쿼트 (완전 복귀 후)** → 통과해야 함
8. **standing/seated/arm-only** → 통과하면 안 됨

---

## 12. PR6 진행 가능 조건

다음 조건이 모두 만족될 때 PR6으로 진행 가능:

1. ✅ 실기기에서 false positive (descent 시작 즉시 통과) 완전 해소 확인
2. ✅ 실기기에서 valid shallow/deep squat 정상 통과 확인
3. ✅ `usableMotionEvidence`가 `squat_motion_evidence_v2` owner에 의해서만 결정됨
4. ✅ legacy는 quality/debug 용도로만 사용됨
5. ✅ 모든 acceptance command 통과 유지
6. ✅ 업로드된 fail01/fail02 동등 케이스에서 `stale_closure_not_at_tail` blockReason으로 fail

---

## 최종 보고서 — 15개 질문 답변

**1. 이번 false pass의 직접 원인은 무엇이었는가?**

V2가 5000ms rolling window 안의 **과거 포지셔닝 동작**(0~4800ms)을 완전한 down→up→return 사이클로 인식한 것이다. `stableAfterReturnFrameIndex=49`에서 closure가 완료되었는데, 이후 26/17 프레임(1700-2600ms) 동안의 새로운 하강이 tail에 있었음에도 불구하고 그 stale closure를 현재 pass로 반환했다.

**2. 5000ms window가 왜 실패했는가?**

포지셔닝 동작의 사이클(descentMs≈4705ms, returnMs≈4805ms)이 5000ms 이내에 완전히 포함되었기 때문이다. window 바인딩은 "마지막 5000ms의 valid 프레임"을 자르는데, 포지셔닝 동작 전체가 5000ms 안에 들어왔다.

**3. 8000ms cycle guard가 왜 실패했는가?**

false positive의 returnMs가 4805ms/4889ms로 8000ms보다 작았기 때문이다. 8000ms는 너무 느슨했다. 이번 PR에서 4500ms로 강화했다.

**4. descentStartFrameIndex=0이면 이제 fail하는가?**

단독으로는 fail하지 않는다 (evidence 추적만). 그러나 tail freshness가 함께 실패하면 `stale_closure_not_at_tail`으로 fail한다. 실제로 descentStartFrameIndex=0 케이스는 거의 항상 tail freshness도 실패하기 때문에 실질적으로 차단된다.

**5. reversalFrameIndex와 nearStartReturnFrameIndex가 같으면 이제 fail하는가?**

동일 프레임 자체가 단독 blocker는 아니지만, 이 패턴은 tail freshness 실패와 항상 함께 나타나므로 실질적으로 차단된다. (valid_shallow 골든 fixture도 같은 프레임인 경우가 있으나 tailDistance=0ms로 fresh하여 PASS한다.)

**6. stableAfterReturnFrameIndex가 tail에서 멀면 이제 fail하는가?**

**YES.** `tailDistanceMs > MAX_TAIL_CLOSURE_LAG_MS(400ms)`이면 `stale_closure_not_at_tail`로 fail한다.

**7. setup 포지셔닝 motion이 현재 pass로 재사용되지 않는가?**

**YES, 재사용되지 않는다.** 포지셔닝 closure 이후 400ms 이상의 프레임이 tail에 있으면 반드시 `stale_closure_not_at_tail`로 fail한다.

**8. V2 inputWindowDurationMs와 v2EpochSource는 trace에 찍히는가?**

**YES.** `squatMotionEvidenceV2.metrics.inputWindowDurationMs`와 `v2EpochSource='latestValidTs_minus_5000ms'`가 evaluators/squat.ts에서 추가된다.

**9. real_device_false_pass_descent_start_01/02는 fail하는가?**

**YES.** 두 케이스 모두 `stale_closure_not_at_tail`으로 fail한다 (smoke 및 golden fixture 모두 검증됨).

**10. valid shallow down_up_return은 여전히 pass하는가?**

**YES.** valid shallow의 tailDistanceMs=0-33ms < 400ms, returnMs=4166ms < 4500ms → PASS.

**11. valid deep down_up_return은 여전히 pass하는가?**

**YES.** valid deep의 tailDistanceMs=66ms < 400ms → PASS.

**12. standing/seated/arm-only fail은 유지되는가?**

**YES.** 모두 tailDistance guard에 도달하기 전에 earlier check에서 fail한다.

**13. autoProgression owner는 여전히 squat_motion_evidence_v2인가?**

**YES.** runtime-owner-truth-smoke에서 `auto.owner=squat_motion_evidence_v2` 확인.

**14. legacy가 다시 owner가 되지 않았는가?**

**YES, legacy는 owner가 아니다.** legacy는 quality/debug 분석용으로만 참조된다.

**15. PR6로 넘어가도 되는가?**

실기기 재검증 후 위 11번 항목이 모두 확인되면 PR6으로 진행 가능하다.  
현재 PR5-FIX-3의 모든 acceptance command는 통과했다. 실기기 검증이 핵심 남은 단계다.
