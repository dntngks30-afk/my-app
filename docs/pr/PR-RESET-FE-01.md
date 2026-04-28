# PR-RESET-FE-01 — ResetTabViewV2 · recommendations API 연동

## 목적 (CURRENT_IMPLEMENTED)

`ResetTabViewV2`가 마운트 시 `GET /api/reset/recommendations` 결과(`fetchResetRecommendations`)를 소비해 헤더 배지·상단 카드·하단 10개 이슈 목록을 표시하고, 이슈 행 선택만으로 상단 카드를 바꾼다. 로딩·에러·SSOT 10개 정적 폴백을 처리한다. 영상·모달·`POST /api/reset/media`는 범위 밖(FE-02).

## 변경 파일

| 파일 | 변경 요약 |
|------|-----------|
| [src/app/app/_components/nav-v2/ResetTabViewV2.tsx](../../src/app/app/_components/nav-v2/ResetTabViewV2.tsx) | `fetchResetRecommendations` 1회 호출, `loading` / `ready` / `error` 분기, API 매핑·선택 상태·폴백 행·Play defer |
| [src/app/api/reset/recommendations/route.ts](../../src/app/api/reset/recommendations/route.ts) | `GET` 핸들러 인자를 `getCurrentUserId`에 올바르게 전달(인자명 불일치 수정). **API가 200을 반환하지 못하던 결함 보정** — FE 탭만으로는 우회 불가하므로 본 PR에 포함. |

`src/lib/reset/client.ts`는 BE-02 계약으로 추가 수정 없음.

## ResetTabViewV2 동작 요약

- **Recommendations 소비**: `ResetRecommendationResponse` — `user_pattern.display_label`(배지), `issues`(하단), `featured` + `featured_issue_key` + 방어 규칙으로 초기 `selectedIssueKey` 및 파생 `selectedIssue`.
- **선택**: `ready`에서만 행 클릭 시 `setSelectedIssueKey(issue.issue_key)`만 수행, **API 재호출 없음**.
- **폴백 행**: `error` 전용, SSOT 10개 고정 문구; API `issues`와 **혼합 안 함**; 비클릭(`div` 정적 행) + 안내 문구로 “선택 카드”와 혼동 방지.
- **Play**: `cta_label` 또는 「이 스트레칭 해보기」; `aria-disabled={true}`; `onClick` 빈 본문 + `/* FE-02: ResetStretchModal + fetchResetMedia 연결 예정 */`; toast/alert/콘솔 스팸 없음.

## 선행 조건 (구현·검증 시)

- `GET /api/reset/recommendations`가 **200**, 본문 `{ ok: true, data: { version: 'reset_v1', issues: [...], featured_issue_key, ... } }`, 미인증 시에도 **fallback 200**, `issues.length === 10` 권장.
- 위가 깨지면 **FE에서 우회하지 말고** route/엔진을 좁은 PR로 먼저 고친다.

## Non-goals

- `ResetStretchModal`, `fetchResetMedia`, Mux, 홈 리셋맵, `SessionPanelV2`, `ExercisePlayerModal`, readiness·카탈로그·`recommend-reset.ts` 직접 import, `package.json`/스크립트 추가.

## 다음 PR

- **FE-02**: `ResetStretchModal` + `fetchResetMedia` + 재생.

## 수락 조건 (체크리스트)

- [ ] `ResetTabViewV2`는 mount 시 `fetchResetRecommendations`를 **1회** 호출한다.
- [ ] API 성공 시 하단에 **10개** `issues`가 표시된다.
- [ ] 리스트 클릭은 **API 재호출 없이** `selectedIssueKey`만 바꾼다.
- [ ] 상단 카드의 title / summary / duration / primary stretch name이 **선택 이슈**에 맞게 바뀐다.
- [ ] Play 버튼은 **media/modal을 호출하지 않는다.**
- [ ] 에러 폴백 행은 **SSOT 10개** 문구이다.
- [ ] `/api/reset/recommendations`가 깨져 있으면 **FE 우회 없이 BE 쪽 수정** 후 다시 검증한다.
- [ ] `ResetTabViewV2` **외** core 실행 영역(`/app/home` 등)은 수정하지 않았다.

## 수동 검증

1. `/app/checkin` (production nav 기준 리셋 탭) 진입 시 탭이 깨지지 않는다.
2. 헤더 배지에 `display_label` 또는 로딩/에러 시 안내 문구가 보인다.
3. 성공 시 이슈 10개 행이 보이고 좌·우가 `issue_label` / `short_goal`이다.
4. 행 클릭 시 상단 카드 문구가 바뀐다 (재네트워크 없음).
5. API 실패 시 빈 화면 대신 에러 카드 + 10개 안내 행이다.
6. Play 클릭 시 모달·네트워크·라우팅이 없다.
7. 홈 리셋맵·실행 패널 동작에 변화 없다.
