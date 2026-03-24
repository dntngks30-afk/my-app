# PR-SURVEY-02 — Free survey interaction rule layer

## Findings

- PR-SURVEY-01 이후 축 기여는 명시적 contribution map으로 합산되지만, 동일 스케일에서 **여러 문항이 동시에 올라가는 패턴**(광범위 부하, 비대칭 스택, 허리 부하+하체 가동성 등)은 단일 합만으로는 분리가 약하다.
- 무료 설문에는 유료 deep과 달리 **통증 강도 필드가 evidence에 없어** “보호적 해석”은 C군(허리·골반 부하) 평균을 **맥락 프록시**로만 쓰는 편이 안전하다.
- `runDeepScoringCore`는 채널 비인지이므로, 조합 규칙은 **`survey_axis_interaction_hints`가 있을 때만** 적용하고 카메라/유료는 `undefined`로 기존 동작을 유지한다.

## Why pure weighted summation was insufficient

- 한 문항이 여러 축에 나뉘어 들어가면, **같은 도메인(예: F군)에서 연속으로 높은 응답**이 asymmetry 축에만 선형으로 쌓이고 “패턴”으로 읽히기 어렵다.
- **둔탁하게 여러 movement 축이 함께 높은 경우** deconditioned 쪽 해석은 adapter의 BROAD/DIFFUSE에만 의존해, 그 사이 영역이 얇을 수 있다.
- **G군(긴장) + 전체 응답이 낮은 프로필**은 deconditioned 가중이 약해질 수 있어, 소폭 보조가 필요하다.

## Files changed

- `src/lib/deep-scoring-core/types.ts` — `SurveyAxisInteractionHints`, `DeepScoringEvidence.survey_axis_interaction_hints?`
- `src/lib/deep-scoring-core/survey-axis-interactions.ts` — 규칙 A~D 적용(신규)
- `src/lib/deep-scoring-core/core.ts` — 비-STABLE일 때만 조정 벡터로 분류·derived·`axis_scores_raw` 계산, `reason_codes`에 `interaction_*` 태그
- `src/lib/deep-v2/adapters/free-survey-to-evidence.ts` — `buildSurveyAxisInteractionHints`, evidence에 힌트 부착
- `docs/pr/PR-SURVEY-02.md` — 본 문서

## Exact rules introduced

| ID | 조건(요약) | 조정(보수적) |
|----|------------|----------------|
| **A** `survey02_rule_a_lower_mobility_trunk_load` | `trunk_load_pain_proxy`(C군 평균 ≥ 2.5) ∧ `lower_mobility` ≥ 0.085 | `trunk_control` +0.065(캡 2.7), `lower_mobility` +0.035(캡 0.58) |
| **C** `survey02_rule_c_asymmetry_stack` | `f_asymmetry_cluster`(F군 평균 ≥ 2.5) ∧ `asymmetry` ≥ 0.22 | `asymmetry` +0.085(캡 2.4) |
| **B** `survey02_rule_b_broad_high` | movement 5축만: min ≥ 0.34, max−min ≤ 0.55, mean ≥ 0.4, `deconditioned` ∈ [0.22, 6) | `deconditioned` +0.13(캡 5.55, gate 6 미만 유지) |
| **D** `survey02_rule_d_fatigue_low_habit` | `g_guarding_cluster`(G군 ≥ 2.5) ∧ `low_global_movement_confidence`(18문항 평균 ≤ 2.25) ∧ `deconditioned` < 6 | `deconditioned` +0.1(캡 동일) |

적용 순서: **A → C → B → D** (감사·재현용). `deconditioned ≥ 6`(adapter BROAD 등)이면 B/D는 스킵.

힌트 정의(어댑터):

- `trunk_load_pain_proxy`: C1–C3 평균 ≥ 2.5  
- `f_asymmetry_cluster`: F1–F3 평균 ≥ 2.5  
- `g_guarding_cluster`: G1–G3 평균 ≥ 2.5  
- `low_global_movement_confidence`: 18문항 평균 ≤ 2.25  

## What was intentionally not changed

- 설문 18문항·UI·라우트·카피, `UnifiedDeepResultV2` 스키마, public result renderer, 카메라/refine, readiness, onboarding, claim, session-create.
- PR-SURVEY-01 `signalType` — 스코어에 미사용.
- 유료·카메라 evidence 빌더 — `survey_axis_interaction_hints` 미설정.
- STABLE 게이트 — `isStableEvidence`는 **조정 전** `axis_scores` 기준 유지; STABLE 분기에서는 interaction 미적용.

## Risks / follow-ups

- C군을 “통증”이 아닌 **부하·보호 맥락 프록시**로만 썼음을 문서·코멘트로 고정함; 추후 실제 통증 필드가 무료 경로에 들어오면 Rule A 조건을 재검토.
- `reason_codes`에 `interaction_*` 문자열이 추가됨 — 소비처가 엄격 파싱하면 영향 가능(현재는 나열형 메타로 가정).
- PR-SURVEY-03+에서 임계값·캡을 조정할 때 회귀 스크립트(`free-survey-multi-axis-regression.mjs`)와 함께 확인.

## Acceptance checklist

- [ ] 설문 문항 수 18 유지.
- [ ] 무료 설문 UI/플로우/카피 변경 없음.
- [ ] `buildFreeSurveyDeepEvidence` → `runDeepScoringCore` → Unified V2 경로 유효.
- [ ] 카메라/유료 경로: hints 없음 → 조정 없음(동일).
- [ ] `npm run test:free-survey-evidence-parity` 통과.
- [ ] `npx tsx scripts/free-survey-multi-axis-regression.mjs` — 기존 알려진 4건 diff 외 **신규 primary 불일치 없음**(현재 18/22 일치 유지).
- [ ] `npm run build` 성공.

## Suggested git commands

```bash
git add src/lib/deep-scoring-core/types.ts src/lib/deep-scoring-core/survey-axis-interactions.ts src/lib/deep-scoring-core/core.ts src/lib/deep-v2/adapters/free-survey-to-evidence.ts docs/pr/PR-SURVEY-02.md
git commit -m "feat(deep-scoring): PR-SURVEY-02 conservative survey axis interaction rules"
```
