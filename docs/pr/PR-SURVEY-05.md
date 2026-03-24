# PR-SURVEY-05 — Consume `survey_session_hints` in session 1 plan generation

## Findings

- PR-SURVEY-04가 `_compat.survey_session_hints`를 **저장**만 하고, session-create / plan-generator는 이를 읽지 않아 설문 해석과 첫 세션 품질이 분리되어 있었다.
- 첫 세션 보호는 이미 `getFirstSessionTier`, `FIRST_SESSION_LIMITS`, `adjustFirstSessionTierForOnboardingExperience`, `safety_mode` / `pain_mode`, adaptive overlay로 **지배적**이다. 힌트는 그 **아래**에서만 보수적 bias를 더하는 것이 안전하다.
- claimed public result → `buildSessionDeepSummaryFromPublicResult` → `buildSessionPlanJson` 경로에 optional 필드 하나로 힌트를 실을 수 있어, composer 전면 개편 없이 연결 가능하다.

## Why survey_session_hints need actual consumption

- 동일 Unified 표면 아래에서도 설문이 이미 **볼륨·진입·비대칭·진행 신뢰**를 압축해 두었으므로, 세션 1에서 재해석하지 않으면 정보가 버려진다.
- 소비는 **내부 trace + constraint meta**로 남겨 두면 감사·회귀가 가능하다.

## Files changed

- `src/lib/deep-v2/session/survey-session-hints-first-session.ts` — 힌트 소비 순수 함수(티어·볼륨·난이도 캡·타깃 레벨·골드패스 스코어 보정).
- `src/lib/session/plan-generator.ts` — `PlanGeneratorInput.survey_session_hints`, 세션 1에서만 위 헬퍼 연동; `meta.constraint_flags`에 trace.
- `src/lib/deep-result/session-deep-summary.ts` — optional `survey_session_hints`.
- `src/lib/deep-result/buildSessionDeepSummaryFromPublicResult.ts` — `_compat.survey_session_hints` 검증 후 summary에 전달.
- `src/lib/session/session-snapshot.ts` — `survey_session_hints_present` (관찰가능성).
- `src/app/api/session/create/route.ts` — `buildSessionPlanJson` / gen-cache 입력에 힌트 전달.
- `src/lib/session-gen-cache.ts` — 캐시 키에 힌트 canonical 포함.
- `docs/pr/PR-SURVEY-05.md` — 본 문서.

## Exact hint consumption logic

**적용 조건 (모두 만족 시에만)**

- `input.sessionNumber === 1`
- `input.survey_session_hints` 존재
- **하드 가드에 지배되지 않음**: `pain_mode !== 'protected'` AND `safety_mode !== 'red'`

**우선순위 (높은 것이 이김)**

1. `pain_mode` / `safety_mode` / `red_flags`에 의해 결정되는 `maxLevel`, `getFirstSessionTier`, adaptive overlay(`maxDifficultyCap`, `targetLevelDelta` 등).
2. 온보딩 `exercise_experience_level === 'beginner'` → `adjustFirstSessionTierForOnboardingExperience`.
3. **그 다음** 설문 힌트: 티어 한 단계 추가 보수화, 볼륨 modifier 델타, intro `guarded` 시 `maxLevel`/`finalTargetLevel` 상한 2, 난이도 캡 `medium` 병합, 골드패스 세그먼트 스코어 미세 조정.

**티어 한 단계 bump** (`normal`→`moderate`→`conservative`, 이미 `conservative`면 유지)

- `first_session_conservativeness === 'high'`
- `volume_cap_hint === 'minimal'`
- `volume_cap_hint === 'reduced'` AND `progression_confidence_hint === 'cautious'`
- `intro_tolerance_hint === 'guarded'` AND (`progression_confidence_hint === 'cautious'` OR `first_session_conservativeness === 'high'`)
- `deconditioned_support_hint === 'strong'` AND `first_session_conservativeness !== 'low'`

**볼륨 (`mainCount`용 `volumeModifier`에 가산, 힌트만 합산 상한 -0.18, 전체 `volumeModForMainCount`는 -0.45까지)**

- `minimal`: -0.12
- `reduced`: -0.06
- `deconditioned_support_hint === 'strong'`: 추가 -0.04

**난이도 캡 병합**

- `intro_tolerance_hint === 'guarded'` 또는 (`progression_confidence_hint === 'cautious'` AND `first_session_conservativeness !== 'low'`) → 기존 캡이 없거나 `high`이면 `medium`으로 **만** 조이기 (`low`는 유지).

**타깃 레벨**

- `intro_tolerance_hint === 'guarded'` → `maxLevel`/`finalTargetLevel`을 `min(·, 2)` (safety가 이미 더 낮으면 그대로).

**골드패스 선택 스코어 (구조 변경 없음)**

- `movement_preference_hint === 'mobility_first'` + `prep`: 가동성 태그 일치 시 +2
- `control_first` + `prep`: `core_control` 태그 시 +2
- `asymmetry_caution_hint === 'elevated'` + `main`: `progression_level` 2→-2, 3+→-5

**관찰가능성**

- `plan_json.meta.constraint_flags.survey_session_hints_applied` / `survey_session_hints_trace` — trace가 비어 있지 않을 때만 설정.
- 골드패스 bias 가능 시 `selection:survey_gold_path_bias` trace 항목.
- `deep_summary_snapshot_json.survey_session_hints_present` — 생성 시점에 summary에 힌트가 있었으면 true.

## Priority order vs pain_mode / beginner guardrails

| Layer | 역할 |
|--------|------|
| `pain_mode === 'protected'` 또는 `safety_mode === 'red'` | 힌트 **전부 스킵** |
| `getFirstSessionTier` (pain/yellow/deconditioned top) | 기본 티어 |
| beginner 온보딩 티어 조정 | 힌트 bump **이전** |
| 설문 힌트 | 최대 티어 한 단계·볼륨·캡·스코어 |

## What was intentionally not changed

- 공개 설문 플로우, 결과 렌더러, 카메라 refine, readiness, claim, onboarding, auth/pay, 라우트, UnifiedDeepResultV2 필수 계약.
- `derive-survey-session-hints` 생성 규칙.
- 세션 2+ 전용 로직(힌트 필드 무시).

## Risks / follow-ups

- 힌트가 없는 구버전 payload는 동작 변화 없음.
- non–gold-path 세션 1은 movement/asymmetry 힌트가 스코어에 거의 안 탈 수 있음 — 의도적 최소 범위.
- 임계값·trace 키는 도그푸딩 후 미세 조정 가능.

## Acceptance checklist

- [ ] 힌트 없음 → 기존과 동일한 plan 생성 경로(필드 미전달).
- [ ] 힌트 있음 + 세션 1 + 하드 가드 아님 → 보수적 bias 및 trace/meta 가능.
- [ ] `protected` / safety `red` → 힌트 무시.
- [ ] `npm run build` 성공.
- [ ] (선택) `npm run test:free-survey-evidence-parity` — 설문 빌더 회귀.

## Suggested git commands

```bash
git add src/lib/deep-v2/session/survey-session-hints-first-session.ts src/lib/session/plan-generator.ts src/lib/deep-result/session-deep-summary.ts src/lib/deep-result/buildSessionDeepSummaryFromPublicResult.ts src/lib/session/session-snapshot.ts src/app/api/session/create/route.ts src/lib/session-gen-cache.ts docs/pr/PR-SURVEY-05.md
git commit -m "feat(session): PR-SURVEY-05 consume survey_session_hints for session 1 plan bias"
```
