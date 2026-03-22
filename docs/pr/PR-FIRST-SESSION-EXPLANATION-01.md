# PR-FIRST-SESSION-EXPLANATION-01 — Surface first-session rationale on home summary path

## Goal

Let `POST /api/session/create` with `summary: true` return `plan_json.meta` fields that the home `SessionPanelV2` rationale block already knows how to render (`session_rationale`, `session_focus_axes`), without generating new copy or changing plan generation.

## Problem

`toSummaryPlan` stripped `plan_json` to segments plus a subset of `meta` (`focus`, `priority_vector`, `pain_mode`). Fields produced by `buildSessionPlanJson` — notably `session_rationale` and `session_focus_axes` — were dropped on the summary response, so users on the ResetMapV2 `createSession(..., { summary: true })` path could not see the first-session alignment explanation even though it existed on the full stored plan.

## Change

- **File:** `src/app/api/session/create/route.ts`
- **Behavior:** Extend `toSummaryPlan` to copy through, when present:
  - `session_rationale` (string)
  - `session_focus_axes` (non-empty array, capped length)
  - `primary_type`, `result_type` (non-empty strings)
  - `constraint_flags` only as `{ first_session_guardrail_applied: boolean }` when that flag is boolean on the source meta

No new narrative generation in the route. No changes to plan-generator, readiness, onboarding, or client trigger shape.

## Acceptance

- Summary responses include the above meta fields when the full `plan_json.meta` contains them.
- When absent, behavior matches the previous summary shape (backward compatible).
- Guards (dedupe, daily cap, frequency, analysis input, etc.) unchanged.
