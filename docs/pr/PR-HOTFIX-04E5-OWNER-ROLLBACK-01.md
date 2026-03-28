# PR-HOTFIX-04E5-OWNER-ROLLBACK-01

## 요약

PR-04E5에서 `buildSquatCompletionDepthRows`가 `squatDepthPrimaryStable`을 `depthPrimary`(owner·`rawDepthPeakPrimary`·primary/blended 분기 입력)로 우선 사용하도록 바뀌면서, 얕은 ROM이 blended low-ROM event-cycle로 통과하던 실기기 케이스가 primary 기반 completion/recovery 쪽으로 더 자주 끌려 `not_standing_recovered` 등으로 군집화될 수 있다는 가설에 대응한다.

## CURRENT_IMPLEMENTED (이 PR)

- Completion depth row의 `depthPrimary`는 다시 **오직 `squatDepthProxy`**만 사용한다 (pre-04E5 owner 라우팅).
- `squatDepthPrimaryStable`은 **게이트·owner·relative primary 분기에 사용하지 않는다**.
- 관측: `SquatCompletionState.rawDepthPeakPrimaryStableObs` — valid 슬라이스에서 `max(squatDepthPrimaryStable)`.
- Evaluator: `squatDepthCalibration.rawDepthPeakPrimaryStableObs`, `highlightedMetrics.squatRawDepthPeakPrimaryStableObs`.
- 기존 PR-04E5 필드 유지: `squatPrimaryStablePeak`, `squatPrimaryJumpSuppressedCount`, pose 파이프라인의 stabilization(본 PR에서 미변경).

## LOCKED_DIRECTION

- Primary geometry stabilization은 **디버그·관측** 목적; completion truth/owner는 proxy 스트림과 기존 blended 계약을 유지한다.

## NOT_YET_IMPLEMENTED

- 없음 (본 핫픽스 범위).

## 변경 파일

- `src/lib/camera/squat-completion-state.ts`
- `src/lib/camera/evaluators/squat.ts`
- `src/lib/camera/evaluators/types.ts` (`SquatDepthCalibrationDebug` 필드 1개)
- `scripts/camera-pr-04e5-primary-geometry-stabilization-smoke.mjs` — A-completion·B: owner 는 proxy 이므로 B 픽스처는 **보간 후 proxy**(raw 0.55 별도)로 유지해 fake pass 방지; stable 검증은 `rawDepthPeakPrimaryStableObs`
- `scripts/camera-hotfix-04e5-owner-rollback-smoke.mjs` (신규)
- 본 문서 (신규)

## 검증

```bash
npx tsx scripts/camera-hotfix-04e5-owner-rollback-smoke.mjs
npx tsx scripts/camera-pr-04e3c-squat-low-rom-cycle-strengthening-smoke.mjs
npx tsx scripts/camera-pr-04e5-primary-geometry-stabilization-smoke.mjs
```

## Non-goals

- Overlay smoothing, UI, voice, CameraPreview, 임계값·pass-vs-quality 의미 변경 없음.
