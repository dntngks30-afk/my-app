# PR-CAM-15 — Overhead Low-ROM Progression Path (Easy Pass, Strict Judgment)

## 문제

PR-CAM-12(floor 입력 버그 수정)와 PR-CAM-13(typed progression state 분리) 이후에도 실제 기기 테스트에서 오버헤드 리치 통과가 **여전히 너무 어렵다**는 피드백이 지속됨.

근본 원인:
- 현재 easy 경로(PR-CAM-11B)의 절대 하한 = **126°** (귀 높이 근처).
- 실제 제한적 ROM 사용자(어깨 가동성 제한, 노인, 부상 회복기)는 126°에 미치지 못하면서도 실질적인 팔 올리기 노력을 하고 있음.
- 이 사용자들이 완전히 차단되어 동작 테스트 자체를 통과하지 못함.

스쿼트 아키텍처 비유:
- 스쿼트: completion event(진행) vs strict interpretation(판단)이 명확히 분리되어 있어 ROM 제한 사용자도 부분 ROM으로 진행 가능.
- 오버헤드: PR-CAM-13까지도 easy 경로가 여전히 절대 높이 기준(126°)에 묶여 있어 "pass = easy and humane" 원칙 미달.

## 해결

### 새로운 low-ROM 진행 경로

**개인 baseline 대비 상대적 개선 + 낮은 절대 하한 + 짧은 안정**으로 통과.

#### 통과 조건 (전부 충족 필요)

| 조건 | 상수 | 이유 |
|------|------|------|
| `raiseCount > 0` + `peakCountAtLowRomFloor >= 3` | LOW_ROM_MIN_PEAK_FRAMES = 3 | 실질적 들기 동작 확인 |
| `effectiveArmDeg >= 110°` | LOW_ROM_ABSOLUTE_FLOOR_DEG = 110 | 쉬러그(90°이하)·노이즈 차단, 실질적 거상 요구 |
| `delta from baseline >= 20°` | LOW_ROM_REQUIRED_DELTA_FROM_BASELINE_DEG = 20 | 개인 시작점 대비 실질적 개선 |
| `bestRunMs >= 350ms` + `run frames >= 3` | LOW_ROM_REQUIRED_HOLD_MS = 350, LOW_ROM_MIN_RUN_FRAMES = 3 | 순간 스윙-스루 차단, 의도적 제어 확인 |
| 비대칭 `meanAsym <= 26°, peakAsym <= 40°` | LOW_ROM_MAX_MEAN_ASYM_DEG = 26, LOW_ROM_MAX_PEAK_ASYM_DEG = 40 | easy(22°/36°)보다 약간 완화 |

#### 상수 선택 이유

- **110°**: 팔을 수평보다 약 20° 더 올린 위치. 어깨 쉬러그(~60-90°)와 명확히 구분. 귀 높이(126°)보다 낮아 제한적 ROM 사용자 접근.
- **20° delta**: 10-15°는 자세 흔들림·측정 노이즈 수준. 20°는 의도적 들기 동작임을 보장.
- **350ms hold**: easy의 520ms보다 짧지만, 순간 스윙(< 200ms)과 의도적 안정(> 300ms)을 구분하기 충분.
- **개인 baseline**: 첫 6프레임 평균. 세션 시작 시 팔의 자연스러운 위치를 반영.

### 변경 없는 strict 시스템

| 시스템 | 변경 여부 |
|--------|-----------|
| `evaluateOverheadCompletionState` (strict/fallback dwell) | **변경 없음** |
| `computeOverheadPlanningEvidenceLevel` | **변경 없음** |
| `computeOverheadInternalQuality` | **변경 없음** |
| strict hold 기준(1200ms at 132°+) | **변경 없음** |
| planning/internal quality 업그레이드 조건 | **변경 없음** |

low-ROM으로 통과한 사용자가 `weak` planning evidence를 받는 것은 **의도된 동작**. pass ≠ strong quality.

## 변경 파일

| 파일 | 역할 |
|------|------|
| `src/lib/camera/overhead/overhead-easy-progression.ts` | low-ROM 함수·타입·상수 추가 |
| `src/lib/camera/evaluators/overhead-reach.ts` | baseline 계산, low-ROM zone 수집, OR 통합, debug 노출 |
| `src/lib/camera/evaluators/types.ts` | `OverheadProgressionState` 확장(low_rom path/phase/fields) |
| `src/lib/camera/guardrails.ts` | low-ROM 완료 상태 허용 |
| `src/lib/camera/auto-progression.ts` | overheadEasyOnly·overheadEasySat에 low-ROM 포함 |
| `src/lib/camera/overhead/overhead-ambiguous-retry.ts` | low-ROM 단계·사유 매핑 |
| `scripts/camera-cam15-overhead-low-rom-progression-smoke.mjs` | 신규 smoke (46 assertions) |
| `docs/pr/PR-CAM-15-OVERHEAD-LOW-ROM-PROGRESSION.md` | 본 문서 |

## 주요 설계 결정

### 1. 개인 baseline 추정
- 전략: 첫 6개 유효 프레임의 `armElevationAvg` 평균.
- 이유: 오버헤드 리치 테스트 시작 시 사용자는 보통 팔을 내린 상태. 첫 몇 프레임이 자연스러운 시작 포지션을 포착.
- 보호: 절대 하한(110°)이 있으므로 baseline이 높더라도 delta만으로 통과 불가.

### 2. OR 우선순위
`strict → fallback → easy → low_rom` 순서. 기존 경로가 먼저 체크되어 후퇴 없음.

### 3. progressionPath = 'low_rom'
`overheadProgressionState.progressionPath` 및 `highlightedMetrics.completionPath`에 반영.
기존 소비자는 `=== 'easy'` 등 구체적 값을 체크하므로 새 값 추가만으로 하위 호환.

### 4. guardrail 최소 변경
`lowRomSatisfied`가 true일 때 peakElevation >= 110° + raiseCount > 0 확인만 추가.
easy path와 동일 패턴, 스코어 캡 0.62 (easy의 0.72보다 낮음 — 낮은 elevation 반영).

### 5. auto-progression 통합
`overheadEasyOnly` (낮은 confidence 임계·래치) 및 `overheadEasySat` (hold/rep 차단 해제) 모두 low-ROM 포함.
별도 상수 불필요 — easy와 동일한 완화 값 재사용.

## 하위 호환

| 필드 | 변경 |
|------|------|
| `hm.completionSatisfied` | 기존과 동일 의미, low-ROM true 시 true |
| `hm.easyCompletionSatisfied` | 변경 없음 |
| `hm.strictMotionCompletionSatisfied` | 변경 없음 |
| `hm.completionPath` | 기존 값 유지, 'low_rom' 신규 값 추가 |
| `overheadProgressionState` | 신규 필드 추가만 (lowRomProgressionSatisfied 등) |

## 테스트 결과

```
CAM-15 (신규): 46/46 PASS
CAM-13 (regression): 42/42 PASS  — C 시나리오 갱신(120° 이제 low-ROM 통과)
CAM-12 (regression): 17/17 PASS
CAM-11B (regression): 10/10 PASS — E4 갱신(120° 이제 low-ROM 통과)
CAM-11A (regression): 27/27 PASS — C2/C3 갱신(의도된 행동 변화 반영)
합계: 142/142 PASS
```

### 주요 시나리오 검증

| 시나리오 | 기대 결과 | 실제 |
|----------|-----------|------|
| 112° + 40° delta + 490ms hold | low-ROM 통과 | ✅ |
| 120° + 630ms hold (delta 40°) | low-ROM 통과 | ✅ |
| 125° + 1440ms hold | low-ROM 통과 | ✅ |
| 80° (쉬러그 수준) | 차단 | ✅ |
| 112° + 홀드 부족(스윙스루) | 차단 | ✅ |
| delta < 20° | 차단 | ✅ |
| 128° easy path | 기존대로 easy 통과 | ✅ |
| 135° strict path | 기존대로 strict 통과 | ✅ |
| planning evidence 미업그레이드 | 변경 없음 | ✅ |
| strict quality 미변경 | 변경 없음 | ✅ |

## 리스크 / 후속 과제

### 실기기 튜닝 필요
- **baseline 정확도**: 실기기에서 첫 프레임이 항상 내린 팔 상태인지 확인. 캡처 시작 타이밍에 따라 달라질 수 있음.
- **110° absolute floor**: 실제 사용자에서 쉬러그와 진짜 오버헤드 리치의 경계 확인. 더 낮으면 너무 쉬움, 더 높으면 접근성 저하.
- **350ms hold**: 실기기 cadence는 ~70ms 가정. 실제 프레임 드롭 상황에서 hold 계산 안정성 확인.
- **20° delta**: 초보자가 팔을 이미 올린 상태에서 시작할 경우 delta 계산 왜곡 가능성. baseline window(6프레임)에서 이미 올라간 경우 대비책 고려.

### NOT_YET_IMPLEMENTED
- 음성 cue: low-ROM path의 전용 hold cue 없음 (voice-guidance.ts는 easy_building_hold만 처리). 추후 `low_rom_building_hold` phase를 읽어 별도 cue 추가 가능.
- UI 표시: progressionPath='low_rom' 시 별도 UI 피드백 없음. 현재는 same UI as easy.

## 제품 법칙 정렬

> pass = easy and humane  
> judgment = strict and accurate

- **이 PR 이전**: "humane"의 정의가 126°+ 도달 → 실제 제한적 ROM 사용자에게 여전히 어려움.
- **이 PR 이후**: "humane" = 개인 baseline 대비 실질적 노력 + 최소한의 제어 확인.
- **strict 시스템**: 변경 없음. low-ROM 통과 사용자가 weak planning evidence를 받는 것은 정상.
