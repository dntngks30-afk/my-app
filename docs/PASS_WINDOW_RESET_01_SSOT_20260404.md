# PASS-WINDOW-RESET-01 SSOT
Date: 2026-04-04
Repo: dntngks30-afk/my-app
Locked main baseline before this SSOT: `370f961fc27d15210dbaf17a718468a9f5882561`

## 0. Why this reset exists
PASS-AUTHORITY-RESET-02 made `pass-core.ts` independent from `completionSatisfied`, but real-device truth still shows shallow squats failing repeatedly with blockers such as:
- `freeze_or_latch_missing`
- `no_reversal`
- `ascent_recovery_span_too_short`
- `series_too_short`

The Ask analysis established the core reason:
`pass-core` is independent **by code**, but not independent **in practice**, because it still consumes an upstream-owned frame window (`completionFrames`) and an upstream-owned baseline (`state.baselineStandingDepth`).

Therefore the next reset is not a threshold tweak. It is:
- **PASS-WINDOW-RESET**
- **BASELINE-OWNERSHIP-RESET**

These two boundaries are the minimal required reset.

---

## 1. Product law (hard lock)

### 1.1 Pass law
A squat passes **if and only if** one same rep contains:
1. meaningful descent
2. meaningful reversal / ascent
3. standing recovery

### 1.2 Easy-pass law
If the above three happen in the same rep, pass must open quickly and reliably.
Target behavior under stable capture:
- shallow real squat: 10/10 pass
- deep real squat: 10/10 pass

### 1.3 Never-pass law
The following must never pass:
- standing only
- still descending
- ascent without prior meaningful descent
- seated / mid-rise without standing recovery
- too-fast micro-bounce
- single-frame jitter spike
- unrelated motion
- setup camera reposition / phone tilt / framing translation
- cross-rep stitched fake cycle
- peak/reversal from one rep and standing recovery from another

### 1.4 Separation law
Pass and interpretation are fully separated.

Pass answers only:
- "Did one real squat rep happen?"

Interpretation answers only:
- shallow / low / standard / deep
- quality tier
- warnings
- copy / explanation / policy / UI

Interpretation must never revoke a valid pass.

---

## 2. Root cause lock
The current repo failure is not primarily a pass-core threshold issue.
The failure is that pass-core receives an upstream-clipped and upstream-biased input.

Current practical dependency chain:
`raw landmarks -> pose features -> validRaw -> readiness dwell clip -> valid -> arming slice -> completionFrames -> completion-state baseline -> passCoreDepthFrames -> pass-core`

This causes real shallow reps to be seen too late or too short:
- peak can become first frame (`peakLatchedAtIndex=0`)
- pre-peak descent can disappear (`descentFrames=0`)
- post-peak tail can be too short (`ascent_recovery_span_too_short`)
- whole cycle can be too short (`series_too_short`)

Therefore pass-core must stop consuming `completionFrames` and stop trusting `state.baselineStandingDepth` as motion authority.

---

## 3. New authority model

### 3.1 One pass writer
Only one module may open motion pass truth:
- `src/lib/camera/squat/pass-core.ts`

### 3.2 Zero revokers
After `pass-core` returns `passDetected=true`, no downstream module may set motion truth to false.
Not evaluator.
Not policy.
Not auto-progression.
Not canonical shallow contract.
Not UI latch.

### 3.3 New upstream ownership
Two things move under pass authority ownership:
1. pass window ownership
2. baseline ownership

---

## 4. PASS-WINDOW-RESET (new rule)

### 4.1 New pass input source
`pass-core` must no longer read `completionFrames`.
It must read a dedicated pass window built directly from the post-readiness raw motion stream.

Allowed upstream source:
- `validRaw` after minimum validity filtering
- or a dedicated `passWindowFrames` built directly from `validRaw`

Forbidden pass input source:
- `completionFrames`
- `naturalCompletionFrames`
- anything whose start/end is determined by completion-state attempt logic
- any window whose start is owned by `computeSquatCompletionArming()`

### 4.2 Pass window builder requirements
Create a dedicated window builder whose only job is to hand pass-core an unbiased motion window.
This builder must:
- start before meaningful descent begins
- include full descent
- include peak
- include reversal
- include standing recovery tail
- not start at the peak
- not end before standing recovery is observable
- not depend on canonical shallow contract
- not depend on completion satisfied / blocked reasons

### 4.3 Setup handling inside pass window
Setup motion must not be bypassed simply because a cycle later looks complete.
If setup motion is active during the pre-rep / framing-adjustment phase, pass must stay closed.
A pass may only open after a stable ready segment and a full same-rep cycle after that segment.

---

## 5. BASELINE-OWNERSHIP-RESET (new rule)

### 5.1 Baseline ownership transfer
`pass-core` may no longer trust `state.baselineStandingDepth` as final motion authority.
It may accept it as trace-only reference during transition, but the final pass decision must use a baseline owned by the same pass window.

### 5.2 New baseline law
The baseline used for pass must come from a stable standing subsegment inside the pass window or its dedicated prelude.
That baseline must be:
- locally computed for the same window
- before the meaningful descent of the rep
- not taken from a shallow ramp that still looks like standing
- not inherited from completion-state freeze ownership

### 5.3 Baseline failure handling
If a clean standing baseline cannot be established, pass must remain blocked with a dedicated pass-core reason.
This is better than using a contaminated baseline.

---

## 6. New pass-core contract

### 6.1 Allowed inputs
Pass-core may use only motion-structural facts it owns or that are pass-window-owned:
- pass window frames with depth + timestamps
- pass-window-owned baseline
- readiness / setup-clear signal
- optional trace hints (read-only, non-authoritative)

### 6.2 Forbidden inputs as authority
The following may not participate in final pass authority:
- `completionSatisfied`
- `completionPassReason`
- `completionBlockedReason`
- `completionFrames`
- canonical shallow contract result
- `official_shallow_cycle`
- `low_rom_cycle`
- `ultra_low_rom_cycle`
- ultra-low policy result
- interpretation / quality labels
- completion-state-owned baseline as final truth

### 6.3 Hard pass criteria
Pass opens only if all are true in one same rep:
1. readiness clear
2. pass-window baseline established
3. meaningful descent
4. peak latched (anti-spike)
5. meaningful reversal after that peak
6. standing recovery after that reversal
7. same-rep ownership clear
8. anti-false-pass timing clear
9. setup-safe window clear

### 6.4 Hard never-pass criteria
Pass must block when any of these is true:
- no baseline
- no meaningful descent
- peak at first frame / missing pre-peak evidence
- no reversal after peak
- no standing recovery
- cycle too short
- spike-only pattern
- setup contamination
- same-rep ownership broken

---

## 7. Required state machine
Pass-core must be the owner of a minimal motion-only state machine:
- `WAIT_READY`
- `WAIT_BASELINE`
- `WAIT_DESCENT`
- `PEAK_LATCHED`
- `WAIT_REVERSAL`
- `WAIT_STANDING_RECOVERY`
- `PASS_OPEN`

No downstream module may transition out of `PASS_OPEN` back to failure.

---

## 8. Required architectural changes

### 8.1 `src/lib/camera/squat/pass-core.ts`
Must remain the single pass writer, but its inputs must be replaced with pass-window-owned inputs.
It must not depend on completion-state-owned window or baseline.

### 8.2 New dedicated pass-window builder
Create a new module whose job is only:
- derive pass-window frames from raw valid motion stream
- preserve pre-peak and post-peak coverage
- expose explicit reasons if a usable pass window cannot be built

Recommended path shape:
- `src/lib/camera/squat/pass-window.ts`

### 8.3 Evaluator change
`src/lib/camera/evaluators/squat.ts` must stop passing `completionFrames` into pass-core.
Instead it must:
- build `passWindowFrames` from upstream valid motion stream
- build or request pass-window-owned baseline
- call pass-core with those
- keep completion-state for interpretation/debug only

### 8.4 Completion-state demotion
`src/lib/camera/squat-completion-state.ts` becomes interpretation/debug producer only.
It may continue to generate:
- canonical shallow traces
- event-cycle traces
- blocked reasons for interpretation
- quality helpers
But it may not own pass window or pass baseline.

---

## 9. Real-device truth priority
Synthetic smoke tests are not the final truth for this problem.
The final truth is real-device JSON.

Allowed automated verification scope:
- single-writer check
- zero-revoker check
- one shallow fixture
- one deep fixture
- one standing-only block fixture
- one setup-motion block fixture

Disallowed validation claim:
- "resolved" based on smoke only

Success may only be claimed after real-device JSON shows:
- shallow valid rep passes without deep drift
- deep valid rep passes
- no standing/setup/jitter false pass

---

## 10. Acceptance matrix

### Must pass
- shallow real rep around ~0.05–0.08 relative depth band
- moderate rep
- deep rep
- low-quality but real rep, if the same-rep cycle is complete

### Must never pass
- standing only
- descent only
- still descending
- seated without recovery
- jitter spike
- micro-bounce
- setup reposition / framing translation
- unrelated motion
- cross-rep stitched motion

---

## 11. Immediate stop conditions for implementation
Stop the implementation and report before continuing if any of these is true:
- pass-core still reads `completionFrames`
- pass-core still uses completion-state baseline as final authority
- evaluator cannot provide a wider pass window than completionFrames
- setup bypass remains in pass authority path
- any downstream module can still revoke passDetected

---

## 12. Immediate success definition
This reset is successful only if all are true:
- pass-core is the only pass writer
- pass-core input window is no longer upstream completion-sliced
- pass baseline is pass-window-owned
- shallow valid rep passes without needing deep/standard drift
- deep valid rep still passes
- setup / standing / jitter / partial / unrelated motion remain blocked
- downstream revoker count is zero
