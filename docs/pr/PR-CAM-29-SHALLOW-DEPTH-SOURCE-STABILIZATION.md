# PR-CAM-29 — Shallow depth source stabilization

## 목적

- **CURRENT_IMPLEMENTED (본 PR):** `squat-depth-signal`·`pose-features`·`evaluators/squat`·(선택) `camera-trace` 만 수정해, shallow 구간에서 **primary 붕괴 / blended 과상승**을 **입력 source 층**에서 완화한다.
- **LOCKED_DIRECTION:** completion / arming / reversal / event-cycle / auto-progression / squat page / `/app` 코어는 **비변경**(요구사항 준수).

## 원인 분해 (코드)

1. **`buildSquatDepthSignal`:** `primaryDepth` / `fallbackDepth` / `travelEvidence` / `blendOffered` / `blendCandidateRaw` / `blendCapped` 를 additive 로 노출. `blendLiftCeiling` 은 기존 상수(`PRIMARY_STRONG_MIN`, `FALLBACK_*`, `BLEND_*`, `TRAVEL_EVIDENCE_MIN`)만 조합.
2. **`applySquatDepthBlendPass`:** raw 신호 계산 후 **연속 `SHALLOW_DESCENT_MIN_CONSECUTIVE_FRAMES` 프레임**에서만 blended 출력 허용; **rapid shallowing**(primary 급감) 시 streak 리셋.
3. **Evaluator `highlightedMetrics`:** fallback/travel 피크, blend offered·cap·active 프레임 수, source flip 수를 **관측 전용**으로 추가.
4. **`camera-trace` `diagnosisSummary.squatCycle`:** 위 스칼라를 `highlightedMetrics` 에서 복사(compact).

## 스모크

- `npx tsx scripts/camera-cam29-shallow-depth-source-cap-smoke.mjs`
- `npx tsx scripts/camera-cam29-shallow-depth-source-persistence-smoke.mjs`

## 알려진 상위 이슈 (본 PR 비범위)

- `scripts/camera-pr-04e3b-squat-event-cycle-owner-smoke.mjs` **A4** 는 `origin/main` 기준 **CAM-29 변경 없이도** `completionPassReason === 'not_confirmed'` 로 실패함(synthetic fixture 와 event promotion 조건 불일치). completion-state 수정은 본 PR 금지 범위.
