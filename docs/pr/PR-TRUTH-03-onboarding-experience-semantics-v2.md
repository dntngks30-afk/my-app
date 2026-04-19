# PR-TRUTH-03 — Onboarding experience semantics v2

## Parent SSOT

- Parent: `docs/pr/PR-TRUTH-PARENT-SESSION-DISPLAY-AND-GENERATION-ALIGNMENT.md`
- Previous child: `docs/pr/PR-TRUTH-02-final-plan-back-projection-for-session-rationale.md`

This PR is the third child PR in the session display/generation alignment truth map.

---

## Goal

Make onboarding `exercise_experience_level` a **real generation signal** for session 1, so that:

- `beginner` remains meaningfully more conservative,
- `intermediate` remains the baseline,
- `advanced` becomes detectably more assertive,

without overriding pain/safety guardrails or redesigning the session system.

This PR owns **session-1 onboarding experience semantics** only.

It does not own map display truth, final-plan display reconciliation, or active-plan/profile mismatch reuse policy.

---

## Locked problem statement

Current runtime behavior stores `exercise_experience_level`, but generation semantics are asymmetric:

- `beginner` can make session 1 more conservative,
- `intermediate` is effectively neutral,
- `advanced` is close to a no-op.

As a result, a user can explicitly choose `advanced` / 숙련자 and still receive a first session that feels almost identical to the neutral or conservative baseline.

The product failure is not storage.
It is **semantic under-consumption** of onboarding experience at generation time.

---

## Scope

### In scope

- session 1 only
- generation-time consumption of `exercise_experience_level`
- cache-key correctness for experience-sensitive generation
- bounded, explainable differences between beginner / intermediate / advanced first-session output

### Out of scope

- no change to onboarding UI
- no change to profile write API contract
- no change to map node source hierarchy
- no active-plan/profile mismatch policy change (belongs to PR-TRUTH-04)
- no scoring-core / public-result changes
- no pain-mode meaning changes
- no redesign of full adaptive engine across later sessions

---

## Locked truth

### Truth 1 — experience level must affect generation, not just storage

If the product offers the following onboarding values:

- `beginner`
- `intermediate`
- `advanced`

then session 1 generation must reflect that choice in a way the user can actually feel.

### Truth 2 — experience semantics are subordinate to safety

`exercise_experience_level` must never outrank:

- `pain_mode`
- `safety_mode`
- red/yellow safety gating
- hard template exclusions

Advanced users can receive a stronger first session only **within** the safety envelope.

### Truth 3 — intermediate is the baseline reference point

This PR locks the intended semantic interpretation:

- `beginner` = one step more conservative than baseline when safe
- `intermediate` = neutral baseline
- `advanced` = one step more assertive than baseline when safe

### Truth 4 — advanced must not remain a near-no-op

It is unacceptable for `advanced` to change almost nothing while still being presented as a real onboarding choice.

This PR must introduce at least **two meaningful generation levers** that can reflect the advanced choice.

### Truth 5 — first session only

This PR is restricted to session 1 semantics.
It must not silently redesign later-session adaptive behavior.

---

## Required behavior changes

### A. Preserve current beginner downshift

Existing conservative bias for `beginner` may remain, but it should stay explicit and bounded.

### B. Introduce advanced uplift

For session 1, `advanced` must affect generation through at least two of the following controlled levers:

- `finalTargetLevel`
- `mainCount`
- `maxDifficultyCap`
- `sets/reps` / prescription density
- accessory density or stricter fallback preference toward more demanding eligible templates

Exact combination may vary, but the output difference must be structurally detectable.

### C. Keep intermediate neutral

`intermediate` remains the baseline generation path.
Do not add unnecessary complexity to make it special.

### D. Preserve boundedness

The stronger first session for `advanced` must still be:

- bounded,
- explainable,
- compatible with existing safety and first-session guardrails.

No explosive difficulty jumps.

---

## Recommended semantic model

A safe bounded interpretation is:

### beginner

- shift first-session tier one step more conservative when possible
- preserve current single-set / lower-density tendencies

### intermediate

- leave current baseline untouched

### advanced

- allow one controlled upward adjustment when safety allows, for example:
  - slightly higher target level,
  - one more meaningful main/accessory demand within session-1 caps,
  - stronger difficulty ceiling when current cap is otherwise neutral,
  - slightly fuller prescription when not dominated by safety/pain guardrails.

The exact implementation may differ, but the above semantic direction is locked.

---

## Files expected to change

Primary expected files:

- `src/app/api/session/create/_lib/generation-input.ts`
- `src/lib/session/plan-generator.ts`
- `src/lib/session-gen-cache.ts`

Possible read-only / inspection files:

- `src/lib/session/profile.ts`
- `src/app/api/session/profile/route.ts`
- `docs/pr/PR-FIRST-SESSION-QUALITY-02A.md`

---

## Implementation rules

### Rule 1 — session 1 only

Only consume onboarding experience semantics for `sessionNumber === 1`.
Do not expand this PR into later-session progression logic.

### Rule 2 — additive over destructive

Prefer bounded additive adjustments over rewriting the generator’s core architecture.

### Rule 3 — no safety inversion

Do not let `advanced` bypass:

- safety-mode caps,
- pain-mode protection,
- hard avoid tags,
- protected/caution logic.

### Rule 4 — cache correctness required

If session 1 generation now changes materially by experience level, cache keys must continue to include the relevant input so stale cross-experience reuse cannot happen.

### Rule 5 — detectable but not theatrical

The result difference should be real, but not cartoonishly large.
The user should feel “this is slightly more appropriate for my training background,” not “this is a different product mode.”

---

## Acceptance criteria

1. `advanced` no longer behaves as a near-no-op for session 1 generation.
2. `beginner`, `intermediate`, and `advanced` can produce structurally distinguishable session-1 plans under the same non-safety-dominated baseline.
3. Safety / pain guardrails still dominate experience semantics when necessary.
4. Cache behavior remains correct across experience-level differences.
5. No map, panel, scoring, or active-plan reuse semantics are changed in this PR.

---

## Regression risks

### Risk 1 — over-strengthening advanced

If uplift is too aggressive, first-session trust can drop.

Mitigation:

- keep bounded increments only,
- respect existing first-session caps,
- never outrank safety.

### Risk 2 — hidden no-op under safety domination

In protected/yellow/red conditions, `advanced` may still appear neutral because safety rightfully dominates.

Mitigation:

- this is acceptable if observably safety-dominated,
- acceptance should be judged under non-safety-dominated baseline cases.

### Risk 3 — cache mismatch or stale reuse

If experience now affects generation more strongly, stale cache reuse becomes more costly.

Mitigation:

- preserve cache-key inclusion of `exercise_experience_level`.

---

## Done means

This PR is done when the onboarding experience choice becomes a real but bounded first-session generation signal, and users who choose `advanced` no longer feel that the system ignored their stated training background.
