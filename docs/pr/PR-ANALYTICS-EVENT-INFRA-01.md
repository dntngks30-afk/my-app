# PR-ANALYTICS-EVENT-INFRA-01

## Scope

PR-1 adds the backend/API foundation for KPI measurement:

- `public.analytics_events`
- `public.analytics_identity_links`
- event allow-list and types
- shared sanitizer
- client fire-and-forget helper
- server fire-and-forget helper
- `POST /api/analytics/track`

## Tables

`analytics_events` is a raw observer event store. It is not product state and must not drive readiness, session creation, payment, claim, or execution behavior.

`analytics_identity_links` links `moveReAnonId:v1` anon identities to authenticated `user_id` values when both are available. It is not a BI aggregate table.

## RLS

Both tables enable RLS and intentionally do not add broad anon/auth policies. Client writes go through `/api/analytics/track`; server writes use service-role helpers.

## Product Flow

This PR intentionally adds no tracking calls to landing, survey, result, auth, payment, onboarding, session creation, Reset Map, SessionPanelV2, ExercisePlayerModal, or camera evaluator code.

## Next PR

PR-2 should wire the core public + execution funnel events into product boundaries using the helpers from this PR.

