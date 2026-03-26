# PR-CAM-16 — Overhead Humane Progression Path

**상태:** CURRENT_IMPLEMENTED  
**목표:** pass = humane movement completion, judgment = strict interpretation

---

## 1. Findings — CAM-15가 여전히 너무 엄격한 이유

CAM-15(low_rom)의 실 기기 한계:

| 원인 | 영향 |
|------|------|
| **first-6-mean baseline** | 사용자가 이미 팔을 약간 올린 상태로 시작하면 baseline이 높아지고, delta 조건이 더 어려워짐 |
| **delta ≥ 20°** | 어깨 ROM이 매우 제한된 사용자(부상·고령)에게 20° 개선은 여전히 어려움 |
| **absolute floor 110°** | 110° 이상 올리지 못하는 사용자가 많음 (특히 어깨 손상) |
| **hold 350ms** | 5 프레임 이상 안정이 요구되어 실질적으로 쉽지 않음 |

---

## 2. 해결책 — humane_low_rom 경로

### 핵심 설계

```
strict OR fallback OR easy OR low_rom OR humane_low_rom
```

새 경로(`humane_low_rom`)는 low_rom을 **교체하지 않고** 가산적으로 추가됨.

### Lower-Envelope Baseline (핵심 개선)

```typescript
// 기존 CAM-15: mean of first 6 frames — brittle
baselineArmDeg = mean(first_6_frames)

// CAM-16: min of first 16 frames — lower-envelope
humaneBaselineArmDeg = Math.min(...first_16_frames)
```

**이유:** 사용자가 약간 팔을 올린 채로 시작해도 가장 낮은 초기 포지션을 baseline으로 사용. delta 계산이 더 관대해져 "부분 거상 시작" 케이스도 robust하게 처리.

### 상수 (의도적으로 CAM-15보다 완화)

| 상수 | CAM-15 (low_rom) | CAM-16 (humane) | 이유 |
|------|-----------------|-----------------|------|
| `OVERHEAD_HUMANE_ABSOLUTE_FLOOR_DEG` | 110° | **100°** | 어깨 손상 사용자 포용 |
| `HUMANE_REQUIRED_DELTA_DEG` | 20° | **15°** | 80° 시작 → 95° 도달도 인정 |
| `HUMANE_REQUIRED_HOLD_MS` | 350ms | **200ms** | 3프레임@70ms = 140ms < 200ms → 4프레임(210ms)면 통과 |
| `HUMANE_MIN_PEAK_FRAMES` | 3 | **2** | 최소 2프레임 zone 진입 |
| `HUMANE_MAX_MEAN_ASYM_DEG` | 26° | **28°** | 약간 완화된 비대칭 허용 |
| `HUMANE_MAX_PEAK_ASYM_DEG` | 40° | **44°** | 동일 |
| `HUMANE_BASELINE_WINDOW` | 6 | **16** | 더 넓은 baseline 창 |

### Anti-Noise 조합 (noise pass 방지)

단일 threshold에 의존하지 않고 조합으로 방어:

1. `raiseCount > 0` + `peakCountAtHumaneFloor ≥ 2` — 진짜 들기 동작
2. `effectiveArmDeg ≥ 100°` — 쉬러그(≈90°이하) 차단
3. `delta from lower-envelope baseline ≥ 15°` — 이미 높게 시작한 가짜 통과 차단
4. `bestRunMs ≥ 200ms` + `bestRunFrameCount ≥ 2` — 순간 스윙-스루 차단
5. 비대칭 체크 — 편측성 움직임 차단

---

## 3. 변경 파일

### `src/lib/camera/overhead/overhead-easy-progression.ts`
- `OVERHEAD_HUMANE_ABSOLUTE_FLOOR_DEG = 100` (export)
- `OverheadHumaneLowRomProgressionInput`, `OverheadHumaneLowRomProgressionResult` 인터페이스 추가
- `computeOverheadHumaneLowRomProgression()` 함수 추가
- `humaneAsymmetryFails()` 내부 helper 추가

### `src/lib/camera/evaluators/types.ts`
- `OverheadProgressionState.progressionPath` union에 `'humane_low_rom'` 추가
- `OverheadProgressionState.progressionPhase` union에 `'humane_top' | 'humane_building_hold'` 추가
- 새 필드 6개 추가:
  - `humaneLowRomProgressionSatisfied: boolean`
  - `humaneLowRomBlockedReason: string | null`
  - `humaneLowRomBestRunMs: number`
  - `humaneLowRomPeakElevation: number`
  - `humaneLowRomBaselineElevation: number`
  - `humaneLowRomElevationDeltaFromBaseline: number`

### `src/lib/camera/evaluators/overhead-reach.ts`
- `computeOverheadHumaneLowRomProgression`, `OVERHEAD_HUMANE_ABSOLUTE_FLOOR_DEG` import 추가
- `humaneBaselineArmDeg` 계산 (min of first 16 frames)
- `humaneZoneFrames`, `peakCountAtHumaneFloor` 수집
- `humaneLowRomProgression` 계산 및 OR 통합
- `progressionCompletionPath` 확장 (`'humane_low_rom'` 포함)
- `progressionBlockedReason` 3-tier 확장 (low_rom→humane→없음 순)
- `progressionPhase` humane 구간 추가
- `overheadProgressionState` humane 필드 6개 노출
- `highlightedMetrics` humane 필드 7개 추가
- `insufficientSignal` early return에 humane 필드 추가

### `src/lib/camera/guardrails.ts`
- `OVERHEAD_HUMANE_ABSOLUTE_FLOOR_DEG` import 추가
- `humaneLowRomSatisfied` 체크 추가
- humane guard block: floor check → `completePath: 'humane_low_rom'`, score cap 0.55

### `src/lib/camera/auto-progression.ts`
- `getCommonReasons` 내 `overheadEasyOnly`: humane 포함 (3곳)
- `runStepGate` 내 `overheadEasyOnly`: humane 포함
- `overheadEasySat` (hold/rep 차단 해제): humane 포함

### `src/lib/camera/overhead/overhead-ambiguous-retry.ts`
- `PROGRESSION_RETRY_PHASES`에 `'humane_top' | 'humane_building_hold'` 추가
- `isOverheadAmbiguousRetryEligible`: `humaneZoneFrameCount` evidence 인정
- `deriveOverheadAmbiguousRetryReason`: humane blocked reason → retry reason 매핑
  - `humane_hold_short` → `'no_hold'`
  - `humane_top` → `'unstable_top'`
  - `humane_building_hold` → `'no_hold'`

### `src/lib/camera/voice-guidance.ts`
- `OverheadProgressionState` import 추가 (타입 안전)
- `VoiceGuidanceGate.evaluatorResult.debug`에 `overheadProgressionState` 타입 추가
- `low_rom_building_hold | humane_building_hold` hold cue 블록 추가
  - `CUE_MIN_BUILDUP_MS = 100ms`, `CUE_SUPPRESS_NEAR_SUCCESS_MS = 50ms`

---

## 4. 안전성 — strict 시스템 무변경 확인

| 시스템 | 변경 여부 |
|--------|-----------|
| `evaluateOverheadCompletionState` | **미변경** |
| `computeOverheadPlanningEvidenceLevel` | **미변경** |
| `computeOverheadInternalQuality` | **미변경** |
| strict top hold interpretation | **미변경** |
| squat logic | **미변경** (0개 수정) |
| MediaPipe / 페이지 라우트 / 결과 렌더러 | **미변경** |

humane_low_rom pass는 weak planning evidence / weak internal quality를 **의도적으로** 허용함. strict path는 여전히 강도 높은 기준을 유지함.

---

## 5. 검증

### 실행 명령

```powershell
# 신규 CAM-16 smoke (58 assertions)
npx tsx scripts/camera-cam16-overhead-humane-progression-smoke.mjs

# CAM-15 (46 assertions — I2 assertion 업데이트)
npx tsx scripts/camera-cam15-overhead-low-rom-progression-smoke.mjs

# CAM-13 (42 assertions — B/G 업데이트)
npx tsx scripts/camera-cam13-overhead-progression-state-smoke.mjs

# CAM-11B (10 assertions)
npx tsx scripts/camera-cam11b-overhead-easy-progression-smoke.mjs

# CAM-11A (27 assertions)
npx tsx scripts/camera-cam11a-overhead-hotfix-smoke.mjs
```

### 결과

| Suite | 통과 | 실패 |
|-------|------|------|
| CAM-16 (신규) | **58** | 0 |
| CAM-15 | **46** | 0 |
| CAM-13 | **42** | 0 |
| CAM-11B | **10** | 0 |
| CAM-11A | **27** | 0 |
| **합계** | **183** | **0** |

### 업데이트된 기존 assertion 이유

| Suite | Assertion | 이유 |
|-------|-----------|------|
| CAM-15 I2 | "4 frames@112°→ humane_low_rom PASS" | 200ms hold으로 통과 (의도된 변경) |
| CAM-13 B1-B5 | "3 frames@128° → humane pass" | 상승 중 humane zone(100°+) run=280ms → 통과 |
| CAM-13 G1,G3 | "4 frames@128° → humane pass" | 동일 원리 |

---

## 6. 리스크 / 후속 과제

### 리얼 디바이스 튜닝
- `HUMANE_REQUIRED_DELTA_DEG = 15°`: 실 사용자 baseline이 60-70°인 경우 15° 개선이 의미 있는지 확인 필요
- humane zone run이 rise 구간을 포함해 계산됨 (예: 100°→128° 상승 중 80+ms → hold 시간에 합산). 이 동작이 의도하지 않은 통과를 만들 수 있으므로 실 기기 dogfooding 필요
- 100° 절대 하한이 실 어깨 손상 사용자에게 적절한지 확인

### 잠재적 과완화 케이스
- 사용자가 100°에서 128°로 천천히 상승 (5+ 프레임) → humane zone run이 300ms+가 돼 쉽게 통과. 이는 의도된 humane 철학에 부합하지만, 실 기기에서 "너무 쉬운" 인상을 줄 수 있음
- 후속: `HUMANE_REQUIRED_DELTA_DEG`를 12° → 15°로 낮추거나, 상승 구간 vs. 홀드 구간을 분리할 수 있음 (현재는 심플하게 통합)

---

## 7. Git 명령

```powershell
git add src/lib/camera/overhead/overhead-easy-progression.ts
git add src/lib/camera/evaluators/overhead-reach.ts
git add src/lib/camera/evaluators/types.ts
git add src/lib/camera/guardrails.ts
git add src/lib/camera/auto-progression.ts
git add src/lib/camera/overhead/overhead-ambiguous-retry.ts
git add src/lib/camera/voice-guidance.ts
git add scripts/camera-cam16-overhead-humane-progression-smoke.mjs
git add docs/pr/PR-CAM-16-OVERHEAD-HUMANE-PROGRESSION.md
git add scripts/camera-cam15-overhead-low-rom-progression-smoke.mjs
git add scripts/camera-cam13-overhead-progression-state-smoke.mjs
git commit -m "fix(camera): add humane low-rom overhead progression path (PR-CAM-16)"
```
