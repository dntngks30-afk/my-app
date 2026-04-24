# PR-SQUAT-V2-02C — V2 Temporal Closure Guard

## 1. 회귀 요약

PR5-FIX 이후 실기기에서 이전 문제였던 "얕은 스쿼트가 안 닫힘"은 해소되었지만, 새로운 치명적 회귀가 발생했다.

실기기 증상:
- 사용자가 앉으려고 **하강을 시작하자마자** squat가 통과됨
- 실제로 하강 → 상승반전 → 시작점 복귀를 완료하지 않았는데 overhead reach로 넘어감
- V2 trace: `usableMotionEvidence=true, motionPattern=down_up_return, reversal=true, nearStartReturn=true, stableAfterReturn=true`
- Legacy trace: `no_reversal, completionSatisfied=false, reversalConfirmedAfterDescend=false` — 여전히 실패 보고

Trace에서 확인된 수치:
- V2 `descentMs ≈ 6977ms`, `returnMs ≈ 7067ms`
- 실제 스쿼트 `cycleDurationMs ≈ 491ms`
- V2가 실제 스쿼트보다 14배 긴 구간을 "하나의 스쿼트"로 인식

## 2. PR5-FIX가 smoke는 통과했지만 실기기에서 즉시 통과한 이유

PR3~PR5의 synthetic smoke 케이스는 V2-style `lowerBodySignal` 프레임을 명시적으로 주입했다. 즉, 프레임 버퍼가 짧고 깨끗하며 실제 스쿼트 사이클만 담고 있었다.

실기기 evaluator 경로는 달랐다:

```ts
// evaluators/squat.ts — PR5-FIX 전 코드
const validRaw = frames.filter((frame) => frame.isValid);
const squatMotionEvidenceV2 = evaluateSquatMotionEvidenceV2(
  toSquatMotionEvidenceV2Frames(validRaw) // ← 전체 누적 버퍼 전달
);
```

`validRaw`는 세션 시작부터 현재까지 모든 유효 프레임을 담고 있었다. 카메라를 설치하거나 위치를 잡는 **셋업 동작**(몸을 굽혀 카메라를 조작 → 다시 서기)이 7초 가까이 버퍼에 누적되었고, V2의 `findMotionWindow`가 이 셋업 동작을 완전한 `down_up_return` 사이클로 인식했다.

이후 사용자가 실제 스쿼트를 위해 하강을 시작하면:
- V2는 여전히 이전 셋업 동작 기반의 `usableMotionEvidence=true`를 유지
- `autoProgressionDecision.progressionAllowed=true`로 즉시 통과

## 3. V2 False Positive 원인 분석

**주 원인: unbounded active window (stale buffer)**

`evaluators/squat.ts`가 V2에 전체 누적 세션 버퍼를 넘겨서, `findMotionWindow`가 현재 active attempt가 아닌 과거 셋업 포지셔닝 동작을 `down_up_return`으로 오판했다.

구체적 sequence:
1. 셋업: 사용자가 카메라 위치를 잡기 위해 몸을 굽힘 (depth 증가) → 다시 섬 (depth 감소)
2. `startIndex` = 셋업 시작 (0번째 프레임)
3. `peakIndex` = 셋업 굽힘 최고점
4. `reversal` = 다시 서는 동작에서 감지
5. `returnIndex` = 서 있는 자세로 돌아온 프레임 (약 7초 후)
6. `stableAfterReturn` = 이후 readiness dwell 프레임들 (true)
7. `returnMs = 7067ms` — 실제 스쿼트(491ms)의 14배

Secondary: `nearStartReturn premature`

기존 `nearStartReturn = meaningfulDescent && returnIndex != null` 정의는 reversal을 명시적으로 요구하지 않았다. 이 PR에서 정의를 `meaningfulDescent && reversal && returnIndex != null`로 명확화했다(구조적으로는 reversal 체크가 먼저이므로 동작은 동일하나 evidence 의미가 명확해짐).

## 4. 추가한 Temporal Closure Guard

### 4.1 이중 방어 전략

#### 방어 1 (Primary): evaluators/squat.ts — 입력 창 바인딩

```ts
const MAX_V2_EVAL_WINDOW_MS = 5000;
const latestValidTs = validRaw[validRaw.length - 1]?.timestampMs ?? 0;
const v2EvalFrames = validRaw.filter(
  (f) => f.timestampMs >= latestValidTs - MAX_V2_EVAL_WINDOW_MS
);
const squatMotionEvidenceV2 = evaluateSquatMotionEvidenceV2(
  toSquatMotionEvidenceV2Frames(v2EvalFrames)
);
```

V2에 전달되는 프레임을 최근 5000ms로 제한한다. 실제 스쿼트 사이클(보통 0.5~3초)은 충분히 커버하면서, 세션 초기 셋업 포지셔닝 프레임(7초 이전)은 자동으로 제외된다.

#### 방어 2 (Defense-in-depth): squat-motion-evidence-v2.ts — 내부 temporal guard

```ts
const MAX_SQUAT_CYCLE_MS = 8000;
// returnMs > MAX_SQUAT_CYCLE_MS → activeAttemptWindowSatisfied=false → window_out_of_scope
```

V2 자체가 `returnMs > 8000ms`인 사이클을 거부한다. evaluator가 올바르게 바인딩되면 도달하지 않지만, 방어 레이어로 존재한다.

### 4.2 새 evidence / metrics 필드

**evidence**:
- `temporalClosureSatisfied` — 완전한 하강→반전→복귀 순서가 active window 안에서 성립
- `activeAttemptWindowSatisfied` — `returnMs <= MAX_SQUAT_CYCLE_MS` (8000ms 이내)

**metrics**:
- `descentStartFrameIndex` — 의미 있는 하강이 시작된 프레임 인덱스
- `peakFrameIndex` — 최고 깊이(스쿼트 바닥) 프레임 인덱스
- `reversalFrameIndex` — 반전(상승 시작) 확인된 프레임 인덱스
- `nearStartReturnFrameIndex` — 시작점 근처로 복귀한 첫 프레임 인덱스
- `stableAfterReturnFrameIndex` — 복귀 후 안정 확인된 프레임 인덱스
- `closureBlockedReason` — `'window_out_of_scope'` 등 temporal guard 차단 이유

### 4.3 정확한 pass contract (12개 조건)

```
1. bodyVisibleEnough=true
2. lowerBodyMotionDominant=true
3. meaningfulDescent=true
4. reversal=true               (peak 이후 실제 하강 신호)
5. nearStartReturn=true        (meaningfulDescent && reversal && returnIndex != null)
6. stableAfterReturn=true      (nearStartReturn 이후의 안정 프레임)
7. sameRepOwnership=true       (연속 window, setup phase 없음)
8. notSetupPhase=true
9. notUpperBodyOnly=true
10. notMicroBounce=true
11. temporalClosureSatisfied=true
12. activeAttemptWindowSatisfied=true  ← 신규
```

### 4.4 sameRepOwnership 보강

- `startIndex < peakIndex` 조건 유지
- `reversalFrameIndex`가 실제 프레임 인덱스로 추적됨 (단, reversal==return인 급격한 recovery는 유효로 허용)
- `MAX_REP_FRAME_GAP_MS=750ms` 갭 체크 유지

### 4.5 temporal guard 체크 순서 (sameRepOwnership보다 먼저)

```ts
// temporal guard: window가 너무 길면 sameRepOwnership 체크 불필요
if (!activeAttemptWindowSatisfied) {
  return buildDecision(false, 'none', romBand, 'window_out_of_scope', evidence, metrics);
}
if (!motion.sameRepOwnership) {
  return buildDecision(false, 'none', romBand, 'same_rep_ownership_failed', evidence, metrics);
}
```

## 5. 추가한 Fail Fixtures / Smoke Cases

### Smoke Script 신규 케이스 (camera-squat-v2-01-motion-evidence-engine-smoke.mjs)

| 케이스 | 기대 결과 | blockReason | 검증 내용 |
|---|---|---|---|
| `descent_start_only_must_fail` | false | `no_reversal` | 하강 시작 직후 pass 금지 |
| `early_descent_no_reversal_must_fail` | false | `no_reversal` | 강한 하강, 반전 없음 |
| `descent_then_partial_rise_no_return_must_fail` | false | `incomplete_return` | 부분 상승, 복귀 전 |
| `near_start_without_prior_descent_return_must_fail` | false | `micro_bounce` | 초기 자세 흔들림만 |
| `stale_buffer_closure_must_fail` | false | `window_out_of_scope` | returnMs=10000ms > 8000ms |
| `setup_or_readiness_motion_must_fail` | false | `setup_phase_only` | 셋업 동작만 |

### Golden Fixture 신규 파일 (fixtures/camera/squat/golden/)

| fixture id | expected | blockReason |
|---|---|---|
| `descent_start_only_must_fail_01` | fail | `no_reversal` |
| `stale_buffer_closure_must_fail_01` | fail | `window_out_of_scope` |

## 6. 기존 Shallow Pass Fixture 유지 여부

CURRENT_IMPLEMENTED: 유지됨.

| fixture | expected | V2 결과 | status |
|---|---|---|---|
| `valid_shallow_must_pass_01` | pass | pass | PASS |
| `valid_shallow_real_device_failed_01` | pass | pass | PASS |
| `valid_shallow_real_device_failed_02` | pass | pass | PASS |
| `valid_shallow_real_device_failed_03` | pass | pass | PASS |

## 7. Standing / Seated Fail 유지 여부

CURRENT_IMPLEMENTED: 유지됨.

| fixture | expected | V2 결과 | status |
|---|---|---|---|
| `standing_must_fail_01` | fail | fail | PASS |
| `seated_must_fail_01` | fail | fail | PASS |

## 8. 실행한 Acceptance Commands와 결과

```bash
npx tsx scripts/camera-squat-v2-01-motion-evidence-engine-smoke.mjs
# 165 passed, 0 failed

npx tsx scripts/camera-squat-v2-00-golden-trace-harness.mjs --strict
# STRICT: all required contracts satisfied.

npx tsx scripts/camera-squat-v2-01b-shadow-compare.mjs --strict
# --strict: all V2 results match expected.
# valid_shallow_must_pass_01:  pass → PASS
# valid_deep_must_pass_01:     pass → PASS
# descent_start_only_*:        fail → PASS
# stale_buffer_closure_*:      fail → PASS

npx tsx scripts/camera-squat-v2-02b-runtime-owner-truth-smoke.mjs
# All PR5-FIX runtime owner truth checks passed.
# descent_start_only_must_fail_01: v2.usable=false, blockReason=no_reversal, auto.allowed=false
# stale_buffer_closure_must_fail_01: v2.usable=false, blockReason=window_out_of_scope, auto.allowed=false
```

## 9. 실기기 재검증 항목

NOT_YET_IMPLEMENTED (다음 실기기 dogfooding에서 확인):

1. 앉으려고 **하강 시작하는 순간** → 절대 통과하지 않아야 한다
2. 하강 후 아직 다 일어나지 않았으면 → 통과하지 않아야 한다
3. 하강 → 상승반전 → 시작점 근처 복귀 후에만 → 통과해야 한다
4. 얕은 스쿼트도 실제 복귀까지 완료하면 → 통과해야 한다
5. 딥스쿼트도 기존처럼 → 통과해야 한다
6. standing/seated/arm-only → 통과하면 안 된다
7. V2 trace에 `v2RuntimeOwnerDecision`, `autoProgressionDecision`, `legacyQualityOrCompat`, `pageLatchDecision` 필드가 존재해야 한다
8. `descentMs`, `returnMs` 값이 실제 스쿼트 사이클(0.5~3초)과 합리적인 범위에 있어야 한다

## 10. PR6 진행 가능 조건

LOCKED_DIRECTION:

PR6 (Legacy Quality Analyzer Demotion)으로 진행하기 위한 조건:

1. 이번 PR acceptance commands가 모두 green — **충족됨**
2. 실기기 re-dogfooding에서 아래 항목 확인:
   - 하강 시작 직후 통과 없음 (이번 회귀 수정 검증)
   - 얕은/딥 스쿼트 정상 통과
   - standing/seated 정상 실패
3. trace가 `activeAttemptWindowSatisfied=true`를 보여야 함 (정상 스쿼트에서)
4. legacy fields가 debug/compat-only임이 trace에서 확인됨

## 11. 변경 파일 목록

- `src/lib/camera/squat/squat-motion-evidence-v2.types.ts` — 신규 evidence/metrics 필드 추가
- `src/lib/camera/squat/squat-motion-evidence-v2.ts` — temporal closure guard 구현
- `src/lib/camera/evaluators/squat.ts` — V2 입력 창 5000ms 바인딩
- `scripts/camera-squat-v2-01-motion-evidence-engine-smoke.mjs` — 신규 fail 케이스 6개 추가
- `fixtures/camera/squat/golden/manifest.json` — 신규 fixture 2개 추가
- `fixtures/camera/squat/golden/descent_start_only_must_fail_01.json` — 신규
- `fixtures/camera/squat/golden/stale_buffer_closure_must_fail_01.json` — 신규
- `docs/pr/PR-SQUAT-V2-02C-V2-TEMPORAL-CLOSURE-GUARD.md` — 본 문서

변경하지 않은 것:
- overhead reach evaluator
- `/app/home`, `/app/checkin`, `/app/profile`
- AppShell, SessionPanelV2, ExercisePlayerModal
- auth, payment, onboarding, session execution
- legacy squat completion chain (quality/debug-only 유지)
- auto-progression owner (여전히 `squat_motion_evidence_v2`)

---

## 최종 보고서: 13개 질문 답변

**1. 하강 시작 직후 pass가 발생한 직접 원인은 무엇이었는가?**

`evaluators/squat.ts`가 V2에 `validRaw` 전체(세션 시작부터 누적된 모든 유효 프레임)를 넘겼기 때문이다. 세션 초기 셋업 포지셔닝 동작(몸을 굽혀 카메라 위치 잡기 → 다시 서기)이 버퍼에 남아 있었고, V2가 이를 완전한 `down_up_return` 사이클로 인식했다. 사용자가 실제 스쿼트를 시작하면 — 즉, 하강을 시작하는 순간 — V2는 이미 `usableMotionEvidence=true` 상태였다.

**2. V2가 어떤 frame들을 합쳐 down_up_return으로 오판했는가?**

세션 초기의 **셋업 포지셔닝 프레임** (카메라 설치/위치 조정 시 몸을 굽혔다 폈던 구간) + 이후 **readiness dwell 안정 프레임** 의 조합이다. 구체적으로:
- `startIndex` = 셋업 포지셔닝 시작 (타임스탬프 0 근처)
- `peakIndex` = 셋업 굽힘 최고점
- `reversal` = 셋업 완료 후 다시 서는 동작
- `returnIndex` = 서기 완료 후 readiness dwell 프레임 (~7초 후)
- `stableAfterReturn` = readiness dwell 구간 = true

**3. nearStartReturn이 reversal 이후에만 true가 되도록 보장했는가?**

예. `nearStartReturn` 정의를 `meaningfulDescent && reversal && returnIndex != null`로 명확화했다. 구조적으로 `returnIndex`는 `peakIndex + 1` 이후에만 검색되고, `reversal`도 동일 구간에서 검출된다.

**4. stableAfterReturn이 초기 안정 프레임이 아니라 return 이후 프레임인지 보장했는가?**

예. `stableAfterReturn`은 `returnIndex != null`인 경우에만 `depths.slice(returnIndex, returnIndex + STABLE_RETURN_FRAMES)`에서 계산된다. 초기 셋업 안정 프레임은 evaluator-side 5000ms 창 바인딩으로 V2에 전달되지 않는다.

**5. sameRepOwnership이 시간 순서를 검증하는가?**

예. `startIndex < peakIndex` 조건, 연속 프레임 간 750ms 초과 갭 체크, window 내 setupPhase 프레임 없음 조건이 유지된다. 추가로 `reversalFrameIndex`를 정확히 추적해 evidence에 노출한다.

**6. activeAttemptWindow 또는 bounded post-ready window만 평가하는가?**

예. 이중 방어:
- `evaluators/squat.ts`: 최근 5000ms로 바인딩
- `squat-motion-evidence-v2.ts`: `returnMs > 8000ms` → `window_out_of_scope` 거부

**7. descent_start_only_must_fail fixture가 추가됐는가?**

예. `fixtures/camera/squat/golden/descent_start_only_must_fail_01.json` 및 smoke 케이스 `descent_start_only_must_fail` 추가됨. V2 결과: `usableMotionEvidence=false, blockReason=no_reversal`.

**8. stale_buffer_closure_must_fail fixture가 추가됐는가?**

예. `fixtures/camera/squat/golden/stale_buffer_closure_must_fail_01.json` 및 smoke 케이스 `stale_buffer_closure_must_fail` 추가됨. V2 결과: `usableMotionEvidence=false, blockReason=window_out_of_scope`.

**9. valid shallow down_up_return은 여전히 pass하는가?**

예. `valid_shallow_must_pass_01`, `valid_shallow_real_device_failed_01/02/03` 모두 pass. Shadow compare와 runtime owner truth smoke 모두 PASS.

**10. standing/seated/arm-only fail은 유지되는가?**

예. `standing_must_fail_01`, `seated_must_fail_01` 모두 V2 `usableMotionEvidence=false` 유지.

**11. autoProgression owner는 여전히 squat_motion_evidence_v2인가?**

예. `autoProgressionDecision.owner='squat_motion_evidence_v2'`는 모든 runtime owner truth smoke에서 확인됨.

**12. legacy가 다시 owner가 되지 않았는가?**

예. legacy fields(`completionSatisfied`, `finalPassEligible` 등)는 여전히 `legacyQualityOrCompat` 하위에 debug/compat-only로 격리됨. V2 `usableMotionEvidence`가 단독 progression owner.

**13. PR6로 넘어가도 되는가?**

LOCKED_DIRECTION: 실기기 re-dogfooding 후 결정. 이번 PR acceptance commands는 모두 green이다. 실기기에서 하강 시작 즉시 통과하지 않음을 확인한 뒤 PR6로 진행한다.
