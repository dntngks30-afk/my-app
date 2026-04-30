# PR-AUTH-IOS-HANDOFF-SIGNUP-INTENT-01

## 목표

iOS 실기기 auth 실패 2건을 auth/handoff/session intent routing 범위에서 최소 수정으로 안정화한다.

- iOS KakaoTalk in-app Kakao 로그인 무반응 체감 완화
- in-app 회원가입 intent가 기존 session short-circuit에 먹혀 onboarding으로 가는 회귀 차단

## 문제 증상

1. iOS KakaoTalk in-app에서 Kakao 클릭 시 무반응처럼 보임
2. iOS in-app에서 로그인 화면 “회원가입” 클릭 → “안전하게 이어서 시작하기” 이후 회원가입 폼 대신 onboarding으로 이동

## 원인

### 원인 1 — iOS KakaoTalk direct OAuth 정책

`/app/auth`에서 iOS + KakaoTalk in-app + Kakao일 때 handoff sheet를 건너뛰고 direct OAuth(`startOAuthClient('kakao')`)를 실행하던 분기 존재.

### 원인 2 — Kakao `prompt=login`

`startOAuthClient`의 provider query params에서 Kakao에 `prompt=login`을 고정 적용.
Google `prompt=select_account`는 유지 대상이나 Kakao `prompt=login`은 필수 계약으로 잠겨 있지 않음.

### 원인 3 — signup intent 소실

`/auth/handoff?method=email&mode=signup` 진입 후 `HandoffClient`가 signup 분기보다 session short-circuit(`router.replace(oauthNext)`)를 먼저 수행.
결과적으로 signup intent가 execution/readiness 흐름에 흡수되어 onboarding으로 이어질 수 있음.

## 수정 범위

- `src/app/app/auth/AppAuthClient.tsx`
- `src/app/auth/handoff/HandoffClient.tsx`
- `src/lib/auth/startOAuthClient.ts`

비범위:
- `/app/home`, onboarding 도메인 로직, payment/Stripe, session generator, public result scoring/camera, auth callback PKCE 교환 구조, Supabase migration

## 변경 사항

### 1) iOS KakaoTalk direct OAuth 폐기

- iOS in-app에서 Kakao는 KakaoTalk 포함 예외 없이 handoff sheet 경로 사용
- iOS Safari/일반 브라우저의 Kakao direct OAuth는 유지
- iOS Google 미지원 정책 유지
- Android in-app handoff/Chrome intent 정책 유지

### 2) Kakao `prompt=login` 제거

- Google만 `queryParams: { prompt: 'select_account' }`
- Kakao는 queryParams 미전달(옵션에서 생략)
- 로그 `accountSelectionHint`: Google=`select_account`, Kakao=`null`

### 3) signup intent 보존

`HandoffClient`에서 `method=email && mode=signup` 처리 우선:
- 기존 session이 있으면 signOut 시도
- 성공/실패와 무관하게 `/signup?next=...`로 이동
- 기존 session short-circuit는 OAuth handoff(google/kakao) 및 email/login에만 유지

## signup intent 보존 법칙

- `email/signup` handoff는 사용자 intent가 우선
- existing session이 있어도 signup intent를 execution/readiness로 조용히 전환하지 않음
- OAuth handoff의 session short-circuit은 기존대로 유지

## Android 미변경

- Android in-app의 handoff URL 생성 및 Chrome intent 진입 정책 변경 없음

## Acceptance Criteria

- iOS Safari에서 Kakao 클릭 시 OAuth 페이지로 이동
- iOS KakaoTalk in-app에서 Kakao 클릭 시 무반응 없이 handoff CTA/sheet 노출
- iOS in-app에서 회원가입 클릭 후 signup intent가 보존되어 signup 폼 진입
- existing session에서 회원가입 클릭 시 조용히 `/execution/start`/`/onboarding`으로 가지 않음
- Android in-app handoff/intent 기존 동작 유지
- Google iOS 미노출 정책 유지
- auth callback PKCE 교환 경로 불변

## 수동 실기기 체크리스트

### iOS Safari
- `/app/auth` 진입
- Kakao 클릭
- OAuth 페이지 이동 확인

### iOS KakaoTalk in-app
- `/app/auth` 진입
- Kakao 클릭
- 무반응 없이 “안전하게 이어서 시작하기” sheet 또는 명확한 handoff CTA 확인
- CTA 후 Safari/auth handoff 흐름 확인

### iOS in-app (existing session)
- 로그인 화면에서 회원가입 클릭
- “안전하게 이어서 시작하기” 클릭
- onboarding이 아니라 회원가입 폼으로 이동하는지 확인

### Android KakaoTalk in-app
- 기존 Chrome intent/handoff 유지 확인
