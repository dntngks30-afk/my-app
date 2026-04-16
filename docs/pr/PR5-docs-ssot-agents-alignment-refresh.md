# PR5 — Docs / SSOT / AGENTS Alignment Refresh

> Parent SSOT: `docs/pr/PR-POST-52-FOLLOWUP-PRIORITIES-SSOT.md`
> Prior sibling truths:
> - `docs/pr/PR3-alignment-audit-guardrail-expansion-truth.md`
> - `docs/pr/PR4-truth-owner-generation-trace-contract-cleanup.md`
> Scope type: docs-only alignment refresh
> Goal: lock the post-PR52 laws, PR3 audit law, and PR4 selected-truth trace law into durable docs / SSOT / AGENTS guidance so future work does not drift

---

## Why this PR exists

PR #52, PR3, and PR4 together clarified important product and system truths:

- MOVE RE is a **state-based exercise execution system**, not a content app.
- Public result truth must continue into session generation rather than ending as a report.
- Session 1 should feel like a continuation of the selected current state truth.
- Alignment must be both **directionally real** and **machine-auditable**.
- The trace contract must distinguish:
  - **selected truth** (what won and why)
  - **realized alignment** (whether the generated session honored that truth)
- `Prep` semantics must not be silently promoted into `Main` semantics.

These truths now exist partly in code and partly in recent developer memory.
PR5 exists to make them durable written law so future PRs, agents, and contributors do not regress them through local convenience, legacy assumptions, or partial context.

---

## Parent truths carried forward

From `PR-POST-52-FOLLOWUP-PRIORITIES-SSOT.md`, P5 is locked as:

- update SSOT/docs/AGENTS to reflect:
  - public result truth owner semantics
  - baseline session anchor priority
  - preserved phase semantics
  - current canonical follow-up order
- keep docs-only scope

This child SSOT inherits those locks completely.

---

## Exact product truth this PR protects

The protected truth is:

> product law must live in durable system memory, not only in recent implementation memory.

If the docs/AGENTS layer does not reflect the new canonical truth, future PRs can easily drift toward:

- legacy-band-first reasoning
- generic recommendation framing
- result page thinking instead of execution-system thinking
- source-owner confusion
- trace-contract confusion
- phase-semantic shortcuts

---

## Scope

This PR may do the following only:

1. Refresh docs/SSOT/AGENTS language to reflect the current canonical post-PR52 truth.
2. Lock the distinction between:
   - selected truth
   - selected truth ownership
   - realized alignment audit
3. Reflect PR3 and PR4 outcomes in durable docs language.
4. Clarify the canonical PR follow-up order and current architecture truths.
5. Update agent-facing guidance so future coding agents do not collapse these concepts.

---

## Non-goals

This PR must **not** do any of the following:

- no code changes
- no selection policy changes
- no session-composition changes
- no renderer/UI changes
- no onboarding/auth/payment changes
- no DB changes
- no cleanup of unrelated docs outside this truth boundary
- no policy rewrites beyond codifying already-locked truth

---

## Locked behavior-preserving rule

PR5 is a **docs-only alignment PR**.
It does not authorize product behavior change.
It only writes down already-locked truth more clearly.

Therefore:

- no meaning changes to `baseline` / `refined`
- no changes to fallback ordering
- no changes to phase semantics
- no changes to session-create behavior
- no changes to PR3/PR4 code contracts

---

## Canonical documentation truths PR5 must lock

### 1) Product identity
Docs and AGENTS must state clearly that MOVE RE is:

- **not** a content app
- **not** a static recommendation library
- a **state-based exercise execution system**

### 2) Public result truth continuity
Docs and AGENTS must reflect that:

- public result truth is not the end of the funnel
- the selected current public result should continue into execution
- session creation uses selected analysis truth rather than generic routine logic

### 3) Session 1 alignment law
Docs and AGENTS must reflect that:

- session 1 should feel like a continuation of the selected current state truth
- state-based execution must be felt, not only explained in text
- `Prep` semantics must not silently dominate `Main`

### 4) PR3 audit law
Docs and AGENTS must reflect that PR3 established:

- `alignment_audit` as a distinct contract for realized alignment
- the system should be able to audit whether the selected truth was actually honored
- audit precision must avoid overclaim

### 5) PR4 selected-truth trace law
Docs and AGENTS must reflect that PR4 established:

- selected-truth contract is distinct from realized alignment
- selected truth should be readable through canonical trace context such as:
  - source mode
  - truth owner
  - public result id
  - stage
  - selected timestamps
  - fallback layer/reason
- `selected_truth_trace` and `alignment_audit` serve different roles and must not be conflated

### 6) Follow-up order memory
Docs should preserve the canonical follow-up priority order from the parent SSOT:

1. source-selection truth
2. first-session composition quality
3. alignment audit / guardrails
4. truth-owner / trace contract cleanup
5. docs alignment

PR5 should reflect that P5 is now the documentation lock after the earlier layers.

---

## Recommended file targets

Exact file list may vary depending on repo structure, but the PR should update only the docs/agent-facing layer that actually serves as durable guidance.

Likely targets:

- `AGENTS.md`
- `ARCHITECTURE.md`
- `SYSTEM_FLOW.md`
- `DEVELOPMENT_RULES.md`
- possibly the top canonical SSOT doc if it contains now-stale wording
- possibly `docs/KNOWN_RISKS_AND_OPEN_ITEMS.md` or equivalent if it references outdated assumptions

Do not spray minor edits across many docs unnecessarily.
Prefer a small number of meaningful updates in the files that truly guide future work.

---

## Required wording/structure outcomes

After this PR, a future contributor or coding agent reading the docs should be able to answer clearly:

1. What kind of product MOVE RE is.
2. Why public result truth matters beyond the result screen.
3. Why session 1 alignment matters.
4. What PR3 changed conceptually.
5. What PR4 changed conceptually.
6. Why `selected_truth_trace` and `alignment_audit` are different.
7. Why `Prep` vs `Main` semantics are protected.
8. What the canonical follow-up order was after PR52.

---

## Regression proof requirements

The implementation is acceptable only if all of the following remain true:

1. No code files are changed.
2. Docs do not contradict current code truth.
3. Docs do not reintroduce legacy-band-first or generic recommendation framing.
4. Docs clearly separate selected-truth trace from alignment audit.
5. Docs remain consistent with the parent SSOT and PR3/PR4 child SSOTs.

---

## What “done” means

This PR is done when:

- the durable docs/AGENTS layer reflects the current canonical product truth,
- PR3 and PR4 are explained at the right conceptual level,
- future agents are less likely to conflate selected truth with realized alignment,
- and no implementation behavior was changed in the process.

---

## Recommended implementation style

- docs-only diff
- precise wording over long prose
- update the highest-value canonical docs rather than many incidental files
- write for future agents and future maintainers, not just current memory
- prefer explicit law/contract wording over vague product language

---

## Recommended model / execution mode

- Primary: **Composer 2**
- Acceptable alternative: **GPT-5.4 Thinking** if broader docs reconciliation is needed

This PR should feel like durable memory maintenance, not product redesign.

---

## Final canonical statement

PR5 is not a behavior PR.
PR5 is the documentation lock that makes the post-PR52 direction durable: MOVE RE is a state-based execution system; selected public-result truth continues into session generation; session 1 alignment matters; PR3 audits realized alignment; PR4 normalizes selected-truth trace; and future work must preserve phase semantics and avoid collapsing these concepts back into generic recommendation logic.
