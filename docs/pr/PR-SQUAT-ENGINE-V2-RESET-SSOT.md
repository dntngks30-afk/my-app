# PR-SQUAT-ENGINE-V2-RESET-SSOT

> Parent SSOT for the squat camera reset refactor.  
> This document is intentionally deletion-first and authority-reducing.  
> It is not another threshold-tuning, patch, or behavior-preserving boundary cleanup PR.

---

## 0. Status

- Document type: parent SSOT / architecture reset plan
- Runtime code changes in this document: none
- Target area: public camera squat pass/completion authority
- Product identity reminder: MOVE RE camera is a self-serve usable-signal capture channel, not a medical or precision diagnosis tool
- Primary goal: make valid squat completion reliably pass while preventing standing/descent/bottom/mid-ascent false pass

---

## 1. Why this reset exists

The current mainline squat camera system has reached a structural failure mode.

Repeated PRs have tried to fix shallow squat pass by adjusting, promoting, freezing, wrapping, or guarding parts of the existing chain. That approach is now exhausted.

Current user-visible symptoms:

1. Valid shallow squat is effectively impossible or too hard to pass.
2. Deep squat, which used to pass more consistently, has also become harder.
3. Making pass easier reopens false pass classes.
4. Closing false pass classes makes legitimate pass impossible again.
5. Each new fix adds another layer, blocker, adapter, trace, or exception.
6. The number of pass-related authorities has grown beyond safe reasoning.

This is not primarily a threshold problem.
This is an authority topology problem.

The core problem:

```txt
Too many runtime surfaces can decide, reinterpret, veto, expose, or latch squat pass truth.
```

Therefore this reset is required.

---

## 2. Non-negotiable reset laws

These laws must be treated as stronger than existing implementation habits.

### Law 1 — One runtime pass owner

Squat pass has exactly one runtime owner:

```txt
SquatRepEngineV2
```

No downstream layer may convert a passed squat rep into not-passed.
No downstream layer may convert a not-passed squat rep into passed.

### Law 2 — Shallow squat is not a failed deep squat

Shallow squat must not be interpreted as the beginning of a deeper squat that never completed.

Shallow is its own valid ROM band when it contains:

```txt
meaningful descent -> reversal -> near-standing recovery -> short stable dwell
```

### Law 3 — False pass prevention belongs inside the state machine

Standing, descent-only, bottom/seated hold, mid-ascent, micro-bounce, and cross-rep stale evidence must be rejected inside the single squat state machine.

They must not depend on scattered late blockers.

### Law 4 — Quality never owns pass

Quality may produce warnings.
Quality may affect explanation, confidence language, and downstream recommendation.
Quality must not own completion truth.

### Law 5 — Final blocker does not own squat pass

Final blockers may exist for non-squat or generic UI/capture reasons only if they do not rewrite squat motion truth.
For squat, final blocker must not be a second pass authority.

### Law 6 — Page latch does not own pass

The page may schedule UI success, freeze visual state, play audio, or route to the next step.
It may not reinterpret squat pass.

### Law 7 — Trace/debug is sink-only

Trace, debug panels, exported snapshots, and observability fields may only observe already-computed truth.
They must not become runtime decision inputs.

### Law 8 — Guardrail is not completion

Guardrail may describe camera quality, visibility, confidence, and retry guidance.
Guardrail must not decide whether a squat rep was completed.

---

## 3. Current authority map to collapse

The current system contains multiple effective pass-related authority surfaces.

### 3.1 Current motion/completion surfaces

- `src/lib/camera/squat/pass-core.ts`
  - Declares itself as squat motion pass authority.
  - Produces `passDetected`, `passBlockedReason`, rep evidence, phase-like proof fields.

- `src/lib/camera/squat-completion-state.ts`
  - Produces completion-state fields, shallow/low/standard/ultra-low cycle fields, phase and recovery fields.

- `src/lib/camera/squat/squat-completion-core.ts`
  - Contains deeper completion mechanics and historical cycle logic.

- `src/lib/camera/evaluators/squat.ts`
  - Orchestrates squat evaluation and emits debug surfaces consumed downstream.

### 3.2 Current downstream veto/latch surfaces

- `src/lib/camera/auto-progression.ts`
  - Reads owner truth.
  - Applies UI progression gate.
  - Applies final blocker chain.
  - Produces `progressionPassed`, `finalPassEligible`, `finalPassBlockedReason`.

- `isFinalPassLatched(...)`
  - Can re-check final pass conditions.
  - Creates another success boundary after `progressionPassed`.

- `src/app/movement-test/camera/squat/page.tsx`
  - Consumes gate result.
  - Owns page latch, freeze, success side effects, route transition.

### 3.3 Current quality/retry/debug surfaces

- guardrail / capture quality layer
- confidence and retry reason surfaces
- failure tag projections
- `squatCycleDebug`
- trace/debug panel fields
- success snapshot fields

These are useful as outputs, but dangerous as decision inputs.

---

## 4. Structural diagnosis

### Diagnosis A — Pass authority and pass explanation are mixed

Some fields are motion truth.
Some fields are UI gate truth.
Some fields are retry explanation.
Some fields are debug mirrors.
Some fields are fallback compatibility.

The repo has accumulated enough layers that field names can look authoritative even when they are projections or mirrors.

### Diagnosis B — Shallow squat is vulnerable to deep-squat semantics

A shallow rep can be seen as:

- not enough descent for a deep/standard cycle
- early peak
- incomplete phase
- not recovered enough
- thin evidence
- not confirmed by late latch
- blocked by final gate

This means shallow is not treated as a first-class completion band.
It is repeatedly forced to survive deeper-cycle assumptions.

### Diagnosis C — False pass prevention is scattered

False pass prevention appears across multiple layers:

- no meaningful descent checks
- peak latch checks
- reversal checks
- standing recovery checks
- setup motion checks
- final blockers
- latch frame checks
- stale rep guards
- trace-based diagnostics

Some of these are legitimate, but their distribution creates two bad outcomes:

1. valid reps are over-blocked by late layers
2. false pass returns when one layer is relaxed

### Diagnosis D — Behavior-preserving boundary cleanup is insufficient

Previous STRUCT refactors helped name and freeze boundaries, but preserved the old runtime topology.
That was appropriate for safety at the time.

The current state requires authority removal, not more boundary naming.

---

## 5. Target architecture

### 5.1 Single decision object

The new engine must return a single decision object:

```ts
export type SquatRomBand = 'micro' | 'shallow' | 'standard' | 'deep';

export type SquatRepPhase =
  | 'not_ready'
  | 'standing'
  | 'descending'
  | 'bottom'
  | 'ascending'
  | 'recovered';

export interface SquatRepDecisionV2 {
  passed: boolean;
  phase: SquatRepPhase;
  romBand: SquatRomBand;
  blockReason: string | null;
  qualityWarnings: string[];
  evidence: {
    descent: boolean;
    reversal: boolean;
    nearStandingRecovery: boolean;
    stableAfterRecovery: boolean;
    sameRepOwnership: boolean;
  };
  timing: {
    descentStartAtMs?: number;
    peakAtMs?: number;
    reversalAtMs?: number;
    recoveredAtMs?: number;
    stableAtMs?: number;
  };
  metrics: {
    relativePeak?: number;
    descentSpanMs?: number;
    reversalSpanMs?: number;
    recoverySpanMs?: number;
  };
}
```

The exact type names can change during implementation, but the ownership shape must not change.

### 5.2 Only one pass boolean

The runtime must have only one squat motion pass boolean:

```txt
SquatRepDecisionV2.passed
```

Everything else must be derived, displayed, or logged.

### 5.3 ROM band is classification, not authority

`romBand` classifies the movement after evidence is measured.

Allowed meanings:

- `micro`: too small to pass
- `shallow`: valid low-ROM squat cycle if state sequence completes
- `standard`: valid standard squat cycle
- `deep`: valid deep squat cycle

Forbidden meaning:

- `shallow` as incomplete deep squat
- `standard` as the only legitimate pass band
- `deep` as the only safe pass band

### 5.4 Phase owns ordering

The state machine must enforce ordering:

```txt
standing -> descending -> bottom/peak -> ascending -> recovered -> stable -> pass
```

A frame cannot pass if the phase has not reached recovered/stable.

### 5.5 Quality warnings are non-blocking

Examples:

```txt
passed=true, romBand='shallow', qualityWarnings=['low_rom']
passed=true, romBand='deep', qualityWarnings=['unstable_knee_signal']
passed=false, romBand='micro', blockReason='micro_movement'
```

Warnings may affect explanation, not completion.

---

## 6. State machine contract

### 6.1 Pass requires all completion evidence

A squat may pass only if all are true:

1. readiness/capture input is usable enough to evaluate motion
2. meaningful descent occurred
3. a peak/bottom region was observed
4. reversal occurred after peak
5. near-standing recovery occurred after reversal
6. short stable dwell occurred after recovery
7. evidence belongs to the same rep
8. movement is not micro/noise

### 6.2 Pass must be impossible in these states

- standing only
- no movement
- setup-only movement
- descending only
- bottom/seated hold
- mid-ascent before recovery
- noisy micro bounce
- stale prior rep evidence
- cross-rep merged evidence

### 6.3 Shallow pass requirements

Shallow pass must require completion sequence, not depth equivalence with standard/deep.

Shallow pass requires:

```txt
relative movement above micro floor
+ meaningful descent span
+ reversal after peak
+ near-standing recovery
+ short stable dwell
+ same-rep ownership
```

Shallow pass must not require standard/deep ROM.

### 6.4 Standard/deep pass requirements

Standard/deep pass use the same sequence contract as shallow, but classify into higher ROM bands.

They must not be made harder by shallow-specific false-pass patches.

---

## 7. Deletion / demotion map

This reset is successful only if authority is removed.

### 7.1 Must be demoted to compatibility or observability

- legacy `passDetected` as final owner
- legacy `completionSatisfied` as final owner
- `official_shallow_cycle` as pass owner
- `low_rom_cycle` as pass owner
- `ultra_low_rom_cycle` as pass owner
- `standard_cycle` as pass owner
- completion blocked reasons as final runtime blockers
- retry tags as pass blockers
- quality/evidence labels as pass blockers

These may remain temporarily as compatibility mirrors, but must not own runtime pass.

### 7.2 Must be removed from squat final pass authority

- squat-specific final blocker vetoes that flip or block a completed motion pass
- fallback owner recomputation that can disagree with V2 decision
- latch-level re-evaluation of squat motion completion
- page-level reinterpretation of pass truth
- trace/debug-derived runtime gates

### 7.3 May remain as consumers

- auto-progression may consume `SquatRepDecisionV2.passed`
- guardrail may consume decision for retry copy
- page may consume decision for success UI
- trace may serialize decision
- debug panel may show decision
- snapshot may persist decision

---

## 8. Migration strategy

This refactor must be large enough to solve the problem, but staged enough to avoid uncontrolled rewrite.

### PR-SQUAT-V2-01 — Add SquatRepEngineV2 in parallel

Purpose:

- create the new engine and decision type
- do not wire runtime success to it yet
- run fixture replay only

Expected files:

- `src/lib/camera/squat/squat-rep-engine-v2.ts`
- `src/lib/camera/squat/squat-rep-engine-v2.types.ts`
- `scripts/camera-squat-engine-v2-fixture-smoke.mjs`
- fixture utilities if needed

Forbidden:

- no runtime behavior change
- no auto-progression wiring
- no page wiring
- no final blocker edits
- no legacy deletion yet

Acceptance:

- V2 fixture smoke proves the mandatory matrix below
- V2 emits stable decision object
- V2 does not read legacy final blocker/latch/debug authority

### PR-SQUAT-V2-02 — Wire evaluator / auto-progression to consume V2 decision

Purpose:

- evaluator computes `SquatRepDecisionV2`
- auto-progression uses `decision.passed` as squat motion truth
- downstream layers stop recomputing squat completion truth

Expected changes:

- `evaluators/squat.ts` emits `debug.squatRepDecisionV2`
- `auto-progression.ts` uses V2 decision for squat pass branch
- old owner outputs remain as compatibility mirrors only

Forbidden:

- no threshold tweaking to force pass
- no new final blocker
- no page rewrite
- no new shallow exception chain

Acceptance:

- valid shallow fixture passes through runtime gate
- valid standard fixture passes through runtime gate
- valid deep fixture passes through runtime gate
- standing/descent/bottom/mid-ascent/micro false pass fixtures remain blocked
- `auto-progression` does not flip V2 motion pass

### PR-SQUAT-V2-03 — Delete / demote legacy pass authorities

Purpose:

- remove or hard-demote legacy owners after V2 is runtime source
- prevent old code from silently re-owning pass

Targets:

- final squat pass vetoes
- fallback squat owner recomputation
- latch-level squat motion re-checks
- legacy cycle fields as pass owners
- retry/failure tags as pass blockers

Allowed:

- retain legacy fields as trace mirrors if needed
- retain adapters only if they clearly read from V2

Acceptance:

- grep/search proof that squat pass branch reads only V2 pass truth
- legacy owner functions are deleted, deprecated, or adapter-only
- page latch does not decide squat completion
- final blocker cannot veto completed squat motion pass

### PR-SQUAT-V2-04 — Observability compatibility and real-device validation lock

Purpose:

- normalize trace/debug/snapshot around V2 decision
- prove real-device validation paths
- preserve debugging ability without runtime contamination

Expected:

- trace exports include `squatRepDecisionV2`
- debug panel labels V2 as owner and legacy as compatibility/mirror
- success snapshots store V2 decision
- no trace/debug field is read as runtime gate input

Acceptance:

- real-device shallow squat pass
- real-device standard/deep squat pass
- standing/descent/bottom/mid-ascent false pass blocked
- no major frame lag regression from duplicate heavy computation

---

## 9. Mandatory fixture matrix

Every implementation PR after V2 introduction must protect this matrix.

| Case | Expected | Reason |
|---|---:|---|
| standing only | fail | no descent/reversal/recovery cycle |
| setup-only movement | fail | not a squat rep |
| descending only | fail | no reversal/recovery |
| bottom/seated hold | fail | no recovery |
| mid-ascent before recovery | fail | recovery/stable dwell not reached |
| micro bounce | fail | below meaningful movement floor |
| stale prior rep evidence | fail | same-rep ownership broken |
| valid shallow squat | pass | shallow is a valid ROM band |
| valid standard squat | pass | standard complete cycle |
| valid deep squat | pass | deep complete cycle |

The valid shallow fixture must be mandatory, not optional, not conditional, and not skipped.

---

## 10. Frame-lag and performance requirements

The reset must also reduce or avoid frame lag.

Rules:

1. Do not run multiple full squat engines per frame after runtime wiring.
2. V2 should compute one decision from a bounded window.
3. Legacy mirrors must not perform duplicate heavy evaluation once demoted.
4. Trace construction must be sink-only and cheap.
5. Page render must not trigger extra full motion evaluation.
6. Debug panels must not compute pass truth.

Performance acceptance:

- no duplicate V1 + V2 heavy path after PR-SQUAT-V2-03
- no page-level re-evaluation of squat pass
- no debug-only computation on hot path unless debug is explicitly enabled

---

## 11. Runtime ownership after reset

### 11.1 Allowed runtime flow

```txt
frames/landmarks
-> evaluator/squat.ts
-> SquatRepEngineV2
-> SquatRepDecisionV2
-> auto-progression consumes decision.passed
-> page consumes gate success for UI/navigation
-> trace/debug/snapshot observe decision
```

### 11.2 Forbidden runtime flow

```txt
SquatRepDecisionV2.passed=true
-> final blocker changes to false
```

```txt
SquatRepDecisionV2.passed=false
-> latch/page/debug changes to true
```

```txt
trace/debug field
-> runtime pass decision
```

```txt
quality warning
-> pass denial
```

```txt
shallow rom
-> incomplete deep squat
```

---

## 12. Non-goals

This reset must not:

- redesign the public camera funnel
- touch `/app/home`, `/app/checkin`, `/app/profile`, AppShell, SessionPanelV2, ExercisePlayerModal, or authenticated execution core
- change payment/auth/readiness/app contracts
- change overhead reach logic
- add a new camera motion to the funnel
- convert camera into medical diagnosis
- optimize UI visuals before pass ownership is fixed
- add another layer of patch blockers
- solve every historical trace naming issue in the first PR

---

## 13. Implementation constraints

### 13.1 Do not layer more patches onto legacy

Any implementation that adds new shallow promotion, new final blocker exception, new fallback pass path, or new trace-derived gate without deleting/demoting old authority is rejected.

### 13.2 Prefer deletion over compatibility unless migration requires it

Compatibility mirrors are allowed temporarily, but each must have a planned deletion/demotion target.

### 13.3 Each PR must prove authority reduction

Every PR must answer:

```txt
Which pass authority did this remove, demote, or prevent from owning runtime truth?
```

If the answer is “none,” the PR is probably another patch, not part of this reset.

### 13.4 Existing tests are not enough

Historical smokes may encode the old multi-authority topology.
They are useful, but the new mandatory fixture matrix is the primary acceptance layer.

---

## 14. Acceptance criteria for the full reset

The reset is complete only when all are true:

1. `SquatRepEngineV2` is the single runtime owner of squat motion pass.
2. Valid shallow squat passes on fixture replay and real device.
3. Valid standard/deep squat passes on fixture replay and real device.
4. Standing-only does not pass.
5. Descent-only does not pass.
6. Bottom/seated hold does not pass.
7. Mid-ascent before recovery does not pass.
8. Micro bounce does not pass.
9. Auto-progression does not rewrite squat motion pass.
10. Final blocker does not own squat pass.
11. Page latch does not re-evaluate squat completion.
12. Guardrail does not own squat completion.
13. Quality warning does not deny pass.
14. Trace/debug is sink-only.
15. Legacy pass authority is deleted, deprecated, or adapter-only.
16. No major frame-lag regression from duplicate evaluation.

---

## 15. Rollback criteria

Rollback or stop the migration if any of these occur:

1. standing-only pass opens
2. descent-only pass opens
3. bottom/seated pass opens
4. mid-ascent pass opens
5. shallow pass only works by bypassing the state machine
6. V2 and legacy both continue to own runtime pass after PR-SQUAT-V2-03
7. frame lag worsens because V1 and V2 both run heavy paths permanently
8. page/debug/trace starts influencing runtime pass
9. implementation adds more final blockers instead of deleting/demoting old ones

---

## 16. Ask-mode analysis tasks before implementation

Before any implementation PR, run Ask mode to produce a repo-grounded analysis report.

Ask mode must not edit files.
Ask mode must not propose threshold tuning as the main answer.
Ask mode must identify exact delete/demote targets.

Required outputs:

1. Current pass authority graph
2. Current hot path from evaluator to page navigation
3. Exact legacy fields/functions that can veto pass
4. Exact places where shallow is treated as incomplete/deep-start
5. Exact places where final/latch/page can reinterpret pass
6. Minimal new V2 engine integration point
7. Deletion/demotion plan per file
8. Fixture source plan
9. Performance/hot-path risk map
10. PR-SQUAT-V2-01 implementation checklist

---

## 17. Final reset statement

The old goal was:

```txt
Make shallow pass without reopening false pass.
```

The new goal is stricter:

```txt
Remove every runtime authority that can disagree with the single squat rep state machine.
```

Valid squat completion must be decided once.
Everything else must observe, explain, schedule, or persist that decision.

This is the only acceptable path out of the current repeated-PR loop.
