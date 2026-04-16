# PR1 — Claimed Public Result Selection Policy Refinement Truth

> Parent SSOT: `PR-POST-52-FOLLOWUP-PRIORITIES-SSOT.md`
> Parent merged context: `#52 feat: Public Baseline Result → Session 1 Composition Alignment Lock`

## Purpose

This PR exists to lock the **source-selection truth** that must happen **before** any first-session composition logic begins.

PR #52 improved Session 1 alignment **after** a claimed public result had already been selected.
That means the next highest-order truth is not more composition tuning first.
It is whether the system is choosing the **right current claimed public result** to compose from.

This PR must make MOVE RE feel like:
- the system is using the result the user just saw,
- the first session follows the user’s **current** state,
- analysis truly continues into execution.

---

## Locked product laws

1. MOVE RE is a **state-based exercise execution system**, not a result page plus generic routine.
2. Analysis exists to open the next action, not to terminate as an isolated report.
3. **Current state truth must win before composition logic begins.**
4. Result truth, session-composition truth, and execution truth must remain directionally aligned.
5. Public-first remains locked: payment unlocks execution; it does not re-author analysis.
6. One PR must own one layer. This PR owns **claimed public result selection policy only**.

---

## Problem this PR solves

The current claimed-result selection policy can still produce a believable but directionally stale first session when:
- an older refined result beats a newer baseline purely because refined is preferred first,
- or a naive latest-only strategy would ignore stage/execution suitability and create a different class of mismatch.

So the target is **not**:
- naive refined-first,
- and **not** naive latest-only.

The target is a more explicit claimed-result selection policy that weighs:
- stage,
- freshness,
- claim timing,
- result creation timing,
- execution suitability,
while preserving safe fallback behavior.

---

## Canonical user-felt change

After this PR, the user should more consistently feel:
- “The system is using the result I just saw.”
- “My first session follows my current state, not an older state.”
- “Analysis really continues into execution.”

This PR is successful only if source-selection truth is improved **without** bleeding into composition, UI, onboarding, or payment layers.

---

## Exact ownership

This PR owns:
- claimed public result selection policy refinement,
- source-selection truth before Session 1 composition,
- explicit selection criteria and tie-break reasoning,
- preservation or clarification of safe fallback behavior,
- tests proving stale refined no longer wins by default.

This PR does **not** own:
- session composition rewrite,
- anchor-quality tuning,
- result renderer/UI rewrite,
- onboarding changes,
- readiness model changes,
- payment/auth continuity,
- adaptive/session 2+ logic,
- trace-contract redesign beyond the minimum additive evidence needed to prove the policy.

---

## Locked implementation direction

Primary implementation target:
- refine `getLatestClaimedPublicResultForUser` selection policy

Allowed policy inputs:
- selected result stage
- claimed timing
- result creation timing
- relative freshness
- execution suitability
- explicit tie-break order

Hard rules:
1. Do **not** keep a blind refined-first bias.
2. Do **not** replace it with naive latest-only.
3. Preserve legacy fallback behavior unless this PR explicitly and narrowly owns a fallback clarification required by the new policy.
4. Do not smuggle composition-policy changes into source-selection code.
5. Do not rewrite public result truth generation.

---

## Selection policy truth to lock

The implementation must encode a policy strong enough to satisfy all of the following truths:

### T1. Current claimed result truth should generally beat stale remembered preference
A newer claimed baseline may be more correct for Session 1 than an older refined result.
The system must not blindly favor refined just because it is refined.

### T2. Refinement still matters when it is current and execution-suitable
This PR must not accidentally demote refined results into irrelevance.
A refined result can still win when it is the more current and execution-suitable truth.

### T3. Selection must be explainable
The winning result should be explainable through a deterministic policy using stage, freshness, claim timing, creation timing, and execution suitability.

### T4. Downstream layers must receive one stable selected truth
This PR should improve the selected source truth **before** composition begins, not create ambiguity downstream.

### T5. Safe fallback remains intact
If no suitable claimed public result is available, existing safe fallback behavior must remain intact unless this PR narrowly documents and owns a required clarification.

---

## Non-goals

- No Session 1 generator redesign
- No candidate ranking / anchor-quality tuning
- No UI/copy/result-page work
- No onboarding restructuring
- No readiness semantics change
- No payment or auth flow change
- No adaptive logic expansion
- No cross-layer mega PR behavior

---

## Files expected to change

This list is directional, not mandatory, but the PR should stay narrow.

Likely:
- claimed public result selection source file(s)
- narrow helper(s) directly supporting the selection policy
- tests for claimed result selection ordering and tie-breaks
- minimal additive observability only if needed to prove which source won and why

Not expected in this PR:
- broad plan-generator rewrites
- renderer trees
- onboarding pages
- auth/pay continuity code
- execution player code

---

## Regression proof required

The PR is not complete unless it proves at least these cases:

1. **Older refined vs newer baseline**
   - newer baseline can win when it better represents current claimed truth
2. **Current refined vs older baseline**
   - refined can still win when it is actually the better current truth
3. **Equal-ish timing / tie case**
   - deterministic tie-break remains stable and explainable
4. **No suitable claimed public result**
   - legacy/safe fallback behavior remains intact
5. **No composition regression by accidental scope creep**
   - session composition logic stays unchanged unless required only to consume the already-selected source exactly as before

---

## Residual risks intentionally left out of scope

These remain follow-up work, not part of PR1:
- anchor-aware first-session quality tuning
- audit / guardrail expansion
- broader truth-owner / generation-trace contract cleanup
- docs / AGENTS alignment refresh

---

## Follow-up order after this PR

1. PR2 — first-session quality tuning
2. PR3 — alignment audit / guardrail expansion
3. PR4 — truth-owner / generation-trace contract cleanup
4. PR5 — docs / SSOT / AGENTS alignment refresh

---

## Recommended model

**GPT-5.4 Thinking**

Reason:
This PR is a policy/ownership/slicing problem where correctness of selection truth matters more than raw code volume. The main risk is not implementation difficulty but mixing layers or encoding the wrong source-selection law.
