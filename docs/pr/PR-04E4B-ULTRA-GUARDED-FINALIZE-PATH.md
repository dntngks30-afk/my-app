# PR-04E4B-ULTRA-GUARDED-FINALIZE-PATH

## CURRENT_IMPLEMENTED

- `ultra_low_rom`의 **guarded finalize 진입**(`ultraLowRomUsesGuardedFinalize`)이 `recoveryMeetsUltraGuardedFinalizeProof`로 판정된다.
- 조건: `returnContinuityFrames >= 3`, `recoveryDropRatio >= LOW_ROM_STANDING_FINALIZE_MIN_DROP_RATIO_WITH_CONTINUITY` (0.35) — PR-04E4 finalize 본문과 동일.
- 구 `recoveryMeetsLowRomStyleFinalizeProof`(0.45 진입)는 ultra 경로에서 제거; `low_rom`·`standard` 분기는 변경 없음.

## LOCKED_DIRECTION

- finalize 필수, 이벤트 승격·`finalizeOk`·standing window·pose `getSquatRecoverySignal` 미변경.

## NOT_YET_IMPLEMENTED

- `LOW_ROM_STANDING_FINALIZE_MIN_DROP_RATIO`(0.45) 상수는 문서/향후 정합용으로 유지 가능하나 현재 코드 경로에서는 미사용.

## 검증

```bash
npx tsx scripts/camera-pr-04e4b-ultra-guarded-finalize-path-smoke.mjs
npx tsx scripts/camera-pr-04e4-lr-standing-tail-tuning-smoke.mjs
npx tsx scripts/camera-pr-04e3c-squat-low-rom-cycle-strengthening-smoke.mjs
npx tsx scripts/camera-hotfix-04e5-owner-rollback-smoke.mjs
```

## 파일

- `src/lib/camera/squat-completion-state.ts`
- `scripts/camera-pr-04e4b-ultra-guarded-finalize-path-smoke.mjs`
- `docs/pr/PR-04E4B-ULTRA-GUARDED-FINALIZE-PATH.md`
