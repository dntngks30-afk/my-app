# PR-SURVEY-01 — Question contribution map (free survey evidence)

## Findings

- 기존에는 `QUESTION_AXIS_SHARES`(행 합 1.0)와 `QUESTION_SLOT_WEIGHT`(가족 내 W1/W2/W3)가 분리되어 있었고, `computeSurveyAxisRawScoresFromAnswers` / `applyFamilyCapRules`가 둘을 곱해 `axis_raw`에 누적했다.
- 동일 수식은 `weight = slotWeight × axisShare`로 합쳐 단일 테이블로 표현 가능하며, 문항별로 **축·가중치·신호 성격(signalType)**을 한 줄에 묶을 수 있다.
- `signalType`은 스코어링 수식에 아직 반영하지 않는다(PR-SURVEY-02+에서 가중/감쇠·감사에 사용 예정). 수치 경로는 PR-FREE-SURVEY-MULTI-AXIS-DEEP-MAPPING-01과 동치를 유지한다.

## Files changed

- `src/lib/deep-v2/adapters/free-survey-to-evidence.ts`
- `docs/pr/PR-SURVEY-01.md` (본 문서)

## What was changed

- `QuestionSignalType`, `QuestionContribution`, `buildQuestionContributions` 헬퍼 추가.
- `FREE_SURVEY_QUESTION_CONTRIBUTION_MAP`: 18문항 각각에 대해 `{ axis, weight, signalType }[]` 선언(`weight` = 기존 slot×share).
- `computeSurveyAxisRawScoresFromAnswers`, `applyFamilyCapRules`가 위 맵만 사용하도록 변경.
- `QUESTION_AXIS_SHARES`, `QUESTION_SLOT_WEIGHT` 상수 제거(단일 소스).

## What was intentionally not changed

- 설문 문항 수(18), UI, 라우트, 카피, public result contract, `UnifiedDeepResultV2`, `runDeepScoringCore`, 카메라/refine 경로, readiness/claim/onboarding/session-create.
- `AXIS_MAX`, `AXIS_TARGET_SCALE`, stable/decond 부스트 규칙, 정규화 파이프라인.
- `signalType`을 evidence 점수에 반영하지 않음.

## Risks / follow-ups

- **PR-SURVEY-02+**: `signalType`을 가중·캡·신뢰도에 반영할 때, 본 맵의 메타만 조정하면 되도록 구조가 준비됨.
- `FREE_SURVEY_QUESTION_CONTRIBUTION_MAP`의 **share/slot 숫자**를 바꾸면 `AXIS_MAX` 주석·상수와 불일치할 수 있으므로, 튜닝 시 문서 상단 수치와 회귀 스크립트를 함께 갱신할 것.

## Acceptance checklist

- [ ] 무료 설문 18문항 ID 집합 불변.
- [ ] `buildFreeSurveyDeepEvidence` 경로로 생성된 evidence → core → `UnifiedDeepResultV2` 검증 통과(기존과 동일 계약).
- [ ] 사용자 대면 카피·라우트·화면 동작 변경 없음.
- [ ] 카메라/refine 로직 미변경.
- [ ] `npm run test:free-survey-evidence-parity` 통과.
- [ ] `npx tsx scripts/free-survey-multi-axis-regression.mjs` — 알려진 4건 diff 외 신규 불일치 없음.
- [ ] `npm run build` 성공.

## Suggested git commands

```bash
git add src/lib/deep-v2/adapters/free-survey-to-evidence.ts docs/pr/PR-SURVEY-01.md
git commit -m "refactor(deep-v2): PR-SURVEY-01 explicit free-survey question contribution map"
```
