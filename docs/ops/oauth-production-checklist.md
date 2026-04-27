# OAuth/PKCE 프로덕션 체크리스트

로컬 OK / 배포 모바일 Fail 패턴(도메인·redirectTo·https 불일치 → PKCE 교환 실패)을 방지하기 위한 설정 가이드.

**중요: URL 두 종류를 혼동하지 말 것**

| 구분 | 용도 | 예시 형태 |
|------|------|-----------|
| **Supabase → Additional Redirect URLs (앱 콜백)** | Supabase가 로그인 후 **우리 Next 앱**으로 돌려보낼 `redirectTo` 허용 목록 | `https://<canonical-domain>/auth/callback` |
| **Google / Kakao 콘솔 → Redirect URI (Supabase 호스트)** | Provider가 **Supabase**로 먼저 돌아오는 URI (Supabase가 그다음 앱 `redirectTo`로 리다이렉트) | `https://<project-ref>.supabase.co/auth/v1/callback` |

Google·Kakao 개발자 콘솔에 **앱의** `/auth/callback`을 넣는 것은 Supabase OAuth 연동이 아닌 다른 흐름이 아닌 한 일반적으로 **아니다**. Supabase로 OAuth를 붙인 경우 **Authorized redirect / Kakao Redirect URI**는 **Supabase 프로젝트의** `/auth/v1/callback`이어야 한다.

---

## 1. Vercel env (앱)

배포 환경에서 최소로 확인할 변수:

- `NEXT_PUBLIC_CANONICAL_ORIGIN=https://<canonical-domain>` — OAuth 시작·`redirectTo` base (프로덕션에서 필수 권장)
- `NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>`
- `NEXT_PUBLIC_SKIP_CANONICAL_REDIRECT` — `1`이면 canonical 리다이렉트 비활성화 (Vercel Preview 등; Preview에서만 사용)

| 변수 | 용도 | 예시 |
|------|------|------|
| `NEXT_PUBLIC_CANONICAL_ORIGIN` | OAuth 시작 및 redirectTo에 사용할 canonical origin | `https://posturelab.com` |
| `NEXT_PUBLIC_SKIP_CANONICAL_REDIRECT` | `1`이면 canonical 리다이렉트 비활성화 (Vercel Preview용) | (Preview 배포에서만 설정) |

- **프로덕션**: `NEXT_PUBLIC_CANONICAL_ORIGIN`을 운영 도메인으로 반드시 설정
- **로컬**: 미설정 시 `window.location.origin` 사용 (리다이렉트 없음)
- **Vercel Preview**: Preview 배포에서 OAuth 테스트 시 `NEXT_PUBLIC_SKIP_CANONICAL_REDIRECT=1` 설정, 또는 canonical으로 리다이렉트된 뒤 프로덕션에서 OAuth 진행

---

## 2. canonical origin 정책

- **www / 비www 통일**: `https://posturelab.com` 또는 `https://www.posturelab.com` 중 하나로 고정
- **https 강제**: OAuth provider 및 Supabase는 https 필수
- **alias 도메인**: alias로 접속 후 OAuth 클릭 시 → **먼저** canonical URL로 `location.replace` → canonical에서 OAuth 시작. 콘솔 이벤트 `oauth_canonical_redirect`로 확인 가능

---

## 3. Supabase → URL Configuration

**Dashboard** → **Authentication** → **URL Configuration**

- **Site URL**  
  `https://<canonical-domain>`  
  예: `https://posturelab.com`

- **Additional Redirect URLs** (앱 콜백 — `signInWithOAuth`의 `redirectTo`가 여기에 포함되어야 함)  
  - `https://<canonical-domain>/auth/callback`  
  - `http://localhost:3000/auth/callback`  
  - Vercel Preview에서 OAuth를 테스트하는 경우(선택):  
    `https://<vercel-preview-domain>/auth/callback`

### 체크리스트

- [ ] Site URL = canonical origin
- [ ] Additional Redirect URLs에 `{canonical}/auth/callback` 포함
- [ ] 로컬 개발용 `http://localhost:3000/auth/callback` 포함 (필요 시)
- [ ] Preview URL은 테스트 시에만 임시 추가, 프로덕션에는 canonical만 유지 권장

---

## 4. Google Cloud Console

**Google Cloud Console** → **APIs & Services** → **Credentials** → **OAuth 2.0 Client** → **Authorized redirect URIs**

다음 **한 줄**이 있어야 한다 (Supabase가 Google OAuth의 콜백을 받는 주소):

- `https://<project-ref>.supabase.co/auth/v1/callback`

**주의:** Supabase로 연동한 경우, Google은 **우선 Supabase**로 돌아온 뒤 Supabase가 `redirectTo`로 **앱** `/auth/callback`을 열어 준다. **앱** `/auth/callback`을 Google 콘솔 Authorized redirect에 넣는 것은, 다른 연동 방식이 아닌 이상 **필수가 아니다**. 앱 콜백 URL은 **Supabase Dashboard의 Additional Redirect URLs** 쪽이 맞다.

---

## 5. Kakao Developers

- **Kakao Developers** → **앱** → **플랫폼** → **Web** → **사이트 도메인 (Web site domain)**  
  `https://<canonical-domain>`  
  (운영에서 고정한 canonical·www 정책과 일치해야 함)

- **Kakao Developers** → **제품 설정** → **Kakao Login** → **Redirect URI**  
  `https://<project-ref>.supabase.co/auth/v1/callback`

**주의:** Web site domain은 **canonical** 정책을 따른다. Redirect URI는 Supabase OAuth용이면 **Supabase 호스트**의 `/auth/v1/callback`이어야 하며, 앱의 `/auth/callback`이 아니다.

---

## 6. 코드 동작 요약 (변경 없음)

- **OAuth 시작점** (`/app/auth`): `window.location.origin !== canonical`이면 `location.replace(canonical + path + query)` 후 OAuth는 canonical에서 이어짐. 콘솔: `oauth_canonical_redirect`
- **redirectTo**: `${canonical또는현재origin}/auth/callback?next=...&provider=google|kakao`
- **콜백** (`/auth/callback`): 서버/미들웨어에서 콜백 도메인을 강제로 바꾸지 않음 (PKCE 교환을 깨뜨릴 수 있음)

---

## 7. Debug log events (`[AUTH-OAUTH]`)

브라우저 개발자 도구 콘솔에서 아래 이벤트로 원인을 좁힌다. (코드·토큰·비밀은 로그하지 않음)

| event | 의미 |
|--------|------|
| `oauth_start` | OAuth 버튼으로 플로 시작 (canonical 전) |
| `oauth_canonical_redirect` | **alias** 등에서 canonical로 옮기기 직전 (이후 같은 탭에서 canonical에서 다시 시도) |
| `oauth_redirect_to_built` | `signInWithOAuth`에 넘긴 `redirectTo`의 **origin + pathname** 메타 (전체 쿼리 raw 미로그) |
| `oauth_signin_error` | `signInWithOAuth`가 **리다이렉트 전** 즉시 실패 (도메인·설정·네트워크 등) |
| `oauth_callback_start` | `/auth/callback` 클라이언트 effect 진입, `hasCode` 여부·provider·sanitized `next` |
| `oauth_callback_missing_code` | `code` 쿼리 없음. Provider·redirect·수동 URL 접근·콘솔 설정 오류 가능 |
| `oauth_exchange_failed` | `exchangeCodeForSession` 실패. PKCE/세션/redirect origin 불일치·만료 등이 **흔한 원인** |
| `oauth_exchange_success` | 세션 교환 성공, 곧 readiness 기반 `replace` |

**해석 힌트**

- `oauth_canonical_redirect` — alias로 들어온 뒤 canonical로 보낸 것이 **정책상 정상**이며, 실패로 오해하지 않도록 로그로 구분
- `oauth_callback_missing_code` — Supabase/Provider redirect 설정 문제 또는 콜백 URL 수동 호출
- `oauth_exchange_failed` — `Additional Redirect URL` / canonical origin / `redirectTo` / PKCE 불일치를 의심
- `oauth_signin_error` — provider 페이지로 가기 **전** 실패

---

## 8. Acceptance test matrix

| 시나리오 | 기대 동작 |
|----------|-----------|
| alias 도메인 → OAuth 클릭 | `oauth_canonical_redirect` → canonical → OAuth → 콜백 성공 |
| canonical 도메인 → OAuth 클릭 | `oauth_start` → 콜백 성공 |
| 로컬 (canonical 미설정) | 리다이렉트 없음, 현재 origin으로 OAuth 진행 |
| Vercel Preview (SKIP=1) | canonical 리다이렉트 스킵, Preview URL에서 OAuth 진행 |
