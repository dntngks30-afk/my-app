# PR-OAUTH-ACCOUNT-SELECT-01 — 소셜 OAuth 계정 선택·재로그인 유도

## 목적

공개 퍼널 종료 후 `/app/auth`에서 Google/Kakao 로그인 시 **이전 계정으로 조용히 자동 재로그인되는 현상을 줄이고**, 최소한 **계정 선택 또는 다른 계정으로 로그인**할 수 있는 기회를 늘리기 위해, Supabase `signInWithOAuth`에 **provider별 `queryParams`**를 넣는다.

## 변경 파일

| 파일 | 내용 |
|------|------|
| `src/lib/auth/startOAuthClient.ts` | `getOAuthQueryParams`: Google `prompt=select_account`, Kakao `prompt=login`. 기존 `redirectTo`·canonical 분기·로그 구조 유지. |

`AppAuthClient.tsx`는 수정하지 않음(동일 `startOAuthClient` 호출).

## Google: `prompt=select_account`

OAuth 승인 요청에 전달되어 Google 쪽에서 **계정 선택** 화면 유도에 도움이 된다.

## Kakao: `prompt=login`

Kakao 문서에 따라 **재로그인/다른 계정** 흐름을 열 가능성을 높인다(동작은 카카오 앱·브라우저 상태에 좌우).

## 보장하는 범위

- 로그인 시작은 기존과 동일하게 `supabase.auth.signInWithOAuth`만 사용한다.
- `/auth/callback?next=…&provider=…` **`redirectTo` 계약은 변경하지 않았다.**
- Canonical origin 리다이렉트 로직은 변경하지 않았다.

## 보장하지 않는 범위

- **Google/Kakao 브라우저 쿠키를 MOVE RE에서 삭제하지 않는다.** (이 PR 범위 외)
- Provider·브라우저 상태에 따라 **항상 새 이메일 입력 화면이 뜨는 것은 보장하지 않는다.**
- 목표는 **무조건 초기화**가 아니라, **조용한 자동 재로그인 가능성을 낮추고 계정 선택/다른 계정 로그인 기회를 제공**하는 것이다.

## 수동 검증 체크리스트

1. `/app/auth`에서 Google → OAuth 동작이 기존과 같이 이어지고, 로그에 `oauth_account_selection_hint_applied` / `accountSelectionHint`가 확인되는지(개발자 도구).
2. Kakao → `accountSelectionHint: login`.
3. 로그인 성공 후 **`next` 복귀·public→ pay → onboarding 등 기존 플로 유지**.
4. `NEXT_PUBLIC_CANONICAL_ORIGIN` 환경에서 비정규 origin에서 로그인 시도 시 **기존처럼 canonical으로 먼저 이동**하는지.

## 후속 리스크

- Supabase/Google/Kakao 쪽 정책·파라미터 이름 변경 시 재검증 필요.
- Kakao의 `prompt=login` 해석은 제품 버전별로 차이 있을 수 있음.
