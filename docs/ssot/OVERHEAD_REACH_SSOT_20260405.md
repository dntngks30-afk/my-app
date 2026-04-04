# OVERHEAD REACH SSOT — TRUTH MAP (2026-04-05)

Status: Active SSOT for the public camera overhead reach step only.

Scope:
- Motion: `overhead-reach`
- Public camera funnel only
- Goal: lock the pass contract before further fixes

Non-goals:
- Do not redesign squat
- Do not redesign app execution flow
- Do not redesign paid/public result flow
- Do not rewrite camera shell, nav, onboarding, session generation, or `/app`

---

## 1. Product law

MOVE RE overhead reach must follow this law:

**Pass should be easy. Interpretation should be strict.**

That means:

- Pass is opened by a real, meaningful arm raise followed by a short top hold.
- Interpretation quality is stricter than pass.
- Raising the arms alone must never pass.
- Passing during active upward motion must never happen.
- Instant pass at the moment the arms reach the top is not acceptable.
- A short but felt hold is required before pass.

Canonical user-facing contract:

**meaningful rise -> top zone entered -> short hold -> pass**

Target hold feel:
- approximately **1.0s to 1.5s felt by user**
- not 0s
- not “pass while still raising”
- not “pure motion without stabilization”

---

## 2. Current repo findings (must be treated as facts)

Relevant files observed in repo:

- `src/lib/camera/pose-features.ts`
- `src/lib/camera/evaluators/overhead-reach.ts`
- `src/lib/camera/overhead/overhead-completion-state.ts`
- `src/lib/camera/overhead/overhead-easy-progression.ts`
- `src/lib/camera/overhead/overhead-top-hold-fallback.ts`
- `src/lib/camera/guardrails.ts`
- `src/lib/camera/auto-progression.ts`
- `src/lib/camera/camera-trace.ts`
- `src/lib/camera/camera-success-diagnostic.ts`
- `src/app/movement-test/camera/overhead-reach/page.tsx`

Current structure is multi-layered:

1. `pose-features.ts`
   - generates phase hints (`raise`, `peak`, `lower`)
2. `overhead-reach.ts`
   - computes strict completion + fallback + easy + low-ROM + humane-low-ROM progression
3. `guardrails.ts`
   - re-evaluates motion completeness again
4. `auto-progression.ts`
   - decides final pass with confidence, pass confirmation, hard blockers, capture quality
5. page + trace layers
   - snapshot/debug/voice/navigation behavior

This means overhead reach does **not** currently have one single owner of truth equivalent to recent squat pass-core style separation.

---

## 3. Core truth split (must be locked)

### 3.1 Completion truth

Completion truth is motion-only truth.

Completion truth must answer only these questions:
- did a meaningful rise happen?
- did the user enter a valid top zone?
- did the user hold at top long enough?
- what path satisfied completion?
- if blocked, what blocked it?

Completion truth must **not** include:
- confidence threshold
- capture quality invalid vs low
- pass confirmation window
- UI latch
- auto-advance
- retry vs fail routing
- voice playback state

### 3.2 Final pass truth

Final pass truth reads completion truth and adds only UI/runtime gates:
- capture quality invalid block
- hard framing block
- pass confirmation stability
- confidence threshold

Final pass truth must never redefine motion completion.

### 3.3 Interpretation truth

Interpretation truth is quality-only truth.
This is where strictness belongs:
- strict top quality
- asymmetry severity
- compensation severity
- internal quality tier
- planning evidence tier
- fallback vs strict explanation

Interpretation truth must not block a valid easy pass unless an explicit hard safety gate says so.

---

## 4. Canonical overhead pass contract

### 4.1 What must be true for pass

Pass must require:
1. **meaningful rise**
2. **top zone entered**
3. **short hold satisfied**
4. **final runtime gates satisfied**

### 4.2 What must never pass

These are absolute failures:
- standing still / noise only
- arm motion with no meaningful rise proof
- pass while the arm is still actively rising
- pass at first top-touch without hold
- pass from only transient top spikes

### 4.3 Pass vs interpretation

Allowed:
- user passes with a modest but real top hold
- interpretation still labels quality as limited / asymmetrical / compensated

Not allowed:
- strict interpretation thresholds silently becoming pass gates everywhere

---

## 5. Current bottleneck map

Do **not** collapse this to one cause.
The repo currently suggests multiple bottlenecks:

### Bottleneck A — rise proof is fragile
Current repo still depends heavily on `raiseCount` generated from frame deltas.
Slow, smooth upward motion can under-trigger `raiseCount`, which can kill otherwise valid attempts.

### Bottleneck B — fallback is not a true fallback
Current fallback still inherits strict prerequisites like peak-oriented gating, so jitter rescue can fail when strict peak labeling fails.

### Bottleneck C — completion truth is duplicated
Evaluator progression truth and guardrail motion completeness are both deciding “complete vs partial”.
This creates drift.

### Bottleneck D — path-specific hold philosophy is fragmented
Repo currently mixes multiple hold durations across strict/easy/low-ROM/humane-low-ROM. This is not a single product contract.

### Bottleneck E — observability is asymmetrical vs squat
Overhead currently records terminal attempt snapshots and success snapshots, but does not have the same rich mid-attempt observation event stream as squat.
This weakens diagnosis of “never opened completion” vs “completion opened but final pass blocked”.

---

## 6. Mandatory design direction

### 6.1 Introduce a single motion owner
Overhead needs a typed single owner similar in spirit to squat pass-core separation, but scoped only to overhead.

Suggested owner fields:
- `meaningfulRiseSatisfied`
- `riseStartedAtMs`
- `topDetectedAtMs`
- `topStableEnteredAtMs`
- `holdStartedAtMs`
- `holdSatisfiedAtMs`
- `completionSatisfied`
- `completionPath`
- `completionBlockedReason`
- `completionPhase`

### 6.2 Unify progression hold contract
There must be one canonical overhead progression hold contract.
Strict interpretation hold may remain separate.

Rules:
- pass hold and quality hold must be separated conceptually
- path-specific emergency numbers should not keep drifting forever
- pass hold must feel like a real brief stop, not a touch

### 6.3 Make fallback independent enough to rescue real device jitter
Fallback must not depend so heavily on strict peak semantics that it dies when strict labeling dies.

### 6.4 Guardrails and final pass must become read-only consumers
`guardrails.ts` and `auto-progression.ts` should read overhead motion truth, not redefine it.

---

## 7. Protected boundaries (absolute)

### 7.1 Do not touch squat in overhead PRs
Absolute rule for PR-01 through PR-05:
- do not modify squat evaluator logic
- do not modify squat completion-state logic
- do not modify squat pass-core logic
- do not modify squat event-cycle logic
- do not modify squat recovery logic
- do not modify squat thresholds
- do not modify squat observability contracts
- do not modify squat retry/fail/pass contracts

### 7.2 Do not mix public overhead fixes with app execution core
Do not modify:
- `/app/home`
- `/app/checkin`
- `/app/profile`
- session create/execution/adaptive core
- onboarding/payment/claim flow

### 7.3 Do not do broad shared-camera refactors unless strictly required
Shared modules may be touched **only** when the change is overhead-scoped and proven not to alter squat behavior.
If a shared file must be edited, overhead-only conditions must be explicit.

---

## 8. Observability SSOT

### 8.1 Current reality
Current repo already stores overhead terminal attempt snapshots via `recordAttemptSnapshot()` and success snapshots via `recordOverheadSuccessSnapshot()`.
But it does **not** currently mirror squat’s separate mid-attempt observation event stream.

### 8.2 Required observability direction
Overhead must expose enough information to separate these cases:
- no meaningful rise ever detected
- rise detected but top never entered
- top entered but hold never accumulated
- hold accumulated but not enough
- completion opened but final pass blocked by runtime gate

### 8.3 Minimum required debug surface
At minimum, terminal snapshot/debug must clearly expose:
- rise proof state
- top detected state
- stable-top state
- hold started state
- hold satisfied state
- completion path
- completion blocked reason
- final pass blocked reason

---

## 9. PR roadmap (locked order)

### PR-01 — Overhead truth freeze + observability lock
Goal:
- lock SSOT boundaries
- add overhead-only observability for completion/final-pass separation
- no pass behavior change yet unless required for observability correctness

### PR-02 — Meaningful rise truth owner
Goal:
- reduce fragile dependence on raw `raiseCount`
- define a stable overhead rise proof contract
- do not touch squat

### PR-03 — Top/hold single progression contract
Goal:
- unify overhead progression hold semantics under one canonical pass hold contract
- keep strict interpretation hold separate if needed

### PR-04 — Fallback rescue normalization
Goal:
- make fallback a true rescue path for real-device jitter
- remove unnecessary strict peak coupling where appropriate

### PR-05 — Final pass read-only alignment
Goal:
- make guardrail/final-pass layers consume overhead motion truth without redefining it
- finish pass-vs-interpretation separation

No PR may skip order without explicit new SSOT update.

---

## 10. Acceptance laws for all overhead PRs

Every overhead PR must prove all of the following:

1. arm motion alone does not pass
2. rising-phase pass does not happen
3. instant top-touch pass does not happen
4. a real short top hold can pass
5. strict interpretation can still be worse than pass quality
6. squat behavior is unchanged
7. overhead debug clearly shows whether failure happened in completion truth or final pass truth

---

## 11. Model/workflow guidance

Recommended model split:
- Sonnet 4.6: truth-owner / contract / state-machine / shared-layer safety PRs
- Composer: narrow UI/debug-surface/copy/smoke additions after contract is already fixed

But regardless of model, every PR prompt must begin by reading this file first.

---

## 12. Hard stop rule

If implementation requires changing squat behavior, stop and report.
Do not proceed by “small shared cleanup” logic.
Overhead work must remain overhead-scoped unless the SSOT is explicitly revised.
