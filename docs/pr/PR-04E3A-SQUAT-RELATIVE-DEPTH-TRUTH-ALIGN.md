# PR-04E3A — Squat relative depth truth alignment (completion-state)

## Scope chain

- **PR-04E1:** arming 입력 안정화 — `squatDepthProxyBlended` + arming depth read.
- **PR-04E2:** completion-state **역전(reversal)** 확인 안정화 — `squat-reversal-confirmation.ts` (본 PR에서 변경 금지).
- **PR-04E3A (this PR):** completion-state의 **relative depth / ROM 밴드 truth**를 arming과 같은 **blended-aware read**와 정렬.

## Why `armed=true` but `relativeDepthPeak=0` was a structural bug

Arming과 evaluator calibration은 completion 슬라이스에서 **blended 피크**를 볼 수 있는데, completion-state는 **primary `squatDepthProxy`만**으로 피크·상대 깊이를 계산하고 있었다. Shallow 실기기에서 primary는 거의 평평하게 남고 blended만 의미 있는 ROM을 담는 경우, **동일 버퍼**에서 `peakBlended%`·`armingDepthPeak`는 크게 나오는데 `relativeDepthPeak`는 0에 가깝고 `insufficient_relative_depth`로 막히는 **입력·completion truth 불일치**가 발생했다.

## Primary / blended / relative roles (after this PR)

- **Primary:** 기하·역전(04E2) 등 **primary 기하 계약**을 유지하는 스트림.
- **Blended (PR-04E1):** hip–knee 등 보조 신호로 **얕은 ROM**에서 depth proxy를 보강한 스트림.
- **Completion relative truth:** `relativePrimary >= 0.12`이면 **primary**를 completion 피크·baseline·`depthFrames`에 사용해 **깊은 표준 경로**를 보존. 그렇지 않고 blended 상대 피크가 시도 플로어를 넘기면 **blended** 스트림으로 정렬해 shallow meaningful rep의 false negative를 줄인다.

Additive 필드: `rawDepthPeakPrimary`, `rawDepthPeakBlended`, `relativeDepthPeakSource`.

## Out of scope (next PR candidates)

- Event-cycle truth promotion, standing recovery / finalize 타이밍 튜닝은 **별도 PR**에서 다룰 수 있다. 본 PR은 **depth source 불일치** 수정에 한정한다.

## Acceptance

- 기존 카메라 스모크 + `camera-pr-04e3a-squat-relative-depth-truth-align-smoke.mjs` 통과.
- Shallow meaningful (primary flat, blended meaningful): `relativeDepthPeak` 붕괴 완화, `insufficient_relative_depth` 단독 오판 감소.
- Standing jitter: 여전히 낮은 relative / 실패 유지.
- Deep standard: `relativePrimary`가 dominant일 때 동작 유지.
