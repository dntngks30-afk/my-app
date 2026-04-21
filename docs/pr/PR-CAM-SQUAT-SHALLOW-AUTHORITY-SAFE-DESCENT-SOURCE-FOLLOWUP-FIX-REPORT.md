# Branch B Follow-up — Source #4 Baseline-Sourcing Fix Report

- **Session type**: narrow follow-up review/fix (Branch B only)
- **Outcome**: **Outcome A — narrow legal fix landed.**
- **Design SSOT**: `docs/pr/PR-CAM-SQUAT-SHALLOW-AUTHORITY-SAFE-DESCENT-SOURCE-EXPANSION.md`
- **Predecessor stop report**: `docs/pr/PR-E1-P4-SHALLOW-PROMOTION-BLOCKED-REPORT.md`
- **Session prompt**: `docs/pr/PR-CAM-SQUAT-SHALLOW-AUTHORITY-SAFE-DESCENT-SOURCE-FOLLOWUP-REVIEW-IMPLEMENTATION-PROMPT.md`
- **E1 promotion registry (this session’s close)**: unchanged — `shallow_92deg` / `ultra_low_rom_92deg` remained `conditional_until_main_passes` when this report was written (correct for that session).
- **Current main addendum**: subsequent verification promoted both representatives to **`permanent_must_pass`** in `scripts/camera-pr-e1-shallow-lock-promotion-registry-smoke.mjs`. **SSOT:** `docs/pr/PR-E1-shallow-representative-must-pass-landed-status-lock.md`.

---

## 1. Root cause (proved against current head before any edit)

The Branch B source #4 (`legitimateKinematicShallowDescentOnsetFrame`) stayed
`null` on `shallow_92deg` and `ultra_low_rom_92deg` through the full
`evaluateExerciseAutoProgress` gate path because of a **chained
baseline-sourcing bug** inside `evaluateSquatCompletionCore`, not because of
any threshold / authority / fixture concern.

Chain of causation (captured directly from the real code path via
`_probe_source4_v2.mjs` pre-fix; see §4):

1. `computeSquatCompletionArming` trims the standing prefix and returns
   `completionFrames` starting at the first post-arming frame. For both
   representative shallow fixtures this is `completionSliceStartIndex = 16`
   — i.e. the arming slice **begins mid-descent** (first slice frame
   `kneeAngleAvg ≈ 97.8°`).

2. Inside `evaluateSquatCompletionCore`:

   - `baselineKneeAngleAvgValue = computeBaselineKneeAngleAvgMedian(
     validFrames, depthFrames.map(f => f.index).slice(0, BASELINE_WINDOW))`
     samples the **first 6 rows of the arming slice**. In the shallow
     fixture those rows are `[97.79°, 94.85°, 93.92°, 94.46°, 97.24°,
     104.55°]` → median `96.04°`, not the true standing `170°`.

   - `baselineFreezeFrameIndex = depthFrames[BASELINE_WINDOW − 1].index`
     resolves to slice-local index `5` (slice[5] sits **after the peak**
     at slice-local index `3`).

3. Source #4's search range is `[baselineFreezeFrameIndex, peakFrameIndex)`.
   `[5, 3)` is the empty set. Even if the baseline median had been correct,
   there is no candidate to evaluate, and the source returns `null`.

Both symptoms collapse into one root cause: **after the arming truncation
the "first BASELINE_WINDOW rows of depthFrames" is no longer the standing
baseline window**. The source-expansion smoke (`...descent-source-expansion-
smoke.mjs`) already acknowledges this boundary explicitly — its Smoke #1
drives `evaluateSquatCompletionState` directly via `evaluateCoreDirect` with
the comment _"the gate's arming filter truncates the standing prefix and
therefore shifts the BASELINE_WINDOW off the true standing baseline. The
design SSOT §4.1 defines the baseline at the completion-core boundary
(pre-arming-truncation), not at the gate boundary."_ The fix below restores
that pre-arming boundary on the gate path.

This matches the prompt's Target 1 (baseline sourcing bug) and Target 4
(baseline-freeze plumbing gap) simultaneously. It requires no threshold
relaxation, no authority-law change, and no fixture modification.

---

## 2. Narrow legal fix applied

The evaluator now seeds the **pre-arming standing-window `kneeAngleAvg`
median** through an additive option, and the completion core honours it:

1. **`src/lib/camera/squat-completion-state.ts`**
   - Added `seedBaselineKneeAngleAvg?: number` to
     `EvaluateSquatCompletionStateOptions`. Sink-only seed; no other
     option / return shape changes.

2. **`src/lib/camera/squat/squat-completion-core.ts`**
   - When `options?.seedBaselineKneeAngleAvg` is a finite number,
     `baselineKneeAngleAvgValue` uses the seed instead of the slice-local
     `computeBaselineKneeAngleAvgMedian`.
   - When the seed is present **and** `depthFreeze != null`,
     `baselineFreezeFrameIndex` is aligned to `depthFrames[0].index`
     (slice-local `0`) — semantically "baseline was frozen before the
     slice started", which is exactly what arming-seed handoff means.
   - When no seed is provided (direct-state call, pre-arming callers,
     non-squat / non-arming paths), the legacy slice-local computation is
     preserved bit-for-bit.

3. **`src/lib/camera/evaluators/squat.ts`**
   - Computes the median of `kneeAngleAvg` over `valid.slice(0,
     BASELINE_WINDOW_EVAL_KNEE=6)` using the same median rule as
     `computeBaselineKneeAngleAvgMedian` (≥ 4 finite samples required,
     else `undefined`).
   - Passes the result as `seedBaselineKneeAngleAvg` alongside the
     existing `seedBaselineStandingDepthPrimary` / `Blended` seeds. No
     other evaluator logic or sequencing changed.

4. **`scripts/camera-pr-cam-squat-shallow-authority-safe-descent-source-followup-smoke.mjs`** (new)
   - Pins source #4 firing through the **gate path** for both representative
     shallow fixtures, AND re-asserts absurd-pass protection on the gate
     path for standing-still / single-frame spike / seated (§5 safety of
     the SSOT, mirrored from the expansion smoke's Smoke #2).

No runtime changes outside those four files. No threshold constant,
authority-law code, fixture, registry, or promotion state was touched.

### Why the fix stays within Branch B SSOT

- **§4.1 clause 3**: "`baselineKneeAngleAvg` is resolvable from the
  standing-baseline window as the median of `kneeAngleAvg` over the
  baseline window." The new seed **is** that median, computed over the
  pre-arming standing window — the boundary the design SSOT originally
  meant. This is the exact fix shape suggested by preferred-fix shape
  #1 / #2 in the prompt ("fix the baseline window so it truly references
  standing-baseline frames" / "fix the mapping between `depthFrames` and
  the baseline knee-angle sample set").
- **§6.1 SL-1**: source #4 remains a sink-only contributor to
  `effectiveDescentStartFrame`; it never writes to any owner field and
  never opens final pass.
- **§6.4 CL-1**: `descentAnchorCoherent` remains `true` (verified in the
  follow-up smoke and in the existing expansion smoke #3).
- **§7.4 item 4 coexistence deferral**: the fix does NOT touch
  `completionOwnerReason === 'pass_core_detected'` authority ambiguity.
  That is still a later authority-law session.

### Why the fix does not relax thresholds

- `KNEE_DESCENT_ONSET_EPSILON_DEG` stays **5.0**.
- `KNEE_DESCENT_ONSET_SUSTAIN_FRAMES` stays **2**.
- `SHALLOW_OFFICIAL_CLOSE_MIN_CYCLE_MS`, `attemptAdmissionFloor`,
  `LEGACY_ATTEMPT_FLOOR`, `GUARDED_ULTRA_LOW_ROM_FLOOR`,
  `LOW_ROM_LABEL_FLOOR`, `STANDARD_OWNER_FLOOR`, all arming and recovery
  constants — **all unchanged**.
- The seed merely routes an already-legal input (median of standing-window
  kneeAngleAvg) past the arming truncation; it does **not** weaken any
  gate or admit a previously-rejected motion.

---

## 3. Smoke / validation results

All mandatory smokes in the prompt §"Mandatory smoke/validation" are green
on the post-fix head:

| Smoke | Pre-fix | Post-fix |
|---|---|---|
| `camera-pr-cam-squat-shallow-authority-safe-descent-source-expansion-smoke.mjs` | 17 passed, 0 failed | **17 passed, 0 failed** |
| `camera-pr-01-squat-completion-first-authority-freeze-smoke.mjs` | 21 passed, 0 failed | **21 passed, 0 failed** |
| `camera-pr-e1-shallow-lock-promotion-registry-smoke.mjs` | 28 passed, 0 failed | **28 passed, 0 failed** |
| `camera-pr-cam-squat-shallow-authority-safe-descent-source-followup-smoke.mjs` (new) | n/a | **18 passed, 0 failed** |
| `camera-pr-f-regression-proof-gate.mjs` (meta-gate) | 12 passed, 0 failed | **12 passed, 0 failed** |

Assertion coverage for the legal-fix rule (prompt §"Legal fix rule" clauses
1–6 and §"Mandatory smoke/validation"):

- `legitimateKinematicShallowDescentOnsetFrameIndex !== null` for both
  `shallow_92deg` and `ultra_low_rom_92deg` **through the gate path** —
  pinned by the new follow-up smoke.
- `legitimateKinematicShallowDescentBaselineKneeAngleAvg ∈ [165°, 175°]`
  for both fixtures (true standing baseline, up from the broken `96.04°`).
- `legitimateKinematicShallowDescentOnsetKneeAngleAvg ≤ baseline − 5°`.
- `descentAnchorCoherent === true` (split-brain guard CL-1 unchanged).
- `effectiveDescentStartFrameSource` ∈ the legal family
  `{phase_hint_descent, trajectory_descent_start, shared_descent_epoch,
   legitimate_kinematic_shallow_descent_onset}` for both fixtures.
- Absurd-pass regression suite still holds through the gate path:
  standing-still / single-frame spike / seated all keep source #4 null
  and `finalPassEligible !== true`.
- PR-01 invariants A–G: all 21 assertions green.

---

## 4. Does source #4 fire on both representative shallow fixtures?

**Yes, for the right reason.**

On current post-fix head (via `evaluateExerciseAutoProgress`):

| field | `shallow_92deg` | `ultra_low_rom_92deg` |
|---|---|---|
| `legitimateKinematicShallowDescentOnsetFrameIndex` | `0` (slice-local) | `0` (slice-local) |
| `legitimateKinematicShallowDescentOnsetKneeAngleAvg` | `97.79°` | `97.79°` |
| `legitimateKinematicShallowDescentBaselineKneeAngleAvg` | `170.00°` | `170.00°` |
| baseline − ε | `165.0°` (>= onset 97.79°) | `165.0°` (>= onset 97.79°) |
| `descentAnchorCoherent` | `true` | `true` |

In both cases the candidate sits at the same slice-local index as
`trajectoryDescentStartFrame`. Under the SSOT §6.4 earliest-wins rule
(with candidate-order tie-break preserved), source #2 still holds
`effectiveDescentStartFrameSource = 'trajectory_descent_start'` — this is
the prompt's explicit allowed alternative ("the new source still
legitimately wins earliest-by-index when designed to do so"). Source #4
firing at the tied index is captured by
`legitimateKinematicShallowDescentOnsetFrameIndex !== null` and by
`descentAnchorCoherent`.

---

## 5. Does promotion become unblocked?

**No — and promotion remains intentionally unchanged.**

Per the prompt §"Promotion boundary for this session": _"Strong default:
do not edit E1 registry states in this session."_ All four promotion
criteria were re-checked on the post-fix head for both representative
fixtures through `evaluateExerciseAutoProgress`:

- `completionTruthPassed`
- `finalPassEligible`
- `isFinalPassLatched`
- `canonicalShallowContractDrovePass`

Making source #4 fire unblocks the source itself (the session mission),
but does not shift the **earliest-by-index** `effectiveDescentStartFrame`
for these fixtures (source #2 still ties at the same slice-local index),
so the canonical cycle-timing gate is not re-opened by this fix alone.

**As of this report’s close:** the `shallow_92deg` / `ultra_low_rom_92deg` entries in
`scripts/camera-pr-e1-shallow-lock-promotion-registry-smoke.mjs` were still
`conditional_until_main_passes`, and the E1 smoke reported conditional SKIPs within the PR-01-accepted band. No registry write and no harness hard-green assertion were changed in this follow-up.

**Current main:** later arming/temporal work and verification promoted both fixtures to **`permanent_must_pass`** with full canonical assertions; see `docs/pr/PR-E1-shallow-representative-must-pass-landed-status-lock.md`.

Promoting these fixtures belonged to later sessions whose scope included the factors that drive canonical shallow close on shallow reps. That broader promotion work was **out of scope** for this follow-up.

---

## 6. Residual risks / follow-ons for later sessions

All explicitly **not authorized** by this report; listed only so a future
session has the diff surface.

1. **Arming truncation versus cycle-timing authority**: the arming slice
   still begins mid-descent for shallow reps, so the *slice-local*
   descent anchor (`source #2` or `source #4` tying at slice-index 0)
   cannot be earlier than the slice start, regardless of how good the
   baseline median is. Improving cycle timing for shallow reps likely
   requires an arming-level rework (standing-window semantics by
   kneeAngleAvg rather than depth only). That is NOT a source #4 issue
   and NOT in Branch B scope.

2. **`pass_core_detected` authority ambiguity** (Branch B §7.4 item 4
   coexistence deferral): still untouched. This follow-up does not
   change its footprint.

3. **Real-capture validation of source #4**: synthetic proofs now pass on
   the gate path; a future calibration-capture session should verify the
   same on real-pose capture traces before any promotion decision.

---

## 7. Confirmation of forbidden-scope compliance

- No threshold values changed (grep confirms
  `KNEE_DESCENT_ONSET_EPSILON_DEG = 5.0`,
  `KNEE_DESCENT_ONSET_SUSTAIN_FRAMES = 2`,
  `SHALLOW_OFFICIAL_CLOSE_MIN_CYCLE_MS`, `attemptAdmissionFloor`
  constants — all intact).
- No authority-law rewrite (`src/lib/camera/auto-progression.ts`
  completion-owner truth surface unchanged; PR-01 smoke green).
- No fixture re-derivation (fixture builder in the source-expansion and
  E1 smokes unchanged; the follow-up smoke re-uses the same builder).
- No pass-core opener revival (pass-core entry points unchanged).
- No P4 promotion edits (E1 registry states unchanged; E1 smoke still
  reports the same 2 PR-01-accepted conditional SKIPs).
- No P3 / P2 / PR-F skip-marker changes.
- No non-squat files touched.
