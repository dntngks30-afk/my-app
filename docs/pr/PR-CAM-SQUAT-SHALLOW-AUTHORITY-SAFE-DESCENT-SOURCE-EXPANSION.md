# PR-CAM-SQUAT-SHALLOW-AUTHORITY-SAFE-DESCENT-SOURCE-EXPANSION — Design SSOT

> **Session type**: docs-only design SSOT. No `src/*`, `scripts/*`, threshold,
> fixture, authority-law, proof-gate, blocker, or naming changes. This
> document is the session's sole output.
>
> **Status**: design SSOT — the next implementation session(s) MUST cite
> this document as binding. Any deviation requires a higher-level SSOT
> escalation.
>
> **Scope lock**: this SSOT defines one new authority-safe descent source
> family, its proof obligations, its split-brain guard, and its coexistence
> accounting. Implementation, thresholds, smoke coverage, and fixture
> promotion all belong to later sessions that MUST run after this design
> SSOT lands.

## References (binding predecessors)

- Parent SSOT: [docs/SSOT_SQUAT_COMPLETION_FIRST_QUALITY_STRICT_2026_04.md](../SSOT_SQUAT_COMPLETION_FIRST_QUALITY_STRICT_2026_04.md)
- Truth Map: [docs/pr/PR-SQUAT-COMPLETION-FIRST-QUALITY-STRICT-TRUTH-MAP-01.md](./PR-SQUAT-COMPLETION-FIRST-QUALITY-STRICT-TRUTH-MAP-01.md)
- Authority freeze: [docs/pr/PR-01-SQUAT-COMPLETION-FIRST-AUTHORITY-FREEZE.md](./PR-01-SQUAT-COMPLETION-FIRST-AUTHORITY-FREEZE.md)
- P1 parent: [docs/pr/P1-SQUAT-LEGITIMATE-SHALLOW-EVIDENCE-RECOVERY.md](./P1-SQUAT-LEGITIMATE-SHALLOW-EVIDENCE-RECOVERY.md)
- P1 diagnosis v1: [docs/pr/P1-DIAGNOSIS-SHALLOW-FIXTURES.md](./P1-DIAGNOSIS-SHALLOW-FIXTURES.md)
- P1 diagnosis v2: [docs/pr/P1-DIAGNOSIS-V2-SHALLOW-SIGNAL-SHAPE-BLOCKER.md](./P1-DIAGNOSIS-V2-SHALLOW-SIGNAL-SHAPE-BLOCKER.md)
- Classification decision: [docs/pr/P1-FOLLOWON-CLASSIFICATION-DECISION.md](./P1-FOLLOWON-CLASSIFICATION-DECISION.md)
- Calibration study result: [docs/pr/P1-CALIBRATION-STUDY-RESULT.md](./P1-CALIBRATION-STUDY-RESULT.md)
- Branch B prompt: [docs/pr/PR-CAM-SQUAT-SHALLOW-AUTHORITY-SAFE-DESCENT-SOURCE-EXPANSION-PROMPT.md](./PR-CAM-SQUAT-SHALLOW-AUTHORITY-SAFE-DESCENT-SOURCE-EXPANSION-PROMPT.md)

---

## §1. Problem statement

The canonical shallow contract on the current PR-01-frozen engine cannot
form earlier legitimate descent evidence than `peakFrame.index − ε` on
realistic shallow reps. This directly blocks `completionTruthPassed`
from ever becoming `true` on the shallow depth band, which in turn blocks
the two E1 fixtures (`shallow_92deg`, `ultra_low_rom_92deg`) from
promoting beyond `conditional_until_main_passes`.

The calibration study ([P1-CALIBRATION-STUDY-RESULT](./P1-CALIBRATION-STUDY-RESULT.md))
established empirically that:

- real `rawDepthPeakPrimary` saturates at ≈ 10⁻⁷ across the entire
  shallow rep (strictly worse than the synthetic fixture's ≈ 4.4 × 10⁻²
  peak);
- `phaseHint === 'descent'` is emitted **zero times** in 57 observed
  phaseHints across three real user recordings under the current engine;
- short-cadence real reps (584 ms, 701 ms) hit the same canonical
  contract blocker family (`descent_span_too_short`,
  `ascent_recovery_span_too_short`, `reversalAtMs === peakAtMs`) as the
  synthetic fixtures;
- `completionTruthPassed === false` is universal on every observed real
  shallow attempt under `ownerFreezeVersion: cam-pass-owner-freeze-01`;
- real shallow "passes" currently route exclusively through
  `completionOwnerReason === "pass_core_detected"` — not through canonical
  shallow contract truth.

Branch A (fixture calibration) is falsified. Fixture re-derivation would
make the primary-depth source **strictly worse**, not better. The correct
structural move is a new authority-safe descent source that does not rely
on a saturation-prone primary-depth channel and does not rely on a
phaseHint that the pipeline does not emit.

This design SSOT defines that new source family.

---

## §2. Current-source failure map

`effectiveDescentStartFrame` in `squat/squat-completion-core.ts` currently
resolves to the earliest of three sources (documented in P1-DIAGNOSIS
§4.4). All three fail on realistic shallow input in distinct ways.

### §2.1 Source #1 — `descentFrame` (phaseHint-driven)

- **Input**: `PoseFeaturesFrame.phaseHint === 'descent'`.
- **Priority**: primary (ordering-first).
- **Observed failure**: both real and synthetic shallow reps emit **zero**
  `'descent'` phaseHints. Real pose-feature extraction on shallow motion
  does not reach the phase-classifier's descent threshold; it flips
  directly from standing-recovered to committed-bottom-or-downward-commitment.
- **Failure class**: structural source-absence. No amount of fixture
  calibration can make this source fire on legitimate shallow reps,
  because the phase-classifier itself does not emit descent on shallow
  motion in production.

### §2.2 Source #2 — `trajectoryDescentStartFrame` (primary-depth threshold)

- **Input**: first frame where
  `squatDepthProxy − baselineStandingDepth ≥ attemptAdmissionFloor × 0.4`
  (fixed coefficient 0.4 in current code).
- **Priority**: fallback.
- **Observed failure on synthetic**: threshold = 0.02 × 0.4 = 0.008.
  Earliest crossing at 1480 ms, 240 ms before peak (per
  [P1-DIAGNOSIS §3.3](./P1-DIAGNOSIS-SHALLOW-FIXTURES.md)). Cycle
  becomes 480 ms, below the 800 ms floor.
- **Observed failure on real data**: `rawDepthPeakPrimary ≈ 10⁻⁷` for the
  entire rep (per calibration study §3). The threshold 0.008 is never
  crossed. The source therefore never resolves a frame; descent anchor
  falls through to Source #3.
- **Failure class**: primary-channel logistic saturation. The source
  depends on a quantity whose observable range on shallow reps is
  5 – 8 orders of magnitude below the authority-safe floor. Lowering the
  coefficient below 0.15 is forbidden (threshold relaxation) and would
  also regress absurd-pass safety (standing-jitter admission).

### §2.3 Source #3 — `sharedDescentEpochFrame` (pass-window-owned)

- **Input**: nearest frame to `sharedDescentTruth.descentStartAtMs`,
  where `sharedDescentTruth` is computed from the pass-window's own
  descent evidence.
- **Priority**: secondary.
- **Observed failure**: `sharedDescentTruth.descentStartAtMs` on
  synthetic fixtures resolves to the pass-window's late descent
  timestamp (≈ 1480 ms, coinciding with Source #2). On real short-cadence
  recordings (JSON 2, JSON 3#2) the pass-window resolves descent ≈ 100 –
  484 ms before peak — not early enough to satisfy the 800 ms cycle floor.
- **Failure class**: late-window bias. The pass-window is anchored near
  the bottom of the rep for shallow motion and does not project a
  descent epoch into the early below-baseline window.

### §2.4 Downstream timing-gate interactions

The canonical shallow contract's minimum-cycle gate
(`SHALLOW_OFFICIAL_CLOSE_MIN_CYCLE_MS = 800` ms in
`squat/squat-completion-canonical.ts`) computes

```
cycleDurationMs = standingRecoveredAtMs − effectiveDescentStartFrame.timestampMs
```

None of the three current sources positions the descent anchor earlier
than ≈ 320 ms before peak on shallow reps. With `standingRecoveredAtMs`
≤ 240 ms after peak for typical shallow recovery, the contract can only
produce `cycleDurationMs ∈ [400, 600]` ms on shallow reps, short of the
800 ms floor. The gate is not the bug — it is a legitimate absurd-pass
safeguard (instant-bounce rejection). The bug is that the descent anchor
is parked near the peak.

A secondary gate is the anti-false-pass temporal ordering bit
(`reversalAtMs > peakAtMs` strict). Both synthetic and real short-cadence
reps show `reversalAtMs === peakAtMs`. Lever B from the P1 implementation
attempt (separating reversal from peak when
`ownerAuthoritativeReversalSatisfied === true`) is a valid authority-safe
repair for this bit; it does not belong to this design's new source, but
the new source implementation session MAY land Lever B alongside for
ordering-bit correctness. Lever B does not, by itself, recover the cycle
floor — only an earlier descent anchor does that.

### §2.5 Pass-core coexistence issue (empirical gap)

The calibration study observed, across all three real recordings:

- `completionTruthPassed: false`
- `finalPassEligible: true`, `finalPassGranted: true`, `finalPassLatched: true`
- `completionOwnerPassed: true` via `completionOwnerReason: "pass_core_detected"`
- under `ownerFreezeVersion: "cam-pass-owner-freeze-01"` (PR-01 freeze active)

This is textually the illegal state described in PR-01 Invariant D
(*"`completionTruthPassed === false` and `finalPassGranted === true` is
illegal"*) and SSOT §6 illegal state #2. The implemented engine is
treating `pass_core_detected` as a sanctioned **completion-owner reason**
that bypasses `completionTruthPassed`, while the PR-01 wording treats
pass-core as strictly non-opener.

The new source must not rely on this path, must not reinforce it, and must
not resolve it in isolation. §7 defines the coexistence accounting the
new source must carry; an actual resolution of the `pass_core_detected`
opener ambiguity is an **authority-law session**, not this branch.

---

## §3. Candidate new descent-source families

Three candidate families are evaluated against the Branch B requirements.
Each candidate is evaluated on five axes:

1. **Early-enough anchor** — produces a frame earlier than ≈ 320 ms
   before peak on shallow reps, enough to clear the 800 ms cycle floor
   on legitimate reps.
2. **Saturation resistance** — not dependent on a quantity whose
   observable range collapses to 10⁻⁷ on realistic shallow input.
3. **Absurd-pass safety** — can be proved safe against standing still,
   setup motion, stale prior rep, mixed rep, and contaminated early-peak
   families without threshold relaxation.
4. **Implementable under PR-01** — does not require reviving pass-core
   as opener, weakening absurd-pass blockers, or relaxing the 800 ms
   floor.
5. **Observability-friendly** — produces a diagnosable trace that
   downstream smokes, split-brain guards, and regression tools can
   assert against.

### §3.1 Candidate A — `kneeAngleAvg` monotonic-descent onset with kinematic gating

**Idea**: define an earliest-below-baseline kinematic descent frame by
looking at `kneeAngleAvg` itself, which is a direct joint-angle
quantity, not a derived depth-proxy and not logistic-saturated.

**Trigger condition (draft, not code)**:

```
descentOnsetFrame = first frame at index i ≥ baselineFreezeFrame.index such that:
  kneeAngleAvg[i] <= baselineKneeAngleAvg - kneeDescentEpsilonDeg
  AND over window [i, i+kneeDescentSustainFrames-1]:
    kneeAngleAvg[j] - kneeAngleAvg[j+1] >= 0 for each j in window
  AND i < peakFrame.index
  AND baselineFrozen === true
  AND attemptAdmissionSatisfied === true
```

Key properties:

- **`kneeDescentEpsilonDeg` is a threshold on joint angle**, not on a
  saturating depth proxy. The synthetic fixture produces a clear 5°
  drop at frame 8 (170° → 165°). Real shallow reps produce equivalent
  early angular descent because knee flexion is the direct mechanical
  primary of the squat descent.
- **`kneeDescentSustainFrames` enforces monotonicity** over a short
  window (recommended 2 – 3 frames at 80 ms step = 160 – 240 ms
  sustain), which rejects single-frame noise jitter without relying on
  phaseHint emission.
- **`baselineKneeAngleAvg` is derived from the standing-baseline window**
  already computed by completion-core, not a fixed constant. This keeps
  the source calibrated to per-user anthropometry without introducing a
  new threshold constant that needs spec negotiation.

Axis evaluation:

| Axis | Assessment |
|---|---|
| Early-enough anchor | **Yes.** Fires at knee = 165° (frame 8, 840 ms) on synthetic fixture. 1960 − 840 = 1120 ms cycle, clears 800 ms floor with 320 ms headroom. On real shallow reps the earliest kinematic drop is expected to fall similarly early, pending empirical replay verification (see §8). |
| Saturation resistance | **Yes.** Knee angle is a direct joint coordinate, not a depth derivation. No logistic saturation at small ROM. |
| Absurd-pass safety | **High**, with the gate stack in §4.3. `baselineFrozen + attemptAdmissionSatisfied + monotonic-sustain + descentConfirmed-precondition` covers the known absurd-pass families. Requires explicit proof obligations in §5. |
| Implementable under PR-01 | **Yes.** Source is a canonical completion-owner feeder — it refines the descent-anchor input to the canonical shallow contract. It does not grant pass, does not bypass `completionTruthPassed`, and coexists with the three existing sources as the earliest-selected candidate. |
| Observability | **High.** `kneeAngleAvg` is already a product debug field. Adding `legitimateKneeDescentOnsetFrame.timestampMs / kneeAngleAtOnset / baselineKneeAngleAvg / monotonicSustainSatisfied` to the completion-core debug payload is additive and does not rewrite any existing field. |

### §3.2 Candidate B — `squatDepthProxyBlended` promotion to authority-safe source

**Idea**: the blended channel already exists in `squat-completion-state.ts`
and already reaches `rawDepthPeakBlended ≈ 0.0586` on real shallow reps
(per calibration study §3). Currently used only as an `armingDepthPeak`
assist. Promote the blended channel to an authority-safe feeder for
`effectiveDescentStartFrame` with its own absurd-pass proof bundle.

**Trigger condition (draft, not code)**:

```
blendedDescentOnsetFrame = first frame at index i ≥ baselineFreezeFrame.index such that:
  squatDepthProxyBlended[i] - baselineBlendedDepth >= attemptAdmissionFloor * k_blended
  AND blendedIsAdmissibleAtIndex(i) === true
  AND armingDepthSource[i] === 'blended_preferred' or 'blended_canonical'
  AND i < peakFrame.index
```

Key concern: the blended channel is **composed** from primary + fallback
travel + observation fallback, and its authority-safety depends on each
component's own provenance. To promote it, the new design would need:

- a formal `blendedProvenance` contract (which components contributed to
  which frame),
- an absurd-pass proof that no component's contamination can pass through
  the blend without being flagged,
- a split-brain guard against blend-assisted early peak contamination
  (the existing `contaminated_blended_early_peak_false_pass` absurd-pass
  family already names this risk in SSOT §7).

Axis evaluation:

| Axis | Assessment |
|---|---|
| Early-enough anchor | **Likely yes** but **unverified**. Real recordings show `squatDepthBlendActiveFrameCount = 3 – 31` on passing attempts, but do not expose per-frame blended trajectories, so early-window blended crossings cannot be confirmed from available data. |
| Saturation resistance | **Yes** at peak (0.0586), but the blended channel's early-descent behavior is unknown without per-frame trajectories (same data gap as calibration study §1.5). |
| Absurd-pass safety | **Medium-to-low.** The blended channel's contamination surface is exactly what the existing `contaminated_blended_early_peak_false_pass` absurd-pass family flags. Promoting it to an opener feeder enlarges that surface. Requires a much heavier proof bundle than Candidate A. |
| Implementable under PR-01 | **Conditionally yes**, but only after the blended-provenance contract is formalized. Without that, it risks violating Law C (assist demotion) by elevating an assist channel into an opener feeder. |
| Observability | **Good.** `rawDepthPeakBlended`, `armingDepthSource`, and `squatDepthBlendActiveFrameCount` are already surfaced. Would need per-frame blended-provenance additions for split-brain diagnosis. |

### §3.3 Candidate C — `downwardCommitmentReached + baselineFrozen + kinematic plausibility` modeled descent epoch

**Idea**: synthesize a descent epoch from three existing signals
(`downwardCommitmentReached`, `baselineFrozen`, `attemptStarted`) plus a
kinematic-plausibility predicate. Pin the descent epoch at the earliest
pre-peak frame that satisfies all four.

**Trigger condition (draft, not code)**:

```
modeledDescentEpochFrame = first frame at index i >= baselineFreezeFrame.index such that:
  baselineFrozen === true at i
  AND attemptStarted === true at i
  AND downwardCommitmentReached becomes true at or before i
  AND kinematicPlausibilityPredicate(i) === true
  AND i < peakFrame.index
```

The `kinematicPlausibilityPredicate` is the open design choice: if it is
a knee-angle drop threshold, Candidate C collapses into Candidate A with
extra preconditions. If it is a depth-proxy threshold, it collapses into
Candidate B. If it is something new (e.g. trunk-lean monotonic forward
tilt), the new predicate itself becomes the source and needs its own
absurd-pass proof.

Observed real data:

- JSON 1 squat: `downwardCommitmentAtMs: 24867.4` = 392 ms after
  `descendStartAtMs: 24475`. Commitment anchor sits near peak — does not
  help recover the 800 ms floor problem.
- JSON 2 squat: `downwardCommitmentAtMs: 13582.7` = 484 ms after
  `descendStartAtMs: 13098.8`. Commitment at peak timestamp — does not
  help.
- JSON 3#2 squat: `downwardCommitmentAtMs: 12744.1` = 100 ms after
  `descendStartAtMs: 12644`. Commitment at peak — does not help.

Axis evaluation:

| Axis | Assessment |
|---|---|
| Early-enough anchor | **No** on its own. `downwardCommitmentAtMs` in all observed real data is anchored at or near the peak timestamp. Candidate C can only recover the cycle floor if its kinematic-plausibility predicate is itself Candidate A (knee-angle-based) or Candidate B (blended-depth). In that case, C is Candidate A or B with extra gate redundancy, not a new source. |
| Saturation resistance | Depends on the chosen predicate. Inherits the predicate's axis. |
| Absurd-pass safety | **High redundancy**, because multiple preconditions must hold. But the safety is additive, not orthogonal — it does not cover anything Candidate A + existing preconditions do not already cover. |
| Implementable under PR-01 | Yes, but adds cost without adding independent descent evidence. |
| Observability | Good; all four signals are already surfaced. |

### §3.4 Candidate ranking

**Rank 1 (preferred): Candidate A — `kneeAngleAvg` monotonic-descent onset.**

**Rank 2: Candidate B — `squatDepthProxyBlended` promotion**, held in
reserve as a complementary source pending per-frame blended-trajectory
data (§8 capture schema). It may become a third-tier feeder in a follow-on
expansion if Candidate A plus the existing three sources still leave
real-world edge cases unrecovered.

**Rank 3 (rejected as standalone): Candidate C**, because the only
variants of C that recover the cycle floor are ones in which C reduces to
A or B.

### §3.5 Why Candidate A is preferred

1. **Signal is observationally clean at the onset timestamp we need.**
   The synthetic fixture's 170° → 165° transition at frame 8 is a 5°
   drop, five orders of magnitude above any joint-angle noise floor. Real
   pose-feature extraction emits kneeAngle as a direct joint-angle
   quantity that does not have the primary-depth channel's logistic
   saturation.
2. **Blended-channel promotion (Candidate B) is a larger scope-expansion
   than Candidate A**, because it elevates an existing assist layer to an
   opener feeder, requiring full blended-provenance contract work. Under
   the smallest-authority-safe-change principle (PR-01 §12), Candidate A
   is the smaller step.
3. **Candidate C reduces to A or B**; picking A directly is more honest.
4. **Candidate A's absurd-pass safety is proofable with existing gates.**
   The `baselineFrozen + attemptAdmissionSatisfied + monotonic-sustain +
   descentConfirmed-precondition` stack reuses signals already computed
   by completion-core.
5. **Candidate A does not touch the existing three sources.** It adds a
   4th source to `effectiveDescentStartFrame`, analogous to the P1
   attempted Lever A but keyed on kneeAngle rather than primary-depth.
   The minCycle floor (800 ms), the `attemptAdmissionFloor` (0.02), and
   the canonical contract's gate topology remain untouched. No threshold
   relaxation.

---

## §4. Preferred source definition — "Legitimate Kinematic Shallow Descent Onset"

The preferred source is named here as **`legitimateKinematicShallowDescentOnsetFrame`**
(shortened `legitKineticDescentOnset` in code-adjacent contexts if later
sessions prefer). It is a 4th-tier candidate for
`effectiveDescentStartFrame` in
`src/lib/camera/squat/squat-completion-core.ts`, sitting alongside but not
replacing the three existing sources.

### §4.1 What signal opens descent evidence

A frame `f` at index `i` opens legitimate kinematic shallow descent
evidence **only if all** of the following hold:

1. `f.index ≥ baselineFreezeFrame.index` — baseline must be frozen before
   the onset is eligible.
2. `f.index < peakFrame.index` — onset must strictly precede peak.
3. `baselineKneeAngleAvg` is resolvable from the standing-baseline window
   as the **median** of `kneeAngleAvg` over the baseline window (median,
   not mean, to reject single-frame spikes).
4. `f.kneeAngleAvg ≤ baselineKneeAngleAvg − KNEE_DESCENT_ONSET_EPSILON_DEG`
   where `KNEE_DESCENT_ONSET_EPSILON_DEG` is a new constant defined in
   §4.4. (**Not a tuning knob** — the implementation session may choose
   its first-landed value within the §4.4 admissible band, then freeze
   it; subsequent change requires a new design SSOT.)
5. Over the window
   `[f.index, f.index + KNEE_DESCENT_ONSET_SUSTAIN_FRAMES − 1]`,
   `kneeAngleAvg[j] − kneeAngleAvg[j+1] ≥ 0` for every adjacent pair in
   the window (monotonic non-increase). `KNEE_DESCENT_ONSET_SUSTAIN_FRAMES`
   is defined in §4.4.
6. `baselineFrozen === true` at `i`.
7. `attemptAdmissionSatisfied === true` at `i`.
8. `descentConfirmed === true` **somewhere in** the current rep window
   (not necessarily at `i`, but at least by `peakFrame.index`). This is
   a rep-scope precondition ensuring the source never fires on a rep
   that completion-core has not even admitted as a descent attempt.

The earliest `f` satisfying all eight becomes
`legitimateKinematicShallowDescentOnsetFrame`.

### §4.2 Integration with `effectiveDescentStartFrame`

```
effectiveDescentStartFrame =
  earliest-by-index of the non-null set:
    { descentFrame,                                  // source #1 (phaseHint)
      trajectoryDescentStartFrame,                   // source #2 (primary-depth threshold)
      sharedDescentEpochFrame,                       // source #3 (pass-window)
      legitimateKinematicShallowDescentOnsetFrame }  // source #4 (NEW, this design)
```

The new source is **never a sole input** when any of sources #1–#3 is
earlier. It is purely an additive floor on the earliest candidate set. It
therefore cannot push the descent anchor *later* than the current engine
— only earlier, and only when the kinematic onset signal is strictly
valid.

### §4.3 How it stays same-rep truthful

- Condition (1) anchors the earliest eligible frame at or after the
  baseline-freeze boundary. Pre-baseline frames cannot contaminate the
  source.
- Condition (2) strictly requires the onset to precede peak. No
  post-peak frame can be claimed as descent onset.
- Condition (6) requires `baselineFrozen === true` at the candidate
  frame. This is the same-rep binding predicate already used by
  completion-core for other rep-bound truths.
- Condition (7) requires `attemptAdmissionSatisfied === true`, which
  already excludes setup-phase and contaminated-setup reps (per the
  `setup_motion_contaminated` and `setup_series_start_false_pass`
  families in the absurd-pass registry).
- Condition (8) binds the source to a rep that completion-core has
  admitted as a descent attempt. A rep that never reaches
  `descentConfirmed === true` cannot produce a
  `legitimateKinematicShallowDescentOnsetFrame`, no matter how many
  spurious kneeAngle drops occur in its frames.

### §4.4 Admissible parameter band (frozen once, spec-negotiable via new SSOT)

| Parameter | Admissible band | Rationale |
|---|---|---|
| `KNEE_DESCENT_ONSET_EPSILON_DEG` | `3.0 – 7.0` | 3° lower bound is ≈ 10× pose-feature angular noise floor for a ready-state standing subject; 7° upper bound preserves the synthetic fixture's frame-8 onset (170° → 165° is a 5° drop, inside the band). Lower than 3° admits standing-jitter (absurd-pass risk); higher than 7° misses the legitimate shallow onset frame. |
| `KNEE_DESCENT_ONSET_SUSTAIN_FRAMES` | `2 – 3` frames | At 80 ms step (canonical fixture step) this is 160 – 240 ms sustain. Matches the shortest realistic shallow-descent duration while rejecting single-frame spikes. |

The implementation session MUST pick one value within each band, MUST
freeze that value in a named constant, and MUST NOT subsequently tune
the value without landing a superseding design SSOT. This is a "threshold
relaxation" guardrail: the band boundaries are the negotiated authority
envelope, and movement outside them is a new SSOT event, not a tuning
commit.

### §4.5 How it avoids the false-pass families

See §5 for the full proof obligation enumeration. Summary here:

- **Standing still**: `KNEE_DESCENT_ONSET_EPSILON_DEG ≥ 3°` AND
  `KNEE_DESCENT_ONSET_SUSTAIN_FRAMES ≥ 2` together reject standing
  jitter. Supplementary: condition (7) excludes pre-attempt-admission
  frames.
- **Setup-motion contaminated**: condition (7) excludes by construction
  (attempt admission is post-setup).
- **Stale prior rep**: condition (1) + condition (6) bind the onset to
  the current-rep baseline-freeze boundary; the prior rep's kneeAngle
  drops cannot contaminate.
- **Mixed-rep timestamp**: same as stale-prior-rep binding.
- **Contaminated blended early peak false pass**: the source does not
  consume blended-depth; orthogonal risk surface.
- **No real descent**: condition (8) precondition binds the source to
  reps that completion-core admits as descent attempts.
- **Seated/quasi-seated nonsense pass**: seated holds produce zero
  monotonic kneeAngle drop (the subject is not moving). Condition (4)
  + (5) does not fire.

---

## §5. Absurd-pass proof obligations

The implementation session MUST land, alongside the new source, a proof
bundle that discharges every obligation below. Each obligation is a
smoke (or contribution to an existing smoke) that asserts the new source
does NOT fire, OR that the new source fires but the canonical contract
still fail-closes, on the corresponding absurd-pass fixture.

Each obligation must be assertable **on the current synthetic fixture
family** (no new fixtures required unless the §8 capture schema is
delivered first). For each obligation, the corresponding absurd-pass
registry entry (per SSOT §7 and P3 design in
`P1-DIAGNOSIS-SHALLOW-FIXTURES.md` §7.2) is named in brackets.

### §5.1 Standing still [`standing_still`]

**Obligation**: on a standing-still fixture whose `kneeAngleAvg` fluctuates
within ±`KNEE_DESCENT_ONSET_EPSILON_DEG / 2` around a near-constant
baseline for the entire capture window, the new source MUST NOT emit a
`legitimateKinematicShallowDescentOnsetFrame`, AND canonical contract
MUST remain fail-closed.

**Proof shape** (smoke-level):
1. Build a `standing_still` fixture with 30+ frames of
   `kneeAngleAvg ∈ [170° − ε/2, 170° + ε/2]`.
2. Assert `legitimateKinematicShallowDescentOnsetFrame === undefined` in
   the completion-core debug payload.
3. Assert `gate.finalPassEligible === false` and
   `completionTruthPassed === false`.

### §5.2 Setup-motion contaminated [`setup_motion_contaminated`, `setup_series_start_false_pass`]

**Obligation**: on a setup-motion fixture where the user performs
adjustment / readiness-check kneeAngle changes before `attemptStarted`
transitions to `true`, the new source MUST NOT anchor the descent onset
at any pre-attempt-admission frame. If the first post-admission
kneeAngle drop is later than the pre-admission jitter, the source must
select the later frame (or no frame).

**Proof shape**:
1. Build a fixture with 10+ pre-attempt frames oscillating kneeAngle by
   `KNEE_DESCENT_ONSET_EPSILON_DEG + 1°` (i.e. larger than the threshold)
   in both directions, then a clean standing hold, then a real descent.
2. Assert
   `legitimateKinematicShallowDescentOnsetFrame.index ≥
   attemptAdmissionSatisfiedFirstFrame.index`.
3. Assert the real descent (post-admission) is correctly anchored.

### §5.3 No real descent [`no_real_descent`]

**Obligation**: on a fixture where the subject oscillates kneeAngle
within the epsilon band but never establishes a monotonic sustained
descent over `KNEE_DESCENT_ONSET_SUSTAIN_FRAMES`, the new source MUST
NOT fire.

**Proof shape**:
1. Build a fixture with kneeAngle oscillating as
   `[170, 166, 170, 166, 170, 166, ...]` (single-frame spikes, never
   sustaining).
2. Assert `legitimateKinematicShallowDescentOnsetFrame === undefined`.
3. Assert `gate.finalPassEligible === false`.

### §5.4 Contaminated blended early peak false pass [`contaminated_blended_early_peak_false_pass`]

**Obligation**: on a fixture that produces an early blended-depth spike
(e.g. a single frame with momentary deep hip drop due to pose-extraction
jitter) but whose kneeAngle does NOT descend, the new source MUST NOT
anchor the descent onset at the spiked frame. The new source is
orthogonal to the blended channel and must not inherit blended
contamination.

**Proof shape**:
1. Re-use the existing
   `contaminated_blended_early_peak_false_pass` fixture family (if
   present in the test corpus) or build a minimal one where
   `squatDepthProxyBlended` spikes while `kneeAngleAvg` remains flat.
2. Assert the new source does not fire.
3. Assert the existing absurd-pass veto for this family still fires.

### §5.5 Stale prior rep [`stale_prior_rep`]

**Obligation**: on a fixture that captures a prior rep followed by
standing recovery followed by a fresh rep attempt, the new source's onset
MUST anchor inside the fresh rep's baseline-freeze window, never in the
prior rep's descent window.

**Proof shape**:
1. Build a two-rep fixture: descent + peak + recovery + standing hold +
   new baseline freeze + new descent.
2. Assert
   `legitimateKinematicShallowDescentOnsetFrame.index ≥
   currentRepBaselineFreezeFrame.index` where `currentRep` is the second
   rep.

### §5.6 Mixed-rep timestamp contamination [`mixed_rep_timestamp_contaminated`]

**Obligation**: on a fixture that intentionally interleaves two rep
attempts' timestamps out of order, the new source MUST fail to emit
(no coherent rep window) or MUST emit only within the current rep's
index range — in either case, the canonical contract must fail-close.

**Proof shape**:
1. Re-use the existing mixed-rep contamination fixture.
2. Assert either
   `legitimateKinematicShallowDescentOnsetFrame === undefined` or
   `legitimateKinematicShallowDescentOnsetFrame.index` lies inside the
   current rep's index range **and** the canonical contract still
   fail-closes.

### §5.7 No real reversal [`no_real_reversal`]

**Obligation**: on a fixture where descent occurs (kneeAngle drops) but
reversal never forms (subject stays at bottom indefinitely or exits
motion without ascent), the new source MAY emit a descent onset, but
the canonical contract MUST fail-close on a later gate. The new source
is not a reversal replacement.

**Proof shape**:
1. Build a fixture with descent to 92° and then flat hold at 92° for
   60+ frames with no ascent.
2. Assert
   `legitimateKinematicShallowDescentOnsetFrame !== undefined` (source
   fires).
3. Assert `canonicalShallowContractBlockedReason === "no_real_reversal"`
   or equivalent downstream gate blocks.
4. Assert `gate.finalPassEligible === false`.

### §5.8 Seated / quasi-seated [included in `seated_still_or_held_at_pass`]

**Obligation**: on a fixture where the subject is already seated
(kneeAngle starts near the squat-peak angle and never transitions from
standing-baseline), the new source MUST NOT fire because the
standing-baseline window never establishes a legitimate
`baselineKneeAngleAvg`, OR because the attempt-admission gate fails.

**Proof shape**:
1. Build a fixture starting at `kneeAngleAvg === 100°` (already bent)
   and staying near 100°.
2. Assert either
   `baselineFrozen === false` for the entire capture, or
   `legitimateKinematicShallowDescentOnsetFrame === undefined`.
3. Assert `gate.finalPassEligible === false`.

### §5.9 Summary proof matrix

| Absurd-pass family | Blocking mechanism in new source |
|---|---|
| `standing_still` | §4.1 conditions (4) + (5) — threshold + monotonic-sustain |
| `setup_motion_contaminated` | §4.1 condition (7) — `attemptAdmissionSatisfied` |
| `setup_series_start_false_pass` | §4.1 condition (7) |
| `no_real_descent` | §4.1 condition (5) — monotonic-sustain |
| `contaminated_blended_early_peak_false_pass` | source does not consume blended depth (orthogonal) |
| `stale_prior_rep` | §4.1 conditions (1) + (6) — current-rep baseline-freeze binding |
| `mixed_rep_timestamp_contaminated` | §4.1 condition (1) — rep-window index binding |
| `no_real_reversal` | downstream canonical-contract gate (new source does not claim reversal truth) |
| `no_real_recovery` | downstream canonical-contract gate (new source does not claim recovery truth) |
| `seated_still_or_held_at_pass` | §4.1 baseline-window unresolvable OR condition (7) fails |
| `ultra_low_trajectory_short_cycle` | downstream 800 ms floor still applies; new source only unblocks legitimate-enough reps |

The implementation session MUST produce a single smoke (or tight cluster)
that covers the entire §5.1–§5.8 matrix. The smoke output must be
byte-exact diffable; new absurd-pass blocking reason strings introduced
by the new source, if any, MUST be added to the absurd-pass registry
design (P3) in the same implementation PR — they may not be invented
ad-hoc in the completion-core path.

---

## §6. Split-brain guard design

Under PR-01 §7 the canonical split-brain invariants are:

- Invariant A — `completionOwnerPassed !== true` → `finalPassEligible !== true`
- Invariant D — `completionTruthPassed === false` + `finalPassGranted === true` is illegal
- Invariant F — pass-core / assist positive evidence may not directly reopen final pass when canonical completion-owner truth is false

The new source must not create new split-brain states. This section
defines the additional guards the implementation session MUST land.

### §6.1 Source-level invariant (SL-1): onset without completion-owner pass

> If `legitimateKinematicShallowDescentOnsetFrame !== undefined` AND
> `completionOwnerPassed !== true`, then `finalPassEligible !== true`.

This is a direct application of PR-01 Invariant A to the new source: the
new source can only move the descent anchor earlier; it cannot by itself
open `completionOwnerPassed`. If the completion-owner pass remains false
for any reason (even though the earlier anchor was correctly identified),
final pass must stay closed.

**Guard shape**: the source contributes to `effectiveDescentStartFrame`
which feeds the canonical shallow contract. The contract's existing
gate topology is preserved. No new pass-granting path is introduced.

### §6.2 Source-level invariant (SL-2): onset-without-reversal does not reopen

> If `legitimateKinematicShallowDescentOnsetFrame !== undefined` AND
> `canonicalShallowContractReversalEvidenceSatisfied === false`, then
> `finalPassEligible !== true`.

The new source must never be sufficient by itself to satisfy the
canonical contract. Reversal evidence, recovery evidence, anti-false-pass
ordering, and minCycle timing remain as independent gates. The new source
addresses only the "descent anchor is too late" input gap; it does not
claim reversal truth, recovery truth, or ordering truth.

**Guard shape**: the canonical contract's existing gate bits (`reversal`,
`recovery`, `anti`, `minCycle`, `epoch`, etc.) continue to be evaluated
independently. The new source feeds `epoch` / `minCycle` only.

### §6.3 Source-level invariant (SL-3): onset without attempt admission

> If `attemptAdmissionSatisfied === false`, then
> `legitimateKinematicShallowDescentOnsetFrame === undefined`.

This is §4.1 condition (7) restated as an invariant. It prevents the new
source from firing during setup / readiness-check phases.

### §6.4 Cross-layer invariant (CL-1): no contradiction with
### `sharedDescentTruth`

> If `legitimateKinematicShallowDescentOnsetFrame !== undefined` AND
> `sharedDescentTruth.descentStartAtMs !== null`, then the earliest of
> the two timestamps is what `effectiveDescentStartFrame.timestampMs`
> must equal.

This is the "earliest wins" rule already embedded in
`effectiveDescentStartFrame` resolution. The split-brain guard asserts
that when both sources resolve, no layer downstream of
`effectiveDescentStartFrame` uses a different descent timestamp. If any
downstream field (e.g. `squatCycle.descendStartAtMs`) disagrees with
`effectiveDescentStartFrame.timestampMs`, split-brain must fire.

**Guard shape**: an additional bit in
`canonicalShallowContractSplitBrainDetected` trace:
`descentAnchorCoherent` (1 / 0). This bit is `0` if any downstream
consumer uses a descent anchor other than the canonical
`effectiveDescentStartFrame.timestampMs`. On detection, the contract
fail-closes the same way the existing split-brain bit does.

### §6.5 Cross-layer invariant (CL-2): onset does not bypass `pass_core_detected`
### coexistence

See §7. The new source does not propagate through any
`completionOwnerReason` path. Specifically:

> `legitimateKinematicShallowDescentOnsetFrame !== undefined` MUST NOT
> cause `completionOwnerReason` to change. If
> `completionOwnerReason === "pass_core_detected"` is what is currently
> being set by the engine, the new source does not suppress that, does
> not replace that, and does not add a new `completionOwnerReason` value.

**Guard shape**: the new source feeds `effectiveDescentStartFrame` only.
It does not feed any `completionOwner*` field. An implementation-session
smoke MUST assert that adding the new source to an engine run does not
change any `completionOwner*` field values on the
`contaminated_blended_early_peak_false_pass`, `standing_still`,
`setup_motion_contaminated`, `stale_prior_rep`, and `mixed_rep`
absurd-pass fixtures.

### §6.6 Regression invariant (RG-1): absurd-pass block-only property

> For every fixture in the absurd-pass registry's block-list, adding
> the new source MUST NOT flip any of these fixtures from
> `gate.finalPassEligible === false` to `gate.finalPassEligible === true`.

**Guard shape**: a before-new-source / after-new-source diff harness on
the complete absurd-pass fixture set. Diff must be empty on the
`gate.finalPassEligible` axis.

### §6.7 Regression invariant (RG-2): PR-01 illegal state lock

> Adding the new source MUST NOT introduce any of the 8 SSOT §6
> illegal states on any existing fixture (absurd-pass, legitimate, or
> conditional).

**Guard shape**: the existing PR-01 illegal-state smoke
(`scripts/camera-pr-01-squat-completion-first-authority-freeze-smoke.mjs`)
must pass before and after the implementation. No new conditional SKIP
markers are permitted as compensation.

---

## §7. Coexistence spec with `pass_core_detected` completion-owner path

### §7.1 Observed production reality (from calibration study §7.5)

Every real shallow squat attempt in the supplied user bundle shows:

- `ownerFreezeVersion: "cam-pass-owner-freeze-01"` (PR-01 authority
  freeze is active)
- `completionTruthPassed: false`
- `finalPassEligible: true`, `finalPassGranted: true`, `finalPassLatched: true`
- `completionOwnerPassed: true`
- `completionOwnerReason: "pass_core_detected"`

Per PR-01 Invariant D and SSOT §6 illegal state #2, the
`completionTruthPassed === false` + `finalPassGranted === true` pair is
textually illegal. The engine is currently producing this state on real
shallow reps. Two interpretations are possible.

### §7.2 Interpretation path (A) — sanctioned completion-owner reason

The implemented engine treats `pass_core_detected` as a **sanctioned
completion-owner reason**, i.e. one of the legitimate values that
`completionOwnerReason` may take while still satisfying the PR-01 Law A
opener constraint (L2 completion-owner truth). Under this interpretation:

- `completionOwnerPassed === true` with
  `completionOwnerReason === "pass_core_detected"` is canonical
  completion-owner truth, regardless of `completionTruthPassed`.
- `completionTruthPassed` in the telemetry is a **canonical-shallow-contract-
  specific** truth bit, distinct from the broader completion-owner truth.
- PR-01 Invariant D as textually worded (referring to `completionTruthPassed`)
  is a drafting mismatch with the implemented authority ladder; the
  intended invariant was about `completionOwnerPassed`, which is indeed
  `true` in the observed state.

Under interpretation (A), the new source MUST:

- NOT interfere with the `pass_core_detected` owner-reason path.
- NOT attempt to make `completionTruthPassed === true` a prerequisite for
  final pass (that would tighten an authority constraint unilaterally and
  is out of scope).
- Simply ensure that when `completionTruthPassed === true` IS reachable
  (because the canonical shallow contract's cycle-timing gate now passes
  thanks to the earlier descent anchor), the legitimate shallow rep
  passes through **canonical** completion-owner truth, not only through
  the `pass_core_detected` assist path.

### §7.3 Interpretation path (B) — latent PR-01 authority gap

The `completionOwnerReason === "pass_core_detected"` path is a latent
implementation gap that PR-01 intended to close but did not. Under this
interpretation, the observed production state is illegal in spirit and
the new source is being asked to cover over an authority-ladder leak.

Under interpretation (B), the new source MUST:

- Make canonical `completionTruthPassed === true` reachable on legitimate
  shallow reps so that the `pass_core_detected` path becomes unnecessary
  for legitimate passes.
- NOT itself close the `pass_core_detected` path — that is an
  authority-law session's job, not this source's job.
- Expose enough trace for the authority-law session to diff canonical
  shallow reps (now passing via `completionTruthPassed === true`) from
  non-canonical passes (still passing via `pass_core_detected`).

### §7.4 This SSOT's stance

The resolution of (A) vs (B) is an **authority-law session** matter.
This design SSOT does NOT choose between them and MUST NOT be taken as
doing so.

What this design SSOT *does* mandate for the new source, under either
interpretation:

1. **Non-interference**: the new source MUST NOT suppress, replace, or
   rewrite the `completionOwnerReason` value on any fixture where the
   existing engine sets `completionOwnerReason === "pass_core_detected"`.
   Smoke §6.5 CL-2 enforces this.
2. **Canonical reachability**: on the E1 fixtures (`shallow_92deg`,
   `ultra_low_rom_92deg`) and on any real shallow replay captured via
   §8's schema, the new source MUST make `completionTruthPassed === true`
   reachable. If the canonical contract passes, it passes via the
   canonical path, not the assist path.
3. **Diagnostic separation**: the implementation MUST surface, in the
   completion-core debug payload, a new boolean
   `canonicalShallowContractDrovePass` that is `true` iff
   `finalPassLatched === true` AND `completionTruthPassed === true` on
   the current rep. This lets future smokes and future authority-law
   sessions directly diff "canonical passes" from "assist passes" without
   reading private owner reasons.
4. **Deferred escalation marker**: the implementation MUST cite this
   SSOT's §7 in a code comment adjacent to the new-source wiring,
   noting that the `pass_core_detected` coexistence accounting remains
   pending authority-law resolution. The code comment MUST NOT resolve
   it in that session.

### §7.5 Hand-off to authority-law owner

Once the implementation session lands, the new canonical-drive boolean
§7.4 item 3 enables the authority-law owner to:

- Measure how many real shallow reps pass via canonical truth vs via
  `pass_core_detected`.
- Decide, based on that measurement, whether interpretation (A) or (B)
  is the intended semantics.
- If (B), propose a follow-on authority-law SSOT that closes the
  `pass_core_detected` opener path.

This design SSOT does NOT force that decision. It only ensures the data
necessary to make it becomes available.

---

## §8. Validation plan

The implementation session MUST produce, before any E1 fixture promotion,
the following validations in order.

### §8.1 Smoke coverage

Each smoke below must pass green. No new SKIP markers, no
`ALLOWED_SKIP_MARKERS` additions in PR-F, no conditional branches that
accept either outcome.

1. **New-source unit smoke** — dedicated smoke that asserts §4.1
   conditions on a minimal fixture family (standing, descending, mixed,
   contaminated). File path recommendation:
   `scripts/camera-pr-cam-squat-legit-kinematic-shallow-descent-source-smoke.mjs`.
2. **Absurd-pass regression smoke** — asserts every §5.1–§5.8 obligation
   on the existing absurd-pass fixture corpus. May be folded into an
   existing absurd-pass-umbrella smoke if present.
3. **Split-brain guard smoke** — asserts §6.1–§6.6 invariants. New bit
   `descentAnchorCoherent` from §6.4 MUST be asserted.
4. **PR-01 invariant smoke** — existing
   `scripts/camera-pr-01-squat-completion-first-authority-freeze-smoke.mjs`
   must remain green, byte-exact output diff allowed only on newly-added
   additive debug fields.
5. **E1 shallow lock-promotion smoke** — after the new source lands,
   `scripts/camera-pr-e1-shallow-lock-promotion-registry-smoke.mjs`
   must show `shallow_92deg` and `ultra_low_rom_92deg` at
   `gate.status === 'pass'` AND
   `finalPassLatched === true` AND
   `completionTruthPassed === true` (i.e. canonical, not via
   `pass_core_detected`).
6. **PR-F regression proof gate** —
   `scripts/camera-pr-f-regression-proof-gate.mjs` must run green with
   NO new entries in `ALLOWED_SKIP_MARKERS`. Existing markers for the
   two fixtures (`conditional_until_main_passes`,
   `shallow fixture not passing on this main`,
   `ultra-low-ROM fixture not passing on this main`,
   `pr01_completion_owner_not_yet_satisfied`) MUST be removable only
   after smoke #5 is green.

### §8.2 Illegal states that MUST remain locked

These 8 states (SSOT §6) must still be unreachable after the new source
lands. Each must have an assertion somewhere in the smoke set above:

1. `completionOwnerPassed !== true` AND `finalPassEligible === true`
2. `completionTruthPassed === false` AND `finalPassGranted === true`  *(legacy state observed in real telemetry — new source must not widen this; see §7)*
3. `completionOwnerReason === 'not_confirmed'` AND owner pass true
4. `completionOwnerPassed === true` AND owner blocked reason non-null
5. `cycleComplete === false` AND final pass true
6. Final-pass success described downstream as `failed`
7. standing/seated/setup/stale/mixed-rep pass surviving to final surface
8. assist-only shallow admission reopening final pass without canonical
   completion-owner truth

Notes on state #2: the new source MUST reduce the population of reps
that reach state #2 (by making more legitimate shallow reps reach
canonical truth); it MUST NOT increase the population; the full
resolution of state #2 is an authority-law session per §7.5.

### §8.3 Real shallow replay captures required

The new source's validation against realistic pose noise requires
per-frame raw pose captures. The capture schema is specified in
calibration study §8. Minimum requirement:

- ≥ 5 real shallow recordings at ≈ 92° peak knee angle.
- Per-frame `kneeAngleAvg` (deg).
- Per-frame `squatDepthProxyPrimary` (raw scalar pre-blend).
- Per-frame `squatDepthProxyBlended` (post-blend scalar).
- Per-frame `phaseHint` (as emitted).
- Per-frame `PoseFeaturesFrame.landmarksCompact` at ≥ 30 Hz across the
  full attempt window (NOT only peak snapshots).
- Baseline-standing window annotation (for baseline-freeze replay).
- Coverage of both normal-cadence (< 1.2 s) and extended-hold (> 3 s)
  shallow reps.

**Status**: NOT YET AVAILABLE. The user-supplied calibration bundle
contains only summary telemetry + overhead-reach peak snapshots; it
lacks per-frame squat trajectory arrays.

**Blocking rule**: the new source's implementation session MAY land
smoke items §8.1 #1 – #4 and may land E1 fixture recovery (#5) using
only the current synthetic fixture corpus. E1 fixture **promotion**
(`conditional_until_main_passes` → `permanent_must_pass`) MAY proceed
on synthetic coverage alone, because the synthetic fixtures are
representative per calibration study §6.1. Real-capture validation
remains as a **follow-on confidence test**, not a blocking prerequisite
for fixture promotion.

### §8.4 Rollback rule

If the implementation session discovers that the new source cannot
satisfy §5 proof obligations within the §4.4 admissible parameter band,
the session MUST:

1. Stop.
2. Revert `src/*` edits.
3. Produce a stop-report doc in `docs/pr/` identifying which §5
   obligation failed and why.
4. NOT broaden the §4.4 parameter band (that requires a new superseding
   SSOT).
5. NOT fall back to Candidate B without landing a full
   `blendedProvenance` contract design SSOT first.

---

## §9. Out-of-scope list (hard prohibitions for subsequent sessions
## until superseded)

The following are **prohibited** in the implementation session and in any
follow-on session that cites this SSOT, until a successor SSOT that
supersedes this one explicitly re-authorizes them:

1. **Threshold relaxation**:
   - lowering `SHALLOW_OFFICIAL_CLOSE_MIN_CYCLE_MS` below `800` ms;
   - lowering `attemptAdmissionFloor` below `0.02`;
   - widening `GUARDED_ULTRA_LOW_ROM_FLOOR` below `0.01`;
   - setting `KNEE_DESCENT_ONSET_EPSILON_DEG` below `3.0` or above `7.0`;
   - setting `KNEE_DESCENT_ONSET_SUSTAIN_FRAMES` below `2` or above `3`;
   - any scalar tuning outside the §4.4 admissible band.
2. **Pass-core opener revival**: no code path may be added whose effect
   is to make `pass-core` positive evidence sufficient, by itself, to
   open canonical `completionTruthPassed === true`. The §7 coexistence
   accounting with `pass_core_detected` is **observation + deferral**,
   not endorsement.
3. **Fake `phaseHint === 'descent'` injection**: neither at the mock
   level nor at the pose-feature-extraction level. §4's new source
   replaces the need for phaseHint emission on shallow reps; it does not
   manufacture it.
4. **Fixture-side cheat**: no modification to the synthetic
   `squatPoseLandmarksFromKneeAngle` fixture family to make the new
   source fire at a cherry-picked timestamp. The fixture corpus is
   representative (calibration study §6.1) and MUST remain unchanged
   during this design branch.
5. **Fixture re-derivation from real recordings**: calibration study
   §6.1 proved this would make Source #2 strictly worse, not better.
   Fixture re-derivation as a recovery tactic is forbidden.
6. **Advancing to P2 / P3 / P4**: all three remain blocked until this
   design SSOT's implementation session lands and smoke items §8.1
   #1 – #6 are green.
7. **Expanding `ALLOWED_SKIP_MARKERS` in PR-F proof gate**: no new
   markers may be added to paper over a failed §8.1 smoke. If a smoke
   fails, the fix is §8.4 rollback, not skip-marker expansion.
8. **Using Candidate B or Candidate C as a replacement for Candidate A**
   without landing a successor design SSOT that explicitly supersedes
   §3.4 ranking.
9. **Promoting `shallow_92deg` or `ultra_low_rom_92deg`** to
   `permanent_must_pass` before §8.1 smoke #5 is green AND
   `completionTruthPassed === true` on both fixtures.
10. **Downgrading `shallow_92deg` or `ultra_low_rom_92deg`** to `skip_permanent`,
    `deprecated`, or any status that removes them from the E1 registry's
    active set.
11. **Closing the `pass_core_detected` completionOwnerReason path in
    this branch**. §7.5 identifies that as an authority-law session; it
    MUST NOT be resolved as part of this design's implementation PR.
12. **Broadening the scope of this branch to non-squat modules**,
    to pose-features internals, to the pass-window architecture, or to
    the UI / route / page layer.

---

## §10. Session exit summary

### §10.1 What this session produced
- This design SSOT at `docs/pr/PR-CAM-SQUAT-SHALLOW-AUTHORITY-SAFE-DESCENT-SOURCE-EXPANSION.md`.
- Zero `src/*` / `scripts/*` / threshold / fixture / authority-law /
  proof-gate / blocker / naming changes.
- Zero temporary scripts left in-tree.

### §10.2 What the next session (implementation) must do
1. Cite this SSOT as binding in its PR prompt.
2. Implement `legitimateKinematicShallowDescentOnsetFrame` per §4.1.
3. Wire it as the 4th candidate to `effectiveDescentStartFrame` per §4.2.
4. Pick `KNEE_DESCENT_ONSET_EPSILON_DEG` and
   `KNEE_DESCENT_ONSET_SUSTAIN_FRAMES` values within §4.4 bands, freeze
   them in named constants.
5. Land smoke items §8.1 #1 – #4 in the same PR.
6. Land Lever B (reversal/peak separation) optionally, in a separate
   commit, if ordering-bit correctness is needed for the fixtures to
   satisfy `anti=1`.
7. Add the §7.4 item 3 `canonicalShallowContractDrovePass` debug boolean.
8. Add the §7.4 item 4 code comment citing §7 coexistence deferral.
9. NOT promote E1 fixtures in the same PR — promotion is smoke #5's
   own PR (aligned with P4).

### §10.3 What authority-law session must eventually do (not this branch)
Resolve the §7.2 vs §7.3 interpretation ambiguity for the
`completionOwnerReason === "pass_core_detected"` path, using the
`canonicalShallowContractDrovePass` diagnostic introduced by §7.4 item 3.

### §10.4 Blocked-until-resolved
- P2, P3, P4 remain blocked until §8.1 #1 – #6 are all green.
- E1 entries for `shallow_92deg` and `ultra_low_rom_92deg` remain
  `conditional_until_main_passes`. Promotion is gated on §8.1 smoke #5.
  Downgrade is forbidden (§9 item 10). PR-F SKIP markers remain at
  current breadth (§9 item 7).

---

## §11. Final lock

This design SSOT defines the **next authority-safe shallow descent source
branch** as `legitimateKinematicShallowDescentOnsetFrame`, a
`kneeAngleAvg` monotonic-descent onset source with kinematic gating,
which fills the Source #4 slot in `effectiveDescentStartFrame` and allows
the canonical shallow contract to satisfy its minimum-cycle gate on
legitimate shallow reps without depending on the saturation-prone primary
depth channel, on phaseHint emission that the real pipeline does not
produce, or on the pass-core assist path currently observed in production
telemetry. Its proof obligations (§5), split-brain guards (§6),
coexistence accounting with `pass_core_detected` (§7), and validation
plan (§8) are binding on the implementation session that cites this
SSOT. P2, P3, P4, and E1 fixture promotion remain blocked until that
implementation session lands green against §8.1.
