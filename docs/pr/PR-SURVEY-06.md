# PR-SURVEY-06 — Survey session hints: observability & explainability

## Findings

- PR-SURVEY-05는 설문 힌트를 세션 1 plan에 반영하지만, `constraint_flags`에 `survey_session_hints_applied` + flat `trace`만 있어 **present / eligible / 차단 이유 / 우선순위**를 한눈에 구분하기 어렵다.
- `session_rationale`은 홈·프리뷰 등 **사용자 대면** 경로에 연결되어 있어, 설문 설명 문장을 직접 덧붙이면 SSOT·카피 정책을 깨기 쉽다.
- 구조화된 `observability` 블록과 **비 UI용** `survey_session_rationale_tags`로 감사·디버그·분석을 분리하는 것이 안전하다.

## Why explainability / observability is needed after PR-SURVEY-05

- 운영/디버깅 시 “힌트가 있었는데 왜 안 바뀌었나?”는 **하드 가드 차단**과 “힌트가 약해서 trace가 비었음”을 구분해야 한다.
- beginner 티어 조정과 설문 티어 bump의 **적용 순서**를 메타에 남겨야 회귀 분석이 가능하다.

## Files changed

- `src/lib/deep-v2/session/survey-session-hints-first-session.ts` — `buildSurveySessionHintsObservability`, `classifySurveyHintChangedFields`, `resolveSurveyHintBlockedBy`, 타입 `SurveySessionHintsObservabilityV1` 등.
- `src/lib/session/plan-generator.ts` — 세션 1에 `meta.survey_session_hints_observability`, `meta.survey_session_rationale_tags`, `constraint_flags` 확장.
- `docs/pr/PR-SURVEY-06.md` — 본 문서.

## Exact new metadata / trace / rationale fields

### `meta.survey_session_hints_observability` (세션 1에만)

`schema_version: 'survey_session_hints_obs_v1'`

| Field | 의미 |
|--------|------|
| `present` | 입력에 `survey_session_hints` 객체가 있었는지 |
| `eligible` | 세션 1이면서 present |
| `applied` | eligible이고 하드 가드에 막히지 않았으며 effect `trace`가 1개 이상 |
| `blocked` / `blocked_by` | `null` \| `pain_protected` \| `safety_red` \| `session_not_1` |
| `precedence` | `no_hints` \| `hard_guard_blocks_survey` \| `eligible_no_survey_effect` \| `survey_after_beginner_tier` \| `survey_hints_applied` |
| `considered_hint_axes` | eligible일 때 평가 대상 축 이름(고정 7축 목록) |
| `changed_fields` | flat trace prefix로 역추적: `first_session_tier`, `volume_modifier`, `max_difficulty_cap`, `target_level`, `gold_path_scoring` |
| `rationale_tags` | 디버그용 짧은 태그 (UI 카피 아님) |
| `trace` | PR-SURVEY-05와 동일한 effect trace 문자열 배열 |
| `beginner_guardrail_before_survey_tier` | 온보딩 beginner일 때 true (순서 설명) |

### `meta.survey_session_rationale_tags` (선택, 세션 1, 태그가 있을 때만)

예: `survey_bias_mobility_first`, `survey_bias_control_first`, `survey_bias_asymmetry_caution`, `survey_bias_broad_deconditioned`, `survey_bias_low_progression_confidence`  
— **`session_rationale` 문자열은 변경하지 않음.**

### `constraint_flags` (세션 1에만)

- `survey_session_hints_present`, `eligible`, `applied`, `blocked`, `blocked_by`
- `survey_session_hints_trace` — effect trace가 있을 때만 (이전 PR과 동일 조건)

## Precedence rules (documented)

1. **하드 가드**: `pain_mode === 'protected'` 또는 `safety_mode === 'red'` → 설문 힌트 효과 없음 (`hard_guard_blocks_survey`, trace는 비어 있을 수 있음).
2. **세션 번호**: 세션 1이 아니면 eligible 아님 (`session_not_1`).
3. **첫 세션 가드 스택 (코드 순서)**: `getFirstSessionTier` → `adjustFirstSessionTierForOnboardingExperience`(beginner) → `bumpFirstSessionTierForSurveyHints` — beginner가 설문 티어 bump보다 먼저 적용됨을 `beginner_guardrail_before_survey_tier`로 표시.
4. **설문 힌트**: 위가 통과한 뒤에만 볼륨·캡·레벨·골드패스 스코어 bias 적용.

## What was intentionally not changed

- 설문·라우트·렌더러·카메라·readiness·claim·onboarding·auth/pay·UnifiedDeepResultV2 필수 계약.
- PR-SURVEY-05 알고리즘(티어·볼륨·캡·레벨·스코어) 본문.
- `session_rationale` 표시 문구(사용자 대면).
- session-create 라우트 본문, 대규모 analytics 프레임워크.

## Risks / follow-ups

- 저장되는 `plan_json` 크기가 세션 1에서 소폭 증가한다.
- `rationale_tags`는 **내부용**으로 유지하고, UI에 노출하려면 별도 제품 결정이 필요하다.

## Acceptance checklist

- [ ] 세션 1이 아니면 기존과 동일하게 survey observability 블록이 plan meta에 추가되지 않는다(세션 1만).
- [ ] 힌트 없음 → `present: false`, `precedence: no_hints`.
- [ ] protected / safety red → `blocked_by` 명시, `applied: false`.
- [ ] `npm run build` 성공.

## Suggested git commands

```bash
git add src/lib/deep-v2/session/survey-session-hints-first-session.ts src/lib/session/plan-generator.ts docs/pr/PR-SURVEY-06.md
git commit -m "feat(session): PR-SURVEY-06 survey hints observability and rationale tags"
```
