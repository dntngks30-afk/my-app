# DESCENT-TRUTH-RESET-01 SSOT
Date: 2026-04-04
Repo: dntngks30-afk/my-app
Locked main baseline: `e55ac17b8e56c657d056ca84e64cf954e69490f6`

## 0. Why this reset exists
PASS-WINDOW-RESET-01 improved pass-window and baseline ownership, but real-device truth still shows zero squat success. The latest Ask report found that the remaining bottleneck is **descent truth split-brain**, not pass authority ownership itself. The current repo allows one layer to say descent happened while another still says descent span is zero, weak, or too short. This prevents shallow real reps from closing even when reversal and standing recovery later appear.

The Ask report established these facts:
- `descendConfirmed` can become true in completion-state while event-cycle still reports `descentFrames = 0` and `descentDetected = false`.
- `detectSquatEventCycle()` uses a stricter and separate descent definition (`rel > prevRel + 0.002`, `descentFrames >= 3`, `descentExcursion >= 0.022` or strict structural fallback).
- `computeBlockedAfterCommitment()` in completion-state can flip from `no_reversal` to `descent_span_too_short` on the same real shallow rep as rescue/reversal evidence changes.
- `pass_snapshot` remains null because final exported observability does not expose whether `squatPassCore.passDetected` stayed false or whether final UI gating blocked the pass edge.

Therefore the next reset boundary is:
- **DESCENT-TRUTH-RESET-01**
- **PASS-SNAPSHOT-OBSERVABILITY-RESET-01**

These two boundaries are the minimum required next step.

---

## 1. Product law (hard lock)

### 1.1 Pass law
A squat passes if and only if one same rep contains:
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
- ascent-only / mid-rise without prior meaningful descent
- seated / bottom-only without standing recovery
- setup camera reposition / phone tilt / framing translation
- single-frame jitter spike
- micro-bounce / too-fast fake dip
- unrelated motion
- cross-rep stitched fake cycle

### 1.4 Separation law
Pass and interpretation are fully separated.
Pass answers only:
- “Did one real squat rep happen?”

Interpretation answers only:
- shallow / low / standard / deep
- quality tier
- warnings
- explanation / copy / policy / UI

Interpretation must never revoke a valid pass.

---

## 2. Root cause lock
The current remaining failure is **not** primarily pass-window ownership anymore.
The current remaining failure is that **descent truth is defined differently in multiple layers**.

Current split-brain pattern:
- completion-state descent truth:
  - `descendConfirmed = (descentFrame != null || eventBasedDescentPath) && armed`
  - `effectiveDescentStartFrame` may be trajectory-based
- event-cycle descent truth:
  - `descentFrames` counts only pre-peak steps where `rel > prevRel + 0.002`
  - `descentDetectedByRule` requires `descentFrames >= 3 && descentExcursion >= 0.022`
  - structural fallback still requires additional pre/post/step/excursion conditions
- completion blocker truth:
  - `computeBlockedAfterCommitment()` can still return `no_reversal` or `descent_span_too_short`
  - the same rep is re-evaluated after reversal rescue / bridge / backfill changes

Result:
- one layer says descent happened
- another says descent span is zero
- the final blocker family oscillates across the same real shallow rep
- pass never opens reliably

Therefore the next reset must unify descent truth ownership.

---

## 3. New authority model

### 3.1 One pass writer
Only one module may open motion pass truth:
- `src/lib/camera/squat/pass-core.ts`

### 3.2 Zero revokers
After `pass-core` returns `passDetected=true`, no downstream module may set motion truth to false.

### 3.3 One descent truth owner
A new motion-only descent truth owner must be introduced.
Recommended path:
- `src/lib/camera/squat/squat-descent-truth.ts`

This module must be the single owner of:
- whether meaningful descent happened
- descent start timestamp
- descent peak timestamp
- descent frame count (motion-owned)
- descent excursion
- descent blocked reason

No other module may invent its own authoritative descent definition.

---

## 4. DESCENT-TRUTH-RESET (new rule)

### 4.1 New shared descent truth contract
Create a single motion-only descent truth contract.
Its job is only:
- read pass-window-owned frames
- derive one descent epoch
- derive one peak anchor
- derive one descent frame count / excursion summary
- emit a single blocked reason when descent is insufficient

This contract must be consumed by:
- pass-core
- completion-state timing/blocker logic
- event-cycle observability

### 4.2 Forbidden duplicate descent authority
The following may no longer act as separate authoritative descent owners:
- completion-state local `descendConfirmed` logic as final authority
- event-cycle local `descentFrames` rule as final authority
- structural fallback-only descent invention
- `phaseHint === 'descent'` alone as final motion authority

They may remain as trace hints, but not as competing truths.

### 4.3 Required descent truth outputs
The shared descent truth module must produce, at minimum:
- `descentDetected: boolean`
- `descentStartAtMs: number | null`
- `peakAtMs: number | null`
- `peakIndex: number | null`
- `descentFrameCount: number`
- `descentExcursion: number`
- `descentBlockedReason: string | null`
- `trace: string`

### 4.4 Shallow descent compatibility law
A shallow real rep around ~0.05–0.08 relative depth must not fail merely because per-frame increments are smooth and small after smoothing/blending.
A shallow real rep must still be recognized as having descent if the overall pre-peak movement is meaningful within one same rep.

### 4.5 Peak tie law
Earliest-equal-max anchoring must not collapse descent truth.
If a shallow rep plateaus near the peak, the chosen peak anchor must still preserve a valid pre-peak descent window.

---

## 5. Completion-state demotion
`src/lib/camera/squat/squat-completion-state.ts` must stop owning an independent descent truth.
It may continue to own:
- interpretation/debug surfaces
- canonical shallow contract traces
- blocked reason packaging
- quality helpers

But it must consume the shared descent truth for:
- `descendConfirmed`
- descent timing gates
- `descent_span_too_short`
- reversal preconditions tied to descent epoch

Completion-state may no longer disagree with the shared descent truth on whether descent existed.

---

## 6. Event-cycle demotion
`src/lib/camera/squat/squat-event-cycle.ts` must stop inventing an independent authoritative descent truth.
It may continue to emit:
- event-cycle notes
- band / source / debug surfaces
- reversal/recovery observability

But its `descentFrames`, `descentDetected`, and `descent_weak` must be derived from or aligned to the shared descent truth.

Event-cycle must not say `descentFrames = 0` while the shared descent truth has already established a meaningful descent epoch for the same rep.

---

## 7. pass-core law after this reset
`pass-core.ts` remains the single pass writer.
After this reset, pass-core must consume the shared descent truth instead of independently inferring descent from raw thresholds alone.

Pass opens only if all are true in one same rep:
1. readiness clear
2. pass-window baseline established
3. shared descent truth detected
4. peak latched / anti-spike clear
5. meaningful reversal after that peak
6. standing recovery after that reversal
7. same-rep ownership clear
8. setup-safe window clear

---

## 8. PASS-SNAPSHOT-OBSERVABILITY-RESET (new rule)

### 8.1 Current observability gap
`pass_snapshot` currently freezes only on the first false→true edge of `finalPassEligible`.
If that edge never occurs, exported JSON cannot distinguish:
- pass-core never opened
- pass-core opened but UI gate blocked
- final gate edge logic never fired

### 8.2 Required new observability
The exported camera JSON must directly expose at least:
- `squatPassCore.passDetected`
- `squatPassCore.passBlockedReason`
- `squatPassCore.descentDetected`
- `squatPassCore.descentStartAtMs`
- `squatPassCore.peakAtMs`
- `squatPassCore.reversalAtMs`
- `squatPassCore.standingRecoveredAtMs`
- `squatUiGate.uiProgressionAllowed`
- `squatUiGate.uiProgressionBlockedReason`
- `finalPassEligible`

### 8.3 New export law
If pass-core never opens, JSON must clearly say so.
If pass-core opens but final UI edge is blocked, JSON must clearly say so.
No more ambiguous `pass_snapshot = null` without decisive owner truth fields.

---

## 9. Required architectural changes

### 9.1 New shared descent truth module
Create a new module whose only job is to derive descent truth from the pass window.
Recommended path:
- `src/lib/camera/squat/squat-descent-truth.ts`

### 9.2 `pass-core.ts`
Must consume shared descent truth instead of owning an isolated descent definition.
Must not rely on an independent descent rule that can drift away from completion/event-cycle.

### 9.3 `squat-completion-state.ts`
Must consume shared descent truth for descent existence and descent timing.
Must not keep a separate authoritative descent definition.

### 9.4 `squat-event-cycle.ts`
Must consume or align to shared descent truth.
It may not continue to output `descentFrames = 0` for a rep already recognized as meaningful descent by the shared descent truth.

### 9.5 Observability/export files
The camera session/export layer must expose pass-core + UI gate truth directly.
Expected touch points include:
- `camera-observability-squat-session.ts`
- `camera-trace.ts`
- any call site that freezes or exports `pass_snapshot`

---

## 10. Real-device truth priority
Synthetic smoke tests are not final truth for this issue.
The final truth is real-device JSON.

Allowed automated verification scope:
- single-writer check
- zero-revoker check
- one shallow fixture
- one deep fixture
- one standing-only blocked fixture
- one setup-motion blocked fixture
- one observability export check

Disallowed validation claim:
- “resolved” based on smoke only

Success may only be claimed after real-device JSON shows:
- shallow valid rep passes without deep drift
- deep valid rep passes
- no standing/setup/jitter false pass
- exported JSON clearly shows pass-core truth and UI gate truth

---

## 11. Acceptance matrix

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

### Must be directly observable in JSON
- pass-core passDetected
- pass-core passBlockedReason
- pass-core descentDetected
- UI gate allowed / blocked reason
- finalPassEligible

---

## 12. Immediate stop conditions for implementation
Stop the implementation and report before continuing if any of these is true:
- pass-core still owns an independent descent truth separate from the new shared module
- completion-state still computes an authoritative descent truth in parallel
- event-cycle still computes an authoritative descent truth in parallel
- exported JSON still cannot distinguish pass-core false vs UI gate false
- any downstream module can still revoke passDetected

---

## 13. Immediate success definition
This reset is successful only if all are true:
- one shared descent truth owner exists
- pass-core consumes that shared descent truth
- completion-state consumes that shared descent truth
- event-cycle consumes or aligns to that shared descent truth
- shallow valid rep no longer dies on `descentFrames = 0` / `descent_weak` split-brain
- pass-core truth is directly visible in exported JSON
- UI gate truth is directly visible in exported JSON
- downstream revoker count remains zero
