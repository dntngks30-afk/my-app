# PR-ONBOARDING-MIN-06 — 결제 후 온보딩 최소화·실행 준비 톤 정렬

## 1. Assumptions

- `session_user_profile`의 `target_frequency`, `exercise_experience_level`, `pain_or_discomfort_present`는 실행·readiness에 **여전히 필요**하며, 스키마 변경 없이 유지한다.
- 설문 v2는 Likert 체감 문항이라 **운동 경험(초보/중급)** 과 1:1 매핑되지 않아 자동 추정하지 않는 것이 안전하다.
- `lifestyle_tag`(TEXT)는 기존 컬럼으로, **선택적** “조심할 점 한 줄”에 재사용 가능하다.

## 2. CURRENT_IMPLEMENTED (이 PR 후)

- **onboarding-prep**: 카피를 “짧은 확인 + 실행 설정” 중심으로, CTA **「실행 설정으로」**.
- **onboarding (`/onboarding`)**: 단일 스크린 유지, 카피로 **설문·결과와 역할 분리** (패턴은 이미 반영 → 여기선 주당 횟수·경험·안전).
- **통증 프리필**: `movementTestSession:v2`의 q2(불편 슬롯) 평균으로 보수적 힌트(`inferPainHintFromSurveyV2`) — 사용자가 변경 가능.
- **선택 필드**: 수술·부상·제한 등 **한 줄** → `lifestyle_tag`(비어 있으면 요청 본문에서 키 생략).
- **POST /api/session/profile + `applyTargetFrequency`**: 본문에 **없는** 키는 컬럼을 업데이트하지 않음 → `postSessionProfile` 등 **빈도만** 보내는 호출이 경험·통증·lifestyle을 지우지 않음.
- **onboarding-complete**: 짧은 연결 완료 메시지.

## 3. LOCKED_DIRECTION

- post-pay 온보딩은 **최소 실행 준비**; 결제 = 실행 unlock; claim/session 경로 유지.

## 4. NOT_YET_IMPLEMENTED

- 의료/법적 장문 인테이크, 별도 DB 컬럼 추가.
- 세션 생성·로딩·PWA 안내 UX.

## 5. Findings (변경 전)

- 온보딩은 이미 **한 화면·3필수**였으나, 카피가 일반 “설문 느낌”에 가까움.
- `POST /api/session/profile`이 빈도만 보낼 때 `lifestyle_tag` 등을 **null로 덮어쓸 수 있는** 구조였음(이 PR에서 완화).

## 6. Root cause of onboarding friction

- **인지**: 결과·설문과 **역할이 겹친다**고 느끼기 쉬움.
- **기술**: 부분 업데이트 시 **필드 소거** 위험.

## 7. Files changed

- `src/app/onboarding/page.tsx` — UI/카피, 통증 프리필, 선택 `lifestyle_tag`
- `src/lib/onboarding/surveyOnboardingHints.ts` — 설문 기반 통증 힌트
- `src/app/onboarding-prep/page.tsx` — 짧은 안내·CTA
- `src/app/onboarding-complete/page.tsx` — 연결 완료 카피
- `src/app/api/session/profile/route.ts` — 선택 필드 파싱·검증
- `src/lib/session/profile.ts` — `applyTargetFrequency` 부분 업데이트
- `docs/pr/PR-ONBOARDING-MIN-06.md`

## 8. Proposed onboarding structure after change

1. **onboarding-prep** (기존 1스텝): 한 줄 설명 → **실행 설정으로**
2. **onboarding** (1스크린): (1) 주당 횟수 (2) 경험 (3) 통증/불편 (4) 조심할 점 선택 → **저장하고 루틴 연결하기**
3. **onboarding-complete** → claim (기존)

## 9. Why this is safe relative to SSOT

- 필수 3필드·API 계약 유지; DB 마이그레이션 없음.
- `/app` 실행 코어 미변경; readiness의 `has_target_frequency`·실행 설정 필드 로직 유지.
- 빈도-only 클라이언트 호출이 다른 컬럼을 지우지 않게 개선.

## 10. Acceptance tests (manual)

1. 결제/실행 연속 → onboarding-prep → onboarding → complete → 홈/claim 흐름 유지.
2. 온보딩에서 필수 3개만 채우면 제출 가능; 선택 메모는 비워도 됨.
3. 설문 완료 후 온보딩 진입 시 통증이 **가능하면** 프리필(설문 없으면 수동).
4. 온보딩 저장 후 session profile에 값 반영, 이어서 claim/readiness 정상.
5. `postSessionProfile`(빈도만) 호출 시 기존 경험·통증이 **의도치 않게 null**이 되지 않음(회귀 확인).

## 11. Explicit non-goals

- payment·claim·session-create 라우트 계약 변경.
- 연령/성별 수집 UI 추가(이미 다른 경로에서 수집 시 재질문 안 함).

---

## Implementation type

**Mixed**: form UI + 카피 + **API/apply 부분 업데이트**(안전한 필드 보존) + 설문 힌트 헬퍼.

## Follow-up PRs

- `lifestyle_tag` 노출 위치·코치 요약에 반영 여부.
- readiness에서 `complete_onboarding` vs 실행 설정 필드 불일치 시 정합화 문서화.

## Diff summary

- 온보딩 3필수 + 선택 메모; 설문 기반 통증 힌트; 짧은 톤의 prep/complete.
- session profile **부분 업데이트**로 다른 API 소비자 보호.

## Manual paths

- `/onboarding-prep` → `/onboarding` → `/onboarding-complete`
- 설문 완료 후 같은 브라우저에서 `/onboarding` (통증 프리필 확인)
