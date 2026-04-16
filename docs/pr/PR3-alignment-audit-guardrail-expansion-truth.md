# PR3 — Alignment Audit / Guardrail Expansion Truth

> Parent SSOT: `docs/pr/PR-POST-52-FOLLOWUP-PRIORITIES-SSOT.md`
> Scope type: additive audit / trace expansion only
> Goal: strengthen machine-auditable proof that session 1 actually preserved public-result alignment without reopening composition semantics

---

## Why this PR exists

PR #52 improved baseline/session-1 alignment and added useful ownership observability:

- `analysis_source_mode`
- `source_public_result_id`
- `is_public_result_truth_owner`
- `fallback_reason`
- `baseline_session_anchor`
- `baseline_primary_type`

That is a good start, but it is still mostly **source trace**, not a full **alignment audit**.
The system can currently tell us where the input came from, but it still cannot cleanly answer the more important follow-up questions in a machine-auditable way:

- Did session 1 actually stay aligned to the selected public-result anchor?
- Was the public-result anchor preserved directly, translated safely, or degraded into a softer fallback?
- Did forbidden phase drift happen where `Prep` semantics ended up dominating what should feel like `Main` intent?
- Did replacement occur in a way that still preserved the intended result-led direction?

This PR exists to make those answers explicit in trace/audit form **without** changing what the plan generator means.

---

## Parent SSOT truths carried forward

From `PR-POST-52-FOLLOWUP-PRIORITIES-SSOT.md`, this PR is P3 and is locked as:

- alignment observability → audit / guardrail expansion
- additive audit-friendly metadata preferred over composition rewrite
- no source-selection policy change
- no big plan-generator redesign
- no UI copy work

This child SSOT inherits those locks completely.

---

## Exact product truth this PR protects

MOVE RE claims that the first session is a continuation of the user's current public result truth.
If that claim is real, the system must be able to say more than just “a public result was used.”
It must be able to audit whether alignment actually held.

The protected truth is:

> session 1 alignment is not just a hopeful input assumption; it is an auditable output claim.

---

## Current repo truth to preserve

### Current canonical source-owner path

Current source ownership is resolved through:

- `src/lib/session/resolveSessionAnalysisInput.ts`
- `src/app/api/session/create/_lib/generation-input.ts`
- `src/app/api/session/create/_lib/plan-materialize.ts`

Current trace already records source ownership and fallback context, including:

- `analysis_source_mode`
- `source_public_result_id`
- `is_public_result_truth_owner`
- `fallback_reason`
- `baseline_session_anchor`
- `baseline_primary_type`

These meanings are already part of the canonical chain and must not be broken or renamed casually in this PR.

### Current limitation

Those fields describe **where the truth came from**, but not sufficiently **whether the resulting session preserved that truth in practice**.

---

## Scope

This PR may do the following only:

1. Expand `generation_trace_json` with additive, audit-friendly alignment fields.
2. Add narrowly scoped helper logic that computes alignment audit facts from already-resolved generation inputs and/or generated plan output.
3. Record whether alignment was preserved, translated, weakened, or fallback-driven in a machine-readable way.
4. Record whether a forbidden dominance pattern was avoided, especially phase-semantic drift where `Prep` silently dominates what should feel like `Main` intent.
5. Keep the new audit contract stable enough for future debugging and regression review.

---

## Non-goals

This PR must **not** do any of the following:

- no public-result selection policy rewrite
- no `getLatestClaimedPublicResultForUser` change
- no plan-generator scoring rewrite
- no candidate ranking redesign
- no session-quality tuning beyond audit computation
- no UI renderer changes
- no onboarding/auth/payment/public-flow changes
- no adaptive/session-2+ redesign
- no DB migration unless absolutely required for additive persistence compatibility

---

## Locked behavior-preserving rule

This PR is **not** a composition-policy PR.
It is an **audit-layer PR**.

Therefore:

- no threshold changes
- no meaning changes for `Prep`, `Main`, `Cooldown`
- no changes to anchor priority itself
- no new fallback ordering
- no silent field removal from existing trace
- no change to user-facing first-session rationale semantics

The PR may compute more explicit audit conclusions, but it may not change the generator's decision law in the same PR.

---

## Required audit questions the new trace must answer

After this PR, the trace should be able to answer these questions directly and consistently:

1. Was session 1 generated from public result truth or legacy fallback?
2. If public result truth was used, what was the selected anchor/stage/type basis?
3. Did the generated session preserve that anchor directly, preserve it through safe translation, or weaken it into a generic fallback shape?
4. Did replacement occur, and if so, was the replacement alignment-preserving or alignment-weakening?
5. Was forbidden dominance avoided?
   Especially: did `Prep` remain `Prep`, rather than silently becoming the main driver of what the session feels like?
6. Can we machine-read whether alignment outcome was `strong`, `partial`, `weak`, or `fallback-only` without reverse-engineering multiple fields later?

---

## Canonical implementation direction

### 1) Add an explicit alignment-audit block

Prefer one additive nested trace object instead of scattering new top-level booleans everywhere.
Recommended direction:

- `generation_trace_json.alignment_audit`

This object should remain additive and coexist with the current top-level source-owner fields.
Do not remove or rename the existing top-level fields in this PR.

### 2) Alignment-audit block should answer four layers

The audit block should cover these conceptual layers:

#### A. selected_truth
What truth the system believed it was following.
Examples:

- selected source mode
- selected public result id if present
- selected stage if available
- selected anchor basis
- selected primary type if available

#### B. intended_alignment
What session-1 direction was supposed to preserve.
Examples:

- baseline session anchor expected
- whether public-result truth ownership was expected to dominate
- whether fallback was already in effect before generation

#### C. realized_alignment
What the generated session actually appears to express after generation.
Examples:

- whether alignment was preserved directly
- whether it was translated but still directionally preserved
- whether it became weak/generic
- whether fallback dominated

#### D. guardrail_outcome
What was explicitly prevented.
Examples:

- whether forbidden `Prep` dominance was avoided
- whether replacement remained alignment-preserving
- whether generic safe fallback overrode result-led direction

### 3) Keep outcome enums small and stable

Prefer a few stable string unions over many overlapping booleans.
Suggested shape:

- `alignment_strength`: `strong | partial | weak | fallback_only`
- `alignment_mode`: `direct | translated | degraded | fallback`
- `replacement_effect`: `none | alignment_preserving | alignment_weakening | unknown`
- `phase_semantic_guardrail`: `preserved | warning | violated`

Exact names may differ, but the contract must stay compact and readable.

### 4) Audit computation should live near session-create trace building

Prefer keeping the new audit computation close to the existing session-create trace path, for example in or near:

- `src/app/api/session/create/_lib/plan-materialize.ts`
- or a narrowly scoped helper imported there

Do not spread audit truth ownership across many unrelated files.

### 5) Use already available inputs first

Audit should be computed from already-resolved truth and generated output, such as:

- `analysisSourceMode`
- `sourcePublicResultId`
- `isPublicResultTruthOwner`
- `fallbackReason`
- `deepSummary.baseline_session_anchor`
- `deepSummary.primary_type`
- generated `planJson`
- existing plan meta / rationale / phase information if already present

Do not introduce a second competing truth path just to compute audit.

---

## Suggested file scope

Likely files:

- `src/app/api/session/create/_lib/plan-materialize.ts`
- `src/app/api/session/create/_lib/types.ts`
- `src/lib/session/session-snapshot.ts`

Optional only if truly needed and still narrow:

- a new helper such as `src/app/api/session/create/_lib/alignment-audit.ts`

Avoid widening beyond this unless a concrete trace-contract dependency forces it.

---

## Locked output expectations

After this PR, `generation_trace_json` should still include the current source-owner fields, and additionally include a stable audit-friendly block that allows future debugging to answer:

- what truth was selected,
- what alignment was intended,
- what alignment was realized,
- and whether key guardrails held.

The trace must become easier to inspect manually and easier to diff across regressions.

---

## Regression proof requirements

The implementation is acceptable only if all of the following remain true:

1. Existing source-owner fields are preserved.
2. Session-create still succeeds for both:
   - claimed public result path
   - legacy paid deep fallback path
3. No user-facing route or response semantics are broken.
4. No phase meaning changes occur.
5. New audit fields are additive and absent-safe for older consumers.
6. The trace for session 1 becomes more explainable without requiring manual reconstruction from scattered fields.

---

## Edge cases to handle explicitly

### Case A — public result truth owner, direct anchor preservation
The audit should mark this as the strongest successful case, not merely “public result used.”

### Case B — public result truth owner, but generator had to translate safely
This must not be mislabeled as failure if direction is preserved.
It should read as a weaker but still acceptable alignment mode.

### Case C — public result truth owner, but realized session became too generic
This should be visible as weakened alignment, not hidden under a source-owner success flag.

### Case D — no claimed public result, legacy fallback path
This must be explicit as fallback-driven rather than silently looking like aligned public-result execution.

### Case E — phase-semantic drift risk
If the generator avoided `Prep` domination successfully, the audit should say so.
If it cannot prove preservation, it should not overclaim success.

---

## What “done” means

This PR is done when:

- a child PR adds an explicit alignment-audit contract,
- that contract is computed from current canonical inputs and generated output,
- source-owner truth remains intact,
- no composition-policy rewrite is mixed in,
- and future debugging can distinguish direct success, safe translation, weakened alignment, and fallback-only generation.

---

## Recommended implementation style

- small helper(s)
- additive trace contract
- narrow file diff
- no opportunistic cleanup outside this ownership layer
- comments that explain meaning, not just mechanics

---

## Recommended model / execution mode

- Primary: **GPT-5.4 Thinking**
- Acceptable alternative for tightly scoped code-only pass: **Sonnet 4.6**

For this PR, the agent should behave as if the audit contract is the deliverable.
It must resist the temptation to “also improve session quality” in the same patch.

---

## Final canonical statement

PR3 is not the PR that changes what session 1 means.
PR3 is the PR that makes the system able to prove, in a compact and machine-readable way, whether session 1 actually honored the selected public-result truth and whether the key alignment guardrails held.
