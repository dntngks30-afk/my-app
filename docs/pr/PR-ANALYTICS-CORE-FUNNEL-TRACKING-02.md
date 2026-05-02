# PR-ANALYTICS-CORE-FUNNEL-TRACKING-02

## Scope
- Wire PR-1 analytics helpers into P0 public funnel and execution funnel boundaries.
- Additive tracking only. No dashboard UI, no KPI query APIs, no DB changes.

## Event List Inserted
- `landing_viewed`
- `public_cta_clicked`
- `survey_started`
- `survey_completed`
- `refine_bridge_choice_clicked`
- `result_viewed`
- `execution_cta_clicked`
- `auth_success`
- `checkout_success`
- `onboarding_completed`
- `public_result_claim_success`
- `session_create_success`
- `app_home_viewed`
- `reset_map_opened`
- `session_panel_opened`
- `exercise_player_opened`
- `session_complete_success`

## Files Touched
- Public/client boundaries:
  - `src/app/(main)/page.tsx`
  - `src/app/movement-test/survey/page.tsx`
  - `src/app/movement-test/refine-bridge/page.tsx`
  - `src/app/movement-test/baseline/page.tsx`
  - `src/app/movement-test/refined/page.tsx`
  - `src/app/app/(tabs)/home/_components/HomePageClient.tsx`
  - `src/app/app/(tabs)/home/_components/reset-map-v2/SessionPanelV2.tsx`
  - `src/app/app/(tabs)/home/_components/reset-map-v2/ExercisePlayerModal.tsx`
  - `src/components/auth/AuthCard.tsx`
  - `src/app/auth/callback/CallbackClient.tsx`
  - `src/app/signup/complete/CompleteClient.tsx`
- Server success routes:
  - `src/app/api/stripe/verify-session/route.ts`
  - `src/app/api/session/profile/route.ts`
  - `src/app/api/public-results/[id]/claim/route.ts`
  - `src/app/api/session/create/route.ts`
  - `src/app/api/session/complete/route.ts`
- Validation:
  - `scripts/analytics-core-funnel-tracking-smoke.mjs`
  - `package.json`

## Behavior Safety
- No product branching depends on analytics response.
- Client tracking remains fire-and-forget via `trackEvent()`.
- Server tracking uses `logAnalyticsEvent()` and does not alter route success/failure semantics.
- No dashboard/admin KPI API or UI added.

## Testing
- `npm run test:analytics-event-infra`
- `npm run test:analytics-core-funnel-tracking`
- targeted TypeScript check for touched files

## Known Limitations
- Deduplication is intentionally pragmatic, not perfect identity-grade dedupe.
- `auth_success` is captured at the current reliable client success boundaries; future auth surface changes may need another boundary insertion.
- Result view tracking on the refined route reports `result_stage='refined'` even when the page renders a fallback baseline presentation.

## Next PR
- PR-3 Admin KPI Dashboard v1
