# Pilot OAuth — production checklist (Google / Kakao)

**Automated auth URL smoke (`npm run test:pilot-auth`) only validates callback error URL shaping in source.** It does **not** perform live provider login. Complete this checklist for production pilot readiness.

## Required production domain checks

- Canonical production domain loads the app as expected.
- Alias domain behavior is **understood** (redirect to canonical vs intentionally unsupported).
- If alias is used, document expected user experience and failure modes.

## Supabase checks

- **Site URL** is correct for production.
- **Additional Redirect URLs** include the app’s `/auth/callback` (and any required variants documented in ops).
- **Google** provider enabled for the project.
- **Kakao** provider enabled for the project.

## Google Cloud Console checks

- OAuth consent screen is production-ready **enough for pilot** (test users / publishing status understood if app is not fully public).
- **Authorized JavaScript origins** include the canonical origin.
- **Authorized redirect URI** includes Supabase `/auth/v1/callback` (exact URL per project).

## Kakao Developers checks

- **Web platform** domain includes the canonical origin.
- **Redirect URI** includes Supabase `/auth/v1/callback` (per Kakao app settings).
- Kakao login product is **enabled**.
- Required consent items are configured.
- App status / business verification restrictions are **understood** for pilot scope.

## Runtime login checks

- Google login succeeds on **canonical** production domain.
- Kakao login succeeds on **canonical** production domain.
- Logout then **different** account login works.
- Google login from **Instagram** in-app browser is checked (pass, fail, or documented limitation).
- Kakao login from **KakaoTalk** in-app browser is checked.
- OAuth callback failure shows **useful** error context (user lands on app auth with clear messaging where applicable).
- User is **not** dropped to public home unexpectedly after OAuth in ways that break continuity.

## Manual hard fails

- Google login fails on production canonical domain (when service is expected up).
- Kakao login fails on production canonical domain (when service is expected up).
- OAuth callback **loses** provider context on failure (cannot tell Google vs Kakao).
- Login succeeds but **result/session continuity** is lost vs pilot contract.
- In-app browser blocks login with **no** fallback guidance.

## Manual result table

| Provider | Environment | Browser | Result | Notes |
|----------|-------------|---------|--------|-------|
| Google | Production | Safari / Chrome / PWA / in-app | PASS / FAIL / NOT_TESTED | |
| Kakao | Production | Safari / Chrome / PWA / in-app | PASS / FAIL / NOT_TESTED | |

Add rows until all required runtime checks above are covered or explicitly marked `NOT_TESTED` with rationale.
