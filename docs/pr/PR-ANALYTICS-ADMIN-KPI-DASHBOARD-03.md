# PR-ANALYTICS-ADMIN-KPI-DASHBOARD-03

## Scope
- Add an admin-only KPI dashboard v1.
- Read from existing `analytics_events` and `analytics_identity_links`.
- No product tracking changes, no DB changes, no event taxonomy changes.

## Routes Added
- Admin page
  - `/admin/kpi`
- Admin KPI APIs
  - `/api/admin/kpi/summary`
  - `/api/admin/kpi/funnel`
  - `/api/admin/kpi/retention`
  - `/api/admin/kpi/raw-events`

## API Contracts
- `summary`
  - overview cards
  - top drop-off
- `funnel`
  - `public | execution | first_session`
- `retention`
  - `app_home | first_session_complete`
- `raw-events`
  - masked ids
  - shallow safe props preview

## person_key Definition
1. `user:{user_id}` when `user_id` exists
2. `user:{linked_user_id}` when `anon_id` links through `analytics_identity_links`
3. `anon:{anon_id}` when only `anon_id` exists
4. `event:{id}` fallback when no identity exists

All funnel and retention counts use distinct `person_key`, not raw event count.

## Funnel Formulas
- `count` = distinct `person_key` for each event
- `conversion_from_previous` = current / previous
- `conversion_from_start` = current / first
- `dropoff_count` = previous - current
- `dropoff_rate` = dropoff_count / previous

## Retention Definition
- `app_home` cohort = first `app_home_viewed` per person
- `first_session_complete` cohort = first `session_complete_success` with session 1 when available
- return event set:
  - `app_home_viewed`
  - `session_panel_opened`
  - `exercise_player_opened`
  - `session_complete_success`
- D1/D3/D7 based on `kst_day`

## Admin Auth Assumptions
- browser checks `/api/admin/check`
- KPI APIs require existing `requireAdmin(req)`
- reads use `getServerSupabaseAdmin()`
- every KPI API response sets `Cache-Control: no-store`

## Limitations
- MVP computes person linking and distinct counts in Node, not SQL warehouse tables.
- Raw events pagination uses `created_at` cursor semantics suitable for pilot volume.
- Summary retention cards show the latest app-home cohort row in range, not a full blended cohort statistic.
- `first_session` funnel depends on `session_number` being present on relevant events.

## Testing
- `npm run test:analytics-event-infra`
- `npm run test:analytics-core-funnel-tracking`
- `npm run test:analytics-admin-kpi-dashboard`
- targeted TypeScript check for admin KPI files

## Next PR Recommendation
- PR-4 Session Drop-off + Camera/PWA/Push Detailed Tracking
