# PR-AUTH-UI-02B — Auth UI Brand Token Alignment, Title-Only Hero

## 목적 (CURRENT_IMPLEMENTED)

- `/app/auth`, `/login`, `/signup` 인증 표면을 `docs/BRAND_UI_SSOT_MOVE_RE.md`와 동일한 **public-brand primitive·`--mr-public-*` 토큰** 정렬로 맞춘다.
- **Hero는 title만** — 로그인/회원가입 상단에 description·subtitle 형태의 문장 노출 금지.
- **기능 변경 없음**: OAuth 라우팅·`redirectTo`/`next`, Supabase 호출 계약·`replaceRouteAfterAuthSession` 미수정.

## 수정 파일

| 파일 | 변경 요약 |
|------|-----------|
| `src/components/auth/MoveReAuthScreen.tsx` | 루트를 `MoveReFullscreenScreen` + `mr-public-funnel-shell` 계열로 전환. Stitch용 `MoveReAuthBackground` 제거. Wordmark `Move Re` + `mr-public-brand-serif`. Hero는 `h1`만. OTP 안내는 `noticeSlot`(hero 밖 pill). |
| `src/components/auth/AuthShell.tsx` | 카드 레이아웃을 `MoveReSurfaceCard` 기반으로 통합. badge/title/`description` **optional** (`compactHeader` 시 숨김). glass·무거운 shadow 제거. |
| `src/components/auth/AuthCard.tsx` | `AUTH_INPUT_CLASS` 단일 클래스. 폼 제출 버튼 `MoveRePrimaryCTA`. 카피 안의 직조 Stitch hex·그라디언트 제거. `/login`(standalone)·`/signup`(standalone)은 `MoveReAuthScreen`으로 래핑.`signupLayout==="embedded"`는 `AppAuthClient`만. |
| `src/app/app/auth/AppAuthClient.tsx` | 모드 칩 스타일을 토큰 기반으로 교체.`signupLayout="embedded"` 명시(OAuth·embedded 중첩 레이아웃 일관화). OTP 문구를 hero `subcopy`가 아니라 `noticeSlot`으로 이동. |
| `src/components/auth/AuthSocialButtons.tsx` | 소셜 버튼을 얇은 border + `bg-white/[0.035]` 등 PR 권장 톤으로 정리(provider 핸들러 불변). |
| `src/components/auth/MoveReAuthBackground.tsx` | 삭제 — 배경은 `MoveReFullscreenScreen` + cosmic glow로 대체. |

## Hero description 제거

- 로그인 title: **내 분석을 이어서 확인하세요** (`LOGIN_HEADLINE`)
- 회원가입 title: **나를 위한 리셋 여정을 시작하세요** (`SIGNUP_HEADLINE`)
- 과거 `AuthShell` 카드 안의 「계정에 로그인하여…」「맞춤 교정 솔루션…」 등 인증 카드 헤더 본문 **`compactHeader`/embedded 경로에서 제거**되어 hero와 중복되지 않음.
- OTP/메일 발송 후 추가 문구는 **hero `<header>` 안이 아니라** `noticeSlot` 또는 카드 본문(메일 확인 스텝)에만 표시.

## 기능 미변경 보장

- `startOAuthClient`, `signInWithPassword`, `signInWithOtp`, `signUp` 호출부·`redirectTo`/`next` 인코딩·`onMailLinkScheduled` 연동 유지.
- `/signup/complete`의 `CompleteClient`는 기존처럼 `AuthShell`에 badge/title/description을 넘기는 경로 유지(AuthShell에서 non-compact 시에만 카드 안 헤더 표시).

## public-brand primitive

- `MoveReFullscreenScreen` — 배경 코스믹 글로우.
- `MoveReSurfaceCard` — 폼 카드.
- `MoveRePrimaryCTA` — 이메일 로그인/회원가입 제출.

## 제거·완화한 Stitch raw 스타일

- `bg-[#0c1324]`, `bg-[#070d1f]`, `from-[#ffb77d]`류 직조 hex 및 그라디언트 버튼.
- `shadow-[0_24px_60px_-20px_…]`, `backdrop-filter: blur(16px)` 수준 카드 글래스.
- 단독 `MoveReAuthBackground` 방사형 오버레이.

## 검증

- `npm run build` — 성공.
- `npm run lint` — 로컬에서 `Invalid project directory ...\lint`(Next ESLint 디렉터리 설정 이슈)로 실패할 수 있음. 빌드·타입 검증 통과 시 CI와 별도 확인 권장.

## 남은 리스크 / 후속

- `/signup/complete`(Neo 스타일)는 본 PR 범위 밖 유지 가능; 완전한 토큰 통일은 별도 PR 후보.
- `next lint` 경로 문제는 레포 ESLint/next 설정 확인 시 해소.
