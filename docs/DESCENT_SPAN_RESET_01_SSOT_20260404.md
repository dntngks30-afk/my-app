# DESCENT-SPAN-RESET-01 SSOT
Date: 2026-04-04
Repo: dntngks30-afk/my-app

## 0. Why this reset exists
Recent real-device validation produced two truths at the same time:

1. Good shallow passes now exist.
   - The first shallow attempts in some sessions passed only after a meaningful descent -> reversal/ascent -> standing recovery.
   - The new post-peak reversal/standing structure appears to be working in those cases.

2. Early shallow false passes still remain.
   - Later shallow attempts in the same validation run passed too early.
   - Device logs show `completionBlockedReason = "descent_span_too_short"` while `squatPassCore.passDetected = true` and `finalPassEligible = true`.
   - This proves the remaining bottleneck is no longer same-frame reversal+standing.
   - The remaining bottleneck is **pre-peak descent span ownership**.

Therefore this PR must NOT re-open the old reversal/standing false-pass bug.
It must only fix the remaining early-pass bug:

**A squat must not pass when the pre-peak descent span is too short, even if post-peak structure looks valid.**

---

## 1. Product law (hard lock)

### 1.1 Pass law
A squat passes if and only if one same rep contains:
1. meaningful descent
2. meaningful reversal / ascent
3. standing recovery

### 1.2 Preserve-good-pass law
The newly recovered good shallow passes must remain possible.
Do not block shallow reps that genuinely show:
- real descent
- real post-peak ascent/reversal
- real standing recovery

This reset is **not** allowed to make the good first-attempt shallow passes fail again.

### 1.3 Never-pass law
The following must never pass:
- standing only
- descent only
- bottom arrival only
- bottom jitter / bottom hold without enough pre-peak descent span
- early peak with too-short pre-peak descent
- setup motion
- unrelated motion
- spike/jitter

---

## 2. Root cause lock
The remaining split-brain is:

- completion-state owns a shallow timing gate named `descent_span_too_short`
- pass-core does not consume that timing truth
- shared descent truth currently allows descent with:
  - `relativePeak >= MIN_SHARED_DESCENT_RELATIVE_PEAK`
  - `descentFrameCount >= 1`
- therefore a shallow rep can have:
  - very short pre-peak descent
  - peak latched extremely early
  - valid-looking post-peak reversal/standing
  - pass-core pass = true
  - completion blocked reason = `descent_span_too_short`

That is the exact remaining false-pass class.

---

## 3. Scope boundary (hard lock)
This PR is narrow.
It exists only to block **early shallow passes caused by too-short pre-peak descent span**.

### Allowed scope
- `src/lib/camera/squat/squat-descent-truth.ts`
- `src/lib/camera/squat/pass-core.ts`
- minimal tests directly related to descent span / early peak
- docs for this SSOT

### Forbidden scope
- do not change guardrail ownership again
- do not reopen guardrail veto in final pass
- do not weaken reversal/standing structured requirements added by REVERSAL-STANDING-RESET-01
- do not add new downstream revokers
- do not turn completion-state back into final motion owner
- do not touch unrelated UI / camera funnel files

---

## 4. New authority rule
### 4.1 Pre-peak descent must be authoritative for pass
`pass-core` may not open pass unless pre-peak descent span itself is sufficiently meaningful.

### 4.2 Shared descent truth must expose this explicitly
Shared descent truth must own and expose a pass-relevant pre-peak span contract.
At minimum it must provide enough truth for pass-core to know:
- how many pre-peak frames existed
- how long pre-peak descent lasted in ms
- whether pre-peak descent satisfies the minimum meaningful span contract

### 4.3 Completion and pass-core must stop disagreeing on this axis
We are **not** making pass-core read completionBlockedReason.
Instead, pass-core and completion must align on the same geometric/time evidence for the specific question:

**Was the pre-peak descent long enough to count as meaningful descent?**

---

## 5. Minimal reset boundary
This reset is:
- **DESCENT-SPAN-RESET-01**

Optional secondary alignment allowed only if absolutely necessary:
- **PEAK-LATCH-ALIGN-01**

But the primary truth boundary is DESCENT-SPAN.

---

## 6. Required behavioral outcome

### Must keep working
The good shallow passes from validation sessions 1 and 2 must still pass.
These are the preserved success class:
- shallow rep
- meaningful descent before peak
- structured post-peak reversal
- structured standing recovery
- no setup contamination

### Must now be blocked
The later false passes from validation sessions 3 and 4 must stop passing.
These are the blocked class:
- shallow rep
- peak happens too early
- pre-peak descent span is too short
- completion would say `descent_span_too_short`
- pass-core must now also stay blocked

---

## 7. Required implementation principles

### 7.1 Do not use completionBlockedReason as authority
Pass-core still must not depend on completion-state verdict fields.
No shortcut like:
- `if completionBlockedReason === 'descent_span_too_short' then fail`

That would re-couple pass authority to completion-state.

### 7.2 Instead, import the same evidence class into shared descent truth / pass-core
The pass path itself must require minimum pre-peak descent span evidence.
Examples of allowed evidence class:
- minimum pre-peak frame count
- minimum descent-start to peak duration in ms
- minimum monotonic pre-peak run requirement
- equivalent pass-window-owned pre-peak span contract

### 7.3 Preserve post-peak improvements
Do not remove or weaken:
- structured reversal frames
- structured standing recovery frames
- same-frame reversal+standing impossibility

This PR is pre-peak only.

---

## 8. Required result semantics

### 8.1 Pass-core may open pass only if all are true
- readiness clear
- baseline clear
- meaningful pre-peak descent span clear
- peak latch clear
- structured reversal clear
- structured standing recovery clear
- same-rep ownership clear
- setup clear

### 8.2 Early shallow pass must now fail with a pass-core-local reason
When the pre-peak descent span is too short, pass-core must stay blocked with a pass-core-local reason.
Do not silently rely on completion's `descent_span_too_short` string.

---

## 9. Real-device truth priority
Automated checks are structural guards only.
Real-device JSON remains the final truth.

### Success may be claimed only if:
- validation cases 1 and 2 still pass
- validation cases 3 and 4 no longer early-pass
- no regression to old same-frame reversal/standing false pass

### Failure if any of these happens:
- the good first-attempt shallow passes stop passing
- early shallow passes still open before meaningful descent is established
- completion/pass-core split-brain on descent span remains unchanged

---

## 10. Minimal automated checks allowed
Only small structural checks are allowed.
Do not build a giant smoke suite.

Allowed:
- one preserved good shallow pass fixture
- one blocked early-peak shallow fixture
- one deep pass fixture
- one standing-only blocked fixture

---

## 11. Immediate stop conditions
Stop and report before continuing if any are true:
- the only way to fix this is to make pass-core consume completionBlockedReason directly
- the good shallow pass class cannot be preserved with a narrow pre-peak change
- reversal/standing logic must be weakened again to make the new fix work
- guardrail/final-pass ownership would need to change again

---

## 12. Acceptance definition
This PR is accepted only if all are true:
- good shallow passes still pass
- early shallow passes caused by too-short pre-peak descent no longer pass
- pass-core remains single motion owner
- no downstream revoker is added
- reversal/standing structural protections remain intact
