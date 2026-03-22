# PR-UI-SUMMARY-SCORING-ALIGN

**목적:** `movement-test/survey/page.tsx`의 UI/세션 보조 요약에서 `calculateScoresV2` 직접 의존 제거, 07C direct domain SSOT와 정렬.

---

## 1. Findings

- **이 PR 당시:** `survey/page.tsx`가 `calculateScoresV2` 대신 `getSurveyUiAxisSummary`를 쓰도록 정렬 (마지막 문항에서 `topScore`는 레거시 세션 `finalType` 스탬프용으로만 사용).
- **후속 `PR-SESSION-SCHEMA-CLEANUP`:** 설문에서 `finalType` 제거와 함께 `getSurveyUiAxisSummary` 호출도 제거됨. 어댑터의 `getSurveyUiAxisSummary` export는 유지(다른 경로·테스트용).
- **기존:** `calculateScoresV2` → 6도메인 0~100 → 최고 축 `topScore`.
- **공유 SSOT:** `free-survey-to-evidence.ts`의 `computeDomainScoresAndPattern` (07C와 동일 수식).

---

## 2. Changes

| 파일 | 내용 |
|------|------|
| `src/lib/deep-v2/adapters/free-survey-to-evidence.ts` | `getSurveyUiAxisSummary()` export — domain scores에서 topAxis/topScore |
| `src/app/movement-test/survey/page.tsx` | `calculateScoresV2` import 제거, `getSurveyUiAxisSummary` 사용 (후속 PR에서 설문 측 호출 제거) |

---

## 3. Final rule

- **Survey UI summary truth:** `getSurveyUiAxisSummary` → `computeDomainScoresAndPattern` SSOT.
- **Baseline과 공유:** 동일 `computeDomainScoresAndPattern` → `freeSurveyAnswersToEvidence`와 축 점수 일치.
- **사용자 visible behavior:** 레이아웃/문항/흐름 동일; `topScore` 분포는 기존과 동일 계열(이전에도 동일 domain 수식).

---

## 4. Smoke

- Lint: 대상 파일 문제 없음.
- `npm run test:free-survey-evidence-parity` — 기존 07C parity 유지.

### Known risk

- (후속) `PR-SESSION-SCHEMA-CLEANUP`에서 설문이 세션 `finalType`을 쓰지 않도록 정리함. deep baseline과 무관했던 점은 동일.
