# PR-04E3C — Shallow low-ROM cycle truth strengthening

## PR-04E3B와의 관계

- **PR-04E3B**는 baseline freeze·peak latch·event-cycle **candidate**(`detected`)와 **제한적 truth 승격**(`eventCyclePromoted`)을 도입했다.
- **PR-04E3C**는 owner 이름(`low_rom_event_cycle` / `ultra_low_rom_event_cycle`)은 유지하되, 승격을 **“얕은 이벤트”가 아니라 “얕은 cycle”**에만 주기 위해 **reversal-lite**·**recovery-lite** 게이트를 추가한다.

## 왜 shallow success 가 salvage-like 로 보였는지

실기기에서 `reversalConfirmedBy: null`, `recoveryConfirmedAfterReversal: false`, primary 피크는 거의 0인데 blended 만 큰 채로 `low_rom_event_cycle` 이 열릴 수 있었다. completion-state 의 **PR-04E2 primary reversal** 과 shallow **blended** truth 가 분리되어 있어, 통과는 되지만 “하강→역전→복귀”를 **동일 스트림에서** 입증하기 어려운 조합이었다.

## reversal-lite / recovery-lite 역할

| 필드 | 의미 |
|------|------|
| `reversalLiteConfirmed` | 피크 이후 **locked depth** 기준으로 baseline 방향 하락이 **연속 `MIN_REVERSAL_FRAMES_LITE` 프레임** 이상, `MIN_REVERSAL_DROP_LITE`(절대·상대피크 비율) 충족 — **단발 1프레임 튐**으로는 불충분 |
| `recoveryLiteConfirmed` | 피크 이후 suffix 에서 standing tolerance **근처**(`standingBand * 1.22`) 연속 `MIN_RECOVERY_FRAMES_LITE` 프레임 |

- `squatEventCycle.detected` = **shallow candidate** (기존 하강·역전·near-standing·지터 거절 유지).
- **`eventCyclePromoted`** = 위 candidate 에 더해 **finalize·차단 집합·deep 제외** + **`reversalLiteConfirmed` ∧ `recoveryLiteConfirmed`** 를 만족할 때만 truth owner 승격.

## HMM 은 owner 가 아님

HMM 은 `detectSquatEventCycle` 안에서 `rule_plus_hmm` 보조 메모·구조 완화에만 쓰이며, **final pass owner 나 승격 단독 조건이 아니다** (PR-04E3B 계약 유지).

## 다음 PR 후보

- Standing recovery tail tuning (finalize vs near-standing 정렬).
- Primary geometry stabilization 과 blended truth 의 추가 정렬(별도 PR·캘리브레이션).

## 스모크

`npx tsx scripts/camera-pr-04e3c-squat-low-rom-cycle-strengthening-smoke.mjs`
