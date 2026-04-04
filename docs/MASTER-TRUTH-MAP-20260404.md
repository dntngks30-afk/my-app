# SQUAT SHALLOW BOTTLENECK — MASTER TRUTH MAP (2026-04-04)

## 0. Scope

This document is a repository-grounded truth map for the current shallow/ultra-low squat bottleneck.
It is not a single-root-cause memo.
It separates:

- authority truth
- acquisition truth
- policy truth
- evaluator truth
- UI/progression truth
- observability truth

Source inputs used:

- current repo code paths under `src/lib/camera/...`
- uploaded device observation log `붙여넣은 텍스트 (1).txt`
- PR-11 completion note `붙여넣은 텍스트 (2).txt`

---

## 1. What the current repo actually does

### 1.1 Current close writer

`official_shallow_cycle` is still opened by the canonical closer path in `applyCanonicalShallowClosureFromContract()`.
That is structurally good because there is a single closer.
But the closer currently consumes a canonical contract whose reversal evidence is still too broad.

### 1.2 Current canonical reversal evidence is still broader than gold path

In `src/lib/camera/squat/shallow-completion-contract.ts`, `reversalEvidenceFromInput()` currently treats all of the following as reversal evidence:

- `ownerAuthoritativeReversalSatisfied`
- `officialShallowStreamBridgeApplied`
- `officialShallowAscentEquivalentSatisfied`
- `officialShallowClosureProofSatisfied`
- `officialShallowPrimaryDropClosureFallback`
- `guardedShallowTrajectoryClosureProofSatisfied`

That means bridge/proof/suffix-style facts can still help satisfy the canonical contract directly.
This is the main structural reason the repo is not yet fully converged to a single gold path.

### 1.3 Current evaluator split

`src/lib/camera/evaluators/squat-meaningful-shallow.ts` already hardened `ultra_low_rom_cycle`.
But `official_shallow_cycle` intentionally still allows bridge-assisted reversal and only checks:

- standing phase
- timing lower bounds
- current-rep ownership upper bound

So the repo today is converged only for `ultra_low_rom_cycle`, not for `official_shallow_cycle`.

---

## 2. What the uploaded device log proves

### 2.1 Final successful pass is not a clean low-rom path

The final successful attempt shows all of the following together:

- `completionPassReason = official_shallow_cycle`
- `officialShallowStreamBridgeApplied = true`
- `reversalEvidenceProvenance = official_shallow_stream_bridge`
- `eventCycleBand = ultra_low_rom`
- `relativeDepthPeak ≈ 0.06`
- `finalPassLatched = true`

This means the winning pass is not a plain low_rom clean path.
It is a shallow/ultra-low case that still depends on the official shallow bridge lane at close time.

### 2.2 The capture oscillates across multiple truth layers before final pass

Across 55 attempt observations, the log repeatedly alternates between:

- `not_armed`
- `no_reversal`
- `ultra_low_rom_not_allowed`

Observed counts from the uploaded log:

- `no_reversal`: 22
- `ultra_low_rom_not_allowed`: 20
- `not_armed`: 7
- `shallow_descent_too_short`: 4

This is not one bottleneck.
It is a multi-layer oscillation across admission, reversal, policy, and closure.

### 2.3 Shallow admission often exists while event-cycle truth is still weak or absent

From the same log:

- `officialShallowPathAdmitted = true` in 47 observations
- among those, `eventCycleDetected = false` in 40 observations
- `officialShallowStreamBridgeApplied = true` in 25 observations
- among those, `eventCycleDetected = false` in 18 observations
- among those, `eventCycle.descentFrames = 0` in 16 observations
- among those, `eventCycle.notes` often include `descent_weak`, `recovery_tail_weak`, `freeze_or_latch_missing`, or `series_too_short`

This proves the repo still spends a lot of time in a state where:

- shallow admission is open,
- event cycle is weak or absent,
- bridge/proof signals begin to matter,
- and policy/evaluator reasons keep changing.

### 2.4 Observability split-brain is real

In the final successful attempt:

- `perStepSummary.descent.frameCount = 0`
- `perStepSummary.ascent.frameCount = 0`
- but `descendDetected = true`
- `reversalConfirmedAfterDescend = true`
- `recoveryConfirmedAfterReversal = true`
- `passLatched = true`

So the system currently has at least two valid-but-different motion truths:

- phase/per-step truth
- completion/closure truth

That mismatch is survivable for the engine, but it makes debugging and product trust much harder.

---

## 3. Full truth map

### Layer A — Setup / readiness truth

Owner:

- `computeSquatReadinessStableDwell()`
- `computeSquatSetupMotionBlock()`

Purpose:

- decide whether capture is allowed to enter rep evaluation
- reject framing translation / unstable setup patterns

Typical blockers seen in logs:

- pre-attempt `freeze_or_latch_missing`
- early `not_armed`

Failure mode:

- legitimate shallow motion can appear in observation before stable attempt truth exists

### Layer B — Arming / epoch truth

Owner:

- `computeSquatCompletionArming()`
- depth freeze handoff inside `evaluateSquatCompletionState()`

Purpose:

- establish current-rep epoch
- freeze baseline
- latch peak
- determine slice start

Current bottleneck:

- many observations still sit in `baselineFrozen=false`, `peakLatched=false`
- admission/open-window can feel ahead of epoch truth

### Layer C — Attempt admission truth

Owner:

- `computeSquatAttemptAdmission()`
- `deriveOfficialShallowCandidate()`
- `deriveOfficialShallowAdmission()`

Purpose:

- declare a meaningful shallow attempt exists

Current bottleneck:

- official shallow admission opens frequently before a strong event-cycle descent truth is present
- this is not yet wrong by itself, but it increases dependence on later bridge/proof closure

### Layer D — Reversal truth

Sub-lanes:

1. strict/rule/HMM reversal
2. stream bridge / ascent-equivalent
3. trajectory/tail/proof provenance

Current bottleneck:

- canonical contract still lets bridge/proof-style facts directly satisfy reversal evidence
- so reversal truth is not yet fully gold-path-only

### Layer E — Recovery / finalize truth

Owner:

- standing recovery window
- finalize gate

Purpose:

- detect return to standing and ensure finalization is valid

Observation:

- this layer often becomes available even when event-cycle descent truth is weak
- by itself this is okay, but it becomes dangerous when combined with broad reversal evidence

### Layer F — Canonical shallow contract truth

Owner:

- `deriveCanonicalShallowCompletionContract()`

Purpose:

- primary shallow closeability decision

Current bottleneck:

- still treats bridge/proof signals as direct reversal evidence inputs
- therefore `official_shallow_cycle` can still be a residual fallback lane

### Layer G — Policy truth

Owner:

- `applyUltraLowPolicyLock()`

Purpose:

- block illegitimate ultra-low patterns

Current bottleneck:

- policy blocks many interim ultra-low cases correctly
- but policy is not the final top authority because official shallow close can still later succeed
- result: logs alternate between `no_reversal` and `ultra_low_rom_not_allowed`

### Layer H — Evaluator meaningful-shallow truth

Owner:

- `getShallowMeaningfulCycleBlockReason()`
- `demoteMeaninglessShallowPass()`

Purpose:

- final evaluator-level demotion gate

Current bottleneck:

- `ultra_low_rom_cycle` is already hardened
- `official_shallow_cycle` is still allowed as a residual bridge-assisted path

### Layer I — UI / progression truth

Owner:

- pass latched / progression passed / final success owner

Purpose:

- product-facing pass decision

Current bottleneck:

- UI sees a final clean pass object even when the underlying observation history was noisy and bridge-heavy

### Layer J — Observability truth

Owner:

- pass snapshot
- per-step summary
- event cycle debug
- completion debug

Current bottleneck:

- per-step / phase summary and completion truth can diverge
- debugging becomes harder than the actual engine state

---

## 4. Bottleneck families (not one cause)

### Family 1 — Residual close-authority mismatch

`official_shallow_cycle` is still not fully converged to gold-path-only authority.
This is the top structural gap.

### Family 2 — Current-rep acquisition instability

Before final pass, the system repeatedly cycles through:

- pre-attempt / no epoch
- attempt admitted
- no reversal
- ultra-low policy blocked
- bridge applied
This means legit shallow motion is not being captured cleanly enough through the strict lane alone.

### Family 3 — Weak-event / bridge dependency

The logs show many moments where event-cycle descent truth is weak or absent but bridge/proof becomes relevant.
That is exactly the dependency the top-level SSOT wanted to eliminate.

### Family 4 — Boundary overlap

Canonical contract, policy lock, evaluator meaningful gate, and UI pass each still contribute to the final story.
Single writer exists, but single authority story is not yet clean.

### Family 5 — Observability split-brain

Per-step counts and completion truth disagree often enough that repo debugging remains slower and more fragile than necessary.

---

## 5. Repository-grounded final diagnosis

The repo does NOT currently suffer from one isolated bug.
It suffers from one dominant structural gap plus several supporting instability gaps:

1. Dominant structural gap:
  `official_shallow_cycle` can still close from a canonical contract that accepts bridge/proof-style reversal evidence.
2. Acquisition instability gap:
  legitimate shallow current-rep capture still oscillates through not_armed / no_reversal / ultra_low policy blocked states before stabilizing.
3. Boundary gap:
  policy, canonical, evaluator, and UI are not yet reading one fully unified shallow gold-path status.
4. Observability gap:
  debug/per-step/eventCycle views are not aligned enough with closure truth.

---

## 6. Required PR order

1. PR-12 — Official Shallow Gold-Path Convergence
2. PR-13 — Shallow Current-Rep Acquisition Stabilization
3. PR-14 — Policy / Evaluator / Canonical Boundary Convergence
4. PR-15 — Observability SSOT Cleanup

Why this order:

- PR-12 removes the residual writer-authority gap first.
- PR-13 prevents PR-12 from causing shallow false negatives by making legitimate current-rep capture cleaner.
- PR-14 removes overlapping consumers and normalizes blocker ownership.
- PR-15 makes future device validation and calibration faster and more trustworthy.