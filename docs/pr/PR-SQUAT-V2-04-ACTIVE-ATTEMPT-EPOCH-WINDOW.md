# PR-SQUAT-V2-04 — Active Attempt Epoch Window

## Status: CURRENT_IMPLEMENTED

---

## 1. PR6가 직접 원인이 아니라는 결론

PR6 regression bisect 결과:

- PR6의 `auto-progression.ts` 변경은 **type/JSDoc/trace-only** diff였다.
- `progressionPassed`·`finalPassEligible`·`isFinalPassLatched` 로직에 behavioral 변경 없음.
- Pre-PR6 상태로 `auto-progression.ts`만 되돌린 후 모든 acceptance smoke test를 재실행한 결과 **결과가 동일**했다.
- 따라서 PR6는 직접 원인이 아니다.

**CURRENT_IMPLEMENTED**: 직접 원인은 `SquatMotionEvidenceEngineV2`가 `latestValidTs_minus_5000ms` rolling window를 사용하면서 실기기에서 current attempt의 reversal/return closure를 안정적으로 닫지 못하는 것이었다.

---

## 2. Rolling 5s Window가 현재 병목인 이유

### 반복 실패 패턴 (실기기 JSON 2, JSON 3 공통)

```
v2EpochSource:            latestValidTs_minus_5000ms
inputWindowDurationMs:    ≈4900–5000ms
descentStartFrameIndex:   0
preDescentBaselineSatisfied: false
peakFrameIndex:           50 (of 51 total frames)
reversalFrameIndex:       null
blockReason:              no_reversal / no_return_to_start
```

### 근본 메커니즘

**Case A — 천천히 하강하는 경우 (descent > 3s)**

사용자가 천천히 앉으면 5000ms rolling window가 descent 전체로 채워진다:

```
[T-5000ms → T] = [descent start → peak (at tail)]
→ V2 window에 peak 이후 프레임이 없음
→ reversal/return 감지 불가
→ no_reversal 차단
```

**Case B — 복귀 후 window 이동**

사용자가 상승을 완료하면 window가 앞으로 이동:

```
[T+1000ms-5000ms → T+1000ms] = [mid-descent → return]
→ descentStartFrameIndex=0 (window이 descent 도중 시작)
→ startDepth = mid-descent depth ≈ 0.35 (standing depth 아님)
→ relativePeak = 0.90 - 0.35 = 0.55 → romBand='shallow' (실제론 deep)
```

이것이 JSON 3에서 deep squat가 `romBand='shallow'`로 기록된 원인이다.

---

## 3. Active Attempt Epoch 기준

`evaluators/squat.ts`의 `computeActiveAttemptEpoch` 함수가 매 evaluation tick마다 호출된다.

### 우선순위

```
A. first meaningful descent candidate detected
   → epochStartMs = descentCandidateMs - PRE_DESCENT_BASELINE_MS(500ms)
   → epochSource = 'active_attempt_epoch_with_pre_descent_baseline'
      or 'active_attempt_epoch'

B. fallback: rolling 5s window
   → epochStartMs = latestValidTs - MAX_V2_EVAL_WINDOW_MS(5000ms)
   → epochSource = 'rolling_window_fallback'
   → usedRollingFallback = true
```

### 알고리즘 (stateless, 매 tick 계산)

```
1. validRaw에서 최근 MAX_EPOCH_LOOKBACK_MS(8000ms) 내 프레임 추출
2. depth peak(= squat bottom) 탐색
3. peak < EPOCH_DESCENT_THRESHOLD(0.035) → rolling fallback
4. peak에서 역방향 스캔 → local minimum(= descent 시작 직전) 탐색
5. setup/framing 프레임이 있으면 그 이후로 clip
6. epochStartMs = descentStartMs - PRE_DESCENT_BASELINE_MS(500ms)
7. V2에 epochStartMs 이후 프레임 전달
```

### 결과

| | 이전 (rolling 5s) | 이후 (active epoch) |
|---|---|---|
| descentStartFrameIndex | 0 (no baseline) | ≥3 (pre-descent baseline 포함) |
| startDepth | mid-descent depth (부정확) | standing depth (정확) |
| relativePeak | 과소평가 | 정확 |
| romBand (deep squat) | shallow (오분류) | deep (정확) |
| reversal 감지 | 불가 (peak at tail) | 가능 (full cycle visible) |

---

## 4. Setup/Framing Translation Frame 제외 방식

`computeActiveAttemptEpoch`에서 epoch 계산 시:

```typescript
for (let i = descentStartIdx; i >= 0; i--) {
  const ph = String(recentFrames[i]!.phaseHint ?? '').toLowerCase();
  if (ph === 'setup' || ph === 'readiness' || ph === 'align' || ph === 'alignment') {
    setupClipIdx = i + 1;  // setup 이후부터 시작
    epochResetReason = 'setup_phase_excluded';
    break;
  }
}
```

- `phaseHint=setup|readiness|align|alignment` 프레임을 발견하면 그 이후로 epoch clip
- `epochResetReason='setup_phase_excluded'` 기록

대형 framing translation의 경우 `phaseHint=setup`으로 처리되므로 자동 제외된다.

---

## 5. Epoch Reset 조건

이 구현은 stateless이므로 매 tick마다 epoch를 재계산한다. 자연적인 "reset"은 다음 상황에서 발생한다:

| 조건 | 결과 |
|---|---|
| setup/framing 프레임 발견 | epochClip → setup 이후로 epoch 재설정 (`epochResetReason='setup_phase_excluded'`) |
| 의미 있는 depth peak 없음 | rolling fallback (`usedRollingFallback=true`) |
| retry/capture 새 시작 | `validRaw` 버퍼 초기화 → epoch 자연 갱신 |
| terminal pass/fail 이후 | 버퍼 초기화 → epoch 갱신 |
| `no_reversal` 장기 지속 | peak이 계속 tail에 붙은 상태 → rolling fallback 자동 적용됨 |

`epochResetReason` 필드로 trace에 기록된다.

---

## 6. V2 Pass Logic 자체는 변경하지 않았다는 증거

`squat-motion-evidence-v2.ts`에 대한 변경 없음:

- `MAX_SQUAT_CYCLE_MS = 4500` — 유지
- `MAX_TAIL_CLOSURE_LAG_MS = 400` — 유지
- `MEANINGFUL_DESCENT_MIN = 0.035` — 유지
- `findMotionWindow` — 변경 없음
- `no_reversal` 판정 로직 — 변경 없음
- `no_return_to_start` 판정 로직 — 변경 없음
- `stale_closure_not_at_tail` 판정 — 변경 없음
- `attempt_duration_out_of_scope` 판정 — 변경 없음
- shallow promotion patch — 추가 없음

변경된 파일:
- `src/lib/camera/evaluators/squat.ts` — epoch 계산 로직 및 fallback 교체
- `src/lib/camera/squat/squat-motion-evidence-v2.types.ts` — 신규 diagnostic 타입 필드 추가

V2 engine 자체(`squat-motion-evidence-v2.ts`)는 변경하지 않았다.

---

## 7. 추가한 Debug Fields

`SquatMotionEvidenceDecisionV2.metrics`에 추가된 필드 (타입 정의: `squat-motion-evidence-v2.types.ts`):

| 필드 | 의미 |
|---|---|
| `v2EpochSource` | `active_attempt_epoch_with_pre_descent_baseline` / `active_attempt_epoch` / `rolling_window_fallback` |
| `usedRollingFallback` | rolling 5s window를 fallback으로 사용했을 때 `true` |
| `activeAttemptEpochStartMs` | 계산된 epoch 시작 timestamp (ms) |
| `activeAttemptEpochSource` | `first_descent_candidate` / `rolling_fallback` |
| `latestFrameTimestampMs` | V2에 전달된 마지막 프레임 timestamp |
| `preDescentBaselineFrameCount` | descentStartFrameIndex 이전 baseline frame 수 |
| `peakDistanceFromTailFrames` | peak에서 마지막 프레임까지의 frame 수 (0이면 reversal 감지 불가) |
| `peakDistanceFromTailMs` | peak에서 마지막 프레임까지의 ms |
| `framesAfterPeak` | peakDistanceFromTailFrames의 alias |
| `msAfterPeak` | peakDistanceFromTailMs의 alias |
| `cycleDurationCandidateMs` | descentStart부터 latestFrame까지 (closure 미확정 시 cycle 진행 추정) |
| `cycleCapExceeded` | cycleDurationCandidate 또는 returnMs가 4500ms 초과 여부 |
| `epochResetReason` | `setup_phase_excluded` / `null` |

모두 `evaluators/squat.ts`에서 V2 call 이후 `metrics` 객체에 annotate된다.

`buildSquatV2RuntimeOwnerDecisionTrace`가 `metrics: { ...decision.metrics }` 스프레드를 사용하므로 trace로 자동 노출된다.

---

## 8. 추가한 Observation Fixtures

`fixtures/camera/squat/observations/` 디렉토리 신설 및 4개 fixture 추가:

| 파일 | 시나리오 | 예상 결과 |
|---|---|---|
| `real_device_pr6_after_shallow_no_reversal_01.json` | Rolling window failure: 51 frames, peak at tail (frame 50), no reversal room | `usableMotionEvidence=false`, `motionPattern=bottom_hold`, `blockReason=no_return_to_start` |
| `real_device_pr6_after_shallow_no_reversal_02.json` | Active epoch success: pre-descent baseline + full shallow cycle (2.9s) | `usableMotionEvidence=true`, `motionPattern=down_up_return`, `romBand=shallow` |
| `real_device_pr6_after_deep_no_return_01.json` | Rolling window failure: mid-descent cut, bottom_hold, no return | `usableMotionEvidence=false`, `motionPattern=bottom_hold`, `blockReason=no_return_to_start` |
| `real_device_pr6_after_shallow_late_pass_01.json` | Active epoch success: pre-descent baseline + full deep cycle (3.1s) | `usableMotionEvidence=true`, `motionPattern=down_up_return`, `romBand=deep` |

기존 golden fixtures는 변경하지 않았다.

---

## 9. 신규 Active Epoch Report Script

`scripts/camera-squat-v2-04-active-epoch-report.mjs`

출력 columns:
```
fixture | v2EpochSource | usedRollingFallback | activeAttemptEpochStartMs
inputWindowDurationMs | inputFrameCount | usableMotionEvidence | motionPattern
blockReason | romBand | relativePeak | descentStartFrameIndex | peakFrameIndex
peakDistanceFromTailFrames | framesAfterPeak | reversalFrameIndex
nearStartReturnFrameIndex | stableAfterReturnFrameIndex | cycleDurationCandidateMs
cycleCapExceeded | diagnosis
```

**참고**: 이 스크립트는 `evaluateSquatMotionEvidenceV2`를 직접 호출하므로 `v2EpochSource`는 evaluator 레이어에서 annotation되지 않아 `unknown`으로 표시된다. 실기기 runtime에서는 `evaluators/squat.ts`를 통해 정상적으로 annotation된다.

실행 결과 요약 (20 fixtures):
- `usableMotionEvidence=true`: 6 (must-pass 3 + obs pass 2 + deep pass 1)
- `usableMotionEvidence=false`: 14 (must-fail 10 + obs fail 2 + 추출 방식 차이 2)

---

## 10. 기존 Smoke/Golden/Shadow 결과

실행 명령 및 결과:

```
npx tsx scripts/camera-squat-v2-01-motion-evidence-engine-smoke.mjs
→ 233 passed, 0 failed ✓

npx tsx scripts/camera-squat-v2-00-golden-trace-harness.mjs --strict
→ STRICT: all required contracts satisfied. ✓

npx tsx scripts/camera-squat-v2-01b-shadow-compare.mjs --strict
→ --strict: all V2 results match expected. ✓

npx tsx scripts/camera-squat-v2-02b-runtime-owner-truth-smoke.mjs
→ All PR5-FIX runtime owner truth checks passed. ✓

npx tsx scripts/camera-squat-v2-04-active-epoch-report.mjs
→ Exit code 0, report generated ✓
```

---

## 11. 실기기 재검증 항목

### 검증 항목

| # | 항목 | 기준 |
|---|---|---|
| 1 | shallow squat 자연 통과 | 3회 중 최소 2회 통과 |
| 2 | deep squat 자연 통과 | 1회 자연 통과 |
| 3 | 하강 시작 직후 통과 금지 | peakDistanceFromTailFrames > 5 |
| 4 | standing only 통과 금지 | `motionPattern != standing_only` 상태서 pass 없음 |
| 5 | seated/bottom hold 통과 금지 | `motionPattern != bottom_hold` 상태서 pass 없음 |
| 6 | arm-only/upper-body-only 통과 금지 | `motionPattern != upper_body_only` 상태서 pass 없음 |

### 기대 trace 필드 변화

실기기에서 PR6-FIX-01 이후 예상 변화:

| 필드 | 이전 | 이후 |
|---|---|---|
| `v2EpochSource` | `latestValidTs_minus_5000ms` | `active_attempt_epoch_with_pre_descent_baseline` |
| `usedRollingFallback` | (없음) | `false` (정상 시) |
| `descentStartFrameIndex` | `0` | `3~10` (pre-descent baseline 포함) |
| `peakDistanceFromTailFrames` | `0~2` (실패 시) | `>5` (ascent 감지 가능) |
| `romBand` (deep squat) | `shallow` (오분류) | `deep` (정확) |

---

## 12. PR7 진행 가능 조건

다음이 모두 충족되어야 PR7 진행 가능:

- [x] acceptance smoke tests 전부 PASS (233/233)
- [x] golden strict 통과
- [x] shadow compare strict 통과
- [x] runtime owner truth 통과
- [x] diagnostic report script 실행 성공
- [ ] 실기기 shallow squat 3회 중 2회 이상 자연 통과 확인
- [ ] 실기기 deep squat 1회 자연 통과 확인
- [ ] `v2EpochSource=active_attempt_epoch_with_pre_descent_baseline` trace에서 확인
- [ ] false positive (하강만으로 통과) 미발생 확인

---

## 변경 파일 요약

| 파일 | 변경 내용 |
|---|---|
| `src/lib/camera/evaluators/squat.ts` | `computeActiveAttemptEpoch` 함수 추가, V2 eval window를 epoch 기반으로 교체, diagnostic fields annotation |
| `src/lib/camera/squat/squat-motion-evidence-v2.types.ts` | 신규 metrics 타입 필드 14개 추가 |
| `fixtures/camera/squat/observations/*.json` | observations 디렉토리 신설, 4개 fixture 추가 |
| `scripts/camera-squat-v2-04-active-epoch-report.mjs` | 신규 diagnostic report script |
| `docs/pr/PR-SQUAT-V2-04-ACTIVE-ATTEMPT-EPOCH-WINDOW.md` | 본 PR 문서 |

**변경하지 않은 파일 (의도적)**:
- `src/lib/camera/squat/squat-motion-evidence-v2.ts` — V2 pass logic 변경 없음
- `src/lib/camera/auto-progression.ts` — owner 구조 변경 없음
- `src/lib/camera/trace/*.ts` — metrics 스프레드로 자동 노출됨
- `fixtures/camera/squat/golden/*.json` — 기존 must-pass/must-fail 유지
