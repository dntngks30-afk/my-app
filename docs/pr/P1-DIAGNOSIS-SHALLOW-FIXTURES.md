# P1 Diagnosis — Legitimate Shallow Evidence Recovery (Diagnostic Only)

> **Scope of this document**: read-only diagnosis only. No `src/*` or `scripts/*` changes, no git commits.
> This document captures the exact upstream evidence gaps preventing the two
> `conditional_until_main_passes` shallow fixtures from reaching canonical
> completion-owner truth, classifies the gap, and enumerates authority-legal
> recovery levers for a follow-up P1 implementation session.
>
> Non-negotiable invariants (must remain unviolated across P1 → P4 → P3 → P2):
> 1. Completion-owner truth is the ONLY opener of final pass (PR-01 freeze).
> 2. Pass-core / shallow-assist / closure-proof / bridge / event-cycle are NOT openers.
> 3. Absurd-pass registry is block-only.
> 4. Quality interpretation is separate from pass/fail truth.
> 5. No pass-core-first authority may be reopened.

- Related SSOT: [docs/SSOT_SQUAT_COMPLETION_FIRST_QUALITY_STRICT_2026_04.md](../SSOT_SQUAT_COMPLETION_FIRST_QUALITY_STRICT_2026_04.md)
- Parent PR prompts:
  - [P1 — legitimate shallow evidence recovery](P1-SQUAT-LEGITIMATE-SHALLOW-EVIDENCE-RECOVERY.md)
  - [P4 — regression harness hardening](P4-SQUAT-REGRESSION-HARNESS-HARDENING.md)
  - [P3 — absurd-pass registry normalization](P3-SQUAT-ABSURD-PASS-REGISTRY-NORMALIZATION.md)
  - [P2 — authority naming / comment cleanup](P2-SQUAT-AUTHORITY-NAMING-COMMENT-CLEANUP.md)
- PR-01 reference: `docs/pr/PR-01-SQUAT-COMPLETION-FIRST-AUTHORITY-FREEZE-IMPLEMENTATION-PROMPT.md`

---

## §1. Fixtures in diagnosis

Both fixtures are currently registered as `conditional_until_main_passes` in
[scripts/camera-pr-e1-shallow-lock-promotion-registry-smoke.mjs](../../scripts/camera-pr-e1-shallow-lock-promotion-registry-smoke.mjs)
Matrix A. Both are representative legitimate shallow reps — they should pass
under real-world completion-owner truth but currently fail-close.

| fixtureId | Knee-angle peak | Recovery tail | Total frames | Registry state |
|---|---|---|---|---|
| `shallow_92deg` | ≈92° | 6 frames of 170° | 31 frames @ 80ms | `conditional_until_main_passes` |
| `ultra_low_rom_92deg` | ≈92° | 10 frames of 170° | 35 frames @ 80ms | `conditional_until_main_passes` |

Knee-angle sequence (both):

```
170 × 8, 165, 155, 145, 130, 115, 100, 95, 93, 92, 92, 93, 95, 100, 115, 130, 145, 160, 170 × {6 | 10}
```

Step: 80ms. Start timestamp: 200ms. Fixture builder and input path are
identical to E1 Matrix A (`squatPoseLandmarksFromKneeAngle`,
`makeKneeAngleSeries`, `evaluateExerciseAutoProgress`).

---

## §2. Diagnostic method (read-only)

The capture script below was run ad-hoc against the production engine
(`evaluateExerciseAutoProgress`). No smoke file was added. Reproduce it by
pasting the script into a temp `.mjs` at repo root and running
`npx tsx <temp>.mjs`, then deleting the temp file.

```javascript
// P1 DIAGNOSTIC CAPTURE — temp file, read-only.
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(__dirname);

const { evaluateExerciseAutoProgress, isFinalPassLatched } = await import(
  './src/lib/camera/auto-progression.ts'
);

function mockLandmark(x, y, visibility = 0.99) { return { x, y, visibility }; }
function clamp(v, lo = 0, hi = 1) { return Math.min(hi, Math.max(lo, v)); }
function squatPoseLandmarksFromKneeAngle(timestamp, kneeAngleDeg) {
  const lms = Array(33).fill(null).map(
    (_, i) => mockLandmark(0.3 + (i % 11) * 0.04, 0.1 + Math.floor(i / 11) * 0.2, 0.99)
  );
  const depthT = clamp((170 - kneeAngleDeg) / 110);
  const shoulderY = 0.18 + depthT * 0.05;
  const hipY = 0.38 + depthT * 0.12;
  const kneeY = 0.58 + depthT * 0.04;
  const shinLen = 0.18;
  const bendRad = ((180 - kneeAngleDeg) * Math.PI) / 180;
  const ankleDx = Math.sin(bendRad) * shinLen;
  const ankleDy = Math.cos(bendRad) * shinLen;
  lms[11] = mockLandmark(0.42, shoulderY);
  lms[12] = mockLandmark(0.58, shoulderY);
  lms[23] = mockLandmark(0.44, hipY);
  lms[24] = mockLandmark(0.56, hipY);
  lms[25] = mockLandmark(0.45, kneeY);
  lms[26] = mockLandmark(0.55, kneeY);
  lms[27] = mockLandmark(0.45 + ankleDx, kneeY + ankleDy);
  lms[28] = mockLandmark(0.55 + ankleDx, kneeY + ankleDy);
  lms[0] = mockLandmark(0.5, 0.08 + depthT * 0.02);
  return { landmarks: lms, timestamp };
}
function makeKneeAngleSeries(startTs, values, stepMs = 80) {
  return values.map((a, i) => squatPoseLandmarksFromKneeAngle(startTs + i * stepMs, a));
}
function toLandmarks(seq) { return seq.map((f) => ({ landmarks: f.landmarks, timestamp: f.timestamp })); }
function squatStats(lms, ms = 3200) {
  return { sampledFrameCount: lms.length, droppedFrameCount: 0, captureDurationMs: ms, timestampDiscontinuityCount: 0 };
}

const FIXTURES = {
  shallow_92deg: [
    ...Array(8).fill(170),
    165, 155, 145, 130, 115, 100, 95, 93, 92, 92, 93, 95, 100, 115, 130, 145, 160,
    ...Array(6).fill(170),
  ],
  ultra_low_rom_92deg: [
    ...Array(8).fill(170),
    165, 155, 145, 130, 115, 100, 95, 93, 92, 92, 93, 95, 100, 115, 130, 145, 160,
    ...Array(10).fill(170),
  ],
};

for (const [id, angles] of Object.entries(FIXTURES)) {
  const frames = makeKneeAngleSeries(200, angles, 80);
  const lms = toLandmarks(frames);
  const gate = evaluateExerciseAutoProgress('squat', lms, squatStats(lms));
  const cs = gate.evaluatorResult?.debug?.squatCompletionState ?? {};
  const pc = gate.evaluatorResult?.debug?.squatPassCore ?? {};
  console.log(id, JSON.stringify({
    gate: {
      status: gate.status,
      finalPassEligible: gate.finalPassEligible,
      finalPassBlockedReason: gate.finalPassBlockedReason,
      completionSatisfied: gate.completionSatisfied,
      isFinalPassLatched: isFinalPassLatched('squat', gate),
    },
    completionCore: {
      completionSatisfied: cs.completionSatisfied,
      completionPassReason: cs.completionPassReason,
      completionBlockedReason: cs.completionBlockedReason,
      ruleCompletionBlockedReason: cs.ruleCompletionBlockedReason,
      postAssistCompletionBlockedReason: cs.postAssistCompletionBlockedReason,
      cycleComplete: cs.cycleComplete,
    },
    timing: {
      descendStartAtMs: cs.descendStartAtMs,
      peakAtMs: cs.peakAtMs,
      reversalAtMs: cs.reversalAtMs,
      standingRecoveredAtMs: cs.standingRecoveredAtMs,
      cycleDurationMs: cs.cycleDurationMs,
      downwardCommitmentDelta: cs.downwardCommitmentDelta,
    },
    shallowEvidence: {
      relativeDepthPeak: cs.relativeDepthPeak,
      evidenceLabel: cs.evidenceLabel,
      officialShallowPathAdmitted: cs.officialShallowPathAdmitted,
      officialShallowPathClosed: cs.officialShallowPathClosed,
      officialShallowClosureProofSatisfied: cs.officialShallowClosureProofSatisfied,
    },
    ultraLowPolicy: {
      ultraLowPolicyScope: cs.ultraLowPolicyScope,
      ultraLowPolicyBlocked: cs.ultraLowPolicyBlocked,
      ultraLowPolicyTrace: cs.ultraLowPolicyTrace,
    },
    canonicalContract: {
      canonicalShallowContractSatisfied: cs.canonicalShallowContractSatisfied,
      canonicalShallowContractBlockedReason: cs.canonicalShallowContractBlockedReason,
      canonicalShallowContractStage: cs.canonicalShallowContractStage,
      canonicalShallowContractSplitBrainDetected: cs.canonicalShallowContractSplitBrainDetected,
      canonicalShallowContractTrace: cs.canonicalShallowContractTrace,
    },
    passCore: {
      passDetected: pc.passDetected,
      passBlockedReason: pc.passBlockedReason,
      passCoreStale: pc.passCoreStale,
    },
  }, null, 2));
}
```

---

## §3. Captured state (both fixtures — identical root cause)

### §3.1 Gate surface — both fixtures

| Field | shallow_92deg | ultra_low_rom_92deg |
|---|---|---|
| `gate.status` | `retry` | `retry` |
| `gate.finalPassEligible` | `false` | `false` |
| `gate.finalPassBlockedReason` | `"completion_truth_not_passed"` | `"completion_truth_not_passed"` |
| `gate.completionSatisfied` | `true` *(motion-level, pass-core owned)* | `true` *(motion-level, pass-core owned)* |
| `gate.passConfirmationSatisfied` | `true` | `true` |
| `isFinalPassLatched('squat', gate)` | `false` | `false` |

> **Important**: `gate.completionSatisfied: true` is the **motion-level** truth
> returned by `getSquatProgressionCompletionSatisfied` which reads
> `passCore.passDetected`. It is NOT the completion-owner truth. The final pass
> is correctly blocked because
> `state.completionSatisfied: false` + `completionBlockedReason: 'ultra_low_rom_not_allowed'`.
> This is exactly the authority separation PR-01 enforces.

### §3.2 Completion core — both fixtures

| Field | Value |
|---|---|
| `completionSatisfied` | `false` |
| `completionPassReason` | `"not_confirmed"` |
| `completionBlockedReason` | `"ultra_low_rom_not_allowed"` |
| `cycleComplete` | `false` |
| `currentSquatPhase` | `"standing_recovered"` |
| `completionMachinePhase` | `"recovered"` |
| `attemptStarted` | `true` |
| `descendConfirmed` | `true` |
| `downwardCommitmentReached` | `true` |
| `reversalConfirmedAfterDescend` | `true` |
| `recoveryConfirmedAfterReversal` | `true` |
| `ownerAuthoritativeReversalSatisfied` | `true` |
| `ruleCompletionBlockedReason` | `null` *(rule-core cleared)* |
| `postAssistCompletionBlockedReason` | `"ultra_low_rom_not_allowed"` *(policy stamped)* |

### §3.3 Timing anchors — both fixtures

| Field | Value |
|---|---|
| `descendStartAtMs` | `1480` |
| `peakAtMs` | `1720` |
| `reversalAtMs` | `1720` ⚠ identical to peak |
| `standingRecoveredAtMs` | `1960` |
| **`cycleDurationMs`** | **`480`** ⚠ below 800ms floor |
| `downwardCommitmentDelta` | `0.0256` (non-degenerate) |
| `baselineFrozen` | `true` |
| `peakLatched` | `true` |

### §3.4 Shallow evidence — both fixtures

| Field | Value |
|---|---|
| `relativeDepthPeak` | `0.0437` |
| `evidenceLabel` | `"ultra_low_rom"` |
| `officialShallowPathCandidate` | `true` |
| `officialShallowPathAdmitted` | `true` |
| `officialShallowPathClosed` | `false` |
| `officialShallowClosureProofSatisfied` | `false` at state level, `true` inside `shallowClosureProofTrace.proof` ⚠ internal split |
| `officialShallowReversalSatisfied` | `true` |

### §3.5 Ultra-low policy — both fixtures

| Field | Value |
|---|---|
| `ultraLowPolicyScope` | `true` |
| `ultraLowPolicyDecisionReady` | `true` |
| `ultraLowPolicyBlocked` | `true` |
| `ultraLowPolicyTrace` | `"scope=1\|ready=1\|legitimate_canonical=0\|blocked=policy_illegitimate_annotation_only"` |

The `legitimate_canonical=0` bit is a **downstream consequence** of
`canonicalShallowContractSatisfied: false`. Once canonical-contract is
satisfied, the ultra-low policy admits the cycle as legitimate.

### §3.6 Canonical shallow contract — both fixtures (THE ROOT CAUSE)

| Field | Value |
|---|---|
| `canonicalShallowContractSatisfied` | `false` |
| `canonicalShallowContractStage` | `"reversal_blocked"` |
| `canonicalShallowContractBlockedReason` | `"minimum_cycle_timing_blocked"` |
| `canonicalShallowContractAuthoritativeClosureWouldBeSatisfied` | `false` |
| `canonicalShallowContractSplitBrainDetected` | `true` ⚠ |
| `canonicalShallowContractReversalEvidenceSatisfied` | `true` |
| `canonicalShallowContractRecoveryEvidenceSatisfied` | `true` |
| `canonicalShallowContractAntiFalsePassClear` | `false` ⚠ secondary blocker |

Contract trace (both fixtures identical):

```
eligible=1|admission=1|attempt=1|timing=1|minCycle=0|epoch=1|nonDegCommit=1|
reversal=1|weakEvtBlock=0|repOwnership=1|recovery=1|anti=0|split=1|
authClosure=0|closureSrc=none|stage=reversal_blocked|blocked=minimum_cycle_timing_blocked
```

Two `0` bits:
- `minCycle=0` — **primary first-fail** (returned by `firstBlockedReason` walk)
- `anti=0` — **secondary** (ordering violation: `reversalAtMs === peakAtMs`)

### §3.7 shallowClosureProofTrace (excerpt) — both fixtures

```
bridge.bridgeBlockedReason         : null
bridge.guardedClosureProofBlockedReason : "no_trajectory_reversal_rescue"
proof.officialShallowReversalSatisfied  : true
proof.officialShallowClosureProofSatisfied : true     ← proof-stage truth
proof.proofBlockedReason           : "proof_primary_drop_not_satisfied"
suffix.finalizeSatisfied           : false
suffix.finalizeReason              : "ultra_low_rom_guarded_finalize"
suffix.continuityOk                : true
consumption.eligible               : false
consumption.completionPassReason   : "ultra_low_rom_cycle"
consumption.completionSatisfied    : true             ← "would be satisfied"
```

The consumption / proof stages would be "satisfied" but the canonical-contract
gate (which is now the authoritative shallow close) blocks the write. This is
the PR-01-aligned fail-close behavior and is **correct**. The gap is upstream:
the canonical contract's own timing input is wrong.

### §3.8 Pass-core — both fixtures

| Field | Value |
|---|---|
| `passDetected` | `true` |
| `passBlockedReason` | `null` |
| `passCoreStale` | *(unset)* |

Pass-core says "motion pass detected" — this is consistent because pass-core
under PR-01 is motion-owner only, not the completion-owner. Final pass is still
blocked because completion-owner is not satisfied.

---

## §4. Gap classification

### §4.1 Primary classification — **G4 (canonical shallow contract first-blocked)**

Per plan §1-4, the gap categories are:

- G1 — `ruleCompletionBlockedReason` stage (armed/descend/attempt/commitment)
- G2 — commitment passed but reversal/ascent failed
- G3 — `ultra_low_rom_cycle` path entered but `ultraLowRomFreshCycleIntegrity !== true`
- G4 — canonical shallow contract `firstBlockedReason` exists
- G5 — all cores passed but UI/readiness/arming blocked
- G6 — other

**Both fixtures classify as G4** with `firstBlockedReason = "minimum_cycle_timing_blocked"`.

Evidence against other categories:
- Not G1: `ruleCompletionBlockedReason: null` (rule-core cleared).
- Not G2: `reversalConfirmedAfterDescend: true`, `recoveryConfirmedAfterReversal: true`, `ownerAuthoritativeReversalSatisfied: true`.
- Not G3 directly: the ultra-low policy IS blocked, but only because
  `canonicalShallowContractSatisfied=false` — G4 is upstream of G3 here.
- Not G5: UI gate never reached (completion-owner truth not satisfied first).

### §4.2 Secondary gap — anti-false-pass temporal ordering (`anti=0`)

Both fixtures additionally fail
`temporalEpochOrderClearFromInput` because
`reversalAtMs (1720) > peakAtMs (1720)` is FALSE — strict inequality requires
`reversalAtMs > peakAtMs`, but both are the exact same timestamp.

This is a **shadow G4** — even after `minCycle=0` is fixed, anti-false-pass
ordering would still fail the contract unless also addressed.

### §4.3 Tertiary signal — `canonicalShallowContractSplitBrainDetected: true`

The split-brain detector fires because the contract is blocked but the
consumption stage and proof stage both report satisfied. Under PR-01 this
split MUST fail-close at the contract granularity (and it does). The
split-brain signal itself is a healthy guardrail firing correctly; it is
NOT a gap to fix, but a signal to preserve.

### §4.4 Root cause of G4: `descendStartAtMs` anchored at peak

`cycleDurationMs = standingRecoveredAtMs - effectiveDescentStartFrame.timestampMs`
yields `1960 - 1480 = 480ms`. The 800ms floor
(`SHALLOW_OFFICIAL_CLOSE_MIN_CYCLE_MS = 800`, see
[squat-completion-canonical.ts:8](../../src/lib/camera/squat/squat-completion-canonical.ts)
and [squat-completion-state.ts:1755](../../src/lib/camera/squat-completion-state.ts))
is violated.

But the fixture's actual first-below-baseline frame is at raw index 8 (165°,
timestamp 840ms). If the descent anchor were at 840ms instead of 1480ms,
`cycleDurationMs = 1960 - 840 = 1120ms`, comfortably above the 800ms floor.

`effectiveDescentStartFrame` in
[squat-completion-core.ts:1804-1817](../../src/lib/camera/squat/squat-completion-core.ts)
chooses the earliest of three sources:

1. `descentFrame` — first frame with `phaseHint === 'descent'`
2. `trajectoryDescentStartFrame` — first frame where
   `depth - baselineStandingDepth >= attemptAdmissionFloor * 0.4`
3. `sharedDescentEpochFrame` — nearest-to-target frame derived from
   `sharedDescentTruth.descentStartAtMs`

For the synthetic E1 fixture all three sources converge at/near the peak
because:
- No explicit `phaseHint === 'descent'` is injected by the landmark mocker.
- `attemptAdmissionFloor * 0.4` is tripped late for low-ROM rep shape.
- `sharedDescentTruth` (from pass-window-owned frames) resolves to the
  pass-window's own late descent timestamp.

This is the upstream evidence gap. The same real-world rep where pose-feature
extraction emits earlier descent phaseHints would not trigger this failure —
but the fixture-level legitimacy proof requires a recovery that works
regardless of `phaseHint` richness.

---

## §5. Authority-legal recovery levers (to be chosen in next session)

All levers must live in one of:

- [src/lib/camera/squat-completion-state.ts](../../src/lib/camera/squat-completion-state.ts)
- [src/lib/camera/squat/squat-completion-core.ts](../../src/lib/camera/squat/squat-completion-core.ts)
- [src/lib/camera/squat/shallow-completion-contract.ts](../../src/lib/camera/squat/shallow-completion-contract.ts)

| Lever | What it does | Authority check | Trade-off |
|---|---|---|---|
| **A (primary)** Add 4th source to `effectiveDescentStartFrame`: "earliest post-baseline-freeze depthFrame whose `depth >= attemptAdmissionFloor * k` where `k < 0.4`, bounded by `peakFrame.index`." Pins anchor at the first meaningful below-baseline frame (fixture frame 8 → 840ms). | **LEGAL.** It refines an existing completion-core feeder signal (descent anchor). It does NOT open pass, does NOT reopen pass-core authority, does NOT introduce a new grant path. Canonical contract remains the sole gate. | Choosing `k` too small admits trajectory noise; must stay above sub-threshold jitter. Suggested `k ∈ [0.15, 0.25]`. Must be accompanied by a new smoke asserting no new standing-still / setup-motion admission. |
| **B** Split `reversalAtMs` from `peakAtMs` when both resolve to the same frame: advance reversal to `peakFrame.index + 1` when ascent starts the very next frame. | **LEGAL.** Ordering repair only; same signal, different timestamp resolution. Does NOT open pass. | Need to ensure this does not swallow micro-bounce false passes. Tie the split to `ownerAuthoritativeReversalSatisfied === true` to gate the repair. |
| **C** Lower `SHALLOW_OFFICIAL_CLOSE_MIN_CYCLE_MS` from 800 to e.g. 500. | **LEGAL-but-UNSAFE.** No authority violation but weakens an absurd-pass safeguard that exists for product reasons (jerky micro-bounce rejection). **REJECT** unless Lever A and B are both infeasible. | High risk: reopens the instant-bounce absurd-pass family. |
| **D** Tighten `canonicalShallowContractSplitBrainDetected` veto: ensure split-brain triggers consumption-stage short-circuit. | **LEGAL-but-REDUNDANT.** Split-brain already fails-close at contract granularity in PR-01; making it bite harder at consumption is belt-and-braces, not gap recovery. Keep as optional hardening after A + B. | No real downside, but does not recover the fixtures by itself. |
| **E** Inject `phaseHint` into the fixture landmark mocker. | **REJECTED.** This is a **fixture-side** change, not a real-path evidence recovery. Would paper over the actual upstream gap and hide a real-user failure class. Parent P1 doc forbids fixture-specific tweaks. |

**Recommended combination for P1 implementation session**: `A + B`, each in an
independent commit with its own smoke. Both are pre-canonical-contract feeder
repairs; together they clear `minCycle=0` and `anti=0` simultaneously.
Residual risk after A + B: re-verify no regression against existing
absurd-pass fixtures (`no_real_descent`, `standing_still`,
`setup_motion_contaminated`, `contaminated_blended_early_peak_false_pass`).

### §5.1 Next-session reproduction command

```powershell
# From repo root
npx tsx _p1_diagnosis_capture.mjs    # paste the script from §2 into this temp file first
```

### §5.2 Next-session verification command (after lever A + B applied)

```powershell
# Both fixtures must become gate.status === 'pass' + finalPassEligible === true
npx tsx _p1_diagnosis_capture.mjs

# Full PR-F regression proof bundle must stay green, INCLUDING permanent-lock smokes
npx tsx scripts/camera-pr-f-regression-proof-gate.mjs
```

---

## §6. Stop / residual-risk policy

The diagnosis did NOT trigger any of the plan's stop conditions:

- Fixture did not pass through `evaluateExerciseAutoProgress` (no false-pass).
- All expected debug fields are present and typed.

Residual risks going into P1 implementation:

1. Lever A's `k` constant must be proven to not admit standing-still / setup-
   motion families via a dedicated before-after smoke.
2. Lever B's reversal/peak split must not laundered instant-bounce shallow reps.
3. `canonicalShallowContractSplitBrainDetected` must remain a guardrail — it
   should still fire any time contract/proof/consumption disagree, even after
   the fixtures are recovered.

---

## §7. Phase specs for follow-up sessions (no execution this session)

### §7.1 P4 — Regression harness hardening (ONLY after P1 lever A + B land)

**Preconditions** (hard): P1 lever(s) committed and both fixtures
(`shallow_92deg`, `ultra_low_rom_92deg`) return
`gate.status === 'pass'` + `finalPassEligible === true` via the capture script.

**Actions**:

- [scripts/camera-pr-f-regression-proof-gate.mjs](../../scripts/camera-pr-f-regression-proof-gate.mjs) — remove markers
  `pr01_completion_owner_not_yet_satisfied`,
  `conditional_until_main_passes`,
  `shallow fixture not passing on this main`,
  `ultra-low-ROM fixture not passing on this main`
  from `ALLOWED_SKIP_MARKERS` **only for the two recovered fixtures** (keep any
  other marker still in use elsewhere).
- [scripts/camera-pr-e1-shallow-lock-promotion-registry-smoke.mjs](../../scripts/camera-pr-e1-shallow-lock-promotion-registry-smoke.mjs) —
  promote `shallow_92deg` + `ultra_low_rom_92deg` entries in
  `SHALLOW_FIXTURE_REGISTRY` from
  `conditional_until_main_passes` → `permanent_must_pass`, delete `skipReason`
  fields, restore Matrix A hard assertions (remove the "accept either state"
  branches added in PR-01).
- [scripts/camera-pr-d-squat-regression-harness-smoke.mjs](../../scripts/camera-pr-d-squat-regression-harness-smoke.mjs) —
  convert `1b` SKIP branch to hard-pass (previously conditional).
- Add new illegal-state lock assertions to
  [scripts/camera-pr-01-squat-completion-first-authority-freeze-smoke.mjs](../../scripts/camera-pr-01-squat-completion-first-authority-freeze-smoke.mjs)
  or a P4-dedicated smoke: the five invariants from P4 doc Rule 2.

**Stop condition**: if P1 did not actually recover the fixtures (capture script
still returns `retry` + `completion_truth_not_passed`), **DO NOT PROCEED** with
P4. Under no circumstances broaden `ALLOWED_SKIP_MARKERS` as a compensation.

### §7.2 P3 — Absurd-pass registry normalization (chosen design: **extract new helper**)

**New file**: `src/lib/camera/squat/squat-absurd-pass-registry.ts` — typed
read-only table.

**Registry shape** (enumeration-only; no function calls, no branching logic):

```typescript
export type AbsurdPassFamilySource =
  | 'ui-latch-gate'
  | 'owner-contradiction'
  | 'completion-envelope'
  | 'late-post-owner-veto'
  | 'pass-core-veto';

export interface AbsurdPassFamily {
  readonly id: string;
  readonly description: string;
  readonly reasonStringsProduced: readonly string[];
  readonly source: AbsurdPassFamilySource;
}

export const ABSURD_PASS_REGISTRY: readonly AbsurdPassFamily[] = [
  { id: 'standing_still', ... },
  { id: 'seated_still_or_held_at_pass', ... },
  { id: 'setup_motion_contaminated', ... },
  { id: 'stale_prior_rep', ... },
  { id: 'mixed_rep_timestamp_contaminated', ... },
  { id: 'contaminated_blended_early_peak_false_pass', ... },
  { id: 'no_real_descent', ... },
  { id: 'no_real_reversal', ... },
  { id: 'no_real_recovery', ... },
  { id: 'ultra_low_trajectory_short_cycle', ... },
  { id: 'setup_series_start_false_pass', ... },
];
```

**In-place wiring targets** (reason strings read from registry constants;
existing behavior unchanged):

- [auto-progression.ts:1078-1126](../../src/lib/camera/auto-progression.ts) `applySquatFinalBlockerVetoLayer` — three late-veto branches reference registry entries.
- [auto-progression.ts:1663-1806](../../src/lib/camera/auto-progression.ts) three `shouldBlockSquat*` helpers — reason strings imported from registry.

**New smoke**: `scripts/camera-pr-01-p3-absurd-pass-registry-smoke.mjs` —
statically verifies:
- Every entry's `id` is unique.
- Every entry's `reasonStringsProduced` strings match strings actually emitted
  in the wiring targets (text equivalence, no substitution).
- No entry is referenced from a grant path (i.e. no path that could set
  `finalPassEligible: true`).

**Hard prohibitions**:
- Registry entries MUST NOT expose a function that grants pass.
- Existing reason strings MUST NOT change (byte-exact preservation for
  trace/analytics parity).
- `completion-owner` path MUST NOT be touched.

### §7.3 P2 — Authority naming / comment cleanup (last; zero behavioral change)

**Targets** (concrete coordinates collected during diagnosis scouting):

- [auto-progression.ts:482-486](../../src/lib/camera/auto-progression.ts) `readSquatCurrentRepPassTruth` JSDoc — remove "pass-core (primary)" phrasing.
- [auto-progression.ts:2201-2212](../../src/lib/camera/auto-progression.ts) block comment `"Main pass gate uses passCore.passDetected / single truth"` — rewrite to distinguish motion-owner vs final-pass-owner.
- [auto-progression.ts:2605-2614](../../src/lib/camera/auto-progression.ts) Step A/B labels — realign to PR-01 ordering.
- [auto-progression.ts:2729-2731](../../src/lib/camera/auto-progression.ts) `"pass-core-first owner alignment"` legacy comment — mark explicitly as legacy.
- [evaluators/squat.ts:307-316](../../src/lib/camera/evaluators/squat.ts) `"ONLY owner of squat motion pass truth"` — narrow to motion truth.
- [evaluators/squat.ts:760](../../src/lib/camera/evaluators/squat.ts) `"final motion pass truth"` — avoid reading `"final"` as product-pass.
- [squat-completion-state.ts:777](../../src/lib/camera/squat-completion-state.ts) `"pass-core (which owns the single pass authority)"` — distinguish completion vs motion ownership.
- [guardrails.ts:432-434](../../src/lib/camera/guardrails.ts) `"single squat motion-completion owner is pass-core"` — terminology alignment.

**Rules**:
- Keep existing `@deprecated` / `compat` / `legacy` field names (do not
  hide history). Add comment `"sink-only, non-canonical authority"` adjacent.
- Zero behavioral change: the full PR-F proof bundle must run green before
  and after with identical output.

---

## §8. This session's output (final)

- **NEW**: this document — [docs/pr/P1-DIAGNOSIS-SHALLOW-FIXTURES.md](P1-DIAGNOSIS-SHALLOW-FIXTURES.md)
- **UNCHANGED**: `src/*`, `scripts/*`, no git commit.
- **NEXT-SESSION ENTRY ORDER**: P1 lever A + B → P4 → P3 → P2 (per parent
  PLANMODE prompt).
