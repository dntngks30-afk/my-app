# PR-04E4-LR-STANDING-TAIL-TUNING

## CURRENT_IMPLEMENTED

- `getStandingRecoveryFinalizeGate`에서 low-rom-style 증명(`needsLowRomStyleProof`)일 때, **연속성 게이트(≥3) 통과 후** drop 비교 하한을 **0.45 → 0.35**로 조정해 `pose-features` `getSquatRecoverySignal`의 `lowRomContinuityOk`(연속 3 + drop ≥35%)와 동일 계약으로 맞춤.
- 상수 `LOW_ROM_STANDING_FINALIZE_MIN_DROP_RATIO_WITH_CONTINUITY = 0.35` 추가; `recoveryMeetsLowRomStyleFinalizeProof`(ultra guarded 진입)는 기존 **0.45** 유지.

## LOCKED_DIRECTION

- finalize 소유권·이벤트 승격 블록 목록·`finalizeOk`·standing window 스캔·pose 쪽 시그널 생성은 변경 없음.
- owner routing(primary/blended)·pass-vs-quality 분리 변경 없음.

## NOT_YET_IMPLEMENTED

- `ultra_low_rom` 비-guarded 경로의 160ms hold 완화는 본 PR 범위 밖.

## 검증

```bash
npx tsx scripts/camera-pr-04e4-lr-standing-tail-tuning-smoke.mjs
npx tsx scripts/camera-pr-04e3c-squat-low-rom-cycle-strengthening-smoke.mjs
npx tsx scripts/camera-hotfix-04e5-owner-rollback-smoke.mjs
```

## 파일

- `src/lib/camera/squat-completion-state.ts`
- `scripts/camera-pr-04e4-lr-standing-tail-tuning-smoke.mjs`
- `docs/pr/PR-04E4-LR-STANDING-TAIL-TUNING.md`
