# PR-SURVEY-03 — Deconditioned internal interpretation layer

## Findings

- PR-SURVEY-01/02 이후에도 `deconditioned` 축은 **게이트·가중합·interaction**에 의해 단일 스칼라로만 읽히기 쉬워, “전반 저컨디션”, “특정 축 + 배경 decond”, “약한 지지”가 구분되지 않는다.
- 공개 `primary_type`은 유지하되, **내부 감사·우선순위·향후 세션 보수성**을 위해 형태(shape) 레이블이 필요하다.
- 무료 설문은 PR-SURVEY-02 `survey_axis_interaction_hints`로 fatigue/저응답 프록시를 이미 넣었으므로, 동일 힌트를 low_confidence 판정에 재사용할 수 있다.

## Why deconditioned needed refinement

- BROAD/DIFFUSE 부스트로 `deconditioned=7`이 되는 경우와, 특정 축이 1위인데 decond만 붙은 경우가 **같은 축 숫자만으로는 동일 계열처럼 보일 수 있다.**
- Renderer/카피를 바꾸지 않고도 `reason_codes`·`priority_vector`·`_compat`로 downstream이 보수적으로 읽을 훅이 필요하다.

## Files changed

- `src/lib/deep-scoring-core/types.ts` — `DeconditionedInterpretation`, `DeepScoringCoreResult.deconditioned_interpretation`
- `src/lib/deep-scoring-core/deconditioned-interpretation.ts` — `evaluateDeconditionedInterpretation` (신규)
- `src/lib/deep-scoring-core/core.ts` — 해석 호출, `reason_codes`, `low_confidence` 시 `priority_vector.deconditioned` ×0.93
- `src/lib/result/deep-result-v2-contract.ts` — `_compat.survey_deconditioned_interpretation?` (검증 대상 아님)
- `src/lib/deep-v2/builders/build-free-survey-baseline.ts` — baseline `_compat`에 메타 전달
- `docs/pr/PR-SURVEY-03.md` — 본 문서

## Exact internal interpretation logic introduced

함수: `evaluateDeconditionedInterpretation(sv, primary_type, secondary_type, pain_mode, evidence)`

- **none**: `STABLE`이거나, `deconditioned < 0.28` 이고 primary가 `DECONDITIONED`가 아님.
- **broad** (`primary === DECONDITIONED`): movement 5축 평균·분산이 둔탁함(`mean ≥ 0.38`, `spread ≤ 0.82`, `min ≥ 0.14`)이고 우세도가 낮으면 broad; 그 외 DECON primary 기본은 broad.
- **hybrid** (`primary === DECONDITIONED`): 최고 movement 축 `top ≥ 0.48` 이고 우세도 `dom ≥ 0.2` → 특정 축이 같이 두드러짐.
- **hybrid** (non-DECON): `D ≥ 1.15`, `D/maxPart ∈ [0.3, 0.92]`, `dom ≥ 0.08`.
- **low_confidence**: (1) G군+전체 저응답 힌트이면서 `0.42 ≤ D < 3.6`, primary ≠ DECON; 또는 (2) `0.52 ≤ D < 2.65`, `dom < 0.13`, `mean < 0.48`, `maxPart ≥ 0.2`.

`reason_codes`: `decond_interp_broad` | `decond_interp_hybrid` | `decond_interp_low_confidence` (해당 시만).

`priority_vector`: `low_confidence`일 때만 `deconditioned`에 ×0.93 (분류 로직은 이미 확정된 뒤라 primary/secondary 불변).

## What was intentionally not changed

- 설문 18문항, UI/플로우/카피, 라우트, 카메라/refine, onboarding, claim, readiness, session-create.
- `UnifiedDeepResultV2` 필수 필드 스키마(검증 경로); `_compat` 선택 확장만.
- 공개 `primary_type` 판정 트리(`classifyTypes`, STABLE·통증 게이트).
- 카메라 refined 빌더는 `_compat`에 본 필드를 넣지 않음(카메라 경로 변경 최소화).

## Risks / follow-ups

- `low_confidence`의 priority 축소가 드물게 상대 순서를 바꿀 수 있으나, 계수 0.93으로 제한.
- 향후 세션 품질/첫 세션 보수성에서 `_compat.survey_deconditioned_interpretation`을 소비할 때, 과거 payload에는 필드가 없을 수 있음 → optional 처리 필수.
- 임계값은 PR-SURVEY-04에서 데이터/도그푸딩으로 미세 조정 가능.

## Acceptance checklist

- [ ] 설문 18문항·UI·카피 불변.
- [ ] `buildFreeSurveyBaselineResult` → validate 통과.
- [ ] `npm run test:free-survey-evidence-parity` 통과.
- [ ] `npx tsx scripts/free-survey-multi-axis-regression.mjs` — 기존 알려진 4건 primary diff만.
- [ ] `npm run build` 성공.

## Suggested git commands

```bash
git add src/lib/deep-scoring-core/types.ts src/lib/deep-scoring-core/deconditioned-interpretation.ts src/lib/deep-scoring-core/core.ts src/lib/result/deep-result-v2-contract.ts src/lib/deep-v2/builders/build-free-survey-baseline.ts docs/pr/PR-SURVEY-03.md
git commit -m "feat(deep-scoring): PR-SURVEY-03 deconditioned internal interpretation layer"
```
