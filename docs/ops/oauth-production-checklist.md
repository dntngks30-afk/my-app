# OAuth/PKCE 프로덕션 체크리스트

로컬 OK / 배포 모바일 Fail 패턴(도메인·redirectTo·https 불일치 → PKCE 교환 실패)을 방지하기 위한 설정 가이드.

## 1. 환경 변수

| 변수 | 용도 | 예시 |
|------|------|------|
| `NEXT_PUBLIC_CANONICAL_ORIGIN` | OAuth 시작 및 redirectTo에 사용할 canonical origin | `https://posturelab.com` |
| `NEXT_PUBLIC_SKIP_CANONICAL_REDIRECT` | `1`이면 canonical 리다이렉트 비활성화 (Vercel Preview용) | (Preview 배포에서만 설정) |

- **프로덕션**: `NEXT_PUBLIC_CANONICAL_ORIGIN`을 운영 도메인으로 반드시 설정
- **로컬**: 미설정 시 `window.location.origin` 사용 (리다이렉트 없음)
- **Vercel Preview**: Preview 배포에서 OAuth 테스트 시 `NEXT_PUBLIC_SKIP_CANONICAL_REDIRECT=1` 설정, 또는 canonical으로 리다이렉트된 뒤 프로덕션에서 OAuth 진행

## 2. canonical origin 정책

- **www / 비www 통일**: `https://posturelab.com` 또는 `https://www.posturelab.com` 중 하나로 고정
- **https 강제**: OAuth provider 및 Supabase는 https 필수
- **alias 도메인**: alias로 접속 후 OAuth 클릭 시 → canonical으로 즉시 리다이렉트 → canonical에서 OAuth 시작

## 3. Supabase 설정

### Site URL
- **Dashboard** → Authentication → URL Configuration
- **Site URL**: `https://<canonical-domain>`
  - 예: `https://posturelab.com`

### Redirect URLs (Additional Redirect URLs)
- `https://<canonical-domain>/auth/callback`
  - 예: `https://posturelab.com/auth/callback`
- 로컬 개발: `http://localhost:3000/auth/callback` 추가
- Vercel Preview에서 OAuth 테스트 시: 해당 Preview URL `/auth/callback` 추가 (선택)

### 체크리스트
- [ ] Site URL = canonical origin
- [ ] Additional Redirect URLs에 `{canonical}/auth/callback` 포함
- [ ] 로컬 개발용 `http://localhost:3000/auth/callback` 포함 (필요 시)
- [ ] Preview URL은 테스트 시에만 임시 추가, 프로덕션에는 canonical만 유지 권장

## 4. 코드 동작 요약

- **OAuth 시작점** (`/app/auth`): `window.location.origin !== canonical`이면 `location.replace(canonical + path + query)` 후 OAuth 클릭 시 canonical에서 진행
- **redirectTo**: 항상 `${canonical}/auth/callback?next=...` (canonical 미설정 시 `window.location.origin` 사용)
- **콜백** (`/auth/callback`): 도메인 강제 리다이렉트 없음 (PKCE 교환을 깨뜨릴 수 있음)

## 5. Acceptance Test

| 시나리오 | 기대 동작 |
|----------|-----------|
| alias 도메인 → OAuth 클릭 | canonical으로 리다이렉트 → OAuth 진행 → 콜백 성공 |
| canonical 도메인 → OAuth 클릭 | 그대로 OAuth 진행 → 콜백 성공 |
| 로컬 (canonical 미설정) | 리다이렉트 없음, 현재 origin으로 OAuth 진행 |
| Vercel Preview (SKIP=1) | canonical 리다이렉트 스킵, Preview URL에서 OAuth 진행 |
