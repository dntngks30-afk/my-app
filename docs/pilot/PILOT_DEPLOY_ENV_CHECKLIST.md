# Pilot deploy / environment checklist (2026-05-01)

**Never commit or paste secret values.** List keys and categories only.

## Vercel / hosting

- Production project selected and linked to this repo
- Canonical production domain confirmed and documented
- Alias domain behavior documented (redirect vs unsupported)
- Latest target branch deployed for pilot window
- Deployment logs reviewed for errors

## Environment variables (names / categories only)

- Supabase: project URL, anon key (public), **service role key (server-only)**
- Stripe: publishable key, **secret key**, **webhook secret** (if payment in pilot)
- Mux / media: **token IDs / secrets** as required if template media is exercised
- App: `NEXT_PUBLIC_*` origin / canonical URL, OAuth-related public vars
- Feature flags / pilot access flags (if any)

Do **not** record actual values here.

## Supabase (production)

- Correct production project selected
- `exercise_templates` count and M01–M48 presence verified (or parity smoke / manual)
- Auth providers (Google, Kakao) enabled
- Site URL and redirect URLs include app `/auth/callback`
- RLS policies allow intended pilot read paths
- Service role key never exposed to client bundles

## Stripe / payment or pilot access

- If payment required: live path tested or documented bypass for pilot
- If pilot access is coupon/admin/manual: exact method documented
- Webhook endpoint and signing secret configured if webhooks used

## Mux / media

- Exercise playback works on canonical domain
- Signed media route works if applicable
- `media_ref` gaps understood (warnings vs blockers)

## PWA / browser

- Install path acceptable for pilot
- Cache / stale session behavior sanity-checked
- iOS Safari and Android Chrome entry smoke (manual)

## Manual result table

| Area | Result | Notes |
|------|--------|-------|
| Vercel / hosting | PASS / FAIL / NOT_TESTED | |
| Env configuration | PASS / FAIL / NOT_TESTED | key names only in notes |
| Supabase | PASS / FAIL / NOT_TESTED | |
| Stripe / access | PASS / FAIL / NOT_TESTED | |
| Mux / media | PASS / FAIL / NOT_TESTED | |
| PWA / browser | PASS / FAIL / NOT_TESTED | |

**Forbidden in this document:** Supabase service role value, Stripe secret or webhook secret, OAuth client secret, Mux secret, any production token string.
