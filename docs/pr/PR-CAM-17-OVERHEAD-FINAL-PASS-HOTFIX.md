# PR-CAM-17 — Overhead Final Pass Owner Hotfix

**상태**: CURRENT_IMPLEMENTED  
**날짜**: 2026-03-26  
**작성자**: principal motion-analysis engineer

---

## 1. Findings

### 최종 pass 체인 버그 (각도 하한 이후에도 통과 안 되던 원인)

PR-CAM-16까지 easy/low_rom/humane_low_rom 경로의 _평가기 진행(progression)_ 자체는 충족되고 있었다. 그러나 최종 UI pass(성공 음성·자동 전진)가 여전히 발화하지 않은 이유는 **final pass 체인**의 세 지점이었다.

#### Bug 1 (Critical) — `isFinalPassLatched` easyOnly 미탐지

```
// 기존 (잘못됨)
const easyOnly = Boolean(easySat && !strictMotion);
//                        ↑ low_rom·humane 경로 누락
```

`lowRomProgressionSatisfied`, `humaneLowRomProgressionSatisfied`가 `easyOnly` 계산에 포함되지 않아:
- `confTh` → 0.72 (strict threshold) 적용 — 0.58~0.71 구간 humane/low_rom pass 차단
- `framesReq` → 3+ (strict) 적용 — 2 프레임이면 충분한 humane pass가 latch 안 됨
- 결과: `effectivePassLatched=false` → 성공 음성 누락, 애매 재시도 오발화

#### Bug 2 (Secondary) — `lowConfidenceRetry` 임계 오적용

```
// 기존 (잘못됨)
const lowConfidenceRetry = guardrail.retryRecommended && confidence < passThreshold;
//                                                                   ↑ 0.72 (strict)
```

easy/low_rom/humane 경로에서 `passThresholdEffective`(0.58)를 써야 하는데 `passThreshold`(0.72)를 써서, 느린 humane 사용자의 세션이 조기 retry로 종료되는 문제.

#### Bug 3 — Guardrail raiseCount hard-gate

`raiseCount === 0` 조건이 easy/low_rom/humane 세 경로 모두에서 `rep_incomplete` + `partial` 반환을 유발했다. 느린 팔 올리기에서 `phaseHint='raise'` 감지(`delta > 2.2°/frame`)가 실패하면 `raiseCount=0`이 돼 guardrail 완료 상태가 `partial`로 고정, 이후 `overheadRepHoldBlocks` 계산이나 retry 분기에서 차단.

#### 각도 하한 단독으로는 해결 불가한 이유

- PR-CAM-13~16에서 각도 floor를 낮췄어도 progression이 충족된 뒤 `isFinalPassLatched`가 'easy-only' 임계를 적용하지 않으면 UI 성공 경로가 열리지 않는다.
- 최종 UI pass는 `effectivePassLatched = isFinalPassLatched(STEP_ID, gate) || passLatched`로 제어되며, `isFinalPassLatched`가 false이면 성공 음성도 자동 전진도 발화하지 않는다.

---

## 2. Locked Files Modified

```
src/lib/camera/auto-progression.ts
src/lib/camera/guardrails.ts
src/lib/camera/evaluators/overhead-reach.ts
src/lib/camera/evaluators/types.ts
scripts/camera-cam17-overhead-final-pass-hotfix-smoke.mjs  (신규)
docs/pr/PR-CAM-17-OVERHEAD-FINAL-PASS-HOTFIX.md            (신규)
```

---

## 3. Change Summary

### `src/lib/camera/auto-progression.ts`

**`ExerciseGateResult` 인터페이스 신규 필드**
```typescript
finalPassEligible: boolean;
finalPassBlockedReason: string | null;
```
가시성 필드. `null`이면 pass 가능, 아니면 막힌 단계 이름 반환.
블로커 우선순위: `completion_not_satisfied` → `capture_quality_invalid` → `confidence_too_low:X<Y` → `pass_confirmation_not_ready` → `hard_blocker:X` → `overhead_rep_hold_blocked`.

**`isFinalPassLatched` 수정 (Bug 1 수정)**
```typescript
// 수정 후 — lowRom·humane도 easyOnly 포함
const lowRomSat = hm?.lowRomProgressionSatisfied === true || ...;
const humaneLowRomSat = hm?.humaneLowRomProgressionSatisfied === true || ...;
const easyOnly =
  ops?.requiresEasyFinalPassThreshold === true ||
  Boolean((easySat || lowRomSat || humaneLowRomSat) && !strictMotion);
const confTh = easyOnly ? OVERHEAD_EASY_PASS_CONFIDENCE /* 0.58 */ : 0.72;
const framesReq = easyOnly ? OVERHEAD_EASY_LATCH_STABLE_FRAMES /* 2 */ : REQUIRED_STABLE_FRAMES;
```

**`lowConfidenceRetry` 수정 (Bug 2 수정)**
```typescript
// 수정 후
const lowConfidenceRetry = guardrail.retryRecommended && confidence < passThresholdEffective;
```

**`finalPassBlockedReason` 계산 (신규)**
`progressionPassed` 계산 직후 인라인으로 최종 pass 차단 사유를 계산해 모든 리턴 경로에 포함.

### `src/lib/camera/guardrails.ts`

**easy/low_rom/humane 경로 raiseCount soft-guard 전환 (Bug 3 수정)**

기존: `raiseCount === 0` → `rep_incomplete` + `partial` 반환  
수정: `raiseCount === 0`을 hard gate에서 제거, 점수 소폭 감점(×0.92~0.95)만 적용.  
`frames.length < MIN_VALID_FRAMES` + `peakElevation < FLOOR` 하드 조건은 유지.

```typescript
// easy (변경 후)
const easyScoreMul = raiseCount === 0 ? 0.95 : 1.0;
return { score: clamp(Math.min(peakElevation / 165, 0.72) * easyScoreMul), status: 'complete', ... };

// low_rom (변경 후)
const lowRomScoreMul = raiseCount === 0 ? 0.95 : 1.0;
return { score: clamp(Math.min(peakElevation / 155, 0.62) * lowRomScoreMul), status: 'complete', ... };

// humane (변경 후)
const humaneScoreMul = raiseCount === 0 ? 0.92 : 1.0;
return { score: clamp(Math.min(peakElevation / 160, 0.55) * humaneScoreMul), status: 'complete', ... };
```

비-overhead 로직, hard framing / body-loss 안전 로직은 변경 없음.

### `src/lib/camera/evaluators/types.ts`

**`OverheadProgressionState` 신규 필드**
```typescript
requiresEasyFinalPassThreshold: boolean;
```
`progressionCompletionSatisfied === true && strictMotionCompletionSatisfied === false`일 때 `true`. `isFinalPassLatched`가 이 필드를 보고 완화 임계(0.58)를 선택.

### `src/lib/camera/evaluators/overhead-reach.ts`

**`overheadProgressionState` 객체에 `requiresEasyFinalPassThreshold` 설정**
```typescript
requiresEasyFinalPassThreshold: progressionCompletionSatisfied && !strictMotionCompletionSatisfied,
```

---

## 4. Why Safe

| 보호 영역 | 상태 |
|------------|------|
| `evaluateOverheadCompletionState` | **변경 없음** — strict 판단 수학 그대로 |
| `computeOverheadPlanningEvidenceLevel` | **변경 없음** — planning evidence 기준 그대로 |
| `computeOverheadInternalQuality` | **변경 없음** — internal quality tier 그대로 |
| 스쿼트 로직 | **변경 없음** — squat 경로 미접촉 |
| MediaPipe, 라우트, 결과 렌더러, 인증, 앱셸 | **변경 없음** |
| hard framing / body-loss 블로커 | **유지** — `left_side_missing`, `right_side_missing`, `framing_invalid`, `hard_partial`은 여전히 pass 차단 |
| `captureQuality=invalid` 차단 | **유지** |

humane/easy pass를 해도 planning evidence·internal quality tier는 strict 기준으로 낮게 유지된다 (weak/minimal). 이것이 의도된 동작.

---

## 5. Validation

```powershell
# CAM-17 신규 smoke (48 passed, 0 failed)
npx tsx scripts/camera-cam17-overhead-final-pass-hotfix-smoke.mjs

# CAM-16 회귀 smoke (58 passed, 0 failed)
npx tsx scripts/camera-cam16-overhead-humane-progression-smoke.mjs
```

| 스크립트 | 결과 |
|----------|------|
| `camera-cam17-overhead-final-pass-hotfix-smoke.mjs` | **48 passed, 0 failed** |
| `camera-cam16-overhead-humane-progression-smoke.mjs` | **58 passed, 0 failed** |

---

## 6. Risks / Follow-ups

1. **실기기 도그푸딩 필수**: `raiseCount soft-guard`는 느린 팔 올리기에서만 영향. 빠른 동작에선 `raiseCount > 0`이라 점수 감점 없음. 실제 사용자 패턴으로 smoother 확인 권장.

2. **`phaseHint='raise'` 감지 임계 (`delta > 2.2°/frame`)**: 매우 느린 사용자의 경우 phaseHint가 'raise'로 분류 안 될 수 있음. 이는 PR-CAM-18 수준의 별도 이슈 (pose-features.ts 수정 필요, 이 PR 범위 외).

3. **confidence 0.58~0.72 구간 humane 사용자**: 이제 `isFinalPassLatched`가 0.58 임계로 올바르게 체크하므로 UI 성공 경로가 열림. 실기기에서 ambiguous-retry 오발화가 더 이상 없는지 확인.

---

## 7. Git Commands

```powershell
git add src/lib/camera/auto-progression.ts
git add src/lib/camera/guardrails.ts
git add src/lib/camera/evaluators/overhead-reach.ts
git add src/lib/camera/evaluators/types.ts
git add scripts/camera-cam17-overhead-final-pass-hotfix-smoke.mjs
git add docs/pr/PR-CAM-17-OVERHEAD-FINAL-PASS-HOTFIX.md
git commit -m "fix(camera): unblock overhead humane pass from stale strict veto"
```
