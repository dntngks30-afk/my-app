# PR-CAM-SQUAT-BLENDED-EARLY-PEAK-FALSE-PASS-LOCK-01

> Parent truths to preserve:
>
> - `docs/PASS_AUTHORITY_RESET_SSOT_20260404.md`
> - `docs/pr/PR-RF-STRUCT-11-shallow-squat-safe-pass-truth-map.md`
> - `docs/pr/PR-E-residual-risk-closure-truth-map.md`
> - `docs/pr/PR-E1-conditional-shallow-lock-promotion-map.md`
> - `docs/pr/PR-F-shallow-real-path-permanent-lock-truth-map.md`
>
> Related runtime truth sources:
>
> - `src/lib/camera/auto-progression.ts`
> - `src/lib/camera/squat/pass-core.ts`
> - `src/app/movement-test/camera/squat/page.tsx`
>
> This PR follows the already-locked PR-F direction:
>
> - same-rep recovery-owned ascent may support legitimate shallow recovery
> - representative shallow permanence must stay intact
> - pass-core remains the motion-truth owner
> - final product success remains the post-owner final-pass surface
>
> This PR does **not** replace PR-F.
> This PR does **not** re-open broad shallow policy work.
> This PR exists only because recent real-device / preview observations exposed a narrower remaining false-pass family.

---

## 1. Why this PR exists

Recent real-device / preview observations show a remaining split that is narrower than the earlier camera bottlenecks.

Observed signature:

- `completionPassReason = not_confirmed`
- `completionTruthPassed = false`
- `finalPassEligible = true`
- `finalPassLatched = true`
- `passOwner = other`
- `finalSuccessOwner = other`
- `relativeDepthPeakSource = blended`
- `armingDepthBlendAssisted = true`
- `armingFallbackUsed = true` or equivalent assisted arming path
- very early `peakLatchedAtIndex`
- `eventCycleDetected = false`
- shallow / ultra-low style evidence band

At the same time, legitimate shallow reps still fail for narrow completion reasons such as:

- `descent_span_too_short`
- `ascent_recovery_span_too_short`

This means the remaining production problem is now split into two distinct families:

1. **contaminated false-pass opening** (standing / sway / small movement / blended-assisted early peak)
2. **real shallow under-pass**

This PR handles **only family 1**.

That boundary is critical.
If both families are mixed into one PR, the repo will drift back into broad retune, permissive reopen, or broken representative permanence.

---

## 2. One-sentence objective

**Preserve the PR-F legitimate-shallow recovery direction, but add a narrow final-pass blocker that rejects the blended/fallback + early-peak contaminated false-pass signature without broadening or rolling back pass policy.**

---

## 3. Exact problem statement

The remaining production issue is not “all shallow motion is too permissive.”
The remaining issue is not “completion must always pass before final pass.”
The remaining issue is not “blended source is always bad.”

The exact issue is:

> a contaminated shallow-like signal can still open the final pass surface when blended/fallback assisted depth, very-early peak latching, and non-event-cycle path combine, even though the rep is not a legitimate same-rep shallow recovery.

This PR must solve **only** that exact issue.

---

## 4. Core laws that must remain frozen

### 4.1 No pass-law rewrite

Do not rewrite squat pass policy.
A squat still passes only through the already-locked authority chain.

### 4.2 No PR-F rollback

Do not undo the PR-F direction.
Do not treat every `completionTruthPassed === false` case as a blocker.
Do not kill legitimate recovery-owned shallow pass just because completion-state remains conservative.

### 4.3 No broad blended ban

Do not globally ban blended source, assisted arming, or fallback source.
Those signals are not themselves the bug.
The bug is a **specific contaminated combination**.

### 4.4 No second owner

Do not introduce a new pass owner in UI, trace, or a new evaluator layer.
The fix must stay inside the existing final-pass blocker pattern.

### 4.5 No representative downgrade

The permanently promoted representative shallow fixtures must remain green.
This PR fails if it damages `shallow_92deg` or `ultra_low_rom_92deg`.

---

## 5. Scope boundary

### Allowed primary scope

- `src/lib/camera/auto-progression.ts`

### Allowed secondary scope

- one new narrow smoke file, or at most two, proving the contaminated false-pass family is now blocked
- `scripts/camera-pr-f-regression-proof-gate.mjs` to include the new smoke

### Out of scope

- `src/lib/camera/squat/pass-core.ts` broad retune
- completion-state redesign
- guardrail redesign
- timing / countdown / capture protocol changes
- production overlay / visual debug work
- representative fixture geometry redefinition
- any unrelated smoke weakening

---

## 6. Required design direction

The fix must follow this exact direction:

> **Use the existing narrow final-pass blocker pattern to reject only the contaminated signature that is opening false pass, while leaving the already-accepted PR-F shallow recovery path intact.**

This means:

- do **not** move motion truth ownership away from pass-core
- do **not** make completion-state a global hard gate again
- do **not** add a broad shallow veto
- do **not** lower thresholds globally
- do **not** alter representative fixture semantics

The safest implementation style is:

- add one new `shouldBlock...FinalPass(...)` style blocker
- evaluate it only on squat final-pass opening
- set an explicit blocker reason when the contaminated signature is detected

---

## 7. What the new blocker is allowed to look at

The blocker may look at already-available runtime truth that characterizes the contaminated signature.

Allowed signal families include:

- shallow / ultra-low evidence band
- blended or assisted depth source contributing to arming / relative depth truth
- assisted arming / fallback markers
- very early peak latch position
- absence of strong event-cycle promotion
- final-pass would otherwise open despite weak completion truth
- source purity indicators that distinguish real down-up from standing/sway contamination

But the blocker must **not** be keyed off any single field alone.

### Explicitly forbidden single-field blockers

These alone are NOT sufficient:

- `completionTruthPassed === false`
- `completionPassReason === 'not_confirmed'`
- `relativeDepthPeakSource === 'blended'`
- `armingFallbackUsed === true`
- `peakLatchedAtIndex` being low
- `eventCycleDetected === false`
- shallow evidence label alone

A legitimate PR-F shallow recovery could still contain some of those fields.

The blocker must require a **compound contaminated signature**.

---

## 8. Compound contaminated-signature contract

The new blocker must only fire when the runtime signature strongly matches this family:

1. squat final pass would otherwise open
2. evidence is shallow / ultra-low styled
3. depth truth depends materially on blended / assisted source
4. primary depth truth is negligible or non-credible relative to the blended signal
5. peak anchor is latched very early in the series
6. event-cycle rescue is absent or not promoted
7. the resulting owner/final surface looks like false opening rather than legitimate same-rep down-up recovery

The blocker should be explainable as:

> “This is not a legitimate shallow recovery; this is an assisted, early-anchored contaminated signal pattern that must not open final pass.”

---

## 9. Required output behavior

When the contaminated signature is present:

- `gate.status` must not be `pass`
- `finalPassEligible` must be `false`
- `isFinalPassLatched('squat', gate)` must be `false`
- an explicit new blocker reason must be observable in debug output

When the signature is **not** present:

- PR-F representative shallow recovery must still work
- deep standard cycle must still work
- existing legitimate shallow down-up path must remain eligible

---

## 10. Regression matrix

### Matrix A — newly blocked contaminated false-pass family

These must now fail:

- standing only with blended-assisted shallow-like signal
- sway / small movement contaminated by blended-assisted arming
- extremely early peak-anchor shallow-like signal with no event-cycle rescue
- primary depth near-zero but blended depth appears shallow enough to pass

Expected:

- no final pass
- explicit blocker reason
- no latch

### Matrix B — preserved legitimate paths

These must still pass:

- `shallow_92deg`
- `ultra_low_rom_92deg`
- deep standard full cycle
- legitimate same-rep shallow down-up with recovery-owned ascent

### Matrix C — previously locked false-pass families remain blocked

These must stay blocked:

- no-early-pass family
- trajectory short-cycle false pass
- setup-series-start false pass
- peak-anchor contamination family
- all previously permanent proof-gate families

---

## 11. Required smoke / proof additions

This PR is incomplete unless it adds executable proof for the new contaminated family.

### Required new smoke behavior

The new smoke must prove all of the following:

1. the contaminated signature fixture would have been pass-like without the new blocker
2. with the blocker in place, final pass is denied
3. the blocker reason is explicit and stable
4. representative shallow fixtures still pass
5. deep standard still passes

### Required proof-gate update

`scripts/camera-pr-f-regression-proof-gate.mjs` must include the new smoke.

Reason:
this is now a known regression family and must become permanent proof, not ad hoc manual knowledge.

---

## 12. Hard prohibitions

Reject the PR immediately if any of the following happens:

- broad threshold retune
- PR-F recovery rollback
- completion-state becomes a broad owner veto again
- blended source is banned globally
- representative shallow permanence regresses
- fixture geometry is rewritten just to make the new blocker look green
- existing smoke assertions are weakened
- the new blocker is keyed off one shallow-like field instead of a compound contaminated signature

---

## 13. Acceptance criteria

This PR is complete only if all are true:

1. standing/sway contaminated signature no longer opens pass on device/preview
2. representative shallow permanence remains intact
3. deep standard remains intact
4. the new blocker reason is observable in debug output
5. the new contaminated false-pass family is covered by smoke
6. the PR-F proof gate includes that smoke
7. the diff remains narrow and explainable

---

## 14. Not the job of this PR

This PR does **not** fix real shallow under-pass.

Specifically, it does not retune or solve:

- `descent_span_too_short`
- `ascent_recovery_span_too_short`

That is the next PR after this one.
The order must stay:

1. block contaminated false pass
2. then retune legitimate shallow under-pass

If that order is reversed, the repo risks reopening permissive pass again.

---

## 15. One-line lock

**Add one narrow squat final-pass blocker that rejects only the blended/fallback + very-early-peak contaminated false-pass signature, while preserving PR-F legitimate shallow recovery, representative permanence, and every previously locked regression family.**
