# PR-RISK-07 — Axis/tag mapping SSOT deduplication

## Parent SSOT

- Parent: `docs/pr/PR-RESIDUAL-RISK-CLOSURE-SESSION-DISPLAY-ALIGNMENT.md`
- Previous residual child: `docs/pr/PR-RISK-06-phase-truth-wiring-for-synthetic-preview.md`
- Related primary child: `docs/pr/PR-TRUTH-02-final-plan-back-projection-for-session-rationale.md`

This PR is the second residual-risk closure PR after the main PR-TRUTH-01~05 sequence.

---

## Goal

Remove duplicated axis/tag semantic mapping so that selection-layer and reconciliation-layer share **one authoritative semantic mapping source**.

This PR owns **axis/tag mapping source-of-truth deduplication** only.

It does not change scoring semantics, plan selection policy, or display field family closure.

---

## Locked problem statement

The current system uses axis/tag/vector meaning in more than one place, including:

- priority / selection bias logic
- final-plan reconciliation / display alignment logic

At least one reconcile helper currently carries a local axis-tag mapping copy.

This is acceptable short-term, but it creates long-term risk:

- one mapping can be edited while the other is forgotten
- selection semantics and reconciliation semantics can silently drift apart
- future bugs will look like “the plan was selected with one meaning, but explained with another”

The failure is not necessarily visible today.
It is a **semantic duplication risk** that can reintroduce drift later.

---

## Scope

### In scope

- identify the authoritative owner for axis ↔ focus_tag ↔ target_vector interpretation
- move duplicate mapping tables into a shared SSOT location
- make both selection-side and reconciliation-side consume the same mapping source
- preserve current runtime behavior as closely as possible

### Out of scope

- no scoring-core changes
- no generator redesign
- no display-copy redesign
- no onboarding semantics changes
- no map or SessionPanel redesign
- no new semantic vocabulary expansion

---

## Locked truth

### Truth 1 — one authoritative mapping owner

There must be one authoritative owner for the semantic relationships among:

- axis names (e.g. `lower_stability`, `trunk_control`)
- focus tags (e.g. template `focus_tags`)
- target vectors (e.g. `target_vector`)

### Truth 2 — selection and reconciliation must not drift

If a tag or vector implies an axis during selection or prioritization,
the same semantic implication must be available to final-plan reconciliation.

### Truth 3 — runtime behavior should remain stable

This PR is structural deduplication, not semantic redesign.

The target is to reduce future drift risk without intentionally changing current product behavior.

### Truth 4 — bounded vocabulary remains

Do not expand the semantic surface unnecessarily.
Keep the current bounded axis vocabulary intact.

---

## Required behavior changes

### A. Extract shared semantic mapping

Move duplicated mapping data into a shared helper/module that can be imported by both:

- selection/priority-layer logic
- final-plan display reconciliation logic

### B. Remove local copied mapping where safe

Reconciliation helper should stop owning a private copy of axis/tag semantics if the same meaning already exists elsewhere.

### C. Preserve behavior with minimal change

Use the same mapping values as current runtime where possible.
The goal is deduplication, not reinterpretation.

### D. Keep target-vector interpretation aligned too

If vectors like `balanced_reset` currently have special interpretation behavior, that interpretation must also live in a shared, authoritative place rather than fragmenting further.

---

## Files expected to change

Primary expected files:

- `src/lib/session/final-plan-display-reconciliation.ts`
- `src/lib/session/priority-layer.ts`

Likely additive shared helper file:

- a new small shared semantic mapping helper under `src/lib/session/` or nearby

Possible read-only inspection files:

- `src/core/session-rationale.ts`
- `src/lib/session/session-display-contract.ts`
- any helper currently owning axis/tag/vector translation logic

---

## Implementation rules

### Rule 1 — structural deduplication first

Do not treat this as a behavior-redesign PR.
Prefer moving and reusing existing mappings over rewriting them.

### Rule 2 — one shared import path

After this PR, both reconciliation and selection-related consumers should point at the same semantic mapping owner.

### Rule 3 — no new semantic families

Do not create another partial mapping layer.
Close around one shared source.

### Rule 4 — additive testability/observability welcome

If helpful, add small internal helpers that make the shared mapping easier to inspect or test.
But do not expand product-facing API shape unnecessarily.

---

## Acceptance criteria

1. Axis/tag/vector semantic mapping no longer lives as duplicated independent copies across selection and reconciliation paths.
2. Selection-side and reconciliation-side consumers import the same authoritative mapping source.
3. Current runtime behavior remains materially unchanged.
4. No scoring, onboarding, map, or UI redesign semantics are introduced.

---

## Regression risks

### Risk 1 — accidental semantic drift during dedupe

If mapping values are “normalized” during extraction, behavior may change unexpectedly.

Mitigation:

- preserve current mapping values exactly where possible
- treat extraction as a relocation, not reinterpretation

### Risk 2 — shared helper becomes too broad

If the new shared module tries to solve every semantic problem, scope may sprawl.

Mitigation:

- keep the shared helper narrowly focused on axis/tag/vector mapping only

---

## Done means

This PR is done when the system has one clear semantic mapping owner for axis/tag/vector interpretation, and future display-selection drift can no longer reappear just because two copies of the same mapping evolved separately.
