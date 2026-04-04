# REVERSAL-STANDING-RESET-01 Truth Map
Date: 2026-04-04
Repo baseline: local HEAD reported in Ask = `7aece3c7844c958be38d28db28876e1de992944a`

## 0. Why this reset exists
Recent real-device false passes show shallow squats passing at descent/bottom timing, which is explicitly forbidden by product law. In the exported diagnostics, pass-core can return `passDetected=true` while completion-side still reports `completionBlockedReason="no_reversal"`, `reversalConfirmedAfterDescend=false`, `recoveryConfirmedAfterReversal=false`, and the visible phase remains around bottom/downward commitment. Yet final pass still opens because pass-core is the motion owner and downstream no longer vetoes it. The Ask report isolates the cause to weak post-peak logic inside `pass-core.ts`: reversal and standing recovery can both be satisfied by the same post-peak collapse frame or collapse segment, with no minimum upward span, no minimum reversal frames, and no minimum standing hold after actual ascent.

Therefore the next reset boundary is:
- **REVERSAL-TRUTH-RESET-01**
- **STANDING-RECOVERY-RESET-01**

These two boundaries must be implemented together.

---

## 1. Product law (hard lock)

### 1.1 Pass law
A squat passes **if and only if** one same rep contains, in order:
1. meaningful descent
2. meaningful reversal / ascent
3. standing recovery

### 1.2 Never-pass law
The following must never pass:
- standing only
- descent only
- bottom arrival only
- bottom jitter / depth collapse
- single-frame spike
- post-peak one-frame rebound without a real upward segment
- same-frame reversal + standing recovery
- setup motion / framing motion
- unrelated motion
- cross-rep stitched motion

### 1.3 Separation law
Pass and interpretation remain separated.
Interpretation may classify quality / ROM / warnings, but it may not revoke a valid pass.
However, pass-core itself must satisfy the product law before opening pass.

---

## 2. Locked root cause
The false pass is not primarily caused by guardrail anymore.
The current false pass is caused by weak post-peak proof inside `evaluateSquatPassCore(...)`:

1. **Reversal is too weak**
   - `reversalDropRequired = relativePeak * 0.20`
   - a single post-peak frame meeting this drop is enough

2. **Standing recovery is too weak**
   - `standingThreshold = baseline + relativePeak * 0.40`
   - the scan starts at `fullReversalIndex`
   - the first frame at or below threshold is enough

3. **Same-frame / same-collapse path is currently legal**
   - reversal and standing can both be satisfied by the same frame or same collapse segment
   - no minimum post-peak ascent span is required
   - no minimum reversal frames are required
   - no minimum standing hold after real ascent is required

This directly violates the product law because “meaningful upward movement” is not actually required.

---

## 3. New authority contract

### 3.1 Pass-core remains the single pass writer
`src/lib/camera/squat/pass-core.ts` remains the only motion pass writer.
No downstream revoker is reintroduced.

### 3.2 But pass-core must now prove post-peak structure
Pass-core may not open pass merely because a post-peak scalar depth value fell enough.
Pass-core must prove:
- real reversal began after the peak
- the reversal persisted for a minimum structural span
- standing recovery happened after that reversal span
- standing recovery remained stable for a minimum hold / frame count

### 3.3 Completion-side may disagree, but false pass is still forbidden
Completion-state disagreement is no longer the final owner.
However, pass-core must itself be strengthened so that completion-side “no_reversal” is no longer paired with a user-visible pass in these shallow false-pass cases.

---

## 4. REVERSAL-TRUTH-RESET-01

### 4.1 New reversal law
Reversal may not be satisfied by one frame crossing a scalar drop threshold.
Reversal must require **post-peak upward structure**.

### 4.2 Required reversal conditions
A valid reversal must satisfy all of the following:
- starts strictly after the peak frame
- uses at least a minimum number of post-peak frames
- shows monotonic or majority-upward depth movement over a minimum span
- exceeds a minimum relative depth change from the peak
- cannot be satisfied by the same frame that first qualifies standing recovery

### 4.3 Forbidden reversal proofs
These must not count as reversal:
- one-frame drop after peak
- same-frame collapse to near baseline
- one-frame rebound followed by no actual ascent segment
- noisy bottom jitter crossing the reversal threshold once

### 4.4 Trace requirement
Pass-core trace/debug must explicitly expose:
- reversalCandidateStartAtMs
- reversalConfirmedAtMs
- reversalFrameCount
- reversalSpanMs
- reversalSource = structured | blocked
- reversalBlockedReason

---

## 5. STANDING-RECOVERY-RESET-01

### 5.1 New standing recovery law
Standing recovery may not be satisfied on the same frame as reversal confirmation.
Standing recovery must require **post-reversal stable return**.

### 5.2 Required standing conditions
A valid standing recovery must satisfy all of the following:
- starts strictly after reversal has already been confirmed
- uses at least a minimum number of post-reversal frames
- returns to the standing threshold only after the upward segment exists
- stays within standing threshold for a minimum hold or minimum frame count
- cannot use the same frame that first confirmed reversal

### 5.3 Forbidden standing proofs
These must not count as standing recovery:
- same-frame reversal + standing
- one-frame collapse to threshold
- threshold touch with no stable hold
- post-peak jitter that briefly lands under threshold

### 5.4 Trace requirement
Pass-core trace/debug must explicitly expose:
- standingCandidateAtMs
- standingRecoveredAtMs
- standingRecoveryFrameCount
- standingRecoveryHoldMs
- standingRecoveryBlockedReason

---

## 6. Same-frame / same-collapse prohibition
This is a hard lock.

The following must be impossible after this reset:
- `reversalConfirmedAtMs === standingRecoveredAtMs`
- reversal and standing both satisfied by the same depth frame
- reversal and standing both satisfied by the same collapse segment

If reversal and standing collapse into the same proof unit, pass must remain blocked.

---

## 7. Minimal structural gates required in pass-core
Pass-core must keep all prior valid gates (readiness, baseline, descent, anti-setup, same-rep ownership, cycle duration), and additionally require:

1. **Structured reversal gate**
   - minimum post-peak reversal frames
   - minimum post-peak reversal span in ms
   - minimum reversal excursion/travel

2. **Structured standing gate**
   - minimum post-reversal standing frames
   - minimum standing hold ms or frame count
   - no same-frame satisfaction with reversal

3. **Post-peak ordering gate**
   - peak < reversal < standing
   - strict ordering, not equality

---

## 8. Acceptance criteria
This reset is successful only if all are true:
- shallow valid squat still passes when it includes real descent → ascent → standing
- deep valid squat still passes
- descent-only / bottom-only / bottom-collapse no longer pass
- one-frame post-peak drop no longer passes
- same-frame reversal+standing is impossible
- pass-core trace explicitly shows structured reversal and structured standing timing
- downstream revoker count remains zero

---

## 9. Real-device validation checklist
Success may only be claimed after real-device JSON shows all of the following:
- no pass opens while completion-side still visually sits at bottom/downward commitment with no real upward segment
- no pass opens when `reversalConfirmedAfterDescend=false` and `recoveryConfirmedAfterReversal=false` for the same shallow false-pass case
- `pass_snapshot` opens only after a clear post-peak upward segment and a later standing recovery segment
- shallow valid reps still pass after a real ascent
- standing/setup/jitter/bottom-collapse remain blocked

---

## 10. Immediate stop conditions
Stop implementation and report before continuing if any of these is true:
- pass-core still allows reversal and standing on the same frame
- structured reversal cannot be added without widening unrelated architecture scope
- structured standing cannot be added without breaking pass-core ownership
- a downstream module still needs to become a revoker to block this false pass
- the smallest safe fix would require re-coupling final pass to completion-state

