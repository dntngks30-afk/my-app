# PR-ANALYTICS-DETAILED-TRACKING-04

## Scope
- Add detailed analytics tracking for session execution drop-off
- Add camera refine boundary analytics without touching evaluator internals
- Add PWA install and push permission/subscription analytics
- Extend `/admin/kpi` with read-only detail sections

## Event Names Added
- Session detail
  - `exercise_logged`
  - `exercise_next_clicked`
  - `exercise_skipped`
  - `exercise_player_closed`
  - `session_complete_clicked`
  - `session_complete_blocked`
- Camera boundary
  - `camera_flow_started`
  - `camera_setup_viewed`
  - `camera_step_started`
  - `camera_step_completed`
  - `camera_refine_completed`
  - `camera_refine_failed_or_fallback`
- PWA
  - `pwa_install_card_shown`
  - `pwa_install_cta_clicked`
  - `pwa_install_dismissed`
  - `pwa_install_prompt_accepted`
  - `pwa_install_prompt_dismissed`
- Push
  - `push_card_shown`
  - `push_permission_requested`
  - `push_permission_granted`
  - `push_permission_denied`
  - `push_subscribe_success`
  - `push_subscribe_failed`

## Session Drop-off Boundaries
- `SessionPanelV2`
  - `session_complete_clicked`
- `ExercisePlayerModal`
  - `exercise_logged`
  - `exercise_next_clicked`
  - `exercise_player_closed`
- `/api/session/complete`
  - `session_complete_blocked` on existing blocked return paths only

## Camera Boundary Tracking
- `/movement-test/camera`
  - `camera_flow_started`
- `/movement-test/camera/setup`
  - `camera_setup_viewed`
- `/movement-test/camera/squat`
  - `camera_step_started`
  - `camera_step_completed`
  - `camera_refine_failed_or_fallback` on survey fallback
- `/movement-test/camera/overhead-reach`
  - `camera_step_started`
  - `camera_step_completed`
  - `camera_refine_failed_or_fallback` on survey fallback
- `/movement-test/camera/complete`
  - `camera_refine_completed`
  - `camera_refine_failed_or_fallback`

## PWA Tracking Boundaries
- `PwaInstallGuideCard`
  - card shown
  - CTA clicked
  - dismissed
  - prompt accepted/dismissed

## Push Tracking Boundaries
- `usePwaPushPermissionState`
  - card shown
  - permission requested
  - permission granted/denied
  - subscribe success/failed

## Dashboard / API Extensions
- Added read-only API:
  - `/api/admin/kpi/details`
- Extended `/admin/kpi` with:
  - Session Drop-off section
  - Camera Refine section
  - PWA Install section
  - Push Permission section

## Safety Notes
- No analytics writes from admin dashboard
- No new DB tables or migrations
- No product state changes
- No evaluator threshold/pass-fail logic changes
- No PWA install or push subscription behavior changes
- No raw camera traces, raw scoring payloads, raw exercise logs, push endpoint/keys, Stripe raw objects, or emails stored in analytics props

## Non-goals
- No dashboard redesign
- No daily aggregation or materialized views
- No notification sending
- No survey answer-level tracking
- No exercise-level skip/log body payload storage

## Tests
- `npm run test:analytics-event-infra`
- `npm run test:analytics-core-funnel-tracking`
- `npm run test:analytics-admin-kpi-dashboard`
- `npm run test:analytics-detailed-tracking`
- Targeted TypeScript check for touched files

## Known Limitations
- Camera step detail is boundary-based and does not inspect evaluator internals
- Session detail by exercise index is event-count based, not person-distinct
- `exercise_skipped` is allow-listed but not emitted because the current UI has no explicit skip action
- `session_complete_blocked` is logged from existing blocked server responses only

## Next Recommended PR
- PR-5 Retention Cohort Hardening / Daily Aggregation if pilot volume requires it
