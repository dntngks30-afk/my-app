# Implementation Prompt — PR-01 Squat Completion-First Authority Freeze

Use GPT-5.4 / strong reasoning mode.

You are implementing a **narrow correctness PR**, not a broad redesign.

Read these documents first and treat them as binding, in this order:

1. `docs/SSOT_SQUAT_COMPLETION_FIRST_QUALITY_STRICT_2026_04.md`
2. `docs/pr/PR-SQUAT-COMPLETION-FIRST-QUALITY-STRICT-TRUTH-MAP-01.md`
3. `docs/pr/PR-01-SQUAT-COMPLETION-FIRST-AUTHORITY-FREEZE.md`

Then inspect the real current code before editing:

- `src/lib/camera/auto-progression.ts`
- `src/lib/camera/evaluators/squat.ts`
- `src/lib/camera/squat-completion-state.ts`
- any narrow helper files directly touched by those paths

---

## Mission

Implement **PR-01 — Squat Completion-First Authority Freeze**.

Your task is to make squat final pass open **only** from canonical completion-owner truth, while preserving:

- the existing final pass surface contract where possible,
- strict absurd-pass blocking,
- same-rep stale protection,
- and the separation between pass/fail truth and quality interpretation.

This is an authority correction PR.
It is **not** a threshold tuning PR.
It is **not** a semantics consumer PR.
It is **not** a broad refactor PR.

---

## Non-negotiable product law

For squat only:

**Only completion-owner truth may open final pass.**

The following layers may assist, veto, or explain, but may not directly grant success:

- pass-core
- shallow/official shallow assist signals
- closure proof / bridge signals
- event-cycle signals
- trace/debug observability fields

---

## What must become impossible after this PR

These states must fail-close and become impossible in runtime/product output:

1. `completionTruthPassed === false` and `finalPassEligible === true`
2. `completionOwnerPassed !== true` and final pass true
3. `completionOwnerReason === 'not_confirmed'` and owner pass true
4. `completionOwnerPassed === true` and owner blocked reason non-null
5. `cycleComplete === false` and final pass true
6. pass-core-only positive evidence reopening pass while canonical completion-owner truth is false

---

## What must remain true after this PR

1. known standard/deep valid squat still passes
2. legitimate shallow / low-ROM real squat may still pass **if** completion-owner truth is satisfied
3. standing still still fails
4. seated hold / still-seated-at-pass still fails
5. setup-motion contaminated pass still fails
6. stale prior rep still fails
7. mixed-rep contamination still fails
8. existing final pass surface fields stay coherent

---

## Scope rules

### Allowed files

Primary implementation scope:

- `src/lib/camera/auto-progression.ts`
- `src/lib/camera/evaluators/squat.ts`
- `src/lib/camera/squat-completion-state.ts`

Optional narrow helper file only if genuinely needed:

- completion-owner invariant helper
- final-pass authority helper

Optional narrow smoke file only if needed:

- one PR-01-specific smoke
- or minimal extension of an existing squat smoke

### Forbidden changes

Do **not** do any of the following in this PR:

- no threshold retuning
- no confidence retuning
- no pass-confirmation retuning
- no broad `pass-core.ts` math rewrite
- no pose-features redesign
- no event-cycle redesign
- no UI/page/route changes
- no semantics consumer rewrites
- no overhead/non-squat work
- no broad harness program
- no cleanup-only refactor sprawl

If you discover adjacent issues, leave them untouched unless they are strictly required to enforce the PR-01 authority law.

---

## Required implementation intent

### 1. Freeze the opener at completion-owner truth

In the squat branch of the final gate path, rebind the opener so that the product pass surface opens only from canonical completion-owner truth.

Conceptually, the resulting gate must behave like:

```ts
finalPassOpen = completionOwnerPassed && absurdPassRegistryClear && uiGateClear
```

Where:

- `completionOwnerPassed` is the only positive opener
- late blockers may close
- UI/progression gate may close
- assist layers may not independently open

### 2. Remove pass-core-first opener behavior

Eliminate any path where:

- pass-core positive result,
- plus owner shortcut / contradiction bypass,
- causes final pass to open even though completion-owner truth is not satisfied.

Pass-core may still provide:

- rep-bound evidence
- blocked reasons
- stale/invalid safeguards
- observability

But it must not directly grant final pass.

### 3. Strengthen contradiction invariant enforcement

Introduce or tighten a narrow invariant layer so completion-owner contradictions fail-close before reaching final pass.

At minimum, fail-close these:

- owner passed + owner blocked reason present
- owner passed + `not_confirmed`
- owner passed + cycle not complete
- final pass true while completion truth false

### 4. Preserve final pass surface contract

If possible, preserve the existing public surface names and coherence:

- `finalPassEligible`
- `finalPassBlockedReason`
- `squatFinalPassTruth`
- `progressionPassed`

But their authority source must now be completion-owner-first.

### 5. Preserve truthful blocked reasons

Do not replace class-specific blocked reasons with a single vague generic reason when a more truthful reason is already available.

Examples to preserve if relevant:

- stale prior rep
- setup motion blocked
- seated / standing absurd pass
- mixed-rep contamination
- owner contradiction

### 6. Preserve quality separation

Do not touch severity interpretation logic in this PR.
A low-quality successful pass is still allowed as a future semantics-layer outcome.
This PR only decides whether pass is allowed to open.

---

## Working style requirements

- Make the smallest correct diff.
- Prefer targeted edits over refactor cleanup.
- Reuse existing structure where possible.
- Add comments only where they clarify the new authority law.
- Do not change behavior outside the locked scope.
- Be explicit about any residual risk that remains after implementation.

---

## Required validation

Before finishing, validate at minimum:

1. a known deep/standard successful squat still passes
2. a known legitimate shallow successful squat still passes if completion-owner truth is satisfied
3. a case equivalent to `completion false / final pass true` no longer passes
4. standing/seated/setup/stale/mixed-rep failure classes remain blocked
5. final pass surface fields remain mutually coherent

If you add or update a smoke, it should directly assert the illegal authority states, not just generic success/failure snapshots.

---

## Output requirements

When you complete the implementation, provide:

1. the exact files changed
2. the authority-law change in one paragraph
3. the illegal states now blocked
4. residual risks still intentionally left
5. how you validated the change

Do not broaden into the next PR.
Do not rebind downstream semantics here.
Do not sneak in threshold tuning.

---

## One-line lock

**Implement the narrowest possible change that makes completion-owner truth the only opener of squat final pass, while preserving existing absurd-pass blockers, same-rep safeguards, and downstream final-surface stability.**
