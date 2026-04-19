# PR-RISK-09 — Legacy display recovery quality

## Parent SSOT

- Parent: `docs/pr/PR-RESIDUAL-RISK-CLOSURE-SESSION-DISPLAY-ALIGNMENT.md`
- Previous residual child: `docs/pr/PR-RISK-08-active-plan-consumption-evidence-hardening.md`
- Related primary child: `docs/pr/PR-TRUTH-05-display-ssot-closure.md`

This PR is the fourth residual-risk closure PR after the main PR-TRUTH-01~05 sequence.

---

## Goal

Preserve backward-compatible rendering quality for older / incomplete session rows without reopening fresh-path display truth or inventing a new schema.

This PR owns **legacy display recovery quality** only.

It does not change fresh canonical display truth, generator semantics, onboarding semantics, or active-plan/profile reuse policy.

---

## Locked problem statement

PR-TRUTH-05 successfully closed fresh-path display truth around the canonical display field family.
That means fresh plans now flow through:

- canonical display fields in `plan_json.meta`
- pass-through through summary/bootstrap/hydration
- fallback derivation only when payloads are old or partial

That is correct.

However, older rows may still depend on recovery derivation and can therefore render with lower fidelity than fresh canonical rows.

This is not a bug in the fresh path.
It is a **backward-compatibility quality risk** for legacy rows.

The product question is not whether recovery should exist.
It must.
The question is whether legacy recovery should be made more faithful, more explicit, or selectively backfilled—without disturbing the fresh-path SSOT.

---

## Scope

### In scope

- legacy / partial payload display quality for map/panel summary surfaces
- recovery derivation quality and consistency
- optional lightweight backfill/hydration improvements only if needed
- preserving backward compatibility while avoiding fresh-path regressions

### Out of scope

- no fresh canonical display-field redesign
- no generator semantic changes
- no onboarding or profile semantics changes
- no map redesign
- no SessionPanel redesign
- no scoring or pain semantic changes

---

## Locked truth

### Truth 1 — fresh canonical paths remain authoritative

This PR must not reopen or weaken PR-TRUTH-05.
Fresh paths with canonical display fields must remain pass-through-first.

### Truth 2 — legacy recovery remains necessary

Older rows and partial payloads must continue to render through recovery logic.
Deleting legacy recovery is not allowed.

### Truth 3 — legacy quality may improve, but without new semantic ownership

If recovery quality is improved, the improvement must still be recovery-only.
It must not create a second semantic source of truth alongside fresh canonical meta.

### Truth 4 — historical rows may stay approximate where data is truly absent

This PR is allowed to keep some approximation for old data if the underlying canonical fields simply do not exist.
The goal is better compatibility, not fictional precision.

---

## Required behavior changes

### A. Audit legacy recovery surfaces

Inspect where older rows are still recovered for display, especially across:

- plan-summary
- node-display hydration
- bootstrap/home bundles
- map node display resolver
- panel rationale display

Determine whether there are any inconsistent recovery outcomes between those surfaces.

### B. Improve recovery consistency where safe

If the same old row can produce different role/goal/rationale outputs across surfaces, narrow that inconsistency.

### C. Consider lightweight legacy hydration/backfill only if grounded

If there is a safe, minimal way to improve old-row fidelity—such as echoing already recoverable fields through an existing hydration path—this is acceptable.

But do not introduce migrations or broad historical rewrites unless clearly necessary.

### D. Keep fresh-path untouched

Fresh canonical display paths must continue to use pass-through-first behavior.
This PR must not “simplify” by routing fresh rows back through recovery-heavy logic.

---

## Files expected to change

Primary expected files:

- `src/lib/session/session-display-contract.ts`
- `src/lib/session/session-node-display-hydration-item.ts`
- `src/app/api/session/plan-summary/route.ts`
- `src/lib/session/home-node-display-bundle.ts`
- `src/app/app/(tabs)/home/_components/reset-map-v2/session-node-display.ts`

Possible additive support files:

- `src/lib/session/session-display-copy.ts`
- `src/lib/session/client.ts`

Possible read-only inspection files:

- `src/app/app/_components/SessionPanelV2.tsx`
- any legacy batch hydration route if present

---

## Implementation rules

### Rule 1 — fresh path untouched

Do not degrade fresh canonical pass-through behavior.

### Rule 2 — recovery only for legacy/partial rows

Any quality improvement in this PR must stay explicitly on the legacy/partial path.

### Rule 3 — no broad migration unless clearly unavoidable

Prefer lightweight runtime recovery consistency over heavy backfill or schema migration.

### Rule 4 — bounded, honest recovery

Do not fabricate precision that old data cannot support.
When old rows are approximate, keep them bounded and consistent rather than overly specific.

---

## Acceptance criteria

1. Older or partial rows continue to render correctly through recovery logic.
2. Legacy recovery outputs are more consistent across summary/bootstrap/hydration/map/panel surfaces where practical.
3. Fresh canonical paths remain unchanged and authoritative.
4. No generator, onboarding, scoring, map redesign, or UI redesign semantics are introduced.

---

## Regression risks

### Risk 1 — accidentally reintroducing fresh-path reconstruction

If recovery improvements bleed into fresh paths, PR-TRUTH-05 can be weakened.

Mitigation:

- keep pass-through-first rules intact,
- gate changes to legacy/partial conditions only.

### Risk 2 — overfitting recovery to limited old data

If recovery logic tries to be too clever, old rows may become inconsistent or misleading.

Mitigation:

- prefer bounded, stable outputs,
- improve consistency more than specificity.

### Risk 3 — unnecessary scope expansion into data migration

Large historical backfills can create operational complexity disproportionate to the product value.

Mitigation:

- prefer runtime consistency fixes first,
- only backfill if there is a clearly grounded need.

---

## Done means

This PR is done when old or partial session rows remain safely backward-compatible and display more consistently, while fresh canonical rows continue to flow through the already-closed display SSOT without interference.
