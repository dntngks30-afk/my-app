# PR-CAM-29C — Actual Ultra-Shallow Reversal Unlock for 0.02–0.08

## Status
**CURRENT_IMPLEMENTED** — main 브랜치에 반영 완료 (PR-CAM-29B 커밋에서 구현, 29C에서 smoke 검증)

---

## 1. Findings

### 왜 main의 0.08~0.12-only 완화가 부족했는가

PR-CAM-SHALLOW-REVERSAL-SIGNAL-01 은 `[0.08, 0.12)` 구간에만 `shallowWindowReversalRelax`를 추가했다.
`0.02 <= relativeDepthPeak < 0.08` 구간은 여전히 strict-only(`strictPrimaryHit` / `strictReversalHit` 2-frame 연속 hit 요구)였으므로,
피크 깊이가 아주 작은(0.06 수준) 사용자는 `no_reversal`에서 계속 정체했다.

`toSquatDepthProxy` 는 logistic 함수(mid=75도, scale=6.5도)를 사용하며, 실제 사용자 무릎 굽힘이
90~97도 수준에서 멈추면 depth proxy ≈ 0.02~0.09가 된다. 이 구간 사용자가 정상 사이클을 완료해도
reversal 확인이 되지 않아 영구 `no_reversal` 상태였다.

### 왜 0.02~0.08 unlock이 실제 병목인가

관측 JSON 패턴:
- `relativeDepthPeak=0.06` → `no_reversal` / `recovery_hold_too_short` 반복
- 이후 0.09, 0.15, 0.22, 0.63 으로 깊어지며 결국 통과

즉 첫 사이클부터 shallow unlock이 없으면 사용자가 지속적으로 더 깊은 스쿼트를 요구받는 문제 발생.

---

## 2. Files Changed

### 구현 파일 (PR-CAM-29B 커밋에서 반영, 변경 없음)

#### `src/lib/camera/squat/squat-reversal-confirmation.ts`
- `LEGACY_ATTEMPT_FLOOR = 0.02`, `MIN_DESCENT_FRAMES = 3`, `MIN_REVERSAL_FRAMES = 2` 상수 추가
- `guardedUltraShallowReversalAssist()` 함수 추가:
  - 적용 범위: `[LEGACY_ATTEMPT_FLOOR, ULTRA_SHALLOW_STRICT_ONLY_FLOOR)` = `[0.02, 0.08)`
  - strict primary/blended hit 실패 후에만 호출
  - `postPeakMonotonicReversalAssist` + `ascentStreakMax >= 2` + `postPeakFrameCount >= 3` 동시 요구
  - `source: 'rule'` 고정, HMM bridge/rule_plus_hmm 확장 없음
  - 성공 note: `guarded_ultra_shallow_reversal_assist`
  - 실패 note: `ultra_shallow_guarded_assist_no_hit`
- `detectSquatReversalConfirmation()` 구간 분기:
  - `< 0.02`: strict-only 유지 (`ultra_shallow_strict_only_no_hit`)
  - `[0.02, 0.08)`: guarded assist 추가
  - `[0.08, 0.12)`: 기존 `shallowWindowReversalRelax` 유지
  - `>= 0.12`: 기존 moderate 흐름 유지

#### `src/lib/camera/pose-features.ts`
- `hasGuardedShallowSquatAscent()` 함수 추가 (export):
  - `hasGuardedShallowSquatDescent` 의 대칭 mirror
  - 기존 `SHALLOW_DESCENT_*` 상수만 재사용 (신규 수치 없음)
  - 조건: sessionPeak ∈ [0.03, 0.08), currentDepth ∈ [0.03, 0.08), 연속 감소 추세, excursion >= 0.015
- `applyPhaseHints()` 스쿼트 분기 순서 수정:
  1. `guardedShallowDescent` → `'descent'`
  2. `guardedShallowAscent` → `'ascent'` ← **신규**
  3. ultra-shallow bottom/start fallback (기존)
  4. 일반 bottom/descent/ascent 로직 (기존)

### 신규 파일 (PR-CAM-29C)

| 파일 | 목적 |
|------|------|
| `scripts/camera-cam29c-ultra-shallow-0p02-0p08-reversal-smoke.mjs` | [0.02,0.08) 다중 피크 깊이 reversal 확인 |
| `scripts/camera-cam29c-guarded-shallow-ascent-smoke.mjs` | guarded ascent phase 레이블 + pipeline 관측 |
| `scripts/camera-cam29c-ultra-shallow-integration-smoke.mjs` | 완전 사이클·중간 차단·deep regression E2E |
| `docs/pr/PR-CAM-29C-ACTUAL-ULTRA-SHALLOW-REVERSAL-UNLOCK.md` | 본 문서 |

---

## 3. Regression Guards

### standing/jitter/1-frame spike 회귀 차단

| 회귀 시나리오 | 차단 이유 |
|-------------|---------|
| standing jitter (`rel < 0.02`) | `LEGACY_ATTEMPT_FLOOR` 미만 → strict-only 경로, jitter drop이 req 미달 |
| seated hold | `postPeakMonotonicReversalAssist` 실패 (단조 상승 없음) |
| 1-frame spike | strict 2-frame 연속 hit 불가 + monotonic assist minFrames=3 요구 |
| 상승 중간 latch | CAM-29A `minimumCycleDurationSatisfied` 게이트 유지 |
| 하강 중 pass | `standing_recovered` 미도달 → completion 미충족 |

### owner/finalize/timing 미수정 명시

- `squat-completion-state.ts`: **미수정**
- `squat-completion-arming.ts`: **미수정**
- `squat-event-cycle.ts`: **미수정**
- `auto-progression.ts`: **미수정**
- `squat-depth-signal.ts`: **미수정**

---

## 4. Tests Run

```bash
# CAM-29C 신규 스모크 (모두 pass)
npx tsx scripts/camera-cam29c-ultra-shallow-0p02-0p08-reversal-smoke.mjs  # 9/9
npx tsx scripts/camera-cam29c-guarded-shallow-ascent-smoke.mjs            # 4/4
npx tsx scripts/camera-cam29c-ultra-shallow-integration-smoke.mjs         # 7/7

# 기존 회귀 스모크
npx tsx scripts/camera-pr-04e2-squat-reversal-confirmation-stabilization-smoke.mjs  # 13/13 PASS
npx tsx scripts/camera-pr-04e3a-squat-relative-depth-truth-align-smoke.mjs          # 11/11 PASS
npx tsx scripts/camera-pr-04e3b-squat-event-cycle-owner-smoke.mjs                   # 12/13 (A4 pre-existing)
npx tsx scripts/camera-pr-arming-baseline-handoff-01-smoke.mjs                      # 11/11 PASS
npx tsx scripts/camera-pr-retro-arming-assist-01-smoke.mjs                          # 19/19 PASS
npx tsx scripts/camera-ultra-low-rom-event-gate-01-smoke.mjs                        # 8/8 PASS
npx tsx scripts/camera-pr-core-pass-reason-align-01-smoke.mjs                       # 12/12 PASS
npx tsx scripts/camera-cam29a-squat-final-pass-timing-smoke.mjs                     # 14/14 PASS
npx tsx scripts/camera-cam29a-squat-no-mid-ascent-open-smoke.mjs                    # 4/4 PASS
npx tsx scripts/camera-cam29b-ultra-shallow-reversal-guard-smoke.mjs                # 5/5 PASS
npx tsx scripts/camera-cam29b-guarded-shallow-ascent-phase-smoke.mjs                # 4/4 PASS
npx tsx scripts/camera-cam29b-ultra-shallow-integration-smoke.mjs                   # 6/6 PASS
```

### Pre-existing 실패 (본 PR 미도입)
- `04E3B A4`: `completion owner is low/ultra event cycle | got: "not_confirmed"` — git stash 검증으로 PR-CAM-29A 이전부터 존재 확인

---

## 5. Residual (2차 병목)

1. **`recovery_hold_too_short`** — ultra-shallow rep에서 `squatReversalToStandingMs` 충족이 어려움.  
   다음 단계: hold 요구 시간이 ultra-shallow에서 완화 가능한지 검토 필요.

2. **`ascentStreakMax` 의존성** — `computePostPeakRecoveryEvidence`의 streak 카운트가  
   `stabilizePhaseSequence(2)` 이후 phase label을 사용하므로, 빠른 ascent에서 streak=1로 떨어질 수 있음.  
   현재 smoke에서는 통과하나 실기기에서 재검증 권장.

3. **카메라 실기 검증** — 모든 변경은 합성 데이터 기반. 실기기 dogfooding 필수.

---

## Verification

```bash
npx tsx scripts/camera-cam29c-ultra-shallow-0p02-0p08-reversal-smoke.mjs
npx tsx scripts/camera-cam29c-guarded-shallow-ascent-smoke.mjs
npx tsx scripts/camera-cam29c-ultra-shallow-integration-smoke.mjs
```
