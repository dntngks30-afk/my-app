# PR-SESSION-RAIL-TRUTH-HARNESS-01

## Purpose

Lock the truth for how Session Path B actually generates session rails across:

- 6 baseline result types
- target frequency 2 / 3 / 4 / 5
- total sessions 8 / 12 / 16 / 20
- first-session anchor behavior
- later-session phase progression
- adaptive branching after completion
- secondary_type pass-through vs real generation influence

This PR is **not** a generation-semantics change PR.
This PR is a **truth-map + output harness PR** so pilot launch can rely on observed engine behavior rather than assumptions.

---

## Executive conclusion

The current engine is **not** a pre-baked 8/12/16/20-session curriculum.
It is a **next-session materialization rail**.

What is currently locked by repo behavior:

1. `target_frequency` determines only `total_sessions`:
   - 2 -> 8
   - 3 -> 12
   - 4 -> 16
   - 5 -> 20

2. `session/create` materializes only **one next session** at a time.
   It does **not** pre-generate the whole rail.

3. Session 1 is strongly anchored by:
   - `baseline_session_anchor` (preferred), or
   - legacy `resultType` / band fallback.

4. Session 2+ are regenerated using:
   - `phase` / `phase_lengths`
   - recent used template history
   - recent session feedback
   - latest adaptive summary
   - pain/safety signals
   - deep summary inputs

5. `secondary_type` is currently passed through into summary / plan meta, but is **not verified as a direct first-class driver of session composition** in the same way as:
   - `baseline_session_anchor`
   - `resultType`
   - `primary_type`
   - `priority_vector`

Therefore the pilot should not assume:
- “all sessions are fixed at session 1 create time”, or
- “secondary_type definitely changes plan composition today”.

Those must be proven by a harness.

---

## Verified engine truths to preserve

### A. Rail length truth
`target_frequency` maps to `total_sessions` only.
This PR must not change that mapping.

### B. Session creation truth
`session/create` generates only `nextSessionNumber`.
This PR must not change generation to pre-bake all remaining sessions.

### C. Phase truth
Phase is computed from `total_sessions`, optionally using adaptive/front-loaded phase lengths.
This PR must not change phase policy.

### D. Session 1 alignment truth
Session 1 is special.
Its alignment is driven by:
- `baseline_session_anchor` first
- then legacy session band / resultType fallback

This PR must not change first-session alignment logic.

### E. Adaptive truth
Session completion writes execution/adaptive evidence that later influences future generation.
This PR must not disable or redefine adaptive behavior.

### F. Secondary-type truth (current uncertainty)
The repo currently proves that `secondary_type` is:
- preserved in summary contracts
- passed into generation input
- written into plan meta / audit context

But it is **not yet locked** that `secondary_type` directly changes plan selection output.
This PR’s harness must answer that explicitly.

---

## Problem this PR solves

Before the pilot, we need a canonical answer to all of these:

1. For each baseline type, how does session 1 -> N actually evolve?
2. How do 8 / 12 / 16 / 20-session rails differ by frequency?
3. What does the engine do under neutral vs adaptive conditions?
4. Is the rail mostly driven by first-session anchor + phase + priority_vector?
5. Does `secondary_type` materially influence generated plans or merely survive as metadata?

Today the code contains the rules, but there is no single human-readable artifact showing the full rail behavior.

---

## This PR must produce two outputs

### Output 1. Canonical harness script(s)
A deterministic harness that materializes session rails without changing runtime behavior.

### Output 2. Human-readable artifact(s)
Markdown and/or JSON outputs that let us inspect:
- session-by-session progression
- phase changes
- template reuse avoidance
- adaptive branching
- secondary_type influence or lack thereof

---

## Harness scope

### Required baseline type coverage
All 6 baseline result types / anchors:
- LOWER_INSTABILITY
- LOWER_MOBILITY_RESTRICTION
- UPPER_IMMOBILITY
- CORE_CONTROL_DEFICIT
- DECONDITIONED
- STABLE

Where useful, the harness may operate through `baseline_session_anchor` instead of only user-facing result labels, as long as the mapping remains explicit.

### Required frequency coverage
- 2 -> 8 sessions
- 3 -> 12 sessions
- 4 -> 16 sessions
- 5 -> 20 sessions

### Required mode coverage
At minimum, the harness must support:

#### Mode A: static / neutral rail
No completion-derived adaptive perturbation beyond baseline engine defaults.
Purpose: inspect the canonical non-adaptive rail.

#### Mode B: adaptive rail variants
At least these three branches must be reproducible:
- neutral
- low_tolerance / pain_flare style branch
- high_tolerance style branch

The goal is not to perfectly simulate real users.
The goal is to show whether later sessions materially shift when adaptive signals change.

---

## Required questions the harness must answer

### Q1. Are all sessions fixed when session 1 is created?
Expected answer should be demonstrated, not asserted.
The harness must show that later session outputs are generated per-session rather than fully frozen upfront.

### Q2. How does each type progress from session 1 to session N?
The harness must reveal actual progression by phase and by selected plan content.

### Q3. How much of later progression is driven by phase vs adaptive signals?
The harness must show this difference explicitly.

### Q4. Is `secondary_type` actually affecting generation?
This is a first-class goal of this PR.
The harness must compare paired runs where:
- primary / anchor / priority_vector are held constant as much as possible
- secondary_type is changed
- resulting plan outputs are diffed

If the resulting plan is identical except for metadata, the PR must say so plainly.
If it changes selection meaningfully, the PR must show where and how.

### Q5. Is `priority_vector` the real secondary driver instead?
The harness must help distinguish:
- direct `secondary_type` influence
vs
- indirect influence through `priority_vector` / anchor / focus tags.

---

## Locked harness design

### 1. Read-only / non-invasive harness
The harness must not rewrite production semantics.
Preferred approaches:
- pure materialization harness
- fixture input harness
- script-driven calls into existing generation helpers
- controlled inspection of generated `plan_json` / traces

This PR should observe the engine, not redesign it.

### 2. Session-by-session materialization
The harness must simulate or materialize rails in order:
- session 1
- session 2
- ...
- session N

Because the engine is next-session based, the harness must follow that truth.
It must not fake a “whole rail at once” mode unless clearly labeled as derived/synthetic.

### 3. Required per-session output fields
Each session row in the artifact must include at least:
- `session_number`
- `total_sessions`
- `phase`
- `phase_lengths`
- `theme`
- `result_type`
- `primary_type`
- `secondary_type`
- `baseline_session_anchor`
- `session_focus_axes`
- `session_rationale`
- `used_template_ids`
- segment summary (`Prep/Main/Accessory/Cooldown`)
- selected template ids/names
- key plan meta (`constraint_flags`, `baseline_alignment`, `plan_quality_audit.summary` when available)

### 4. Secondary-type comparison mode
A dedicated comparison mode must exist.
For each relevant primary/anchor family, it should compare two cases:
- same anchor / same priority vector as much as possible
- different `secondary_type`

Artifact must include:
- whether output changed materially
- whether only metadata changed
- which field(s) changed
- whether the difference is explainable by another driver (e.g. priority vector)

### 5. Adaptive comparison mode
A dedicated comparison mode must exist for:
- neutral
- pain flare / low tolerance
- high tolerance

Artifact must include whether later sessions changed in:
- item count
- difficulty
- recovery bias
- volume
- template selection
- rationale / focus axes / trace

---

## Deliverables

### Required files
The exact filenames may vary, but the PR must produce:

1. one docs/pr SSOT (this file)
2. one harness script or small harness set
3. one machine-readable artifact output format (JSON)
4. one human-readable artifact output format (Markdown summary)

### Suggested artifact organization
Examples only; adapt to existing repo conventions:
- `scripts/session-rail-truth-harness.mjs`
- `artifacts/session-rail/*.json`
- `artifacts/session-rail/SESSION_RAIL_SUMMARY.md`

---

## Non-goals

This PR must **not**:
- change `session/create` semantics
- pre-generate all sessions in product runtime
- change `target_frequency -> total_sessions`
- change phase policy
- change first-session alignment logic
- change adaptive evaluator thresholds
- add new product UI
- force `secondary_type` to matter if it currently does not

This PR is a truth-revealing harness PR, not a session-engine redesign PR.

---

## Acceptance criteria

### A. Rail visibility
For all 6 baseline types and all 4 frequencies, the team can inspect session 1 -> N rails in a stable artifact.

### B. Session materialization truth proven
The artifact shows that the engine behaves as next-session materialization rather than one-shot pre-generation.

### C. Phase progression visible
The artifact makes phase changes explicit across 8 / 12 / 16 / 20 rails.

### D. Adaptive branching visible
The artifact shows how later sessions differ under neutral vs low-tolerance vs high-tolerance branches.

### E. Secondary-type status resolved
The PR must clearly classify one of these outcomes:
1. `secondary_type` materially affects generated plans
2. `secondary_type` survives mostly as metadata / audit input only
3. `secondary_type` affects plans only indirectly through another driver

This must be stated with evidence from the harness output, not intuition.

---

## Residual risks to document during implementation

1. Some comparisons may be noisy if template ordering / tie-breaking is not perfectly controlled.
2. If `priority_vector` varies alongside `secondary_type`, the harness may falsely attribute influence to `secondary_type`.
3. If certain adaptive branches require DB-backed summaries, the harness may need a controlled fixture path.
4. Existing preview-materialized comparison harnesses may cover only session 1 continuity, not full rail truth.

These risks must be explicitly called out in the implementation report.

---

## Recommended implementation workflow

- Ask first: verify exact read boundaries and best harness insertion point
- Then implementation in a narrow PR
- Prefer structural observation over semantic edits

### Model recommendation
This is **not** a Composer-only PR.
Use:
- **Ask -> Sonnet 4.6** for harness/truth-map design and implementation
- Composer only for narrow follow-up cleanup if needed

---

## Final lock

Before the pilot, the project needs a canonical answer to this:

> “What rail does the engine actually generate for each baseline type and frequency, and does secondary_type truly change that rail?”

This PR exists to answer that question with artifacts, not opinions.
