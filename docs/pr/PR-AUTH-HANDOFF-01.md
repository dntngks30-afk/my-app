# PR-AUTH-HANDOFF-01 — In-app auth handoff with result continuity

## 문제

카카오·네이버·인스타 등 **인앱 브라우저 WebView**에서 Google OAuth가 `disallowed_useragent` 등으로 차단되거나, 이메일 인증 링크가 **다른 브라우저**에서 열리며 `localStorage` 기반 public result bridge·파일럿 컨텍스트가 끊길 수 있다.

## 목표

- 인앱에서 **직접 Supabase OAuth를 우회/해킹하지 않고**, 같은 origin의 **`/auth/handoff`** 로 **외부 브라우저(Android Chrome intent, iOS는 사용자 CTA)** 로 넘긴 뒤 bridge를 **다시 저장**한다.
- **토큰·이메일·auth code·개인정보는 URL에 넣지 않는다.**
- `next`·`/execution/start?...` 는 **내부 상대 경로만** 허용해 open redirect 를 막는다.
- OAuth 콜백 후 `next`가 `/execution/start`(쿼리 포함)이면 **readiness `GO_APP_HOME`이 덮어쓰지 않는다** ([`postAuthRouting`](../src/lib/readiness/postAuthRouting.ts) 기존 계약 유지).
- **Google `prompt=select_account`** 는 제거하지 않는다 ([`startOAuthClient`](../src/lib/auth/startOAuthClient.ts)).

## 목표 흐름

1. 결과 → 실행 CTA → bridge 저장 → `/app/auth?next=/execution/start?publicResultId=...&stage=...` (필요 시 pilot·anonId).
2. 인앱에서 Google/카카오/이메일 선택 → **`/auth/handoff?...`** (또는 Android Chrome intent로 동일 URL).
3. 외부 브라우저에서 handoff가 **bridge·pilot LS 복구**, OAuth/이메일/회원가입으로 분기.
4. 로그인 완료 → `/execution/start` → 기존 온보딩·세션 준비·**기존 PWA 설치 카드**([`StitchOnboardingCompleteScene`](../src/components/stitch/postpay/StitchOnboardingCompleteScene.tsx)) → `/app/home`.

## Query contract (`/auth/handoff`)

| 키 | 설명 |
|----|------|
| `method` | `google` \| `kakao` \| `email` |
| `mode` | `email`일 때만 `login` \| `signup` |
| `source` | 반드시 `in_app_auth_handoff` |
| `ts` | 클라이언트 타임스탬프(ms), **약 12분 TTL** |
| `next` | sanitize 된 내부 경로, 기본 `/execution/start` |
| `publicResultId` / `stage` | 함께 있어야 유효 (`baseline` \| `refined`) |
| `anonId` | 선택, UUID 형태 검증 |
| `pilot` | 선택, [`getPilotCodeFromSearchParams`](../src/lib/pilot/pilot-context.ts) 규칙 |

## Android / iOS

- **Android**: `intent://` + `package=com.android.chrome` + `S.browser_fallback_url` (같은 origin https handoff만).
- **iOS**: Safari 자동 전환 **보장 없음** → **「리셋 이어서 시작하기」** 계열 CTA 1회; 메인 카피에 브라우저 이름 없음.

## 이메일 auth

인앱에서 이메일 로그인/회원가입 제출 전 **handoff**로 외부 브라우저에서 `/app/auth` 또는 `/signup`으로 진입. **운영 OTP·`emailRedirectTo=/signup/complete?next=...`** 구조는 유지.

## 보안 / PII

- URL에 access/refresh token, email, OAuth code 금지.
- `next`에 `//`, `javascript:`, 경로 내 `:` 차단 ([`sanitizeAuthNextPath`](../src/lib/auth/authHandoffContract.ts)).
- handoff TTL로 링크 재사용 창을 축소 (서버 서명 토큰은 본 PR 범위 밖).

## Active 계정 + handoff

- [`resolvePathFromReadinessOrFallback`](../src/lib/readiness/postAuthRouting.ts): fallback이 `/execution/start`(쿼리 포함)면 readiness가 `/app/home`으로 shortcut 하지 않음.

## pilot

- handoff·execution query에서 pilot 저장 시 source **`in_app_auth_handoff`** ([`pilot-context`](../src/lib/pilot/pilot-context.ts)).

## PWA 설치 가이드와의 관계

- 본 PR은 **인증 전 단계 안정화**다. 온보딩 완료 후 **기존** [`PwaInstallGuideCard`](../src/components/pwa/PwaInstallGuideCard.tsx)·[`PR-PWA-INAPP-BROWSER-INSTALL-GUIDE-01`](PR-PWA-INAPP-BROWSER-INSTALL-GUIDE-01.md) 흐름을 바꾸지 않는다. 외부 브라우저로 넘어가면 설치 안내가 더 일관되게 동작할 수 있다.

## Non-goals

- scoring / session generator / `/app/home` UI / 플레이어 수정.
- Supabase 스키마·RLS 변경.
- OAuth 인앱 WebView “우회”.

## QA (요약)

- Android 인앱: Google → intent 또는 handoff URL, 외부에서 OAuth 완료 후 `/execution/start` chain.
- iOS 인앱: Google → 시트 CTA → 외부 로그인.
- 이메일: 인앱 handoff → 외부 회원가입·메일 링크 → `signup/complete` → execution.
- `next` open redirect 샘플 차단 확인.
- pilot·baseline/refined·session-preparing claim 회귀.

## 검증 명령

```powershell
npm run lint
npx tsc --noEmit
npm run test:pilot-auth
```
