# PR-TRUTH-PARENT-SESSION-DISPLAY-AND-GENERATION-ALIGNMENT

## Parent SSOT purpose

This document locks the parent truth map for the current session-alignment failures observed on Home Reset Map and Session Panel.

The problem is **not** one bug.
It is a split truth-ownership problem across 3 different chains:

1. **Map node display truth drift**
2. **First-session intent vs final plan composition drift**
3. **Onboarding experience semantics drift**

This document is a **parent SSOT** for follow-up child PRs.
It is not the implementation itself.

---

## Locked product problem

The following user-facing failures are considered real and must be treated as separate structural issues:

### A. Map node drift

- Session Panel `오늘의 목표` can feel aligned with the user type.
- But Home map nodes such as session 1, 2, 3 still show legacy static labels/subtitles.
- Therefore map and panel appear to talk about different sessions.

### B. Goal-summary vs exercise-composition drift

- The panel goal summary may say one thing.
- The actual generated exercise composition may feel weaker or differently oriented.
- Therefore the session explanation and the selected exercises are not guaranteed to remain aligned after later selection/constraint/order stages.

### C. Onboarding experience drift

- The user can select `advanced` / 숙련자 in onboarding.
- But the generated first session may still feel like a beginner-safe plan.
- Therefore the stored onboarding field currently does not carry strong enough generation semantics at runtime.

### D. Existing-active-plan masking

- Even if onboarding profile changes, an already-existing active plan may still be returned idempotently.
- Therefore the user can experience stale first-session meaning even after changing onboarding inputs.

---

## Parent diagnosis

These failures belong to different truth owners:

- **Display truth owner**
  - map node label / subtitle
  - panel goal / rationale block
- **Generation truth owner**
  - first-session intent
  - final selected template set
  - final post-constraint / post-order composition
- **Profile truth owner**
  - `session_user_profile.exercise_experience_level`
  - profile changes vs already-materialized active session plan

These must not be fixed in one mixed PR.

---

## Product laws

### Law 1 — Do not fake future certainty

The map must not pretend that all future sessions already know their final generated meaning.

### Law 2 — Near surfaces must agree

For current / recent / near-next sessions:

- map node
- session panel
- actual selected exercise composition

must not drift in meaning.

### Law 3 — Onboarding semantics must be real

If `advanced` is offered to the user as a meaningful onboarding choice,
it must change generation behavior in a detectable way.

### Law 4 — Existing active plans must not silently preserve stale semantics when safe regeneration is intended

If profile-level meaning changes before a first session is meaningfully consumed,
the system must not always hide behind idempotent reuse.

---

## Structural truth split

### Chain 1 — Display truth split

Current map display may resolve from:

- active plan meta
- summary meta
- hydrated history meta
- bootstrap meta
- next preview meta
- legacy map data
- arc placeholder

This means the visible node can fall back to old static copy even when panel truth has already moved on.

### Chain 2 — Intent/composition split

Current first-session meaning is introduced early from:

- result-aware session bridge
- baseline session anchor / legacy band
- first-session intent
- session rationale / focus axes

But the final exercise plan is still modified by:

- candidate competition
- constraint engine
- ordering engine
- quality audit
- fallback selection

If final plan composition changes but display/meta meaning is not reconciled afterward,
panel explanation can drift from actual composition.

### Chain 3 — Experience semantics split

Current onboarding experience level is:

- stored in profile
- read during session create
- only materially used to make `beginner` more conservative

Therefore `advanced` currently behaves closer to “no-op” than to a true generation signal.

### Chain 4 — Profile/active-plan split

Current create flow may reuse an existing active plan before checking whether the active plan meaning is stale relative to newer profile truth.

---

## Child PR roadmap

This parent SSOT locks the following split roadmap.

### PR-TRUTH-01 — Map node live truth hardening

Goal:

- Remove legacy static node copy as canonical near-node truth.
- Tighten map node source hierarchy for visible/current/next sessions.

Owns:

- map node truth only
- display-source hierarchy only
- no session generation semantic changes

### PR-TRUTH-02 — Final plan back-projection for session rationale

Goal:

- Reconcile session display/meta meaning with final selected composition.
- Prevent rationale/focus/goal drift after post-selection transforms.

Owns:

- generator output meaning only
- no onboarding semantics change

### PR-TRUTH-03 — Onboarding experience semantics v2

Goal:

- Make `advanced` and `intermediate` materially meaningful in generation.
- Keep pain/safety guardrails authoritative.

Owns:

- session 1 experience semantics only
- no map display rewrite

### PR-TRUTH-04 — Active plan/profile mismatch guard

Goal:

- Prevent stale first-session meaning from being silently preserved when profile truth changed and safe regeneration is possible.

Owns:

- create/idempotent reuse guard only
- no display wording rewrite

### PR-TRUTH-05 — Display SSOT closure

Goal:

- Make map/panel/display contract consume one canonical display field family.
- Demote heuristic read-time derivation to recovery-only.

Owns:

- display-contract closure only
- no scoring/generation semantic changes

---

## Locked order of implementation

The canonical order is:

1. **PR-TRUTH-01** — Map node live truth hardening
2. **PR-TRUTH-02** — Final plan back-projection for session rationale
3. **PR-TRUTH-03** — Onboarding experience semantics v2
4. **PR-TRUTH-04** — Active plan/profile mismatch guard
5. **PR-TRUTH-05** — Display SSOT closure

Reason:

- PR-01 fixes the most obvious visible mismatch first.
- PR-02 fixes explanation vs actual selected exercise drift.
- PR-03 fixes user-perceived onboarding no-op semantics.
- PR-04 prevents stale active plan reuse from hiding PR-03.
- PR-05 closes the display SSOT after the main truth chains are stabilized.

---

## Non-goals of this parent SSOT

This parent SSOT does **not** itself implement:

- scoring-core changes
- pain-mode meaning changes
- adaptive-engine redesign
- session-completion semantics changes
- public-result IA changes
- home visual redesign
- donor map visual redesign

---

## Acceptance criteria for the full roadmap

1. Visible near nodes on the map no longer default to old static semantic copy when runtime truth exists or can be cheaply derived.
2. Session Panel goal summary and final selected exercise composition become materially more aligned.
3. `advanced` onboarding experience no longer behaves as a near-no-op in session 1 generation.
4. Profile changes do not remain silently masked by stale active-plan reuse when safe refresh is intended.
5. Map and panel consume the same bounded display field family as canonical truth.

---

## Final stance

This problem must not be treated as “a wording bug” or “a single generator bug.”

It is a parent structural truth problem across:

- map display ownership,
- generator meaning ownership,
- onboarding semantics ownership,
- active-plan reuse ownership.

The correct fix is a split child-PR roadmap with each PR owning exactly one truth boundary.
