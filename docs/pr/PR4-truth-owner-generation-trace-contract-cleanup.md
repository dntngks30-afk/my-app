# PR4 — Truth-owner / Generation-trace Contract Cleanup

> Parent SSOT: `docs/pr/PR-POST-52-FOLLOWUP-PRIORITIES-SSOT.md`
> Prior sibling truth: `docs/pr/PR3-alignment-audit-guardrail-expansion-truth.md`
> Scope type: additive trace-contract normalization only
> Goal: make the analysis → generation trace chain cleaner, less ambiguous, and easier to debug without changing result selection policy or session-composition meaning

---

## Why this PR exists

PR #52 strengthened source ownership around session creation.
PR #53 (PR3) added an explicit `alignment_audit` block so session 1 alignment can be machine-audited.

That improved observability, but the broader trace contract is still uneven.
The system can now say more about whether alignment held, yet the upstream selected-truth contract is still split across several top-level fields with partially overlapping meanings:

- `analysis_source_mode`
- `source_public_result_id`
- `is_public_result_truth_owner`
- `fallback_reason`
- `baseline_session_anchor`
- `baseline_primary_type`
- and, indirectly, selection facts that currently exist upstream but are not carried cleanly into generation trace such as public-result `stage`, `claimedAt`, and `createdAt`

This means future debugging can still become ambiguous:

- which selected public result actually won
- what stage it was (`baseline` vs `refined`)
- what timestamps defined “current truth”
- whether fallback happened at selection time, resolver time, or generation time
- whether a trace is talking about source ownership, intended alignment, or realized alignment

PR4 exists to normalize that contract so the trace reads like one coherent system explanation rather than a pile of partially related fields.

---

## Parent truths carried forward

From `PR-POST-52-FOLLOWUP-PRIORITIES-SSOT.md`, P4 is locked as:

- normalize trace contract fields for source owner, selected stage, selected timestamps, and fallback reason
- keep the PR additive and contract-cleanup-oriented
- do not mix in new selection policy or session-composition logic unless explicitly required

This child SSOT inherits those locks completely.

---

## Exact product truth this PR protects

MOVE RE must remain explainable not only at the UI/result layer but also at the system trace layer.

The protected truth is:

> the analysis → composition chain must expose one canonical selected-truth contract, one canonical fallback contract, and one clean separation between selected truth and realized alignment.

PR3 already strengthened realized alignment.
PR4 now cleans the selected-truth / trace-ownership side.

---

## Current repo truth to preserve

### Current selected-truth resolver
Current source ownership is resolved through:

- `src/lib/public-results/getLatestClaimedPublicResultForUser.ts`
- `src/lib/session/resolveSessionAnalysisInput.ts`
- `src/app/api/session/create/_lib/generation-input.ts`
- `src/app/api/session/create/_lib/plan-materialize.ts`

Today, `getLatestClaimedPublicResultForUser()` already knows more than the generation trace ultimately records. It returns:

- `id`
- `stage`
- `claimedAt`
- `createdAt`
- validated `result`

But downstream session-create trace still only records a subset of that selection context.

### Current trace contract after PR3
Current `generation_trace_json` includes, at minimum:

- `analysis_source_mode`
- `source_public_result_id`
- `is_public_result_truth_owner`
- `fallback_reason`
- `baseline_session_anchor`
- `baseline_primary_type`
- `alignment_audit`

This PR must preserve backward compatibility with those meanings.
It must not silently remove them or reinterpret them.

---

## Scope

This PR may do the following only:

1. Normalize the selected-truth contract inside generation trace.
2. Carry missing selected-result context into the canonical trace, especially:
   - selected public-result stage
   - selected public-result timestamps relevant to truth choice
3. Normalize fallback explanation so it is clearer what layer the fallback belongs to.
4. Reduce ambiguity between:
   - selected truth
   - selected source ownership
   - realized alignment
5. Keep the cleanup additive and backward-safe.

---

## Non-goals

This PR must **not** do any of the following:

- no claimed-public-result selection policy rewrite
- no `getLatestClaimedPublicResultForUser` ranking change
- no result-selection freshness logic change
- no plan generator candidate ranking / composition rewrite
- no phase semantic changes
- no public renderer/UI changes
- no onboarding/auth/payment changes
- no adaptive/session-2+ expansion
- no audit scoring redesign from PR3

---

## Locked behavior-preserving rule

PR4 is a **trace-contract cleanup PR**, not a behavior PR.

Therefore:

- no change to which result wins
- no change to when legacy deep fallback is used
- no change to what `baseline` / `refined` means
- no change to session 1 anchor priority
- no change to `Prep` / `Main` / `Cooldown` semantics
- no change to user-facing rationale logic

This PR may reorganize and normalize trace ownership, but it may not change generator decisions in the same patch.

---

## Main contract problem to solve

Right now selected-truth information is split across multiple top-level fields and some of the most important source-selection facts are lost before they reach `generation_trace_json`.

PR4 should make it possible to answer, from one canonical trace contract:

1. What selected truth did session creation use?
2. Was it a public result or legacy deep fallback?
3. If it was a public result, what stage was selected?
4. What timestamps explain why that selected truth is considered current?
5. If fallback happened, did it happen because no claimed public result existed, or because generation later degraded?
6. Which fields describe selected truth, and which describe realized alignment?

---

## Canonical implementation direction

### 1) Introduce a canonical nested selected-truth block

Prefer moving toward one additive nested trace object for selected-truth contract.
Recommended direction:

- `generation_trace_json.selected_truth_trace`

This object should become the canonical home for selected-truth metadata.
Existing top-level fields may remain for backward compatibility in PR4, but the new nested object should be the normalized contract going forward.

### 2) Canonical selected-truth block should include

At minimum, normalize these fields into one coherent structure:

- `source_mode`
- `is_truth_owner`
- `public_result_id`
- `public_result_stage`
- `selected_claimed_at`
- `selected_created_at`
- `legacy_deep_attempt_id` when relevant
- `fallback_reason`
- `fallback_layer`

The exact names may differ, but the structure must clearly separate:

- selection facts
- ownership facts
- fallback facts

### 3) Normalize fallback explanation

Current `fallback_reason` alone is not enough because it can be confused with generation-level degradation.
PR4 should distinguish at least conceptually between:

- selection/resolver fallback
- generation-time weakening/degradation

Recommended direction:

- keep existing `fallback_reason`
- add a more explicit additive field such as `fallback_layer`
  - `analysis_input`
  - `generation`
  - `none`

This PR should not redesign PR3 audit meanings.
It should only make the layer boundary explicit.

### 4) Keep realized alignment separate

`alignment_audit` from PR3 should remain a separate block.
Do not fold selected-truth fields into `alignment_audit`.

PR4 should make the contract boundary cleaner:

- `selected_truth_trace` = what won and why
- `alignment_audit` = whether realized session output honored that truth

### 5) Carry stage/timestamps from resolver path without changing selection behavior

Because `getLatestClaimedPublicResultForUser()` already returns stage and timestamps, the trace cleanup should prefer threading those values through:

- `getLatestClaimedPublicResultForUser.ts`
- `resolveSessionAnalysisInput.ts`
- `generation-input.ts`
- `plan-materialize.ts`

This is a data-carrying cleanup, not a selection-policy rewrite.

### 6) Preserve current top-level fields during PR4

For backward safety, keep the existing top-level fields for now:

- `analysis_source_mode`
- `source_public_result_id`
- `is_public_result_truth_owner`
- `fallback_reason`
- `baseline_session_anchor`
- `baseline_primary_type`

PR4 may add the normalized nested contract and start treating it as canonical.
But it must not remove those existing fields in the same PR.

---

## Suggested file scope

Likely files:

- `src/lib/public-results/getLatestClaimedPublicResultForUser.ts`
- `src/lib/session/resolveSessionAnalysisInput.ts`
- `src/app/api/session/create/_lib/generation-input.ts`
- `src/app/api/session/create/_lib/plan-materialize.ts`
- `src/app/api/session/create/_lib/types.ts`
- `src/lib/session/session-snapshot.ts`

Optional only if truly needed:

- a small helper for selected-truth trace normalization near session-create trace building

Avoid widening beyond this.

---

## Required normalized contract questions

After this PR, the generation trace should be able to answer directly:

1. Which selected truth won?
2. Was it `baseline`, `refined`, or legacy fallback?
3. What were the relevant selected-result timestamps?
4. Was source ownership public-result truth or legacy fallback truth?
5. If fallback happened, what layer did it belong to?
6. Which block should a future debugger read for selected truth vs realized alignment?

---

## Regression proof requirements

The implementation is acceptable only if all of the following remain true:

1. Existing top-level source-owner trace fields are preserved.
2. Session-create still succeeds for:
   - claimed public result path
   - legacy paid deep fallback path
3. No user-facing route or response semantics change.
4. No result-selection behavior changes.
5. `alignment_audit` remains a separate PR3 block, not mixed into source-selection contract.
6. The new normalized selected-truth block is additive and absent-safe for older consumers.

---

## Edge cases to handle explicitly

### Case A — claimed refined result selected
Trace should clearly say refined won, with its selected timestamps.

### Case B — claimed baseline result selected
Trace should clearly say baseline won, with its selected timestamps.

### Case C — no claimed public result → legacy fallback
Trace should clearly say no public result won, legacy deep fallback became truth source, and fallback belonged to the analysis-input layer.

### Case D — public result selected, generator later degrades or weakens
This must not be conflated with analysis-input fallback.
Selected-truth trace should still show what won; `alignment_audit` should describe realized weakening separately.

### Case E — future debugging on session 2+
The contract should remain readable even when session-1-specific alignment meta is absent.
Selected-truth trace must not overclaim first-session alignment semantics.

---

## What “done” means

This PR is done when:

- selected-truth metadata is normalized into one canonical nested trace contract,
- stage/timestamp facts are carried through cleanly,
- fallback layer is explicit,
- existing top-level fields remain for compatibility,
- and future debugging can clearly separate selected truth from realized alignment.

---

## Recommended implementation style

- narrow additive diff
- explicit naming
- no opportunistic policy rewrites
- comments that clarify contract meaning and layer boundaries
- backwards-safe coexistence with current top-level trace fields

---

## Recommended model / execution mode

- Primary: **GPT-5.4 Thinking**
- Acceptable alternative if kept very narrow: **Composer 2 / Sonnet 4.6**

For this PR, the deliverable is a cleaner canonical trace contract, not a better recommendation engine.

---

## Final canonical statement

PR4 is not the PR that decides better session content.
PR4 is the PR that makes the selected-truth side of the analysis → composition chain read as one clean canonical contract: what truth won, what stage/timestamps defined it, what layer fallback belonged to, and how that selected truth should be distinguished from the realized alignment audit added in PR3.
