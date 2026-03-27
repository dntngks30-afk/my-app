# PR-HMM-01B — Squat Temporal Shadow Decoder

**Branch:** `feat/pr-hmm-01b-squat-shadow-decoder`  
**Status:** Shadow / Debug layer only. Pass truth 변경 없음.

---

## 1. 왜 guarded finalize 이후에도 HMM이 필요한가

PR-A~C (shallow squat completion slice alignment + guarded finalize)에서:

- `squat-completion-arming.ts`의 peak-anchored arming + `STANDING_INTERNAL_RANGE_MAX`로 **slice 선택 품질**이 개선됐다.
- `squat-completion-state.ts`의 guarded finalize로 `ultra_low_rom` 사이클도 짧은 standing tail이면 통과할 수 있게 됐다.

그러나 현재 rule-based state machine의 한계:

1. **phase 할당이 단순 threshold 기반**이라 slow-ramp descent/ascent를 standing으로 오인할 수 있다.
2. **시간 구조 전체를 한 번에 보지 않는다** — 각 단계가 순서대로 일어났는지 전역적으로 검증하지 않는다.
3. **false negative의 병목이 후반 finalize보다 초중반 phase segmentation에 더 가까운 경우**가 있다.

HMM shadow decoder는 이 모든 영역을 "앞단 시간 분절 레이어"로 독립 감시한다:

- rule-based phaseHint와 완전히 독립적인 temporal segmentation
- 시간적으로 의미 있는 `standing→descent→bottom→ascent→standing` 사이클 탐지
- phase segmentation 실패 원인을 `completionCandidate`, `dominantStateCounts`, `effectiveExcursion`로 노출

---

## 2. 왜 evaluator shadow layer가 첫 삽입점인가

현재 구조에서 안전하게 삽입할 수 있는 위치는 `evaluators/squat.ts` 안이다:

```
pose-features.ts        → PoseFeaturesFrame[]
                              ↓
evaluators/squat.ts     → computeSquatCompletionArming()
                          evaluateSquatCompletionState()
                          decodeSquatHmm()  ← [HERE] shadow layer
                              ↓
debug.squatHmm          → observability 전용 (pass gate 아님)
                              ↓
auto-progression.ts     → getSquatProgressionCompletionSatisfied()
                          squatCycleDebug.hmmConfidence / hmmCompletionCandidate  ← trace only
```

이 삽입점의 장점:
- `completionSatisfied` semantics를 전혀 건드리지 않는다
- `squatCompletionState`가 truth를 유지하고, HMM은 그 **옆**에 독립 존재한다
- 롤백 시 `decodeSquatHmm()` 호출 한 줄만 제거하면 된다

---

## 3. 이 PR이 pass truth를 바꾸지 않는 이유

| 항목 | 상태 |
|------|------|
| `completionSatisfied` semantics | **변경 없음** |
| `low_rom_guarded_finalize` 동작 | **변경 없음** |
| `ultra_low_rom_guarded_finalize` 동작 | **변경 없음** |
| `completionBlockedReason` 값 셋 | **변경 없음** |
| auto-progression pass/retry/fail contract | **변경 없음** |
| page/voice/auto-advance UX | **변경 없음** |
| retry tag mapping | **변경 없음** |

HMM 출력은:
- `debug.squatHmm` (EvaluatorDebugSummary — observability 전용)
- `highlightedMetrics.hmmConfidence` / `hmmCompletionCandidate` 등 7개 스칼라 (debug trace)
- `SquatCycleDebug.hmmConfidence` / `hmmCompletionCandidate` / `hmmDominantPath` (trace log)
- `diagnosisSummary.squatCycle.hmmShadow` (compact snapshot)

에만 실린다. 어떤 gate에도 진입하지 않는다.

---

## 4. HMM 설계 요약

### 상태 (4개)
| idx | name | 의미 |
|-----|------|------|
| 0 | standing | 서 있음 |
| 1 | descent | 하강 중 |
| 2 | bottom | 바닥 |
| 3 | ascent | 상승 중 |

### 전이 구조
```
standing  → standing(0.85) / descent(0.15)
descent   → descent(0.55)  / bottom(0.45)
bottom    → bottom(0.55)   / ascent(0.45)
ascent    → standing(0.45) / ascent(0.55)
비현실 점프(standing→bottom, descent→standing 직접 등) = -Infinity
```

### Emission 모델
`squatDepthProxy`(절댓값) + `frame-to-frame depth delta` 결합 가우시안 근사.

| state | mean_depth | sigma_depth | mean_delta | sigma_delta |
|-------|-----------|------------|-----------|------------|
| standing | 0.01 | 0.015 | 0.000 | 0.006 |
| descent | 0.04 | 0.040 | +0.006 | 0.008 |
| bottom | 0.07 | 0.050 | 0.000 | 0.006 |
| ascent | 0.04 | 0.040 | -0.006 | 0.008 |

### null/invalid 프레임 처리
제거 대신 `INVALID_FRAME_LOG_EMISSION = log(0.25)` soft penalty — 어떤 상태도 강제하지 않음.

### completionCandidate 판정 조건
1. `effectiveExcursion ≥ 0.018` (최소 실효 깊이 변화)
2. RLE 기반 순서 FSM: `standing(≥1) → descent(≥2) → bottom(≥1) → ascent(≥2)` 순서로 모두 등장
3. 각 상태 최소 dwell 충족

---

## 5. 다음 PR에서 completionBlockedReason assist에 쓰는 계획

현재 `completionBlockedReason`의 주요 false negative 경로:

```
descent_span_too_short
recovery_hold_too_short
ultra_low_rom_standing_finalize_not_satisfied
```

다음 PR (`PR-HMM-02: assist truth wiring`)에서:

1. `completionCandidate === true && hmmConfidence > 0.4` → 이미 real cycle이 있다는 증거
2. rule-based completion이 `descent_span_too_short`로 차단됐는데 HMM이 descent≥2를 봤다면 → arming window 재조정 신호
3. HMM counts를 `completionBlockedReason`에 대한 **secondary assist evidence**로 사용해 false negative를 완화 가능

이때도 **final pass gate는 rule-based truth가 소유**한다. HMM은 evidence 강도 조정 역할만.

---

## 6. 파일 변경 목록

| 파일 | 변경 종류 |
|------|-----------|
| `src/lib/camera/squat/squat-hmm.ts` | **신규** — Viterbi shadow decoder |
| `src/lib/camera/evaluators/types.ts` | additive: `squatHmm?: SquatHmmDecodeResult` import 및 필드 |
| `src/lib/camera/evaluators/squat.ts` | additive: `decodeSquatHmm` 호출, `debug.squatHmm`, `highlightedMetrics` 7개 스칼라 |
| `src/lib/camera/auto-progression.ts` | additive: `SquatCycleDebug`에 3개 shadow trace 필드, trace 주입 |
| `src/lib/camera/camera-trace.ts` | additive: `diagnosisSummary.squatCycle.hmmShadow` compact summary |
| `scripts/camera-pr-hmm-01b-squat-shadow-smoke.mjs` | **신규** — shadow decoder smoke (7개 시나리오) |

---

## 7. Acceptance Checklist

- [x] `scripts/camera-cam27-lowrom-standing-recovery-finalize-smoke.mjs` 통과 (변경 없음)
- [x] `scripts/camera-pr-hmm-01b-squat-shadow-smoke.mjs` 7개 시나리오 통과
- [x] `completionSatisfied` / `completionBlockedReason` / `standingRecoveryFinalizeReason` semantics 동일
- [x] auto-progression pass/retry/fail contract 변경 없음
- [x] additive type change only
- [x] page/voice behavior regression 없음
