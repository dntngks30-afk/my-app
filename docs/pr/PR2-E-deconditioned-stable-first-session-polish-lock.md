# PR2-E — Deconditioned / Stable First-Session Polish Lock

> Parent SSOT: `docs/pr/PR-POST-52-FOLLOWUP-PRIORITIES-SSOT.md`
> Master SSOT: `docs/pr/PR2-first-session-quality-tuning-master-ssot.md`
> Predecessor child SSOT: `docs/pr/PR2-A-first-session-quality-baseline-comparison-harness-lock.md`
> Scope type: `DECONDITIONED` / `STABLE` first-session polish only

---

## Purpose

PR2-E owns exactly one felt-quality question:

> make `DECONDITIONED` and `STABLE` session-1 starts feel appropriately polished and non-generic without turning this PR into a cross-anchor mega rewrite.

These anchors often need polish rather than aggressive directional retuning.

---

## Scope

Allowed work:
- tune first-session composition only for `DECONDITIONED`
- tune first-session composition only for `STABLE`
- use the PR2-A harness to prove improved polish/distinctness
- add narrow observability only if required for proof

---

## Non-goals

- no PR1 source-selection rewrite
- no lower-pair tuning
- no upper mobility tuning
- no trunk/core tuning
- no cross-anchor mega rewrite
- no guardrail weakening
- no phase semantic rewrite

---

## Locked truths

### T1. `DECONDITIONED` should feel beginner-safe but not shapeless
It must remain safe while still feeling intentionally structured.

### T2. `STABLE` should feel clean and believable, not generic filler
It should feel like a credible start, not an undifferentiated default.

### T3. Polish must not weaken safety or phase semantics
No prep/main drift, no guardrail weakening.

### T4. Improvement must be visible in the harness
This PR must prove polish by anchor, not through a broad narrative.

---

## Regression proof

1. `DECONDITIONED` and `STABLE` session-1 starts feel more polished/non-generic
2. guardrails remain intact
3. phase semantics remain intact
4. other anchors are not broadly retuned

---

## Final canonical statement

PR2-E is the deconditioned/stable polish PR.
It exists only to make the safest/default-feeling starts more intentional and believable without broad cross-anchor rewrite.
