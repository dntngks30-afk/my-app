# PR1-B — ClaimedAt / CreatedAt Deterministic Tie-Break Lock

> Parent SSOT: `docs/pr/PR-POST-52-FOLLOWUP-PRIORITIES-SSOT.md`
> Master SSOT: `docs/pr/PR1-claimed-public-result-selection-policy-refinement-master-ssot.md`
> Predecessor child SSOT: `docs/pr/PR1-A-currentness-window-stage-freshness-selection-lock.md`
> Scope type: deterministic selection timing law only

---

## Purpose

PR1-B owns exactly one problem:

> after PR1-A corrects stale refined vs fresh baseline ownership, the remaining timing law must become deterministic and explainable through `claimedAt` and `createdAt`.

This PR does **not** change session quality or generator behavior.
It only locks how timing fields are used once the broader stage/freshness decision has already been made.

---

## Scope

This PR may refine only:
- the deterministic tie-break between candidates when stage/freshness buckets are already close
- the exact ordering role of `claimedAt` and `createdAt`
- narrow additive trace explaining which timestamp won and why

Allowed work:
- a narrow ranking helper or comparator extraction
- loader-level tests for timing tie cases
- additive selection-reason trace only if needed

---

## Non-goals

- no stale-refined vs fresh-baseline policy invention beyond PR1-A
- no execution-suitability redesign
- no generator / session composition / plan quality change
- no readiness / onboarding / auth / payment / UI changes
- no broad trace-contract cleanup
- no legacy fallback rewrite

---

## Problem statement to lock

Even after stage/currentness are corrected, the system still needs a deterministic answer for cases like:
- same-stage candidates claimed close together
- baseline vs refined candidates with similar freshness bucket
- rows created earlier but claimed later
- re-claimed or late-claimed results where `createdAt` and `claimedAt` tell different stories

If the policy does not lock this clearly, selection can remain technically working but hard to explain.

---

## Locked truths

### T1. `claimedAt` and `createdAt` have different meanings
- `claimedAt` = when this result entered the authenticated execution path
- `createdAt` = when this result was originally produced

They must not be treated as interchangeable.

### T2. Deterministic timing order is required
When stage/currentness alone does not produce a clear winner, timing tie-break must be deterministic and documented.

### T3. Execution-path recency and analysis recency should both be preserved
The policy must not blindly ignore either timestamp.

### T4. No composition-layer leakage
This timing law must remain a pure source-selection concern.

---

## Canonical implementation direction

PR1-B should formalize a deterministic timing order such as:

1. first resolve stage/currentness bucket from PR1-A
2. then apply a documented timing comparator using `claimedAt`
3. if still tied or near-tied, apply `createdAt`
4. if still tied, use a stable final deterministic key (for example id/order)

The exact comparator can vary, but the final law must make these distinctions explicit:
- execution recency (`claimedAt`)
- analysis generation recency (`createdAt`)
- final deterministic stability

---

## Files expected to change

Likely:
- `src/lib/public-results/getLatestClaimedPublicResultForUser.ts`
- narrow helper(s) if comparator extraction is cleaner
- loader-level tests

Not expected:
- generator / readiness / onboarding / result rendering files

---

## Regression proof

1. same-stage rows with different `claimedAt` sort deterministically
2. equal/similar `claimedAt` rows use `createdAt` deterministically
3. late-claimed older analyses remain explainable by the locked rule
4. loader still returns one stable winner or `null`
5. no composition behavior changes

---

## Final canonical statement

PR1-B is the timing-law PR.
It locks the deterministic meaning and tie-break order of `claimedAt` and `createdAt` after PR1-A has already corrected the larger stale-vs-fresh ownership bug.
