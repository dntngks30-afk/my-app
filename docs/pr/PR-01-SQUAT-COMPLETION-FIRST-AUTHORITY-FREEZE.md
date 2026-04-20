# PR-01 — Squat Completion-First Authority Freeze

> Parent SSOT: `docs/SSOT_SQUAT_COMPLETION_FIRST_QUALITY_STRICT_2026_04.md`  
> Parent PR Truth Map: `docs/pr/PR-SQUAT-COMPLETION-FIRST-QUALITY-STRICT-TRUTH-MAP-01.md`

This PR is the first and mandatory implementation step of the new squat philosophy.

It is **not** a threshold tuning PR.  
It is **not** a broad refactor PR.  
It is **not** a shallow rescue PR.

Its only job is:

**Freeze squat final pass authority so that only completion-owner truth may open final pass, while preserving strict absurd-pass blocking and keeping quality interpretation separate.**

---

## 1. Why this PR exists

The current repo still allows a structural contradiction:

- completion-state/history may say the movement is not confirmed,
- but pass-core-first owner logic may still open owner pass,
- and final pass surface may become true,
- while downstream fields still expose the failed completion history.

That contradiction is the root of the recurring user-visible false-pass class.

This PR exists to remove that contradiction at the authority layer.

---

## 2. Core diagnosis

The current problem is not one threshold.
It is a **truth hierarchy problem**.

The active split is:

1. `completion-owner` style fields represent movement completion history,
2. `pass-core` may still act like the real opener,
3. `ui gate` consumes the owner result,
4. `final pass` surface becomes true,
5. absurd-pass blockers are layered on top as special-case vetoes.

As long as pass-core or assist layers can directly reopen final pass, the same recurrence can come back under new signatures.

So the first correction must be philosophical and structural:

- decide the only opener,
- keep the existing product pass surface,
- rewire the opener to completion-owner truth,
- keep absurd-pass vetoes narrow,
- keep quality separate.

---

## 3. One-line purpose

**Only completion-owner truth may open squat final pass; pass-core and shallow assist layers may assist or veto, but may never directly grant success.**

---

## 4. Scope

### In scope

- Rebind squat final pass authority to completion-owner truth.
- Remove pass-core-first direct opener behavior from the squat final gate path.
- Introduce/strengthen completion-owner contradiction invariants.
- Preserve the existing final pass surface contract if possible.
- Preserve same-rep stale guard and absurd-pass blocking behavior.
- Keep existing quality/semantics separation untouched.
- Add narrow smoke/regression checks for newly illegal authority states.

### Out of scope

- No depth threshold retuning.
- No confidence threshold retuning.
- No pass-confirmation stable-frame retuning.
- No shallow/ultra-low rescue tuning.
- No event-cycle redesign.
- No pose-features redesign.
- No page/route/UI changes.
- No overhead/non-squat changes.
- No downstream semantics rebinding in this PR.
- No broad test harness expansion beyond narrow authority smokes.

---

## 5. Files allowed

Primary expected files:

- `src/lib/camera/auto-progression.ts`
- `src/lib/camera/evaluators/squat.ts`
- `src/lib/camera/squat-completion-state.ts`

Optional narrow helper files if needed:

- `src/lib/camera/squat/squat-completion-owner-invariant.ts`
- `src/lib/camera/squat/squat-final-pass-authority.ts`

Optional narrow smoke files:

- `scripts/camera-pr-01-squat-completion-first-authority-freeze-smoke.mjs`
- or tightly scoped updates to existing squat smokes

### Forbidden in this PR

- `src/lib/camera/pose-features.ts`
- `src/lib/camera/squat/pass-window.ts`
- broad `pass-core.ts` threshold/math rewrites
- route/page/app-shell/UI files
- semantics consumer files (`squat-result-severity`, diagnosis summary, bundle, snapshots)
- non-squat modules

Reason:
This PR is the opener-freeze PR. It should not sprawl into semantics or upstream algorithm redesign.

---

## 6. Locked philosophy for this PR

### 6.1 Completion-first opener

For squat only, `finalPassEligible === true` is legal only if the canonical completion-owner truth for the same rep is true.

### 6.2 Pass-core demotion

`pass-core` remains important but loses direct opener authority.

It may:

- supply same-rep evidence,
- help completion-owner truth form correctly,
- provide blocked reasons,
- support absurd-pass vetoes,
- remain visible in traces.

It may not:

- directly grant final pass,
- bypass completion-owner contradiction checks,
- reopen final pass when completion-owner truth is false.

### 6.3 Quality separation

This PR must preserve the separation between:

- pass/fail truth
- quality/strict interpretation

A low-quality pass may still be a pass.
This PR does not touch severity semantics yet.

### 6.4 Veto-last

Absurd-pass blockers remain allowed, but only as blockers.
They may not become alternate openers.

---

## 7. Required invariants

These invariants become mandatory after PR-01.

### Invariant A

`completionOwnerPassed !== true`  ->  `finalPassEligible !== true`

### Invariant B

`completionOwnerReason === 'not_confirmed'`  ->  owner pass false

### Invariant C

`completionOwnerPassed === true`  ->  `completionOwnerBlockedReason == null`

### Invariant D

`completionTruthPassed === false` and `finalPassGranted === true` is illegal.

### Invariant E

`cycleComplete === false` and final pass true is illegal.

### Invariant F

Pass-core / assist-only positive evidence may not directly reopen final pass when canonical completion-owner truth is false.

### Invariant G

If a rep is blocked for absurd-pass reasons (standing, seated, setup contaminated, stale prior rep, mixed-rep contamination), final pass must fail-close even if other weak evidence appears positive.

---

## 8. Exact design requirements

### A. Freeze the opener at completion-owner truth

In the squat branch of `auto-progression.ts`, the opener chain must be redefined so that the final pass surface opens only from completion-owner truth.

The real product condition must be conceptually equivalent to:

```ts
finalPassOpen = completionOwnerPassed && absurdPassRegistryClear && uiGateClear
```

Where:

- `completionOwnerPassed` is the only positive opener,
- absurd-pass blockers may close,
- UI/progression gate may close,
- no assist layer may independently open.

### B. Remove pass-core direct-opener behavior

Any path equivalent to:

- `pass_core_detected` -> owner pass true -> completion contradiction skipped -> final pass open

must be removed.

Pass-core may still contribute evidence, but it must not be treated as a sufficient opener by itself.

### C. Strengthen contradiction invariant enforcement

Completion-owner contradictions must be normalized/fail-closed before they can reach final pass surface.

At minimum, these contradictions must fail-close:

- owner passed + blocked reason present
- owner passed + `not_confirmed`
- owner passed + cycle not complete
- final pass true while completion truth false

### D. Preserve final pass surface contract if possible

Keep the public/product surface stable if possible:

- `finalPassEligible`
- `finalPassBlockedReason`
- `squatFinalPassTruth`

But change their authority source so they are opened from completion-owner truth.

### E. Preserve truthful blocked reasons

Do not collapse all newly blocked paths to a vague `completion_not_satisfied` if a more truthful class-specific reason already exists.

Examples of valuable blocked reasons to preserve:

- stale prior rep
- setup motion blocked
- seated/standing absurd pass
- mixed-rep contamination
- owner contradiction

### F. Preserve same-rep observability

Do not remove rep-bound trace fields.
If needed, strengthen them so the new opener law remains diagnosable.

Allowed additive debug fields are fine if narrow and truthful.

---

## 9. Recommended implementation shape

A minimal-diff route is preferred.

### Suggested steps

1. In `auto-progression.ts`, separate:
   - canonical completion-owner pass truth
   - pass-core evidence / trace
   - final veto reasons

2. Rewrite the squat final pass blocked-reason builder so:
   - completion-owner truth is the only positive opener,
   - pass-core may contribute blocked reasons / trace only,
   - absurd-pass vetoes still close late.

3. Add or tighten a narrow helper for owner contradiction normalization.

4. Keep `squatFinalPassTruth` as the product surface, but derive it from the new opener law.

5. Update/add narrow smokes for illegal states.

---

## 10. Acceptance criteria

### A. Current recurrence becomes impossible

A squat attempt may no longer produce the state:

- `completionTruthPassed=false`
- and `finalPassEligible=true`

### B. Pass-core cannot directly reopen pass

A pass-core positive result without canonical completion-owner truth may not survive to final pass.

### C. Legitimate shallow real reps remain possible

This PR must not intentionally kill all shallow/low-ROM legitimate reps.
If completion-owner truth is satisfied for a real shallow rep, final pass may still open.

### D. Absurd-pass classes remain blocked

These classes must still fail:

- standing still
- seated hold / seated at pass
- setup-motion contaminated pass
- stale prior rep reused as current pass
- mixed-rep timestamp contamination

### E. Final surface contract remains coherent

For squat:

- `progressionPassed`
- `finalPassEligible`
- `finalPassBlockedReason == null`
- `squatFinalPassTruth.finalPassGranted`

must remain mutually coherent.

### F. Downstream semantics are not yet changed

This PR must not broaden into severity or snapshot consumer rewrites.
That belongs to the next PR.

---

## 11. Minimum regression proof checklist

1. **Known deep/standard success still passes**
2. **Known legitimate shallow pass still passes when completion-owner truth is satisfied**
3. **`completion false / final pass true` case now fails**
4. **standing/seated/setup/stale/mixed-rep cases still fail**
5. **blocked reason remains truthful enough to diagnose the failure class**

---

## 12. Residual risk intentionally accepted

This PR does **not** promise to perfect every shallow edge case.

If some legitimate shallow misses remain after PR-01, that is acceptable.
The point of PR-01 is to eliminate split-brain authority and nonsense pass reopeners first.

After this PR, any remaining shallow failure should collapse into a smaller, more truthful upstream evidence problem.
That is the desired outcome.

---

## 13. Rollback rule

If rollback is needed, rollback only the new opener law changes and narrow invariant helper additions.
Do not mix rollback with threshold or semantics changes.

---

## 14. One-line lock

**PR-01 freezes squat final pass so that only canonical completion-owner truth may open success, while pass-core and assist layers become non-opener evidence/veto/trace roles.**
