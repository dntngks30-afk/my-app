# PR-04E3B — Shallow squat event-cycle completion owner

## 체인 위치

| PR | 역할 |
|----|------|
| PR-04E1 | Arming 입력 안정화 (`squatDepthProxyBlended` 등) |
| PR-04E2 | Reversal 확인 안정화 (`detectSquatReversalConfirmation`, primary 기하) |
| PR-04E3A | Completion relative depth truth 를 blended-aware 로 primary/blended 스트림 정렬 |
| **PR-04E3B** | **동일 attempt 내 baseline freeze + peak latch + shallow event-cycle truth 승격** |

## 문제: same attempt 안 blocked reason churn

얕은 rep 에서 모션 증거는 있는데, 버퍼가 자라면서 **04E3A 스트림 선택(primary ↔ blended)** 이 바뀌거나, baseline/peak 가 프레임마다 재해석되며 `not_armed` / `no_reversal` / `no_descend` / `insufficient_relative_depth` 가 번갈아 찍히는 현상이 있었다. 본질은 “못 봄”이 아니라 **하나의 canonical cycle owner** 가 없어 completion truth 가 흔들리는 것이다.

## 이번 PR의 역할

1. **Baseline freeze**  
   첫 `attemptStarted` 가 되는 prefix 시점의 `relativeDepthPeakSource` 를 잠그고, **전체 버퍼의 앞 `BASELINE_WINDOW` standing min** 을 그 스트림으로 고정한다. `evaluateSquatCompletionState` 호출 **간** 외부 상태는 두지 않고, 매 평가는 **현재 completionFrames 버퍼만**으로 결정한다.

2. **Peak latch**  
   잠긴 스트림 위에서 **전 구간 monotonic max** 가 곧 latched peak (동일 버퍼 내에서만 의미).

3. **Shallow event-cycle helper** (`squat-event-cycle.ts`)  
   `detectSquatEventCycle` / `buildFrozenSquatCycleWindow`: 의미 있는 descent·reversal·near-standing tail, 지터/단일 스파이크 거절. HMM 은 **보조**(`rule_plus_hmm` 메모만), final owner 아님.

4. **Truth 승격 (제한적)**  
   Standard 경로가 `not_confirmed` 이고, **finalize 가 이미 통과**(`standing_hold_met` / `low_rom_guarded_finalize` / `ultra_low_rom_guarded_finalize`)했으며, `recovery_hold_too_short`·finalize 계열·`descent_span_too_short`·`ascent_recovery_span_too_short` 로 막히지 않은 경우에만, event-cycle 이 감지되고 freeze/latch/near-standing 조건을 만족하면 `low_rom_event_cycle` / `ultra_low_rom_event_cycle` 로 승격. **`relativeDepthPeak >= STANDARD_OWNER_FLOOR`(0.4) 인 deep 쪽은 승격 대상에서 제외**해 standard owner 를 빼앗지 않는다.

## Truth map (요약)

| `completionPassReason` | 의미 |
|------------------------|------|
| `standard_cycle` | Deep standard path, `eventBasedDescentPath === false` & 상대 피크 ≥ owner floor |
| `low_rom_cycle` / `ultra_low_rom_cycle` | Phase/trajectory 기반 기존 경로 |
| `low_rom_event_cycle` / `ultra_low_rom_event_cycle` | 저ROM 이벤트 사이클 또는 **이번 PR 승격** |
| `not_confirmed` | 차단 중 |

## Finalize / recovery tail 은 이번 PR 범위 밖

`recovery_hold_too_short`, `low_rom_standing_finalize_not_satisfied`, `ultra_low_rom_standing_finalize_not_satisfied` 는 event-cycle 으로 **덮어쓰지 않는다**. Event-cycle 은 attempt/cycle 인식·relative 안정화 경로이지, standing tail policy override 가 아니다.

## 다음 PR 후보

Standing recovery tail tuning, finalize 와 event-cycle 의 더 촘촘한 정렬(실기기 로그 기반)은 후속 PR 에서 다룰 수 있다.

## 스모크

`npx tsx scripts/camera-pr-04e3b-squat-event-cycle-owner-smoke.mjs`

기존 04E3A/04E2/04E1/04D1·HMM·CAM27 스모크와 함께 회귀 검증한다.
