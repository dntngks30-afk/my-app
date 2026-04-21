# P1 Diagnosis V2 — Shallow Descent Signal-Shape Blocker (Stop Report)

> **Scope**: read-only stop report produced after the P1 implementation session
> failed to recover the two `conditional_until_main_passes` shallow fixtures
> within the authority-safe lever budget (Lever A + Lever B) specified in
> `P1-DIAGNOSIS-SHALLOW-FIXTURES.md` §5.
>
> **Status**: P1 implementation **STOPPED** per parent prompt §"즉시 중단 조건".
> No `src/*` changes were landed. `src/*` tree was reverted to HEAD. Only this
> diagnostic addendum is produced.
>
> **Non-negotiable invariants preserved (did NOT attempt to bypass)**:
> 1. Completion-owner truth is the ONLY opener of final pass (PR-01 freeze).
> 2. Pass-core / shallow-assist / closure-proof / bridge / event-cycle are NOT openers.
> 3. Absurd-pass registry is block-only.
> 4. Threshold relaxation is forbidden.
> 5. Quality truth is separate from pass truth.

- Prior diagnosis: [P1-DIAGNOSIS-SHALLOW-FIXTURES.md](./P1-DIAGNOSIS-SHALLOW-FIXTURES.md)
- Parent prompt: this session's P1 implementation entry
- Authority law: [PR-01-SQUAT-COMPLETION-FIRST-AUTHORITY-FREEZE.md](./PR-01-SQUAT-COMPLETION-FIRST-AUTHORITY-FREEZE.md)

---

## §1. What was attempted

Two authority-safe levers were prototyped against `squat-completion-core.ts`,
`squat-completion-state.ts`, and `evaluators/squat.ts`:

### §1.1 Lever A — 4th source for `effectiveDescentStartFrame`
Added two candidates:
- **Local**: earliest post-baseline-freeze pre-peak `depthFrame` meeting
  `depth - baselineStandingDepth >= attemptAdmissionFloor * 0.2`
  (k = 0.2, midpoint of spec-approved [0.15, 0.25]).
- **External**: pre-computed from the FULL `valid` buffer (upstream of arming
  slicing) in `evaluators/squat.ts`, threaded through
  `EvaluateSquatCompletionStateOptions.legitShallowDescentEpoch`. Synthetic
  `index = Number.MIN_SAFE_INTEGER` to guarantee earliest-by-index selection.
  Same k-scaled threshold formula.

Guards: `depthFreeze != null`, `attemptAdmissionSatisfied === true`, strict
`timestampMs < peakFrame.timestampMs`, `phaseHint = 'descent'`. Does NOT alter
peak, standing-recovered, or reversal anchors.

### §1.2 Lever B — separate `reversalAtMs` from `peakAtMs`
In `squat-completion-core.ts` output:
```ts
const emittedReversalAtMs = (() => {
  const raw = progressionReversalFrame?.timestampMs;
  if (raw == null) return undefined;
  if (raw !== peakFrame.timestampMs) return raw;
  if (!ownerAuthoritativeReversalSatisfied) return raw;
  if (postPeakDepthFrame == null) return raw;
  return postPeakDepthFrame.timestampMs;
})();
```
Advances reversal to the first post-peak depth frame only when
`ownerAuthoritativeReversalSatisfied === true` and `raw === peakAtMs`.

---

## §2. Observed behavior after A + B prototype

Both fixtures still fail-close with the same primary blocker.

| Field | Baseline | With A + B prototype |
|---|---|---|
| `descendStartAtMs` | `1480` | `1400` |
| `peakAtMs` | `1720` | `1720` |
| `reversalAtMs` | `1720` | `1800` ✓ (Lever B worked) |
| `standingRecoveredAtMs` | `1960` | `1960` |
| `cycleDurationMs` | `480` | `560` (still < 800) ⚠ |
| `canonicalShallowContractBlockedReason` | `minimum_cycle_timing_blocked` | `minimum_cycle_timing_blocked` ⚠ |
| Contract trace `anti=` bit | `0` | `1` ✓ |
| Contract trace `minCycle=` bit | `0` | `0` ⚠ |
| `gate.status` | `retry` | `retry` |
| `finalPassBlockedReason` | `completion_truth_not_passed` | `completion_truth_not_passed` |

**Lever B fully succeeded** at clearing the `anti=0` secondary gap.

**Lever A delivered 80ms of descent-anchor improvement (1480 → 1400ms)** but
cannot go earlier within the spec-approved k range. This is not enough:
`cycleDurationMs = standingRecoveredAtMs − descendStartAtMs = 1960 − 1400 = 560ms`,
still below `SHALLOW_OFFICIAL_CLOSE_MIN_CYCLE_MS = 800ms`.

---

## §3. Root cause — upstream signal shape, not anchor selection

### §3.1 Measured `squatDepthProxy` per frame

Directly instrumented in `evaluators/squat.ts` over `valid` (pre-arming-slice):

| idx | timestampMs | kneeAngle° | `squatDepthProxy` | Δ vs standing baseline |
|---:|---:|---:|---:|---:|
| 0–7 | 200–760 | 170 | 4.49 × 10⁻⁷ | 0 |
| 8 | 840 | 165 | 5.46 × 10⁻⁷ | ≈ 1 × 10⁻⁷ |
| 9 | 920 | 155 | 9.55 × 10⁻⁷ | ≈ 5 × 10⁻⁷ |
| 10 | 1000 | 145 | 2.48 × 10⁻⁶ | ≈ 2 × 10⁻⁶ |
| 11 | 1080 | 130 | 1.10 × 10⁻⁵ | ≈ 1 × 10⁻⁵ |
| 12 | 1160 | 115 | 7.19 × 10⁻⁵ | ≈ 7 × 10⁻⁵ |
| 13 | 1240 | 100 | 5.83 × 10⁻⁴ | ≈ 6 × 10⁻⁴ |
| 14 | 1320 | 95 | **2.90 × 10⁻³** | ≈ 2.9 × 10⁻³ |
| 15 | **1400** | 93 | **8.69 × 10⁻³** | ≈ 8.7 × 10⁻³ |
| 16 | 1480 | 92 | 1.81 × 10⁻² | ≈ 1.8 × 10⁻² |
| … | … | … | … | … |
| 19 | 1720 | 95 | 4.37 × 10⁻² | peak |

Lever A's threshold at k ∈ [0.15, 0.25] is
`attemptAdmissionFloor * k = 0.02 × k ∈ [0.003, 0.005]`.

| k | threshold | earliest-crossing timestamp | descendStart | cycle |
|---:|---:|---:|---:|---:|
| 0.25 | 0.005 | 1400 | 1400 | 560ms |
| 0.20 | 0.004 | 1400 | 1400 | 560ms |
| 0.15 | 0.003 | 1400 | 1400 | 560ms *(1320 at 0.0029 just misses)* |

To reach `cycleDurationMs ≥ 800ms` we need `descendStartAtMs ≤ 1160ms`. The
frame at 1160ms has relative depth ≈ 7 × 10⁻⁵, which would require
threshold ≤ 7 × 10⁻⁵, i.e. k ≤ 0.0035 — **~43× below the spec floor k = 0.15**.

### §3.2 Why the prior diagnosis's "frame 8 → 840ms" expectation was optimistic

Prior diagnosis §4.4 stated: *"the fixture's actual first-below-baseline frame
is at raw index 8 (165°, timestamp 840ms). If the descent anchor were at 840ms
instead of 1480ms, `cycleDurationMs = 1960 − 840 = 1120ms`."*

That is directionally true (the pose mock does inflect away from standing at
index 8) but the realized `squatDepthProxy` delta at index 8 is only ~10⁻⁷,
essentially indistinguishable from standing noise. Any k > ~3 × 10⁻⁶ rejects
frame 8. The signal only crosses an authority-safe absurd-pass floor ~6
frames later — by which time the cycle is already below 800ms.

### §3.3 This is NOT a PR-01 authority failure

- `ownerAuthoritativeReversalSatisfied === true` (post-Lever-B).
- `descendConfirmed === true`.
- `reversalConfirmedAfterDescend === true`, `recoveryConfirmedAfterReversal === true`.
- `canonicalShallowContractReversalEvidenceSatisfied === true`.
- `canonicalShallowContractRecoveryEvidenceSatisfied === true`.

The completion-owner path is internally consistent. The contract's
**timing input** (cycle duration) is the sole remaining gap, and it is
upstream of anchor selection — it is a **signal-shape property of the
fixture's pose mock**.

---

## §4. Why Lever A + Lever B cannot recover these fixtures

The gap is not "where should we anchor the descent" (Lever A) — the anchor is
already pinned to the earliest authority-safe threshold crossing. The gap is
"the authority-safe crossing arrives too close to peak for this mock shape".

Any anchor earlier than 1400ms for this fixture requires one of:

1. **k < 0.15** — explicit threshold relaxation. **Forbidden** by parent prompt
   ("threshold 완화 금지") and by `P1-DIAGNOSIS-SHALLOW-FIXTURES.md` §5
   Lever C/E rejection rationale.
2. **A different descent signal** than `squatDepthProxy` (e.g., `kneeAngleAvg`
   derivative, `squatDepthProxyRaw`, a phaseHint-free kinematic trigger). This
   would be a **new authority source**, not a feeder refinement — it would
   need its own design doc, absurd-pass proof, and split-brain guard. It is
   outside both the spec'd Lever A formula (`depth >= attemptAdmissionFloor * k`)
   and the parent prompt's allowed scope.
3. **Lowering `SHALLOW_OFFICIAL_CLOSE_MIN_CYCLE_MS`** (Lever C). **Forbidden**.
4. **Injecting phaseHint into the fixture mock** (Lever E). **Forbidden**.

Of the four, only (2) is potentially authority-safe, but it is a follow-on PR
scope, not this session's scope.

---

## §5. What is preserved (residual correct behavior)

1. PR-01 completion-first authority freeze remains intact — final pass stays
   blocked under `completion_truth_not_passed`, as designed.
2. `canonicalShallowContractSplitBrainDetected: true` continues to fire as the
   healthy PR-01 guardrail it is supposed to be.
3. Absurd-pass blocker families (`standing_still`, `setup_motion_contaminated`,
   `no_real_descent`, etc.) remain unchanged and unweakened.
4. Both fixtures remain `conditional_until_main_passes` in the E1 registry;
   the PR-F proof gate's explicit SKIP markers continue to cover this residual
   risk with byte-exact justification strings.

---

## §6. Stop conditions hit (per parent prompt)

| Condition | Hit? |
|---|---|
| 두 fixture 중 하나라도 여전히 미복구 | **YES** — both remain `retry` |
| 복구를 위해 threshold 완화가 필요해짐 | **YES** — spec k floor 0.15 too high for this signal shape |
| authority law 수정이 필요해짐 | NO |
| absurd-pass blocker 약화 없이는 통과가 안 됨 | NO (blocker unchanged would still catch) |
| split-brain 또는 shortcut reopen 조짐이 생김 | NO (did not open split-brain) |

Per prompt: "즉시 중단". Session ends here. P4 / P3 / P2 **not** attempted.

---

## §7. Recommendation for a future P1 follow-on session (out of scope here)

**Do not re-try Lever A/B on this mock as specified.** Instead, a follow-on
session should:

1. Either adjust the fixture's pose mock to produce a more realistic
   early-descent `squatDepthProxy` gradient (fixture-side fix, still rejected
   by current prompt as Lever E — but E's rejection was framed around
   "fixture-specific tweaks hiding a real-user failure class"; if the mock
   itself is unrealistic for real pose extraction, this becomes a **mock
   calibration**, not evidence hiding), OR
2. Design a new authority-safe descent source in `squat-completion-core.ts`
   that uses `kneeAngleAvg` (or a derivative) with its own absurd-pass proof
   bundle and split-brain guard. This is meaningfully larger than Lever A and
   requires its own SSOT + PR prompt.

Until one of (1)/(2) is chosen and designed with full authority accounting,
`shallow_92deg` and `ultra_low_rom_92deg` MUST remain
`conditional_until_main_passes` — promotion to `permanent_must_pass` is
forbidden, downgrade is forbidden, SKIP markers stay with explicit reason
strings.

---

## §8. Files touched by this session

- **Prototyped then reverted**:
  - `src/lib/camera/squat/squat-completion-core.ts` (Lever A + B prototype)
  - `src/lib/camera/squat-completion-state.ts` (options type extension)
  - `src/lib/camera/evaluators/squat.ts` (legit-shallow epoch computation)
- **Net src diff against HEAD**: **none** (full revert).
- **New doc**: this file.
- **Removed**: temporary capture / debug scripts at repo root.

No git commits were produced by this session.
