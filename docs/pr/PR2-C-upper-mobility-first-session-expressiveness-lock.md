# PR2-C — Upper Mobility First-Session Expressiveness Lock

> Parent SSOT: `docs/pr/PR-POST-52-FOLLOWUP-PRIORITIES-SSOT.md`
> Master SSOT: `docs/pr/PR2-first-session-quality-tuning-master-ssot.md`
> Predecessor child SSOT: `docs/pr/PR2-A-first-session-quality-baseline-comparison-harness-lock.md`
> Scope type: `UPPER_IMMOBILITY` first-session expressiveness only

---

## Purpose

PR2-C owns exactly one felt-quality question:

> make `UPPER_IMMOBILITY` session 1 express its intended direction more clearly, so it no longer feels under-expressed or generically safe.

---

## Scope

Allowed work:
- tune first-session composition only for `UPPER_IMMOBILITY`
- improve anchor-facing expressiveness using the PR2-A harness
- add narrow observability only if required for proof

---

## Non-goals

- no PR1 source-selection work
- no lower-pair tuning
- no trunk/core tuning
- no deconditioned/stable polish
- no cross-anchor mega rewrite
- no safety/phase semantic weakening

---

## Locked truths

### T1. Upper mobility should feel directionally obvious from session 1
Not just explained in result text.

### T2. Expressiveness must not mean aggressiveness
The PR must not weaken difficulty/safety guardrails.

### T3. Prep must remain prep
Upper-specific expressiveness must not be faked by silently reclassifying prep meaning.

### T4. Improvement must be visible in the harness
The before/after difference should be inspectable anchor-wise.

---

## Regression proof

1. `UPPER_IMMOBILITY` becomes more clearly expressed in session 1
2. safety guardrails remain intact
3. phase semantics remain intact
4. other anchors are not broadly retuned

---

## Final canonical statement

PR2-C is the upper-mobility expressiveness PR.
It tunes only how clearly `UPPER_IMMOBILITY` is felt in session 1, without broad cross-anchor rewriting.
