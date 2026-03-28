# PR-04E4C-STANDING-RECOVERY-WINDOW-TUNING

## CURRENT_IMPLEMENTED

- `getStandingRecoveryWindow`에 `evidenceLabel` 인자 추가.
- `low_rom` / `ultra_low_rom`일 때만 `standingRecoveryThreshold`의 바닥을 `STANDING_RECOVERY_TOLERANCE_FLOOR_LOW_BAND` (**0.017**)로 적용; `standard`·`insufficient_signal`은 기존 **0.015** 유지.
- 역방향 연속 접미사 스캔·`standingRecoveredAtMs` 도출·finalize·이벤트 계약 변경 없음.

## LOCKED_DIRECTION

- owner routing·pose `getSquatRecoverySignal`·04E4/04E4B finalize 증명·`finalizeOk` 불변.

## NOT_YET_IMPLEMENTED

- 접미사 갭 허용·비접미사 스캔 등 토폴로지 변경은 본 PR 범위 밖.

## 검증

```bash
npx tsx scripts/camera-pr-04e4c-standing-recovery-window-tuning-smoke.mjs
npx tsx scripts/camera-pr-04e4-lr-standing-tail-tuning-smoke.mjs
npx tsx scripts/camera-pr-04e4b-ultra-guarded-finalize-path-smoke.mjs
npx tsx scripts/camera-pr-04e3c-squat-low-rom-cycle-strengthening-smoke.mjs
npx tsx scripts/camera-hotfix-04e5-owner-rollback-smoke.mjs
```

## 파일

- `src/lib/camera/squat-completion-state.ts`
- `scripts/camera-pr-04e4c-standing-recovery-window-tuning-smoke.mjs`
- `docs/pr/PR-04E4C-STANDING-RECOVERY-WINDOW-TUNING.md`
