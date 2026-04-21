# P1 Calibration Study Result — Real vs Synthetic Shallow Fixture Representativeness

> **Session type**: read-only fixture representativeness study.
> **Artifacts written**: this document only. No `src/*`, `scripts/*`, threshold,
> fixture, authority-law, proof-gate, blocker, or naming changes. No temporary
> capture scripts committed or left in-tree.
>
> **Non-negotiable invariants preserved while studying**:
> 1. Completion-owner truth is the ONLY opener of final pass (PR-01 freeze).
> 2. Pass-core / shallow-assist / closure-proof / bridge / event-cycle are NOT openers.
> 3. Absurd-pass registry is block-only.
> 4. Threshold relaxation is forbidden.
> 5. Quality truth is separate from pass truth.

- Classifying decision doc: [P1-FOLLOWON-CLASSIFICATION-DECISION.md](./P1-FOLLOWON-CLASSIFICATION-DECISION.md)
- Parent prompt: [P1-CALIBRATION-STUDY-REPRESENTATIVENESS-PROMPT.md](./P1-CALIBRATION-STUDY-REPRESENTATIVENESS-PROMPT.md)
- Prior diagnosis: [P1-DIAGNOSIS-V2-SHALLOW-SIGNAL-SHAPE-BLOCKER.md](./P1-DIAGNOSIS-V2-SHALLOW-SIGNAL-SHAPE-BLOCKER.md)
- Authority law: [PR-01-SQUAT-COMPLETION-FIRST-AUTHORITY-FREEZE.md](./PR-01-SQUAT-COMPLETION-FIRST-AUTHORITY-FREEZE.md)

> **E1 registry addendum (current main):** `shallow_92deg` and `ultra_low_rom_92deg` are **`permanent_must_pass`** with full canonical proof — `docs/pr/PR-E1-shallow-representative-must-pass-landed-status-lock.md`. Telemetry conclusions and Branch B design direction in this study are **not** retracted; closure sections that speak of “E1 still conditional” describe **study-time** registry, not current main.

---

## §1. Scope and data sources

### §1.1 Study question

> **Does the current synthetic shallow fixture materially misrepresent real
> shallow motion as consumed by the current engine?**

Decision rule (from parent prompt §"Required decision rule"):

- **Confirm Branch A** if real shallow recordings form earlier legitimate
  descent evidence under the current engine than the synthetic fixture.
- **Falsify Branch A → Branch B** if real recordings also fail with materially
  the same timing shape and blocker profile.
- **Data-collection blocker** only if recordings are unavailable or unusable.

### §1.2 Synthetic fixtures (Branch A's reference point)

- `shallow_92deg` — at study time, E1 `conditional_until_main_passes` (**current main:** `permanent_must_pass`); synthetic via
  `squatPoseLandmarksFromKneeAngle` (see `P1-DIAGNOSIS-V2` §3.1).
- `ultra_low_rom_92deg` — same mock family, same logistic-flat
  `squatDepthProxy` profile in the critical early descent window; same E1 registry note as `shallow_92deg`.

### §1.3 Real user recordings (Branch A's test set)

User-supplied `agent_handoff_shallow_calibration_bundle.md` containing three
full telemetry JSONs captured on the user's deployed build. Each JSON contains
an `attempts[]` array plus a long `squatAttemptObservations[]` per-attempt
observation trace.

| JSON | Squat attempt id | Capture wall-clock (UTC) | `ownerFreezeVersion` |
|---|---|---|---|
| 1 | `trace-1776699703833-hbxb1fg` | 2026-04-20 15:41:43.833Z | `cam-pass-owner-freeze-01` |
| 2 | `trace-1776699745385-az1a2ku` | 2026-04-20 15:42:25.385Z | `cam-pass-owner-freeze-01` |
| 3-A | `trace-1776699745385-az1a2ku` *(duplicate of JSON 2)* | 2026-04-20 15:42:25.385Z | `cam-pass-owner-freeze-01` |
| 3-B | `trace-1776699782474-ub6g7c5` | 2026-04-20 15:43:02.474Z | `cam-pass-owner-freeze-01` |

`ownerFreezeVersion = cam-pass-owner-freeze-01` = PR-01 authority freeze
is active in every captured attempt. These are current-engine recordings, not
pre-PR-01 archives.

After removing the JSON-3 duplicate of JSON 2, the distinct squat-movement
recordings are **3**: JSON 1, JSON 2 (= JSON 3-A), JSON 3-B.

### §1.4 Selection criteria applied

- `movementType === "squat"` only (overhead-reach retries in JSON 1/JSON 2 are
  separate movement types and are excluded).
- `depthBand === "shallow"` on every selected attempt.
- `relativeDepthPeak ∈ {0.06}` on every selected attempt (matches
  `shallow_92deg` target band).
- `evidenceLabel === "ultra_low_rom"` on every selected attempt (matches
  `ultra_low_rom_92deg` target band).
- All 3 distinct recordings are in the selected set. n = 3 ≥ 2 required.

### §1.5 Important data-availability caveat

The real JSONs contain **summary telemetry** (engine outputs like
`descendStartAtMs`, `cycleDurationMs`, `rawDepthPeakPrimary`, etc.) and
**isolated landmark snapshots for overhead-reach peak frames**. They do **not**
contain a per-frame time series of `kneeAngleAvg`, `squatDepthProxy`, or
`squatDepthProxyBlended`.

Consequence: the required per-frame trajectory comparison cannot be executed
frame-for-frame on the current engine from these files alone. However, the
available summary telemetry exposes the three fields that decide Branch A vs
Branch B unambiguously:

1. `rawDepthPeakPrimary` (scalar) — peak of the primary depth channel across
   the attempt.
2. `rawDepthPeakBlended` (scalar) — peak of the blended depth channel.
3. `canonical-contract-equivalent blocker profile` — `cycleDurationMs`,
   `minimumCycleDurationSatisfied`, `descent_span_too_short` /
   `ascent_recovery_span_too_short`, and `officialShallowPathBlockedReason`.

These three fields, combined with the trajectory-level evidence in
`P1-DIAGNOSIS-V2` §3.1 for the synthetic fixture, are sufficient to decide
the classification under the prompt's decision rule. See §8 for the residual
work this limitation leaves for a follow-on measurement session, and §9 for
the prohibitions that remain in force because this limitation is real.

---

## §2. Synthetic fixture measurement recap (from `P1-DIAGNOSIS-V2` §3.1)

The mock's `squatDepthProxy` trajectory on `shallow_92deg` (k = 0.2,
baseline-frozen) over pre-peak frames:

| idx | timestampMs | kneeAngle° | `squatDepthProxy` | Δ vs standing baseline |
|---:|---:|---:|---:|---:|
| 0–7 | 200–760 | 170 | 4.49 × 10⁻⁷ | 0 |
| 8 | 840 | 165 | 5.46 × 10⁻⁷ | ≈ 1 × 10⁻⁷ |
| 9 | 920 | 155 | 9.55 × 10⁻⁷ | ≈ 5 × 10⁻⁷ |
| 10 | 1000 | 145 | 2.48 × 10⁻⁶ | ≈ 2 × 10⁻⁶ |
| 11 | 1080 | 130 | 1.10 × 10⁻⁵ | ≈ 1 × 10⁻⁵ |
| 12 | 1160 | 115 | 7.19 × 10⁻⁵ | ≈ 7 × 10⁻⁵ |
| 13 | 1240 | 100 | 5.83 × 10⁻⁴ | ≈ 6 × 10⁻⁴ |
| 14 | 1320 | 95 | 2.90 × 10⁻³ | ≈ 2.9 × 10⁻³ |
| 15 | 1400 | 93 | **8.69 × 10⁻³** | earliest k-ε crossing |
| 16 | 1480 | 92 | 1.81 × 10⁻² | baseline anchor |
| 19 | 1720 | 95 | 4.37 × 10⁻² | peak |

Key synthetic scalars:

| Field | Synthetic `shallow_92deg` value |
|---|---|
| `rawDepthPeakPrimary` (peak-of-primary) | **≈ 4.37 × 10⁻²** |
| First phaseHint === 'descent' | **never emitted** (mock emits no phaseHint) |
| Earliest k-ε crossing with k ∈ [0.15, 0.25] | 1400ms |
| `peakAtMs` | 1720 |
| `reversalAtMs` (baseline) | 1720 (= peak; anti=0) |
| `reversalAtMs` (with Lever B) | 1800 |
| `standingRecoveredAtMs` | 1960 |
| `cycleDurationMs` | 480 baseline, 560 with Lever A + B |
| `canonicalShallowContractBlockedReason` | `minimum_cycle_timing_blocked` |
| `gate.status` | `retry` |
| `finalPassBlockedReason` | `completion_truth_not_passed` |

---

## §3. Real recording measurement table

All 3 distinct real squat attempts produced the following summary telemetry
under the current PR-01 authority freeze (verbatim from
`agent_handoff_shallow_calibration_bundle.md`):

| Field | JSON 1 squat | JSON 2 squat | JSON 3 squat #2 |
|---|---:|---:|---:|
| Attempt id | `...703833-hbxb1fg` | `...745385-az1a2ku` | `...782474-ub6g7c5` |
| `depthBand` | `shallow` | `shallow` | `shallow` |
| `evidenceLabel` | `ultra_low_rom` | `ultra_low_rom` | `ultra_low_rom` |
| `relativeDepthPeak` | 0.06 | 0.06 | 0.06 |
| `rawDepthPeakPrimary` | **1.41 × 10⁻⁷** | **1.08 × 10⁻⁷** | **1.74 × 10⁻⁷** |
| `rawDepthPeakBlended` | 0.0586 | 0.0586 | 0.0586 |
| `armingDepthSource` | `blended_preferred` | `blended_preferred` | `blended_preferred` |
| `armingDepthPeak` | 0.059 | 0.059 | 0.059 |
| `squatDepthBlendActiveFrameCount` | 31 | 3 | 4 |
| `squatDepthBlendOfferedCount` | 44 | 9 | 10 |
| First `phaseHint === 'descent'` | **never emitted** | **never emitted** | **never emitted** |
| Distinct phaseHints observed in trace | `committed_bottom_or_downward_commitment`, `standing_recovered` | same | same |
| `descendStartAtMs` | 24475 | 13098.8 | 12644 |
| `peakAtMs` *(committed/post-commit)* | 24867.4 | 13582.7 | 12744.1 |
| `reversalAtMs` | 24867.4 | 13582.7 | 12744.1 |
| `reversalAtMs === peakAtMs` | **true (anti=0)** | **true (anti=0)** | **true (anti=0)** |
| `standingRecoveredAtMs` | 33593.1 | 13683.1 | 13344.9 |
| `cycleDurationMs` | 9118.1 *(extended bottom hold)* | **584.3** | **700.9** |
| `minimumCycleDurationSatisfied` | true | **false** | **false** |
| `officialShallowPathBlockedReason` | (none surface) | `ascent_recovery_span_too_short` | `descent_span_too_short` |
| `completionBlockedReason` | null | `ascent_recovery_span_too_short` | `descent_span_too_short` |
| `canonicalShallowContractBlockedReason` *(nearest proxy)* | implicit via `completionTruthPassed=false` | `ascent_recovery_span_too_short` | `descent_span_too_short` |
| `completionTruthPassed` | **false** | **false** | **false** |
| `officialShallowClosureProofSatisfied` | true | true | true |
| `officialShallowPathClosed` | true *(via stream bridge)* | false | false |
| `completionOwnerPassed` | true | true | true |
| `completionOwnerReason` | `pass_core_detected` | `pass_core_detected` | `pass_core_detected` |
| `finalPassEligible` | **true** | **true** | **true** |
| `finalPassLatched` | **true** | **true** | **true** |
| `finalPassBlockedReason` | null | null | null |
| `gate.status` proxy | `pass_latched` | `pass_latched` | `pass_latched` |

Source line references (`agent_handoff_shallow_calibration_bundle.md`):

- JSON 1 squat block: L63–L449.
- JSON 2 squat block: L5983–L6371.
- JSON 3 squat #2 block: L14303–L14687.
- `rawDepthPeakPrimary` values: L237, L6157, L14477.
- `phaseHint` enumeration across the bundle (57 occurrences, 0 `descent`):
  L2828, L3002, L3176, L3351, L3525, L3700, L3877, L4054, L4232, L4408,
  L4584, L4761, L4939, L5113, L5290, L5468, L8749…L11039, L16282…L20863.

---

## §4. Earliest legitimate descent evidence comparison

The parent prompt's Branch A confirmation criterion is:

> real shallow recording shows that the current engine forms **earlier
> legitimate descent evidence** than the synthetic fixture in the critical
> early window, such that the synthetic fixture is clearly the abnormal element.

"Legitimate descent evidence" means one of the three sources in
`squat-completion-core.ts`'s `effectiveDescentStartFrame` priority order:

1. `descentFrame` — primary, keyed to `phaseHint === 'descent'`.
2. `trajectoryDescentStartFrame` — fallback, keyed to
   `depth >= attemptAdmissionFloor × 0.4`.
3. `sharedDescentEpochFrame` — secondary, pass-window-owned.

### §4.1 Source #1 (phaseHint === 'descent')

- **Synthetic**: never emitted.
- **Real**: **never emitted**. All 57 `phaseHint` values across three JSONs
  are `committed_bottom_or_downward_commitment` or `standing_recovered`.
  Zero instances of `phaseHint === 'descent'`.

**Identical behavior.** The synthetic mock is not uniquely deficient on
Source #1 — the real pipeline does not emit descent phaseHints on shallow
reps either.

### §4.2 Source #2 (threshold-based on primary depth)

- **Synthetic**: primary-channel `squatDepthProxy` reaches peak of
  ≈ 4.37 × 10⁻² at the bottom of the rep (knee angle 95°). Earliest
  authority-safe crossing at k ∈ [0.15, 0.25] is 1400ms, ≈ 320ms before peak.
- **Real** (all 3 recordings): `rawDepthPeakPrimary ∈ [1.1, 1.7] × 10⁻⁷` at
  the peak of the rep. **The real engine's primary depth channel saturates
  at ≈ 10⁻⁷ throughout the entire shallow rep — not just the early window.**
  It never reaches any k-ε crossing at all. Period.

**Real is materially worse than synthetic on Source #2.** The synthetic
fixture's primary channel reaches 4.37 × 10⁻² at peak, which at least gives
Source #2 a late-window crossing. The real primary channel stays pinned at
≈ 10⁻⁷ for the entire rep.

### §4.3 Source #3 (sharedDescentEpochFrame / blended)

The real-recording data shows `armingDepthSource = "blended_preferred"` on
every attempt, with `rawDepthPeakBlended ≈ 0.0586` and
`squatDepthBlendActiveFrameCount ≥ 3` (up to 31). That is: the engine has
already fallen back to the **blended** channel because the primary is
saturated. The blended channel reaches a rep-peak ≈ 0.0586 — close to the
synthetic fixture's ≈ 0.044 primary peak.

However, this blended signal is what powers `completionOwnerReason =
"pass_core_detected"` — i.e., the pass-core assist path — not the canonical
`effectiveDescentStartFrame` Source #3 that Lever A targets. Evidence:

- `officialShallowPathClosed` is **false** on both short-cycle real
  recordings (JSON 2, JSON 3#2). The canonical shallow contract's closure
  still fails.
- `completionTruthPassed` is **false** on all 3 real recordings.
- The reason `finalPassLatched` is `true` is that the PR-01-frozen engine
  currently passes `completionOwnerPassed = true` whenever the pass-core
  subsystem reports detection, via `completionOwnerReason = "pass_core_detected"`,
  regardless of `completionTruthPassed`. (See §7 for the PR-01 implication
  this exposes; it is not in-scope to fix here.)

**Real is not materially earlier than synthetic on Source #3 at the canonical-
contract level.** Real reps close via the pass-core assist path, not the
canonical descent source ladder.

### §4.4 Synthesis of §4.1–§4.3

| Descent source | Synthetic | Real | Gap |
|---|---|---|---|
| #1 phaseHint=='descent' | never | never | none |
| #2 threshold-based primary | 1400ms (k=0.15) | **never** (peak = 10⁻⁷) | real worse |
| #3 sharedDescent / blended | blended available, closes via bridge | blended available, does NOT close canonical contract | real worse or equal |

**There is no source on which the real data forms earlier legitimate descent
evidence than the synthetic fixture.** On the source that the current code
privileges (Source #2, primary-depth-threshold), the real data is strictly
worse than the synthetic.

---

## §5. Contract blocker profile comparison

The parent prompt's Branch A falsification criterion is:

> Real shallow recordings also fail under the current engine with **materially
> the same timing shape and blocker profile**, showing that the current source
> family is insufficient even on realistic input.

| Blocker / gate | Synthetic baseline | Synthetic + Lever A+B | Real JSON 1 | Real JSON 2 | Real JSON 3#2 |
|---|---|---|---|---|---|
| `reversalAtMs === peakAtMs` | yes | fixed by Lever B | yes *(24867.4)* | yes *(13582.7)* | yes *(12744.1)* |
| `minimumCycleDurationSatisfied` | false | false | true *(long bottom hold)* | **false** *(584ms)* | **false** *(701ms)* |
| Cycle too short for 800ms floor | yes | yes (560ms) | no *(9118ms)* | yes | yes |
| `descent_span_too_short` family gate | firing (`minimum_cycle_timing_blocked`) | firing | — | — | yes *(descent_span_too_short)* |
| `ascent_recovery_span_too_short` family gate | implicit | implicit | — | yes | — |
| Canonical contract primary blocker | `minimum_cycle_timing_blocked` | `minimum_cycle_timing_blocked` | implicit via `completionTruthPassed=false` | `ascent_recovery_span_too_short` | `descent_span_too_short` |
| `officialShallowPathClosed` | false | false | **true** *(via stream bridge + extended hold)* | **false** | **false** |
| `completionTruthPassed` | false | false | **false** | **false** | **false** |

Observations:

1. **`completionTruthPassed === false` is universal**, across synthetic baseline,
   synthetic + Lever A+B, and all 3 real recordings. The canonical
   completion-owner truth never passes on real shallow reps at this depth
   band.
2. **Short-cycle real reps (JSON 2, JSON 3#2) hit the same blocker family as
   the synthetic fixture.** `descent_span_too_short` and
   `ascent_recovery_span_too_short` are siblings of
   `minimum_cycle_timing_blocked` in the canonical shallow contract —
   they all encode the "cycle timing too short to trust as legitimate shallow
   rep" property.
3. **`reversalAtMs === peakAtMs` is universal** across every short real rep
   AND every synthetic baseline rep. Lever B's fix is equally applicable to
   real and synthetic; neither is uniquely broken.
4. **JSON 1 avoids the short-cycle blocker only because the user held the
   bottom position for ≈ 8700ms, producing `cycleDurationMs = 9118ms`.**
   That is not a "realistic representative shallow rep" — it is a rep with
   an unusually long bottom hold. A normal-cadence real shallow rep
   (JSON 2 at 584ms, JSON 3#2 at 701ms) produces the same sub-800ms cycle
   profile as the synthetic fixture.
5. **`rawDepthPeakPrimary ≈ 10⁻⁷` in real data** (§3 table) directly
   falsifies `P1-DIAGNOSIS-V2` §3.2's optimistic hypothesis that a real
   recording would have an earlier meaningful primary-channel crossing. The
   primary channel is saturated in real data for the entire rep, which is
   strictly worse than the synthetic mock's logistic tail (mock primary peaks
   at ≈ 0.044; real primary peaks at ≈ 10⁻⁷).

**The timing shape and blocker profile match, feature-for-feature, between
real and synthetic.** The canonical shallow contract, which is what
`completionTruthPassed` gates and what the E1 fixture promotion requires,
is insufficient on both.

---

## §6. Primary classification decision — Branch A falsified

**Decision: Branch A (fixture calibration problem) is FALSIFIED.**
**Escalation: Branch B (new authority-safe descent source design PR) is CONFIRMED.**

Justification ranking (highest weight first):

### §6.1 Direct empirical falsifier on the central Branch A premise

The prior classification (`P1-FOLLOWON-CLASSIFICATION-DECISION.md` §4.1 A1–A3)
rested on three premises:

- **A1**: the synthetic mock under-shifts hip position relative to real
  anthropometry, so early descent gradient is structurally flatter than real.
- **A2**: the synthetic mock does not emit phaseHint, but the real pipeline
  would.
- **A3**: the current source family's primary channel is phaseHint, not
  threshold; a fixture that exercises only the threshold fallback is
  stress-testing the wrong branch.

All three are directly falsified by the real-recording data:

- **A1 is false**: on the quantity that actually matters for the
  threshold-based descent source (`squatDepthProxyPrimary`), real is 5 orders
  of magnitude SATURATED (≈ 10⁻⁷) compared to the synthetic (≈ 4.4 × 10⁻²).
  The synthetic fixture is *more* generous to Lever A than real motion is,
  not less. A fixture re-derivation from real data would not recover the
  fixtures — it would make the situation strictly worse by pinning the
  primary channel at 10⁻⁷ through the entire rep.
- **A2 is false**: real pose-feature extraction also does not emit
  `phaseHint === 'descent'` on shallow reps. Zero of 57 observed phaseHints
  in real data are `'descent'`.
- **A3 is false at the canonical-contract level**: real reps that pass the
  canonical contract do so via the `blended_preferred` / stream-bridge path,
  not via the phaseHint source #1. That path exists in the synthetic fixture
  too and is not what's failing. What's failing is the **cycle-timing
  gate**, which is identical in real and synthetic short-cadence reps.

### §6.2 Blocker-profile symmetry

§5 showed that short-cadence real reps (JSON 2, JSON 3#2) fail the canonical
shallow contract with the same family of blockers as the synthetic fixture:

- `descent_span_too_short`
- `ascent_recovery_span_too_short`
- `minimum_cycle_timing_blocked`
- `reversalAtMs === peakAtMs`

These are not aliases — they are sibling gates in the same canonical
contract's timing-bundle branch. Any new descent-source design that targets
the cycle-timing problem must satisfy the same proof obligations for real
and synthetic reps alike.

### §6.3 The only reason real reps "pass" is a completion-owner assist path
### that is orthogonal to the canonical shallow contract

Across all 3 real recordings:

- `completionTruthPassed === false` — canonical contract fails.
- `completionOwnerPassed === true` via `completionOwnerReason === "pass_core_detected"`.
- `finalPassEligible === true` and `finalPassLatched === true` follow from
  the completion-owner signal, not from the canonical contract.

This means the real engine is passing shallow reps through a **pass-core
detection completion-owner path**, not through canonical shallow contract
truth. For the E1 fixture to pass at the canonical-contract level (which is
what `shallow_92deg` / `ultra_low_rom_92deg` promotion requires), the engine
needs a new authority-safe descent source that can make the canonical
shallow contract's cycle-timing gate pass on the observed real signal shape
without relying on the pass-core assist.

That is, by definition, Branch B.

### §6.4 Cheap Branch A falsifier is exhausted

The Branch A calibration hypothesis has been falsified with the cheapest
possible instrument (real telemetry vs synthetic telemetry comparison under
the current engine's own authority freeze). Further Branch A work —
especially fixture re-derivation from real recordings — would be expensive
and would make the timing-gate problem worse, not better.

---

## §7. Exact next session recommendation

Per parent prompt §"Exact next-step recommendation rules" for "Branch A
falsified":

> recommend a **new authority-safe descent source design session only** —
> explicitly require a new SSOT and absurd-pass proof bundle — state that
> this is not a small P1 patch continuation — keep P4/P3/P2 blocked until
> that new design branch is resolved.

### §7.1 Next session type

**Design session: `PR-CAM-SQUAT-SHALLOW-AUTHORITY-SAFE-DESCENT-SOURCE-EXPANSION`**
(or equivalent explicit PR name). **Not an implementation session. Not a P1
continuation. Not a P4/P3/P2 session.**

### §7.2 Required deliverables (design-only, no `src/*` edits)

1. **New SSOT section (or companion SSOT)** defining a descent-source tier
   that does **not** depend solely on `squatDepthProxyPrimary` or on
   `attemptAdmissionFloor`-scaled relative primary-depth thresholds.
   Candidate (non-binding, for the design session to evaluate):
   - `kneeAngleAvg` monotonic-descent onset with kinematic gating, or
   - `squatDepthProxyBlended` promoted from assist-only to authority-safe
     with its own absurd-pass proof obligations, or
   - An explicitly modelled downward-commitment epoch driven by
     `downwardCommitmentReached` + `baselineFrozen` + kinematic plausibility
     rather than a scalar-depth crossing.
2. **Absurd-pass proof bundle** covering at minimum:
   - `standing_still`
   - `setup_motion_contaminated`
   - `no_real_descent`
   - `contaminated_blended_early_peak_false_pass`
   - `stale_prior_rep`
   - `mixed_rep_leakage`
   - The five families currently under `absurd-pass registry` as block-only.
3. **Split-brain guard design** that proves the new source cannot contradict
   canonical completion-owner truth, cannot open final pass independently of
   `completionTruthPassed`, and does not regress the
   `canonicalShallowContractSplitBrainDetected` flag.
4. **Coexistence spec** with the existing `pass_core_detected`
   completion-owner path — the design must either (a) supersede it in
   authority ordering or (b) clarify why both can coexist without violating
   PR-01 §"completion-owner truth is the only opener".
5. **Revalidation plan** for `shallow_92deg` and `ultra_low_rom_92deg`
   against the new source family, using the current synthetic fixtures
   unchanged (since §6.1 proved the synthetic fixtures are representative).
6. **Real-frame replay plan** specifying the raw-frame capture schema that
   future real recordings must include (see §8) so that a future session can
   definitively replay real data through the current engine.

### §7.3 Authority-law anchor

The new SSOT must explicitly keep all five PR-01 invariants:

1. completion-owner truth is the only opener of final pass;
2. pass-core / assist / bridge / closure proof / event-cycle are not
   openers;
3. absurd-pass registry stays block-only;
4. no threshold relaxation;
5. quality truth stays separate from pass truth.

Any design that requires relaxing any of the five is out of scope and must
trigger an immediate stop with a higher-level SSOT escalation.

### §7.4 Blocked-until-resolved

**At the time this section was written:**

- P2, P3, P4 remain blocked until the new source design PR lands its design
  SSOT, its absurd-pass proof bundle, and its split-brain guard proof.
- E1 registry entries for `shallow_92deg` and `ultra_low_rom_92deg` remain
  `conditional_until_main_passes`. Promotion to `permanent_must_pass` is
  forbidden until §7.2 items 1–4 are complete and the fixtures pass under
  the new design's implementation.
- Downgrade of either fixture to `conditional` or `skip_permanent` is
  forbidden.
- PR-F `ALLOWED_SKIP_MARKERS` stays at current breadth. No new markers.

**Current main:** E1 promotion for the two representatives **has landed**; PR-F explained-SKIP allowlist is defined solely by `scripts/camera-pr-f-regression-proof-gate.mjs` (`no PR-D broadening` only). P3/P2 blocking language above may still apply until those prompts authorize work.
- `P1-FOLLOWON-CLASSIFICATION-DECISION.md` §8's "fixture calibration
  representativeness study" recommendation is superseded by this result.
  A fixture re-derivation session is no longer the correct next step; §6.1
  showed it would make the problem worse.

### §7.5 Out-of-band finding to surface to the authority team

The real telemetry shows `completionTruthPassed === false` together with
`finalPassEligible === true` and `finalPassLatched === true` under
`ownerFreezeVersion = cam-pass-owner-freeze-01`, routed via
`completionOwnerReason === "pass_core_detected"`. This is empirically the
state that the PR-01 parent prompt described as forbidden
(*"completionTruthPassed === false 인데 finalPassEligible === true 상태는
다시 나오면 안 된다"*). Either:

- the current engine admits `pass_core_detected` as a sanctioned
  completion-owner reason by explicit design (which is consistent with
  `completionOwnerPassed === true` in the field), in which case PR-01's
  textual invariant wording needs reconciling with the implemented
  authority ladder, **OR**
- there is a latent PR-01 authority gap in production and the pass-core
  path is opening pass without canonical truth.

**This finding is out of scope for the P1 branch.** It must be surfaced to
the authority-law owner as part of the new-source design PR's §7.2 item 4
"coexistence spec" deliverable, not resolved in isolation here. Do not patch
it in a P1 follow-on session; the correct disposition is an authority-law
session.

---

## §8. Residual data-collection plan

The parent prompt's preferred evidence modality — per-frame
`kneeAngleAvg` / `squatDepthProxy` / `squatDepthProxyBlended` trajectories
from real recordings, replayed through the current engine — was **not**
achievable from the supplied JSON bundle because the bundle ships only
summary telemetry + isolated landmark snapshots. The available scalar
telemetry (§3) was sufficient to decide Branch A vs Branch B, but the
follow-on design session in §7 will need trajectory-level data to validate
its absurd-pass proofs on realistic pose noise.

Required future capture schema for **real shallow recordings**, to be
produced **before** the new-source design PR's implementation phase (not
needed for its design SSOT phase):

- Per-frame `kneeAngleAvg` (deg).
- Per-frame `squatDepthProxyPrimary` (raw scalar, pre-blend).
- Per-frame `squatDepthProxyBlended` (post-blend scalar).
- Per-frame `phaseHint` (as emitted by pose-feature extraction).
- Per-frame `PoseFeaturesFrame.landmarksCompact` at 30+ Hz across the full
  attempt window, not just peak snapshots.
- Baseline-standing window annotation (so baseline freeze can be replayed).
- At least 5 real shallow recordings at ≈ 92° peak depth spanning
  normal-cadence (< 1.2s) and extended-hold (> 3s) reps.

Capture schema delivery is **not** blocking for the §7 design SSOT — that
session is design-only.

---

## §9. Hard prohibitions for the next session

The following are prohibited in the next session (new authority-safe descent
source design) unless separately re-authorized by an explicit new prompt
that supersedes this result:

1. **Threshold relaxation** — lowering `k` below 0.15, lowering
   `SHALLOW_OFFICIAL_CLOSE_MIN_CYCLE_MS` below 800ms, softening
   `attemptAdmissionFloor` below 0.02, widening
   `GUARDED_ULTRA_LOW_ROM_FLOOR` below 0.01, or any scalar-knob tuning
   outside existing spec ranges.
2. **Pass-core opener revival** — no reintroduction of any pre-PR-01
   pass-core-first opener shortcut. Pass-core remains non-opener assist,
   veto, and trace only. Specifically, the `completionOwnerReason ===
   "pass_core_detected"` path observed in real telemetry must not be
   promoted to "opener" by the new design; its coexistence accounting
   (§7.2 item 4) must treat it as at most a sanctioned completion-owner
   reason under PR-01's existing ladder, not a new opener.
3. **Authority shortcut reopening** — no assist-only or bridge-based
   reopening of final pass without canonical completion-owner truth. SSOT
   §6 illegal state #8 must stay closed.
4. **Fake phaseHint injection** — no mock-level or engine-level synthesis
   of `phaseHint === 'descent'` for shallow reps. §4.1 showed the real
   pipeline does not emit it; fabricating it would hide the real failure
   class rather than solve it.
5. **Unrealistic landmark manipulation in fixtures** — the synthetic
   `squatPoseLandmarksFromKneeAngle` fixture family is **representative** of
   real motion at the primary-depth and phaseHint level per §6.1. Do not
   "fix" the mock to make it pass. Promoting the fixtures is the job of the
   new source, not the fixture.
6. **Fixture re-derivation from real recordings** — §6.1 showed this would
   make the timing-gate failure strictly worse (real primary is saturated at
   10⁻⁷). The `P1-FOLLOWON-CLASSIFICATION-DECISION.md` §8 recommendation for
   a fixture re-derivation session is superseded and must not be pursued.
7. **Advancing to P2 / P3 / P4** — all three remain blocked until the new
   source design SSOT + absurd-pass proof bundle + split-brain guard land.
   The parent `PLANMODE-P1-P4-P3-P2-IMPLEMENTATION-PROMPT` sequence cannot
   proceed.
8. **Committing runtime code** — the §7 design session produces a docs-only
   SSOT, proof-bundle design, and split-brain guard design. No `src/*` or
   engine `scripts/*` commits in that session. Implementation waits for a
   subsequent session after the design SSOT is approved.
9. **Expanding PR-F `ALLOWED_SKIP_MARKERS`** as a substitute for recovery.
   The PR-F proof gate's conditional SKIP markers must stay at current
   breadth. No new markers to paper over the shallow-contract failure.
10. **Patching the §7.5 out-of-band PR-01 invariant finding in a P1
    follow-on session.** That finding must be surfaced to the authority-law
    owner via the new-source design PR's coexistence spec (§7.2 item 4), not
    resolved in a narrow P1 patch.

---

## §10. Final lock

This calibration study **falsifies Branch A** (fixture calibration problem)
and **confirms Branch B** (new authority-safe descent source required) on
the empirical evidence that:

- real `squatDepthProxyPrimary` saturates at ≈ 10⁻⁷ across the entire
  shallow rep — strictly worse than the synthetic fixture's ≈ 4.4 × 10⁻²
  peak;
- real pose-feature extraction emits zero `phaseHint === 'descent'` on
  shallow reps, matching the synthetic mock;
- real short-cadence shallow reps produce `cycleDurationMs < 800ms` with
  the same blocker family (`descent_span_too_short`,
  `ascent_recovery_span_too_short`) as the synthetic fixture;
- real shallow reps' `completionTruthPassed` is false on every observed
  attempt under the current PR-01 freeze;
- real shallow "passes" route exclusively through `completionOwnerReason
  === "pass_core_detected"`, not through canonical shallow contract truth;
- fixture re-derivation from real data would make Source #2 strictly worse,
  not better.

The next authorized session is a **design session** for a new
authority-safe descent source, with explicit new SSOT, new absurd-pass
proof bundle, and new split-brain guard deliverables. P2, P3, P4 remain
blocked until that design branch resolves. **At this document's original
close,** E1 entries for `shallow_92deg`
and `ultra_low_rom_92deg` were still `conditional_until_main_passes`. PR-F
SKIP markers were at the then-current breadth.

**Current main:** E1 representatives are **`permanent_must_pass`**; PR-F allows only `no PR-D broadening` as an explained SKIP marker — `docs/pr/PR-E1-shallow-representative-must-pass-landed-status-lock.md`.
