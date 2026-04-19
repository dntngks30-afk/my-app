# PR-TRUTH-04 — Active plan/profile mismatch guard

## Parent SSOT

- Parent: `docs/pr/PR-TRUTH-PARENT-SESSION-DISPLAY-AND-GENERATION-ALIGNMENT.md`
- Previous child: `docs/pr/PR-TRUTH-03-onboarding-experience-semantics-v2.md`

This PR is the fourth child PR in the session display/generation alignment truth map.

---

## Goal

Prevent stale first-session meaning from being silently preserved when the user profile changed but an old active plan is still being returned idempotently.

This PR owns **active-plan reuse guard logic** only.

It does not own map truth, final-plan display reconciliation, or onboarding experience semantics themselves.

---

## Locked problem statement

Current flow can legitimately do the following:

1. user profile is written or changed
2. session 1 plan already exists as active plan
3. create flow sees `active_session_number`
4. idempotent path returns existing active plan

This is usually desirable.
But after PR-TRUTH-03, session 1 generation meaning now depends more materially on profile truth such as `exercise_experience_level`.

Therefore an older active session 1 can become semantically stale relative to the newer profile truth, while the system still returns it as if it were fresh.

The failure is not idempotency itself.
It is **unqualified idempotent reuse when profile truth has materially changed and safe regeneration is still possible**.

---

## Scope

### In scope

- detect material mismatch between current session-1 active plan generation profile snapshot and current profile truth
- decide whether safe regeneration is allowed before reusing active plan
- preserve observability around mismatch vs reuse vs regeneration

### Out of scope

- no onboarding UI changes
- no profile API contract redesign
- no session 2+ regeneration redesign
- no map/panel display redesign
- no scoring / pain-mode semantics changes
- no deletion of already-progressed plans
- no broad plan invalidation system redesign

---

## Locked truth

### Truth 1 — idempotent reuse is still the default

This PR must not destroy the current idempotent model.

If there is no meaningful mismatch, or regeneration is not safe, the existing active plan should still be reused.

### Truth 2 — profile truth can invalidate session-1 freshness

For session 1 only, when generation semantics depend on profile truth, a materially changed profile can make the old active plan semantically stale.

At minimum, this PR must consider `exercise_experience_level`.

Optional future expansion may include other fields, but this PR should stay focused.

### Truth 3 — mismatch detection must compare current profile to plan snapshot, not to guesses

A safe mismatch guard requires two truths:

- current profile truth from `session_user_profile`
- generation snapshot stored on the active plan at creation time

Do not infer stale-ness purely from current state without a saved plan-side snapshot.

### Truth 4 — regeneration is allowed only when safe

Even if mismatch exists, regeneration must only happen when it is safe.

Unsafe cases include at least:

- non-session-1 active plan
- active plan already started or materially consumed
- completed/partial progress already attached
- any case where regeneration would destroy meaningful user work or observability

### Truth 5 — safe mismatch must become observable

The system must expose, via logs/meta/trace, whether it:

- reused because no mismatch existed
- reused despite mismatch because regeneration was unsafe
- regenerated because mismatch existed and regeneration was safe

Silent behavior is no longer acceptable.

---

## Required behavior changes

### A. Persist generation-side profile snapshot for session 1

When a session-1 plan is created, persist a minimal profile snapshot in `plan_json.meta`, for example:

```ts
profile_generation_snapshot?: {
  exercise_experience_level?: 'beginner' | 'intermediate' | 'advanced' | null
}
```

Exact shape may differ, but the semantic purpose is locked.

### B. Compare active plan snapshot vs current profile before idempotent reuse

In the create flow, before returning `active_idempotent` for session 1, compare:

- current `session_user_profile.exercise_experience_level`
- active plan generation snapshot experience level

If they are materially different, treat the plan as mismatch-candidate.

### C. Define safe regeneration gate

Only regenerate when all of the following semantic conditions are met:

- active plan is session 1
- plan has not been meaningfully started/consumed
- no meaningful progress/log/evidence that the user already used the plan
- regeneration will not erase meaningful state

If safe, allow regeneration path instead of reusing stale active plan.

### D. Preserve reuse when unsafe

If mismatch exists but safe regeneration conditions are not met, keep the existing plan.
But record observability so the stale reuse is explicit rather than silent.

---

## Files expected to change

Primary expected files:

- `src/app/api/session/create/_lib/progress-gate.ts`
- `src/app/api/session/create/_lib/persistence-commit.ts`
- possibly `src/app/api/session/create/_lib/types.ts`
- possibly `src/lib/session/plan-generator.ts` only if needed for plan meta snapshot pass-through

Possible read-only / inspection files:

- `src/app/api/session/create/route.ts`
- `src/lib/session/profile.ts`
- `src/lib/session/client.ts`

---

## Implementation rules

### Rule 1 — session 1 only

Do not expand this PR into later-session regeneration policy.

### Rule 2 — snapshot before comparison

Prefer explicit plan-side generation snapshot fields over heuristic stale detection.

### Rule 3 — no destructive overwrite of started work

If there is any meaningful evidence the user already engaged with the plan, do not silently regenerate it.

### Rule 4 — observability required

Add clear internal observability such as:

- `active_plan_profile_match`
- `active_plan_profile_mismatch`
- `regen_due_to_profile_mismatch`
- `reuse_despite_profile_mismatch_unsafe`

Exact names may differ, but the semantic distinction must remain.

### Rule 5 — keep existing external API behavior stable where possible

Prefer preserving the overall `session/create` response contract unless a minimal additive signal is necessary.

---

## Acceptance criteria

1. Session-1 active plans carry a minimal generation-side profile snapshot sufficient for mismatch comparison.
2. `session/create` no longer always idempotently reuses a stale session-1 active plan when profile truth changed and regeneration is safe.
3. Started/consumed plans are not silently regenerated.
4. Mismatch vs reuse vs regeneration becomes observable.
5. No map, scoring, pain, or broader later-session semantics are changed in this PR.

---

## Regression risks

### Risk 1 — accidental loss of user work

If regeneration is allowed too aggressively, a user could lose an already-started plan.

Mitigation:

- regeneration gate must be conservative
- require strong safe conditions

### Risk 2 — false mismatch due to missing snapshot

Older plans may not contain the new generation snapshot.

Mitigation:

- handle missing snapshot as backward-compatible fallback
- reuse unless a safe and grounded mismatch can be established

### Risk 3 — over-triggering regeneration loops

If mismatch logic is not bounded, create flow may repeatedly regenerate.

Mitigation:

- snapshot must update on regeneration
- mismatch should clear once regenerated plan matches profile truth

---

## Done means

This PR is done when the system stops hiding semantically stale session-1 reuse behind generic idempotency, while still protecting any plan the user has already meaningfully started.
