# PR-POST-52 — Follow-up Priorities SSOT after PR #52

## Parent context

- Parent merged PR: `#52 feat: Public Baseline Result → Session 1 Composition Alignment Lock`
- This document is the canonical follow-up SSOT for the next wave after PR #52.
- Scope is **prioritization + product truth + PR slicing guidance only**.
- This document does **not** implement changes and does **not** authorize multi-layer rewrites in a single PR.

---

## Why this SSOT exists

PR #52 locked an important truth:

> the first session should feel like a natural continuation of the public result the user just saw.

That solved a major alignment problem, but it did **not** finish the product loop.
The remaining work is not “more recommendation logic” in the abstract.
It is the next set of changes required to make MOVE RE feel more clearly like a
**state-based exercise execution system** rather than a result page plus generic routine.

This SSOT defines the next 5 follow-up priorities, their order, the user-felt change,
and the exact product-law each one protects.

---

## Locked MOVE RE product laws

These laws apply to every follow-up PR in this document.

1. MOVE RE is **not** a content app.
   It is a **state-based exercise execution system**.
2. Analysis exists to open the next action, not to end as an isolated report.
3. The first session must feel like the continuation of the user’s current state truth.
4. Result truth, session-composition truth, and execution truth must stay directionally aligned.
5. Preserve phase semantics.
   `Prep` must not be silently promoted into `Main` semantics.
6. Public-first structure remains locked.
   Payment unlocks execution; it does not re-author analysis.
7. Follow-up PRs must stay narrow.
   One PR = one layer / one ownership problem.

---

## Canonical priority order

### P1 — Claimed public result selection policy refinement

#### Why this is first
PR #52 improved session 1 alignment **after a public result has already been selected**.
That means the higher-order truth is still the result-selection policy itself.
If the wrong claimed result wins, downstream alignment can still feel off even if the new anchor logic is correct.

#### Current residual risk
A stale refined result can still beat a newer baseline simply because the current policy is biased toward refined-first selection.
That can produce a believable but directionally stale first session.

#### Desired user-felt change
The user should feel:
- “The system is using the result I just saw.”
- “My first session follows my current state, not an older state.”
- “Analysis really continues into execution.”

#### Product law protected
**Current state truth must win before composition logic begins.**

#### Locked implementation direction
- Refine `getLatestClaimedPublicResultForUser` selection policy.
- Do not collapse to naive refined-first or naive latest-only.
- Explicitly consider stage, freshness, claim timing, result creation timing, and execution suitability.
- Keep legacy fallback behavior intact unless this PR explicitly owns that policy.

#### Non-goals
- No session composition rewrite.
- No renderer/UI rewrite.
- No onboarding change.

#### Recommended model
- **GPT-5.4 Thinking**

---

### P2 — First-session quality tuning (anchor-aware composition quality)

#### Why this is second
Once the right public result is selected, the next strongest product lever is whether the first session **actually feels different by anchor type**.
PR #52 established safer alignment, but some cases may still feel conservatively similar because unsafe fallbacks were intentionally removed.

#### Current residual risk
The plan may now be safer but less vivid in certain edge cases:
- lower stability vs lower mobility may separate structurally but still feel too close in practice
- upper mobility may still under-express its intended direction
- core/trunk sessions may still feel generically safe rather than distinctly state-led

#### Desired user-felt change
The user should feel:
- “This routine really matches what I was told.”
- “My first session is not generic.”
- “Different result types lead to noticeably different starts.”

#### Product law protected
**State-based execution must be felt from session 1, not just explained in text.**

#### Locked implementation direction
- Tune candidate quality, segment emphasis, and anchor-aware composition behavior.
- Improve composition through better candidate ranking and intent fit.
- Preserve the PR #52 safety correction:
  `Prep` semantics must not be promoted into `Main` semantics.
- Do not weaken pain/safety/difficulty guardrails.

#### Non-goals
- No source-selection rewrite.
- No adaptive/session 2+ rewrite.
- No payment/auth/public-flow rewrite.

#### Recommended model
- **Sonnet 4.6**
- or **GPT-5.4 Thinking** when policy mapping becomes wider than one layer

---

### P3 — Alignment observability → audit / guardrail expansion

#### Why this is third
PR #52 added useful `baseline_alignment` observability, but observability is still weaker than a true audit layer.
The next need is not new product behavior first; it is stronger structural proof of whether alignment really succeeded.

#### Current residual risk
The system can improve while remaining partially opaque:
- alignment may appear correct but not be explicitly machine-audited
- regressions may take too long to isolate
- product direction may drift without a hard signal

#### Desired user-felt change
This is mostly indirect but important:
- fewer quiet regressions
- more stable session quality over time
- less “some users get it, some don’t” behavior

#### Product law protected
**If MOVE RE claims explainable state-based composition, the system must be able to observe and audit that alignment.**

#### Locked implementation direction
- Expand alignment metadata into more explicit audit-friendly fields.
- Track whether session 1 alignment actually succeeded, where replacement occurred, and whether forbidden dominance was avoided.
- Prefer additive audit/trace work over composition rewrites in this PR.

#### Non-goals
- No source-selection policy change.
- No big plan generator redesign.
- No UI copy work.

#### Recommended model
- **Sonnet 4.6**

---

### P4 — Truth-owner / generation-trace contract cleanup

#### Why this is fourth
PR #52 improved one naming problem (`is_public_result_truth_owner`), but the broader contract around selected source, stage, timing, and fallback reasoning still deserves a cleaner canonical trace.
This is less immediately user-visible than P1–P3, but it strengthens long-term debuggability and product consistency.

#### Current residual risk
Without a cleaner trace contract, future debugging can become ambiguous:
- which public result actually won
- what stage it was
- why fallback happened
- whether alignment was based on baseline anchor vs legacy band

#### Desired user-felt change
Indirect but real over time:
- faster diagnosis of odd session behavior
- fewer long-lived hidden mismatches
- more stable quality as the system scales

#### Product law protected
**The analysis → composition chain must remain explainable at the system level, not just at the UI level.**

#### Locked implementation direction
- Normalize trace contract fields for source owner, selected stage, selected timestamps, and fallback reason.
- Keep this PR additive and contract-cleanup-oriented.
- Do not mix in new selection policy or session-composition logic unless explicitly required.

#### Non-goals
- No major user-facing behavior change.
- No public result renderer rewrite.
- No adaptive logic expansion.

#### Recommended model
- **Sonnet 4.6**
- **Composer** acceptable only if tightly scoped to trace contract cleanup

---

### P5 — Docs / SSOT / AGENTS alignment refresh

#### Why this is fifth
This is the least directly user-visible priority, but it is important to prevent future agent or developer work from regressing the laws introduced by PR #52 and the next follow-ups.

#### Current residual risk
Without documentation alignment, future work can easily drift toward:
- legacy-band-first reasoning
- public result ownership confusion
- unsafe phase-semantics shortcuts
- generic “recommendation” framing instead of execution-system framing

#### Desired user-felt change
Almost entirely indirect:
- fewer future regressions
- more consistent PR quality
- less architectural drift

#### Product law protected
**Product truth must live in system memory, not only in recent developer context.**

#### Locked implementation direction
- Update SSOT/docs/AGENTS to reflect:
  - public result truth owner semantics
  - baseline session anchor priority
  - preserved phase semantics
  - current canonical follow-up order
- Keep docs-only scope.

#### Non-goals
- No implementation changes.
- No policy rewrites.

#### Recommended model
- **Composer**

---

## User-felt impact ladder

### Highest direct user-felt impact
1. **P1 — claimed public result selection policy refinement**
2. **P2 — first-session quality tuning**

These two most directly affect whether the user feels:
- “this is using my current result truth”
- “this first session actually matches me”

### Medium indirect but highly important impact
3. **P3 — alignment audit / guardrail expansion**
4. **P4 — truth-owner / trace contract cleanup**

These improve stability, debuggability, and long-term consistency.

### Lowest immediate user visibility, highest long-term memory value
5. **P5 — docs / SSOT / AGENTS refresh**

---

## Recommended PR slicing rule

Do **not** combine these into one mega PR.
Use this order and slice one ownership problem per PR:

1. source-selection truth
2. first-session composition quality
3. alignment audit / guardrails
4. trace contract cleanup
5. docs alignment

If a PR needs to cross more than one of these layers, it should be split unless the overlap is strictly additive and non-controversial.

---

## Out of scope for this SSOT

This document does **not** prioritize or authorize the following as the immediate next step after PR #52:

- public result renderer redesign
- onboarding restructuring
- payment/auth continuity changes
- session 2+ adaptive redesign
- execution player UX changes
- camera evaluator work
- DB migrations unrelated to claimed-result/session-1 truth

Those may become relevant later, but they are not the canonical next priorities defined here.

---

## Final canonical statement

After PR #52, MOVE RE should evolve in this exact direction:

1. choose the right current public result truth,
2. turn that truth into a more distinctly felt first session,
3. audit whether the alignment really held,
4. make the truth-owner/trace chain cleaner and easier to debug,
5. then lock the new laws into docs and agent guidance.

This is the canonical post-PR-52 follow-up order.
