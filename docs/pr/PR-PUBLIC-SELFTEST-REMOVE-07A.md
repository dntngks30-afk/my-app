# PR-PUBLIC-SELFTEST-REMOVE-07A

**제목:** feat(public): remove self-test from active free test flow  
**범위:** UI/라우트 정리 (flow-only PR)  
**상태:** IMPLEMENTED

---

## 1. Assumptions

- `selfTest` 필드와 `finalType` 필드는 `movementTestSession:v2` 세션에 저장되지만,
  현대 공개 결과 경로(`refine-bridge` → `baseline` / `refined` → `PublicResultRenderer`)는
  두 필드를 **읽지 않는다**. (grep 추적 확인)
- `baseline/page.tsx`, `refined/page.tsx`, `refine-bridge/page.tsx`는 오직 `answersById`와 `isCompleted`를 소비한다.
- `SurveyForm` → `/movement-test/result` 경로는 v1 레거시 flow (`(main)/test/page.tsx` + `movementTestSession:v1`)이며,
  이번 PR 범위에 포함되지 않는다.
- `retest-comparison` → `/movement-test/result` 경로는 재검사 전용 내부 flow이며, 공개 퍼널이 아니므로 이번 PR 범위 밖이다.

---

## 2. CURRENT_IMPLEMENTED (변경 전 사실)

- `survey/page.tsx`는 설문 마지막 문항에서 `avg >= 35 && avg <= 49`일 때 **자가테스트 모달**을 표시했다.
- 모달에서 "자가테스트 하기" → `/movement-test/self-test` 경로가 활성 진입점이었다.
- 모달에서 "건너뛰기" → `refine-bridge`로 넘어가는 `handleSkipToResult` 핸들러가 존재했다.
- `self-test/page.tsx`는 3문항 자가테스트 UI를 렌더링하고 완료 시 `refine-bridge`로 이동했다.
- 두 경로 모두 결국 `refine-bridge`에서 합류했으나, **자가테스트 경로에서만 `finalType`이 계산·저장**되었다.
- `finalType`, `selfTest` 세션 필드는 현대 Deep Result V2 스코어링 체인(`build-free-survey-baseline.ts`,
  `free-survey-to-evidence.ts`, `runDeepScoringCore`)에서 **읽히지 않는다**.
- 공개 결과는 이미 `UnifiedDeepResultV2` 계약 기준이며, `public_results.result_v2_json`에 저장된다.

---

## 3. LOCKED_DIRECTION

- 설문이 유일한 public baseline 입력이다.
- 카메라는 결과 직전 optional refine evidence다. (SSOT §4-3)
- 공개 테스트 플로우: `설문 → refine-bridge → baseline / camera → 결과`.
- 중간 단계(자가테스트)는 공개 퍼널에서 제거 방향이다. (SSOT §6 P0)
- 결제는 분석 unlock이 아닌 실행 unlock이다.

---

## 4. NOT_YET_IMPLEMENTED (이 PR 이후 남은 과제)

- `/movement-test/result` 레거시 페이지 자체의 폐기 / 모던 경로로의 완전 대체 (별도 PR)
- `SurveyForm` (v1, `/test` 경로)의 v2 경로 통일 (별도 PR)
- `retest-comparison` 내 `/movement-test/result` 링크의 현대 경로 교체 (별도 PR)
- `SessionV2` 인터페이스의 `selfTest`/`finalType` 타입 필드 정리 (별도 PR — 안전 여부 재확인 후)
- `_compat.scoring_version: 'free_survey_v2_core'` vs 유료 deep 메타 정렬 (별도 PR)

---

## 5. Findings

### 5-1. Self-test 의존성 추적 결과

| 파일 | selfTest 사용 여부 | finalType 사용 여부 | 결론 |
|------|-------------------|---------------------|------|
| `refine-bridge/page.tsx` | 읽지 않음 | 읽지 않음 | 영향 없음 |
| `baseline/page.tsx` | 읽지 않음 | 읽지 않음 | 영향 없음 |
| `refined/page.tsx` | 읽지 않음 | 읽지 않음 | 영향 없음 |
| `build-free-survey-baseline.ts` | 읽지 않음 | 읽지 않음 | 영향 없음 |
| `free-survey-to-evidence.ts` | 읽지 않음 | 읽지 않음 | 영향 없음 |
| `PublicResultRenderer.tsx` | 읽지 않음 | 읽지 않음 | 영향 없음 |
| `movement-test/result/page.tsx` | finalType 사용 | finalType 사용 | 레거시 전용; 공개 메인 퍼널 아님 |

### 5-2. 활성 공개 플로우에서 self-test가 남아 있던 이유

`advanceOrComplete` 함수가 마지막 문항 완료 시 `avg` (6축 점수 평균) 를 계산하고,
35~49 구간에서 모달을 트리거했다. 이 로직은 v2 설문 페이지가 처음 작성될 때부터
"경계선 점수 사용자에게 추가 신호를 수집한다"는 의도로 삽입되었으나,
현재 Deep V2 스코어링 체인은 `selfTest` 입력을 소비하지 않으므로 **실질적으로 데드 로직**이었다.

### 5-3. /movement-test/result 활성 진입점 현황

- `SurveyForm.tsx` (265행): `/movement-test/result` 푸시 — **v1 레거시 플로우** (`(main)/test` 경로)
- `retest-comparison/RetestComparisonClient.tsx` (411행): `/movement-test/result` 푸시 — **재검사 전용 플로우**
- 두 경로 모두 **공개 메인 퍼널(`/movement-test` → survey → baseline/refined)과 무관**하다.
- 이번 PR에서 건드리지 않는다.

---

## 6. Files Changed

| 파일 | 변경 유형 | 내용 |
|------|-----------|------|
| `src/app/movement-test/survey/page.tsx` | 수정 | self-test 모달 분기 제거 |
| `src/app/movement-test/self-test/page.tsx` | 수정 | 호환성 리디렉트로 교체 |
| `docs/pr/PR-PUBLIC-SELFTEST-REMOVE-07A.md` | 신규 | 본 문서 |

### survey/page.tsx 상세 변경

- `showSelfTestModal` 상태 제거
- `handleSkipToResult` 핸들러 제거
- `handleGoToSelfTest` 핸들러 제거
- `useEffect` 2개 제거 (body overflow lock, keydown listener)
- 모달 JSX 블록 전체 제거
- `advanceOrComplete`에서 `avg >= 35 && avg <= 49` 분기 제거 → 마지막 문항 완료 시 **항상 refine-bridge 이동**
- `getAxisSummary` 에서 `avg` 계산 제거 (더 이상 필요 없음)
- `selfTest`/`finalType` 세션 필드는 passthrough 유지 (기존 세션 하위 호환)

### self-test/page.tsx 상세 변경

- 기존 자가테스트 UI 및 스코어링 로직 전체 교체
- 진입 시 `movementTestSession:v2`의 `answersById` 유무 확인
  - 있으면 → `router.replace('/movement-test/refine-bridge')`
  - 없으면 → `router.replace('/movement-test/survey')`
- 파일을 삭제하지 않고 유지하여 북마크/스테일 링크에서 404 방지

---

## 7. Acceptance Tests

1. `/movement-test` → 설문 → 마지막 문항 완료 → **자가테스트 모달 없이 `/movement-test/refine-bridge`로 이동** (avg 범위 무관)
2. 설문 진행 중 어떤 문항에서도 자가테스트 모달이 표시되지 않음
3. `/movement-test/refine-bridge` → "결과 먼저 보기" → baseline 결과 정상 표시
4. `/movement-test/refine-bridge` → "카메라로 움직임 체크하기" → camera → refined 결과 정상 표시
5. `/movement-test/self-test` 직접 접근 시:
   - 설문 답변 있으면 → `/movement-test/refine-bridge` 리디렉트
   - 없으면 → `/movement-test/survey` 리디렉트
   - 404 발생하지 않음
6. 기존 baseline 결과 계속 작동 (PublicResultRenderer, persistPublicResult 무변경)
7. 기존 refined 결과 계속 작동
8. auth/pay/onboarding/claim/session-create 계약 무변경
9. `/app` 실행 코어 무변경
10. scoring 계약 (`build-free-survey-baseline`, `free-survey-to-evidence`, `runDeepScoringCore`) 무변경

---

## 8. Non-goals (이 PR에서 하지 않는 것)

- Deep scoring 로직 변경 (`_compat.scoring_version` 포함)
- `freeSurveyAnswersToEvidence` 또는 `calculateScoresV2` 변경
- `PublicResultRenderer` 변경
- auth/pay/onboarding/session-create/bootstrap 계약 변경
- `/app` 실행 코어 변경
- `SessionV2` 인터페이스에서 `selfTest`/`finalType` 타입 제거
- `SurveyForm` v1 → v2 마이그레이션
- `retest-comparison` 수정
- `/movement-test/result` 레거시 페이지 제거

---

## 9. Follow-up PRs (이 PR로 인해 식별된 후속 과제)

1. **PR-LEGACY-RESULT-CLEANUP**: `/movement-test/result` 레거시 페이지 및 `SurveyForm` v1 경로 처리
2. **PR-SESSION-SCHEMA-CLEANUP**: `SessionV2.selfTest`/`SessionV2.finalType` 타입 필드 정리 (다운스트림 재확인 후)
3. **PR-SCORING-META-ALIGN**: `free_survey_v2_core` → 유료 파이프라인 메타 정렬 (SSOT §6 P0)
