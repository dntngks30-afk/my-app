# PR1-A — Currentness Window / Stage-Freshness Selection Lock

> Parent SSOT: `docs/pr/PR-POST-52-FOLLOWUP-PRIORITIES-SSOT.md`
> Master SSOT: `docs/pr/PR1-claimed-public-result-selection-policy-refinement-master-ssot.md`
> Scope type: claimed-public-result source-selection truth only

---

## Purpose

PR1-A is the **first child PR** under PR1.
It owns exactly one problem:

> correct the stale-refined-vs-fresh-baseline ownership bug without collapsing to naive latest-only.

Today the loader still ranks claimed results as:
- `refined` before `baseline`
- then newer `claimed_at` within the same stage

That means an older refined result can still beat a fresher baseline by default.
This violates the master PR law that **current state truth must win before composition logic begins**.

PR1-A exists to fix that exact problem and nothing wider.

---

## Scope

This PR may change only the **selection ranking policy** inside the claimed public result loader path so that:

1. stage remains meaningful,
2. freshness becomes explicit,
3. a clearly fresher baseline can beat a stale refined result,
4. the policy does **not** degrade into naive latest-only.

Allowed work:
- refine ranking logic in `getLatestClaimedPublicResultForUser`
- add narrow helper(s) to compute freshness/currentness window or policy bucket
- add narrow tests covering stale refined vs fresh baseline ordering
- additive trace/debug fields only if strictly needed to explain the winning source

---

## Non-goals

PR1-A must **not** do any of the following:

- no execution-suitability policy rewrite beyond whatever is already required for existing validity checks
- no `claimedAt` vs `createdAt` tie-break redesign beyond what is necessary for the currentness-window decision
- no session composition or generator changes
- no onboarding / readiness / payment / auth / UI changes
- no renderer/result-contract rewrite
- no legacy fallback redesign
- no broad trace-contract cleanup

Those belong to later child PRs.

---

## Problem statement to lock

The current policy is still structurally equivalent to:

1. prefer `refined`
2. otherwise prefer `baseline`
3. within the same stage, prefer newer `claimed_at`

That creates the exact residual risk called out by the parent SSOT:

> a stale refined result can still beat a newer baseline simply because the current policy is biased toward refined-first selection.

PR1-A must fix **that** and only that.

---

## Locked truths

### T1. Blind refined-first is no longer allowed
The loader must not let refined win merely because it is refined.

### T2. Currentness must be explicit
The policy must encode an explicit notion of freshness/currentness rather than relying on stage rank alone.

### T3. Stage still matters
PR1-A must not swing all the way to naive latest-only. A refined result can still win when it is not stale relative to the baseline candidate set.

### T4. One winner only
The downstream pipeline must still receive exactly one selected claimed public result or `null`, with no ambiguity added downstream.

### T5. Legacy fallback remains intact
If no claimed result survives the loader path, existing legacy fallback behavior remains unchanged.

---

## Canonical implementation direction

The policy should be modeled as a **currentness-window-aware stage selection** rather than a simple stage-first sort.

Canonical direction:

1. Consider valid claimed candidates.
2. Determine whether a baseline candidate is meaningfully fresher than the best refined candidate.
3. If the freshness gap crosses the policy window, the fresher baseline may win.
4. Otherwise, stage can still favor refined when it remains current enough.
5. Keep deterministic fallback ordering after the currentness decision.

Important:
- The exact freshness window may be implemented as a helper or explicit comparison rule.
- The policy must remain deterministic and explainable.
- The rule must be narrow enough that PR1-B can later own the detailed `claimedAt`/`createdAt` tie-break semantics.

---

## Files expected to change

Likely:
- `src/lib/public-results/getLatestClaimedPublicResultForUser.ts`
- one narrow helper near the loader if needed
- selection-policy test file(s)

Not expected:
- `buildSessionDeepSummaryFromPublicResult.ts`
- generator / plan ranking files
- onboarding / readiness UI
- session panel / renderer files

---

## Regression proof

PR1-A is acceptable only if all of the following are proved:

1. **Older refined vs much newer baseline**
   - the newer baseline can win when refined is stale by policy
2. **Current refined vs slightly newer baseline**
   - refined can still win when it remains within the currentness window
3. **Same-stage ordering remains deterministic**
   - within the same stage, ordering still remains stable
4. **No claimed candidate**
   - loader still returns `null`, preserving downstream fallback
5. **No composition regression**
   - session composition behavior stays unchanged apart from receiving a better selected source

---

## Residual risks intentionally left out

PR1-A does **not** fully solve:
- detailed `claimedAt` vs `createdAt` tie-break law
- richer execution-suitability preference
- broader trace/audit normalization

Those are reserved for PR1-B and PR1-C.

---

## Final canonical statement

PR1-A is the stale-refined-vs-fresh-baseline correction PR.
It introduces an explicit currentness-window-aware selection rule so that fresher current truth can beat stale refined preference, while still avoiding naive latest-only behavior.
