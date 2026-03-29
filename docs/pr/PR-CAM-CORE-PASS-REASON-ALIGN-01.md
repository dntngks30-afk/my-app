# PR-CAM-CORE-PASS-REASON-ALIGN-01 — Completion pass reason taxonomy alignment

**Taxonomy alignment PR, not threshold-tuning PR.** 임계값·HMM·이벤트/역전 디텍터·통과 기준 완화는 범위 밖이다.

## Problem

- 코어가 막히지 않은 얕은 완료에서도 `completionPassReason`이 항상 `*_event_cycle`로만 갈리면, `eventCyclePromoted === false`인 JSON과 모순된다(일반 완료 사이클이 이벤트 승격으로 과분류).
- `squat-completion-machine.ts`의 `deriveSquatCompletionPassReason`은 이미 `eventBasedDescentPath`로 `*_cycle` vs `*_event_cycle`을 구분하도록 설계되어 있었으나, 코어에서 재사용되지 않았다.

## Scope

| Area | Change |
|------|--------|
| `squat-completion-state.ts` | `standardPathWon` / blocked 이후 ROM 라벨을 `deriveSquatCompletionPassReason`에 위임(owner 미달 `evidenceLabel === 'standard'`는 `low_rom`으로만 helper 입력). `eventBasedDescentPath`를 상태에 노출. |
| `squat-completion-machine.ts` | 변경 없음 — 기존 `deriveSquatCompletionPassReason` 재사용. |
| `squat-progression-contract.ts` | `resolveSquatPassOwner`: `low_rom_cycle` / `ultra_low_rom_cycle`도 `completion_truth_event`. |
| `auto-progression.ts` | `isSquatShallowRomPassReason` — 네 ROM pass reason 모두 easy-only / failure conf floor 공통. `SquatCycleDebug.eventBasedDescentPath` 전달. |
| `camera-trace.ts` | `diagnosisSummary.squatCycle.eventBasedDescentPath` |

## Non-goals

- Threshold 상수 변경 없음.
- `evaluateSquatCompletionState` wrapper의 `eventCyclePromoted` overwrite 규칙 변경 없음.
- `standardPathWon` / `completionBlockedReason` / `completionSatisfied` 산식 변경 없음.

## Files changed

- `src/lib/camera/squat-completion-state.ts`
- `src/lib/camera/squat/squat-progression-contract.ts`
- `src/lib/camera/auto-progression.ts`
- `src/lib/camera/camera-trace.ts`
- `scripts/camera-pr-core-pass-reason-align-01-smoke.mjs`
- `docs/pr/PR-CAM-CORE-PASS-REASON-ALIGN-01.md`

## Smoke

`npx tsx scripts/camera-pr-core-pass-reason-align-01-smoke.mjs`

## Regression

CAM-25, PR-7, CAM-31, ultra-low-rom-event-gate-01, peak-anchor-integrity-01 스모크 통과 확인.
