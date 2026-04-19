# PR-RESIDUAL-RISK-CLOSURE-SESSION-DISPLAY-ALIGNMENT

## Parent purpose

This document locks the **post-PR1~5 residual risk closure roadmap** for the session display/generation alignment chain.

PR-TRUTH-01 through PR-TRUTH-05 closed the primary product failures, but a few residual risks remain.
These are not severe enough to reopen the original parent truth map, but they are real enough to justify follow-up PRs.

This document is a **new parent SSOT** for those residual closures.

---

## Closed foundation from PR-TRUTH-01~05

The following are already considered solved at the primary level:

- near-node map truth no longer defaults to old generic copy when runtime truth exists
- final-plan rationale/focus is reconciled against selected composition
- onboarding experience semantics are real for session 1
- stale session-1 active-plan reuse is guarded by profile snapshot comparison
- fresh display paths now pass through one canonical display field family

This parent exists only for what remains after that closure.

---

## Residual risk inventory

### Residual A — preview phase truth accuracy

Near-node synthetic preview still uses a coarse `sessionNumber -> phase clamp` approximation in some paths.

This is acceptable as a first safety fix, but it can still cause:

- role-stage drift for 8/12/20-session programs,
- map/panel role language moving earlier than true program phase policy,
- synthetic preview feeling structurally “close enough” rather than truly phase-correct.

This is the highest user-visible residual risk.

### Residual B — axis/tag mapping duplication

Final-plan reconciliation currently keeps an axis/tag mapping copy local to the reconcile helper.

This is acceptable short-term, but long-term it risks:

- drift between priority-layer and reconciliation-layer meaning,
- future edits updating one mapping and forgetting the other,
- silent semantic divergence across selection vs display alignment.

This is a structural maintainability risk.

### Residual C — safe-regeneration consumption evidence thinness

Session-1 profile mismatch regeneration is already conservative, but current safe-regeneration checks lean mainly on:

- `status === 'draft'`
- `exercise_logs` empty

That is good enough for now, but still thinner than ideal if later product paths create more forms of plan consumption evidence.

This is a robustness risk, not an immediate blocker.

### Residual D — legacy display recovery dependence

Fresh paths now use canonical display pass-through, but older rows still rely on recovery derivation.

This is currently intentional and correct.
It is only a risk if legacy rendering quality becomes unacceptable or if historical rows need stronger fidelity later.

This is the lowest-priority residual and may remain as an accepted compatibility tradeoff unless product demands otherwise.

---

## Product prioritization

Residual closure should follow this order:

1. **PR-RISK-06 — Phase truth wiring for synthetic preview / near-node role accuracy**
2. **PR-RISK-07 — Axis/tag mapping SSOT deduplication**
3. **PR-RISK-08 — Active-plan consumption evidence hardening**
4. **PR-RISK-09 — Legacy display recovery quality / optional historical backfill**

Reason:

- PR-RISK-06 improves user-visible truth the fastest.
- PR-RISK-07 prevents future semantic drift at the source.
- PR-RISK-08 hardens profile-mismatch safety without reopening session semantics.
- PR-RISK-09 is optional unless legacy rendering becomes product-important.

---

## Non-goals

This residual roadmap does **not** reopen:

- scoring-core changes
- onboarding UI changes
- map redesign
- SessionPanel redesign
- broad adaptive-engine redesign
- public-result IA redesign

---

## Acceptance for the full residual roadmap

1. Synthetic next/current preview uses true program phase policy rather than coarse session-number clamping.
2. Axis/tag semantic mapping has one authoritative owner shared by selection and reconciliation.
3. Session-1 profile mismatch regeneration safety checks use stronger consumption evidence than logs-only.
4. Legacy recovery remains backward-compatible, whether accepted as-is or selectively improved.

---

## Final stance

PR-TRUTH-01~05 solved the main product drift.
The remaining work is now about **truth accuracy polish** and **structural hardening**, not reopening the original product problem.
