# PR-SURVEY-04 — Survey baseline → session-oriented hints

## Findings

- PR-SURVEY-01~03까지 해석은 core/`reason_codes`/`deconditioned_interpretation`에 쌓이지만, **세션 생성·첫 세션 보수성**으로 번역된 훅이 없었다.
- `UnifiedDeepResultV2` 필수 필드는 유지하고, `_compat`에 **작은 스키마 버전 객체**를 두면 하위 호환·검증 부담이 최소다.
- 무료 설문 baseline은 `priority_vector`가 항상 객체이므로 힌트 생성에 충분하다.

## Why analysis-to-session translation is needed

- 동일 `primary_type`이라도 broad decond vs 단일 축 우세 hybrid는 **첫 세션 볼륨·진입 강도·비대칭 주의**가 달라야 한다.
- 분석 결과를 “설명”에서 끝내면 plan/session 레이어가 공개 카피를 역파싱하거나 중복 휴리스틱을 만들 위험이 있다.

## Files changed

- `src/lib/result/deep-result-v2-contract.ts` — `SurveySessionHints` 및 관련 유니온 타입, `_compat.survey_session_hints?`
- `src/lib/deep-v2/session/derive-survey-session-hints.ts` — `deriveSurveySessionHints` (신규)
- `src/lib/deep-v2/builders/build-free-survey-baseline.ts` — baseline `_compat`에 힌트 부착
- `docs/pr/PR-SURVEY-04.md` — 본 문서

## Exact hint fields introduced

`SurveySessionHints` (`schema_version: 'survey_session_hints_v1'`)

| Field | 의미 |
|--------|------|
| `intro_tolerance_hint` | `open` / `standard` / `guarded` — 워밍업·진입 강도 허용 |
| `first_session_conservativeness` | `low` / `moderate` / `high` |
| `movement_preference_hint` | `mobility_first` / `control_first` / `mixed` |
| `asymmetry_caution_hint` | `none` / `moderate` / `elevated` |
| `deconditioned_support_hint` | `none` / `light` / `strong` |
| `volume_cap_hint` | `standard` / `reduced` / `minimal` |
| `progression_confidence_hint` | `cautious` / `standard` / `steady` |
| `first_session_bias_tags` | 짧은 문자열 태그(감사·추후 규칙 매핑) |

## Mapping logic summary

- 기본: 보수성 `moderate`, intro `standard`, 볼륨 `standard`, 진행 `standard`, decond 지지 `none`.
- **STABLE** + `confidence ≥ 0.55`: 보수성 `low`, intro `open`, 진행 `steady`.
- **evidence_level `lite`** 또는 **confidence < 0.42**: intro `guarded`, 진행 `cautious`, 태그 `lite_evidence_or_low_confidence`.
- **pain_mode `protected`**: 보수성 `high`, intro `guarded`, 볼륨 `minimal`, 진행 `cautious`, 태그 `pain_protected_session_bias`.
- **pain_mode `caution`**: 진행 `cautious`, 태그 `pain_caution_session_bias`.
- **PR-SURVEY-03 `deconditioned_interpretation`**: broad → decond 지지 `strong`, 보수성 상향, intro `guarded`, 볼륨 `reduced`, 진행 `cautious`; hybrid → 지지 `light`, 볼륨 `reduced`; low_confidence → 진행 `cautious` (볼륨 과도 축소 없음).
- **primary `DECONDITIONED`**: 지지 `strong`, 보수성 `high`, intro `guarded`, 볼륨 `reduced`, 진행 `cautious`, 태그 `primary_deconditioned`.
- **priority_vector `deconditioned`**만 의미 있을 때(해석 none): 지지 `light` 보강.
- **비대칭**: `asymmetry` PV 임계(≥0.26 moderate, ≥0.42 elevated); PR-SURVEY-02 rule C 발동 시 최소 moderate; elevated 시 볼륨 `reduced`·보수성 bump.
- **interaction rule 적용**: 태그 `survey_interaction_rules_applied`.

`movement_preference_hint`: primary가 가동/안정 계열이면 고정 매핑; STABLE/DECON/UNKNOWN은 mobility vs control PV 비교(차이 0.12).

## What was intentionally not changed

- 설문 18문항·UI·카피·라우트·공개 결과 렌더러, 카메라 refine, readiness, claim, onboarding, session-create API 본문.
- `validateUnifiedDeepResultV2` 검증 항목(필수 필드만).
- 타입 분류·Unified 필수 스키마.

## Risks / follow-ups

- session-create / plan 엔진이 `_compat.survey_session_hints`를 읽을 때 **구버전 payload에는 필드 없음** → optional 처리 필수.
- 힌트를 실제 템플릿 tier·볼륨에 연결하는 작업은 후속 PR.
- 임계값은 도그푸딩 후 PR-SURVEY-05에서 미세 조정 가능.

## Acceptance checklist

- [ ] 설문 문항·UI·플로우 불변.
- [ ] `buildFreeSurveyBaselineResult` 검증 통과.
- [ ] `npm run test:free-survey-evidence-parity` 통과.
- [ ] `free-survey-multi-axis-regression.mjs` — 기존 알려진 4건 외 primary 불일치 없음.
- [ ] `npm run build` 성공.

## Suggested git commands

```bash
git add src/lib/result/deep-result-v2-contract.ts src/lib/deep-v2/session/derive-survey-session-hints.ts src/lib/deep-v2/builders/build-free-survey-baseline.ts docs/pr/PR-SURVEY-04.md
git commit -m "feat(deep-v2): PR-SURVEY-04 survey baseline session hints in _compat"
```
