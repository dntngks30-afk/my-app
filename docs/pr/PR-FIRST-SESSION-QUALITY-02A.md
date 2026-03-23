# PR-FIRST-SESSION-QUALITY-02A — Apply onboarding experience to first-session quality

## Goal

Wire `session_user_profile.exercise_experience_level` into **session 1 only** plan generation so beginners get a slightly more conservative first session (tier/volume), without changing scoring, readiness, onboarding UI, or result input priority.

## Non-goals

- `pain_or_discomfort_present` is **not** passed into generation (avoid double-conservatism with `pain_mode` / `safety_mode`).
- No composer redesign; no mood/budget changes.

## Implementation

1. **`resolveTotalSessions`** (`src/app/api/session/create/route.ts`): extend `select` with `exercise_experience_level`; profile type includes optional field.
2. **Session create**: when `nextSessionNumber === 1`, if `isValidExerciseExperienceLevel(profile.exercise_experience_level)`, pass it to `buildSessionPlanJson` and **session-gen cache** key.
3. **`PlanGeneratorInput`**: optional `exercise_experience_level`.
4. **`adjustFirstSessionTierForOnboardingExperience`**: if session 1 and `beginner`, shift `getFirstSessionTier` result one step toward conservative (`normal`→`moderate`, `moderate`→`conservative`). Intermediate/advanced unchanged.

## Safety

Existing pain/safety/adaptive paths unchanged; beginner adjustment applies **after** risk-based tier from `pain_mode` / `pv` / `safety_mode`.

## Files

- `src/app/api/session/create/route.ts`
- `src/lib/session/plan-generator.ts`
- `src/lib/session-gen-cache.ts` (cache key includes `exercise_experience_level` for correctness)
