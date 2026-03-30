# PR-CAM-29B — Ultra-Shallow Reversal Unlock with Anti-False-Positive Guards

## CURRENT_IMPLEMENTED

- `relativeDepthPeak < LEGACY_ATTEMPT_FLOOR` (0.02): reversal은 기존과 동일 **strict-only** (standing jitter 차단).
- `LEGACY_ATTEMPT_FLOOR ≤ relativeDepthPeak < 0.08`: strict 실패 시 `postPeakMonotonicReversalAssist` + `computePostPeakRecoveryEvidence`의 `ascentStreakMax` / `postPeakFrameCount` 게이트(`MIN_REVERSAL_FRAMES`·`MIN_DESCENT_FRAMES`, event-cycle과 동일 수치)를 통과할 때만 **rule** 출처 `guarded_ultra_shallow_reversal_assist`.
- `pose-features`: `hasGuardedShallowSquatAscent` — `SHALLOW_DESCENT_*` 상수만 대칭 사용; phase 순서 descent → guarded ascent → ultra-shallow bottom/start → 기존.
- Evaluator: `guardedShallowAscentDetected` (0/1) additive.

## NOT_YET_IMPLEMENTED

- `squat-completion-state` / `auto-progression` / `squat-event-cycle` 미수정.

## 검증

```bash
npx tsx scripts/camera-cam29b-ultra-shallow-reversal-guard-smoke.mjs
npx tsx scripts/camera-cam29b-guarded-shallow-ascent-phase-smoke.mjs
npx tsx scripts/camera-cam29b-ultra-shallow-integration-smoke.mjs
```
