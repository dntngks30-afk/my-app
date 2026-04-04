# GUARDRAIL-DECOUPLE-RESET-01 — FINAL TRUTH MAP
Date: 2026-04-04
Basis:
- Ask report on current HEAD `722dba628acf545ac856f9823d313eb8afd03b3d`
- Real-device export showing shallow squat `squatPassCore.passDetected=true` while final pass remains blocked

## 0. One-line diagnosis
The current bottleneck is no longer shallow motion detection.
The bottleneck is that **guardrail still owns a second motion-completion veto**, so a shallow squat can already be accepted by `pass-core` but still fail user-visible final pass with `guardrail_not_complete`.

---

## 1. Locked product law
A squat must pass if and only if one same rep contains:
1. meaningful descent
2. meaningful reversal / ascent
3. standing recovery

If those three occur in the same rep, shallow and deep squats must both pass reliably.

The following must never pass:
- standing only
- still descending
- ascent only / partial mid-rise
- seated without recovery
- setup camera reposition / framing translation / phone tilt
- jitter spike / single-frame spike
- unrelated motion
- cross-rep stitched fake cycle

Interpretation / quality / policy / UI must never revoke a valid motion pass.

---

## 2. Current proven reality
The latest real-device export proves a new state:
- `squatPassCore.passDetected = true`
- `squatPassCore.passBlockedReason = null`
- `squatUiGate.uiProgressionAllowed = false`
- `squatUiGate.uiProgressionBlockedReason = "guardrail_not_complete"`
- `finalPassEligible = false`
- `pass_snapshot = null`

Therefore:
- shallow squat motion pass is already being detected in some reps
- user-visible final pass still does not open
- the remaining owner is not pass-core
- the remaining owner is the guardrail/UI gate chain

---

## 3. Current ownership map (broken)
Current chain:

`runEvaluator('squat')`
→ `EvaluatorResult.debug.squatPassCore`
→ `assessStepGuardrail()`
→ `guardrail.completionStatus`
→ `getSquatProgressionCompletionSatisfied()`
→ `computeSquatUiProgressionLatchGate()`
→ `progressionPassed`
→ `finalPassEligible`

The key bug is that two separate motion owners still exist:

### Owner A — pass-core
`EvaluatorResult.debug.squatPassCore.passDetected`
This is the new motion pass truth.

### Owner B — guardrail/completion legacy chain
`guardrail.completionStatus === 'complete'`
This is still derived from legacy squat completion truth:
- `highlightedMetrics.completionSatisfied`
- which still reflects completion-state completion truth
- not pass-core motion truth

As a result, pass-core can say “motion pass succeeded” while guardrail says “motion not complete”, and UI still trusts guardrail.

---

## 4. Exact broken points

### 4.1 Broken point A — guardrail squat completeness source
`guardrails.ts:getMotionCompleteness('squat', ...)`
currently decides squat `motion.status` from legacy `highlightedMetrics.completionSatisfied`.

This means:
- if completion-state does not mark `completionSatisfied=true`
- then guardrail stays `partial`
- then `guardrail.completionStatus !== 'complete'`
- even if `squatPassCore.passDetected === true`

### 4.2 Broken point B — early gate dependency in progression reader
`auto-progression.ts:getSquatProgressionCompletionSatisfied(...)`
early returns `satisfied:false` when `guardrail.completionStatus !== 'complete'`.

That means the squat progression reader still treats guardrail completeness as required before accepting pass-core.

### 4.3 Broken point C — final UI gate veto
`auto-progression.ts:computeSquatUiProgressionLatchGate(...)`
blocks with `guardrail_not_complete` when `guardrailCompletionComplete !== true`.

This is the user-visible failure reason.

### 4.4 Broken point D — final pass still depends on UI gate
`auto-progression.ts:evaluateExerciseAutoProgress(...)`
for squat, final pass is:

`progressionPassed = squatOwnerTruth.completionOwnerPassed && squatUiGate.uiProgressionAllowed`

So even after pass-core motion pass opens, UI gate still vetoes final pass.

---

## 5. Root cause
The repo still has **two motion completion authorities**:
1. `pass-core` (new)
2. `guardrail/completionSatisfied` (legacy)

The second one still has veto power over final user-visible pass.

This violates the intended architecture:
- pass-core should own motion pass
- guardrail should be a safety/quality/framing consumer only
- UI gate should not re-judge motion completion using legacy completion state

---

## 6. What must change
This reset is not another descent reset.
This reset is:
- **GUARDRAIL-DECOUPLE-RESET-01**
- optionally followed by a small **FINAL-PASS-GATE-ALIGN** inside the same PR if needed

### 6.1 New ownership law
For squat only:
- motion pass owner = `squatPassCore.passDetected`
- guardrail must not own or redefine squat motion completeness
- guardrail may still report framing / validity / setup / quality / hints
- but not a second motion-completion verdict

### 6.2 New guardrail law
For squat, `guardrail.completionStatus` must not be sourced from legacy `highlightedMetrics.completionSatisfied`.
It must either:
- be aligned to pass-core motion truth
- or be removed from the final pass chain for squat

### 6.3 New final-pass law
Final user-visible squat pass must not require both:
- pass-core motion truth
- legacy guardrail completion truth

There may be only one motion-completion owner.

### 6.4 Allowed remaining UI blockers
Only non-motion blockers may remain downstream, such as:
- capture quality invalid
- hard framing invalid
- setup motion active before ready
- pass confirmation latch not ready

But `guardrail_not_complete` based on legacy squat completion must be removed from the final squat path.

---

## 7. New target architecture
For squat only:

`runEvaluator('squat')`
→ `squatPassCore.passDetected` (single motion owner)
→ minimal UI latch / safety checks
→ `finalPassEligible`
→ snapshot/export

Guardrail stays on a separate lane:
- capture quality
- framing
- insufficient signal
- setup hints
- retry guidance
- quality interpretation

Guardrail does not own squat motion completion anymore.

---

## 8. Never-pass protection after decouple
Removing `guardrail_not_complete` from the final squat path must NOT allow false passes.
Those protections must still come from:
- pass-core same-rep ownership
- pass-core descent/reversal/recovery structure
- pass-core anti-spike timing
- setup motion law
- capture quality invalid / framing invalid hard blockers
- pass confirmation latch if explicitly kept

So decoupling guardrail does not mean making pass easier by cheating.
It means stopping a legacy duplicate motion veto.

---

## 9. Acceptance criteria
This reset is successful only if all are true:
1. shallow squat can reach final user-visible pass when `squatPassCore.passDetected=true`
2. deep squat still passes
3. standing/setup/jitter/partial/unrelated motion still never pass
4. guardrail no longer vetoes squat final pass through legacy `completionSatisfied`
5. user-visible final pass has only one motion-completion owner
6. `pass_snapshot` becomes non-null on valid shallow pass
7. exported JSON clearly shows whether final block is motion or non-motion

---

## 10. Immediate stop conditions
Stop and report before implementation if any of these are true:
- another hidden final squat motion veto exists besides guardrail/UI gate
- pass-core success still depends on legacy completion-state fields in practice
- removing guardrail completion from the squat final path would also remove hard framing/setup invalid blocks
- a separate PR is required just to preserve never-pass cases

---

## 11. Implementation boundary
The minimum reset boundary is:
**GUARDRAIL-DECOUPLE-RESET-01**

Optional same-PR alignment if needed:
**FINAL-PASS-GATE-ALIGN-01**

But the core truth is fixed:
The current failure is not that shallow squat cannot pass.
The current failure is that shallow squat can already pass in pass-core, but a legacy guardrail completion veto still blocks final user-visible pass.
