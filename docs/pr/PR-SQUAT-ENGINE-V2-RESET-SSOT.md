# PR-SQUAT-ENGINE-V2-RESET-SSOT

> Parent SSOT for the squat camera reset refactor.  
> This document is intentionally deletion-first and authority-reducing.  
> It is not another threshold-tuning, patch, or behavior-preserving boundary cleanup PR.

---

## 0. Status

- Document type: parent SSOT / architecture reset plan
- Runtime code changes in this document: none
- Target area: public camera **usable lower-body flexion/extension motion evidence** and **squat camera progression** authority (not “perfect form” judging)
- Product identity reminder: MOVE RE camera is a self-serve **usable-signal capture** channel, not a medical or precision diagnosis tool
- Primary goal: make **usable motion evidence** for normal shallow/deep movement reliably available while preventing standing/descent/bottom/mid-ascent false evidence
- **Semantic reframe (locked):** runtime truth is **usable motion evidence acquired**, not “a technically correct squat rep succeeded.” `usableMotionEvidence` is the progression field; it does not mean perfect squat form, medical assessment, or precise rep scoring.

### Authority statement (non-optional)

**SquatMotionEvidenceEngineV2 is the only runtime owner for squat camera progression.  
Legacy squat logic may analyze quality, but must not decide progression.**

---

## 1. Why this reset exists

The current mainline squat camera system has reached a structural failure mode.

Repeated PRs have tried to fix shallow “pass” by adjusting, promoting, freezing, wrapping, or guarding parts of the existing chain. That approach is now exhausted.

Current user-visible symptoms (as of the motion-evidence design track):

1. Valid shallow movement often fails to produce acceptable progression signal.
2. Valid deep movement may only clear after unnatural bottom dwell or repeated slow rise.
3. Easing “pass” reopens false-evidence classes.
4. Closing false-evidence classes makes legitimate evidence impossible again.
5. Each new fix adds another layer, blocker, adapter, trace, or exception.
6. The number of **progression-related authorities** has grown beyond safe reasoning.

This is not primarily a threshold problem.  
This is an **authority topology** problem.

The core problem:

```txt
Too many runtime surfaces can decide, reinterpret, veto, expose, or latch
squat motion / completion / "pass" truth for camera progression.
```

**Old frame to abandon:** a single “squat rep judge” (`SquatRepEngineV2`-style) that centers `passed` / `passDetected` as if the product were certifying a correct rep.

**New frame (SSOT):** a **usable lower-body flexion/extension motion evidence acquirer** centered on **SquatMotionEvidenceEngineV2** and **usableMotionEvidence**.

Therefore this reset is required.

---

## 2. Non-negotiable reset laws

These laws must be treated as stronger than existing implementation habits.

### Law 1 — One runtime progression owner; one motion-evidence boolean

**Squat camera progression** has exactly one runtime owner:

```txt
SquatMotionEvidenceEngineV2
```

The engine exposes exactly one boolean progression field for this concern:

```txt
usableMotionEvidence
```

`usableMotionEvidence` means: **usable lower-body flexion/extension motion evidence acquired** (see §1). It is **not** a claim of perfect form or medical correctness.

**Immutability:** No downstream layer may turn `usableMotionEvidence === true` into `false`.  
No downstream layer may turn `usableMotionEvidence === false` into `true`.

Downstream may **read**, **display**, **log**, **navigate from**, or **derive UI copy** from this value—they may not **re-author** it.

### Law 2 — Shallow is not a failed deep squat

Shallow movement must not be interpreted as the beginning of a deeper squat that never completed.

Shallow is its own valid ROM band when it contains:

```txt
meaningful descent -> reversal -> near-standing recovery -> short stable dwell
```

(Evidence semantics and internal state names may vary in implementation; the **ownership and immutability** of `usableMotionEvidence` do not.)

### Law 3 — False evidence prevention belongs inside the state machine

Standing, descent-only, bottom/seated hold, mid-ascent, micro-bounce, and cross-rep stale evidence must be rejected **inside the single motion-evidence state machine** owned by `SquatMotionEvidenceEngineV2`.

They must not depend on scattered late blockers.

### Law 4 — Quality never owns progression

**Legacy** quality analysis (see **LegacySquatQualityAnalyzer**, §7) may produce warnings, labels, and explanations for **quality / debug / data / analytics** only.

Quality must **not** own progression truth, vetoes, or latch.

### Law 5 — Final blocker does not own squat camera progression

Final blockers may exist for non-squat or generic UI/capture reasons only if they do **not** rewrite `usableMotionEvidence` or replace the engine as owner.

For squat, final blocker must **not** be a second progression authority.

### Law 6 — Page latch does not own motion evidence

The page may schedule UI success, freeze visual state, play audio, or route to the next step **as a consumer** of the owner’s boolean.

It may **not** reinterpret or replace `usableMotionEvidence`.

### Law 7 — Trace/debug is sink-only

Trace, debug panels, exported snapshots, and observability fields may only **observe** already-computed engine truth.

They must not become **runtime decision inputs** that flip or recompute `usableMotionEvidence`.

### Law 8 — Guardrail is not progression

Guardrail may describe camera quality, visibility, confidence, and retry guidance.

Guardrail must **not** decide or override `usableMotionEvidence`.

### Law 9 — Consumers are not owners

**auto-progression**, page latch, debug, trace, analytics, and **legacy** pathways are **consumers** of `SquatMotionEvidenceEngineV2` output, not co-owners of squat camera progression.

They must not act as final blocker, latch **owner**, or alternative source of progression truth for squat.

---

## 3. Current authority map to collapse

The current system contains multiple effective **pass / completion / gate** authority surfaces. Under this SSOT they are **candidates for demotion** to `LegacySquatQualityAnalyzer` / compatibility / observability (see §7)—they must not remain progression owners.

### 3.1 Current motion/completion surfaces (legacy risk)

- `src/lib/camera/squat/pass-core.ts`
  - Historically: squat motion “pass” authority; `passDetected`, `passBlockedReason`, rep evidence, phase-like proof fields.
  - Target role: **not** squat camera progression owner; **quality / debug / compat** only.

- `src/lib/camera/squat-completion-state.ts`
  - Produces completion-state fields, cycle bands, phase and recovery fields.
  - Target role: **not** owner of `usableMotionEvidence`; may feed **legacy quality** only.

- `src/lib/camera/squat/squat-completion-core.ts`
  - Deeper completion mechanics and historical cycle logic.
  - Target role: same as above.

- `src/lib/camera/evaluators/squat.ts`
  - Orchestrates evaluation and emits debug surfaces consumed downstream.
  - Target: **wire through** `SquatMotionEvidenceDecisionV2` as owner output; legacy remains non-owner.

- Prior naming in older plans (`SquatRepEngineV2`, `passed` as the only boolean): **superseded** by `SquatMotionEvidenceEngineV2` and `usableMotionEvidence` for progression semantics.

### 3.2 Current downstream gate/latch surfaces (must stay consumers)

- `src/lib/camera/auto-progression.ts`
  - **Consumer:** reads owner truth; applies UI gate; may apply **non-squat** final blockers only if they do not flip `usableMotionEvidence`.
  - **Not** an alternate owner of squat motion evidence.

- `isFinalPassLatched(...)` and similar
  - **Not** a second success boundary that re-derives squat motion evidence.

- `src/app/movement-test/camera/squat/page.tsx`
  - **Consumer:** page latch, freeze, success side effects, route transition from gate—**not** owner of `usableMotionEvidence`.

### 3.3 Current quality/retry/debug surfaces

- guardrail / capture quality layer
- confidence and retry reason surfaces
- failure tag projections
- `squatCycleDebug`, trace/debug panel fields, success snapshot fields

These are **allowed outputs** for explanation and observability; they are **dangerous as decision inputs** for progression. They must **not** override the engine.

---

## 4. Structural diagnosis

### Diagnosis A — Progression authority and explanation are mixed

Some fields are motion-evidence truth.  
Some are UI gate truth.  
Some are retry explanation.  
Some are debug mirrors.  
Some are fallback compatibility.

The repo has accumulated enough layers that field names can look authoritative even when they are projections or mirrors. **SSOT names:** only `usableMotionEvidence` (from `SquatMotionEvidenceEngineV2`) is the progression boolean for this concern.

### Diagnosis B — Shallow is vulnerable to deep-squat semantics

A shallow rep can be misread as: not enough for deep, early peak, incomplete phase, thin evidence, not confirmed by late latch, blocked by final gate. Shallow must be a first-class **ROM band** for **evidence**, not an incomplete deep rep.

### Diagnosis C — False-evidence prevention is scattered

When prevention is distributed, valid reps are over-blocked and false evidence returns when one layer is relaxed. Prevention belongs **in the one engine** (Law 3).

### Diagnosis D — Behavior-preserving boundary cleanup is insufficient

Previous STRUCT refactors helped name boundaries but preserved old runtime topology. This reset **removes ownership** from legacy and downstream, not only renames.

---

## 5. Target architecture

### 5.1 Single decision object (owner)

The new engine returns **one** decision object. Illustrative shape (names may change in implementation; **ownership shape must not**):

```ts
export type SquatMotionPatternV2 =
  | 'none'
  | 'standing_only'
  | 'descent_only'
  | 'bottom_hold'
  | 'down_up_return';

export type SquatMotionRomBandV2 =
  | 'micro'
  | 'shallow'
  | 'standard'
  | 'deep';

export interface SquatMotionEvidenceDecisionV2 {
  usableMotionEvidence: boolean;
  motionPattern: SquatMotionPatternV2;
  romBand: SquatMotionRomBandV2;
  blockReason: string | null;
  qualityWarnings: string[];
  evidence: {
    descent: boolean;
    reversal: boolean;
    nearStandingReturn: boolean;
    stableAfterReturn: boolean;
    sameRepOwnership: boolean;
  };
  metrics: {
    relativePeak?: number;
    descentMs?: number;
    ascentMs?: number;
    returnMs?: number;
    estimatedFps?: number;
  };
}
```

`usableMotionEvidence` is the **only** runtime progression boolean for squat camera motion evidence. Everything else is derived, displayed, or logged.

**Deprecated centering for SSOT purposes:** `passed` / `passDetected` as the **name** of progression truth—replaced by **`usableMotionEvidence`** and the semantics above.

### 5.2 ROM band is classification, not authority

`romBand` classifies the movement after evidence is measured.

Allowed meanings:

- `micro`: too small to count as usable evidence
- `shallow`, `standard`, `deep`: valid **ROM bands** when the state sequence for usable evidence completes

Forbidden meaning:

- `shallow` as “incomplete deep squat”
- `standard` as the only legitimate evidence band
- `deep` as the only safe band

### 5.3 Phase / pattern owns ordering (inside the engine)

The state machine enforces ordering so that `usableMotionEvidence` is only `true` when the engine’s contract for **down / up / return** (and same-rep ownership, non-micro) is met—see companion design and implementation PRs.

### 5.4 Quality warnings are non-blocking for progression

Examples:

```txt
usableMotionEvidence=true, romBand='shallow', qualityWarnings=['low_rom']
usableMotionEvidence=true, romBand='deep', qualityWarnings=['unstable_knee_signal']
usableMotionEvidence=false, romBand='micro', blockReason='micro_movement'
```

Warnings may affect explanation; they **must not** deny progression (Law 4).

---

## 6. State machine contract (evidence, not “form score”)

### 6.1 Usable evidence requires completion signals

`usableMotionEvidence` may be `true` only if the engine’s contract holds, including (conceptually):

1. capture input is usable enough to evaluate motion  
2. meaningful descent  
3. peak/bottom region observed (as defined by the engine)  
4. reversal after peak  
5. near-standing return after reversal  
6. short stable dwell after return  
7. same-rep ownership  
8. not micro/noise

Exact internal checks stay inside **SquatMotionEvidenceEngineV2** (no downstream veto).

### 6.2 Usable evidence must be impossible in these states

- standing only  
- no movement / setup-only  
- descending only  
- bottom/seated hold only  
- mid-ascent before return  
- noisy micro bounce  
- stale prior rep / cross-rep merged evidence  

### 6.3 Shallow evidence requirements

Shallow **usable** evidence must require the **completion sequence**, not depth equivalence to standard/deep. Shallow must not be forced through deep-ROM assumptions.

### 6.4 Standard/deep

Same **sequence** contract, higher ROM **classification**—not a separate veto layer outside the engine.

---

## 7. Deletion / demotion map

This reset is successful only if **authority** is removed from legacy and downstream.

### 7.1 LegacySquatQualityAnalyzer (conceptual name)

The **existing large squat stack** (pass-core, completion-state, rep-style “passed” paths, `passDetected` as if it were progression truth) is **demoted** to **LegacySquatQualityAnalyzer** responsibilities:

- **Allowed:** quality, debug, data, **analytics**; ROM interpretation; warnings; trace summaries; future tuning inputs.  
- **Forbidden:** progression ownership; final blocker for squat motion evidence; latch **owner**; flipping or replacing `usableMotionEvidence`; using quality to deny engine progression (Law 4).

Mental model:

```txt
judge  -> commentator
owner  -> analyzer
blocker (squat) -> (removed from legacy; not replaced outside engine)
```

### 7.2 Must be demoted to compatibility or observability

- legacy `passDetected` / `passed` as **final** progression owner  
- legacy `completionSatisfied` as final owner for squat **camera** progression  
- `official_shallow_cycle`, `low_rom_cycle`, `ultra_low_rom_cycle`, `standard_cycle` as **progression** owners  
- completion blocked reasons / retry tags / quality labels as **progression** blockers when they conflict with the engine

They may remain as **mirrors** temporarily; they must **not** own runtime `usableMotionEvidence`.

### 7.3 Must be removed from squat final progression authority

- squat-specific final blocker **vetoes** that flip the engine’s boolean  
- fallback owner recomputation that **disagrees** with `SquatMotionEvidenceEngineV2`  
- latch-level **re-evaluation** of motion evidence for progression  
- page-level **reinterpretation** of the engine’s boolean  
- trace/debug **feeding back** as runtime gate that changes `usableMotionEvidence`

### 7.4 May remain as consumers

- `auto-progression` may **consume** `decision.usableMotionEvidence` (read-only for this boolean)  
- guardrail may consume for copy (not for flipping)  
- page may consume for success UI and routing  
- trace may serialize decision  
- analytics may persist **derived** events with **V2** as the progression source of truth in the event contract

---

## 8. Migration strategy (aligned with PR-SQUAT-MOTION-EVIDENCE-V2 design track)

Staged work; **this SSOT** does not dictate a single implementation PR. Reference roadmap:

| Step | Intent |
|------|--------|
| **PR1** | SSOT update (this document and companion PR report) — reframe to motion evidence, **no code** |
| **PR2** | Golden trace harness — fixture contracts, scripts/docs as scoped |
| **PR3** | Add `SquatMotionEvidenceEngineV2` **in parallel** — no runtime wiring; smoke/fixtures only |
| **PR4** | Shadow compare — legacy vs V2 on golden traces, no behavior change |
| **PR5** | Runtime owner swap — evaluator + `auto-progression` **consume** `usableMotionEvidence`; **no flip** |
| **PR6** | Legacy **quality** demotion — old paths as `LegacySquatQualityAnalyzer`-style only |
| **PR7** | Data + observability lock — derived events, sink-only trace; **V2** clearly labeled as owner in exports |

**Forbidden across documentation-driven phases (unless a dedicated implementation PR explicitly allows and scopes):**

- ad hoc **threshold** tweaks to “force” success  
- new **shallow** exception chains for progression  
- new **pass-core / completion-state** as progression owner (they remain **non-goals** for ownership)  
- **page** and **auto-progression** as **new** owners of the boolean; they stay **consumers**

---

## 9. Mandatory fixture matrix (evidence expectations)

Every implementation PR after V2 introduction must protect this matrix. **“Expected”** = **engine should set `usableMotionEvidence` to match** (and never let downstream **invert** the column).

| Case | Expected (usable evidence) | Reason |
|------|----------------------------:|--------|
| standing only | no | no descent / cycle |
| setup-only movement | no | not a rep-like cycle |
| descending only | no | no reversal/return |
| bottom/seated hold | no | no return |
| mid-ascent before return | no | return/stable not reached |
| micro bounce | no | below meaningful movement |
| stale prior rep evidence | no | same-rep ownership broken |
| valid shallow down-up-return | yes | shallow is a valid band |
| valid standard | yes | full cycle, higher ROM band |
| valid deep | yes | full cycle, higher ROM band |

The valid **shallow** case remains **mandatory**, not skippable.

---

## 10. Frame-lag and performance

1. Do not run **multiple full** squat evaluation stacks per frame after wiring.  
2. **SquatMotionEvidenceEngineV2** should compute one decision from a **bounded** window.  
3. **Legacy** paths must not duplicate **heavy** evaluation as co-owners when demoted.  
4. Trace = sink-only and cheap.  
5. Page must not re-run full motion evaluation to **derive** progression truth.  
6. Debug must not **compute** `usableMotionEvidence` independently of the owner.

---

## 11. Runtime ownership after reset

### 11.1 Allowed runtime flow

```txt
frames/landmarks
-> evaluators/squat.ts
-> SquatMotionEvidenceEngineV2
-> SquatMotionEvidenceDecisionV2 (usableMotionEvidence, ...)
-> auto-progression / page / trace / analytics / legacy quality
   (read only; no flip of usableMotionEvidence)
```

### 11.2 Forbidden runtime flow

```txt
usableMotionEvidence === true
-> any layer sets progression to false (override)
```

```txt
usableMotionEvidence === false
-> latch / page / debug / legacy "promotes" to true
```

```txt
trace / debug / legacy field
-> runtime input that changes usableMotionEvidence
```

```txt
quality warning
-> progression denial
```

```txt
shallow rom
-> "incomplete deep squat" (semantic veto)
```

---

## 12. Non-goals

This reset must not:

- redesign the entire public camera funnel in one doc PR  
- list implementation edits (forbidden in SSOT-only PRs) that touch app surfaces **unless** a scoped follow-up allows  
- change payment/auth/readiness contracts from this document  
- add another layer of **progression** patch blockers on legacy  
- convert camera into medical diagnosis

---

## 13. Implementation constraints

### 13.1 Do not layer more progression patches onto legacy

Any work that adds **new** shallow promotion, **new** final blocker **for squat motion evidence**, or **new** trace gate that **replaces** the engine without **demoting** old authority is rejected.

### 13.2 Prefer deletion over compatibility unless migration requires it

Temporary mirrors are allowed; each needs a **demotion** target. **Legacy** cannot remain a progression owner.

### 13.3 Each implementation PR must prove authority reduction

Every **implementation** PR must answer which **owner** it removed, demoted, or prevented from owning **usableMotionEvidence** for squat.

### 13.4 Existing tests are not enough alone

Historical smokes may encode old topology. The **mandatory matrix** and golden harness (when present) are primary acceptance for **evidence** behavior.

---

## 14. Acceptance criteria for the full reset (documentation + implementation)

The **full** reset (when all implementation PRs land) is complete only when all are true:

1. **SquatMotionEvidenceEngineV2** is the **only** runtime owner of squat **camera progression** (motion evidence).  
2. **usableMotionEvidence** is the **single** progression boolean for that concern; **no downstream flip** (Law 1).  
3. Valid **shallow** and **standard/deep** **usable** evidence on fixture replay and real device, without legacy **owning** progression.  
4. Standing / descent-only / bottom hold / mid-ascent / micro / stale: **not** `usableMotionEvidence` on the matrix.  
5. `auto-progression` **does not** rewrite the engine boolean.  
6. Final blocker / page / guardrail **do not** own squat **motion evidence** progression.  
7. **LegacySquatQualityAnalyzer** paths do **not** decide progression.  
8. Trace/debug is **sink-only** for the engine’s boolean.  
9. **Legacy** progression authority is deleted, deprecated, or adapter-only **without** co-owning.  
10. No major frame-lag regression from duplicate **heavy** paths.

---

## 15. Rollback criteria (implementation phase)

Stop or roll back if:

1. standing-only or seated-only false **usable** evidence appears  
2. `usableMotionEvidence` can be **overridden** by non-engine layers  
3. legacy and V2 both **own** runtime progression after demotion  
4. frame lag from permanent dual heavy paths  
5. page/debug/trace start **writing** progression truth

---

## 16. Ask-mode analysis tasks (before implementation)

Ask mode must not edit code; it must map **current** owners and **delete/demote** targets. Outputs: authority graph, hot path, legacy veto list, shallow-as-incomplete map, final/latch/page reinterpretation, integration point, file plan, fixture plan, performance risks.

---

## 17. Final reset statement

The old loop targeted “make shallow pass without false pass” on a **judge**-shaped system.

The new SSOT is stricter in **ownership** and **product meaning**:

```txt
One engine owns usable lower-body flexion/extension motion evidence for camera progression.
Legacy analyzes quality; it does not decide progression.
No downstream layer may flip usableMotionEvidence.
```

That is the only acceptable path out of the repeated-PR loop for this product framing.
