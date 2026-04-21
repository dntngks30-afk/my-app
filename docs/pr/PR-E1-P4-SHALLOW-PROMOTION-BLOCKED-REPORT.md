# PR-E1/P4 — Shallow Promotion Blocked (Stop Report)

> **Session type**: stop-report only. No `src/*`, no `scripts/*`, no
> registry mutation, no skip-marker widening, no threshold change,
> no fixture edit. This document is the session's sole output.
>
> **Decision**: **Path B — promotion is still blocked.** The two
> representative shallow fixtures (`shallow_92deg`, `ultra_low_rom_92deg`)
> do **not** satisfy the canonical promotion criteria on current head.
> They remain `conditional_until_main_passes` in the E1 registry. No
> E1 harness assertions were promoted to hard green.

## References (binding predecessors)

- Implementation prompt: `docs/pr/PR-E1-P4-SHALLOW-PROMOTION-IMPLEMENTATION-PROMPT.md`
- Parent authority freeze: `docs/pr/PR-01-SQUAT-COMPLETION-FIRST-AUTHORITY-FREEZE.md`
- Branch B design SSOT: `docs/pr/PR-CAM-SQUAT-SHALLOW-AUTHORITY-SAFE-DESCENT-SOURCE-EXPANSION.md`
- Registry smoke under review: `scripts/camera-pr-e1-shallow-lock-promotion-registry-smoke.mjs`
- Calibration background: `docs/pr/P1-CALIBRATION-STUDY-RESULT.md`

---

## §1. Session mission recap

The session was instructed to do exactly one of two things on current
head:

- **Path A** — promote `shallow_92deg` and `ultra_low_rom_92deg` from
  `conditional_until_main_passes` to `permanent_must_pass` and harden
  the E1 harness with canonical hard-pass assertions, **only if** all
  of the following hold for both fixtures:
  1. `completionTruthPassed === true`
  2. `finalPassEligible === true`
  3. `isFinalPassLatched('squat', gate) === true`
  4. `canonicalShallowContractDrovePass === true`
  5. no PR-01 illegal-state regression
  6. no absurd-pass regression
- **Path B** — leave the registry unchanged, write a narrow stop report,
  and confirm no runtime / harness broadening was landed.

The prompt is explicit that weakening assertions, widening skip markers,
reviving pass-core as opener, relaxing thresholds, cheating fixtures, or
rewriting authority law are all forbidden as compensation for a failed
promotion. Per §9 item 9 of the Branch B design SSOT, promotion without
all four canonical bits is also forbidden by design.

---

## §2. What was run on current head

All commands were executed against the current canonical ref (Branch B
source already landed on main). No source, script, or registry file was
modified in this session.

| # | Smoke | Result |
|---|-------|--------|
| 1 | `scripts/camera-pr-cam-squat-shallow-authority-safe-descent-source-expansion-smoke.mjs` | **17 passed, 0 failed** |
| 2 | `scripts/camera-pr-01-squat-completion-first-authority-freeze-smoke.mjs` | **21 passed, 0 failed** (covers standing-still, seated, contaminated-setup, single-frame-spike absurd-pass classes at §§2a.2 / 2b.2 / 2c.2) |
| 3 | `scripts/camera-pr-e1-shallow-lock-promotion-registry-smoke.mjs` | **28 passed, 0 failed** — both representative fixtures still SKIP via `conditional_until_main_passes` with the stable `pr01_completion_owner_not_yet_satisfied` reason |
| 4 | `scripts/camera-pr-f-regression-proof-gate.mjs` | **Green** — "all required scripts executed with no unexplained SKIP and no failures" |

So the canonical regression perimeter is intact. The only question the
session had to answer is whether the two E1 fixtures now clear the
promotion criteria independently. They do not.

---

## §3. Promotion-proof probe (read-only)

A read-only probe drove the same two fixture-angle sequences the E1
smoke builds (Matrix A), through `evaluateExerciseAutoProgress('squat', …)`,
and inspected the resulting `gate` / `squatCycleDebug` surface. The
probe consumed only already-surfaced debug fields — it did not extend
the runtime or harness.

### §3.1 `shallow_92deg`

Fixture: canonical PR-D Matrix 1b shape, peak kneeAngleAvg ≈ 92°, step 80 ms.

| Required for promotion | Observed on head | Pass? |
|---|---|---|
| `completionTruthPassed === true` | `false` | ❌ |
| `finalPassEligible === true` | `false` | ❌ |
| `isFinalPassLatched('squat', gate) === true` | `false` | ❌ |
| `canonicalShallowContractDrovePass === true` | `undefined` | ❌ |

Supporting observations:

- `finalPassBlockedReason` = `completion_truth_not_passed` (PR-01 Invariant D
  correctly fail-closing).
- `completionPassReason` = `not_confirmed`, `completionBlockedReason`
  = `ultra_low_rom_not_allowed`.
- `canonicalShallowContractSatisfied` = `false`.
- `canonicalShallowContractStage` = `reversal_blocked`.
- `canonicalShallowContractBlockedReason` = `minimum_cycle_timing_blocked`.
- `canonicalShallowContractReversalEvidenceSatisfied` = `true`.
- `canonicalShallowContractRecoveryEvidenceSatisfied` = `true`.
- `canonicalShallowContractAntiFalsePassClear` = `false`.
- `canonicalShallowContractSplitBrainDetected` = `true` (diagnostic;
  no pass granted).
- `effectiveDescentStartFrameSource` = `trajectory_descent_start` (Source #2).
- `legitimateKinematicShallowDescentOnsetFrameIndex` = `null` — the new
  Branch B Source #4 did **not** fire on this fixture.
- Pass-core is positive (`passDetected === true`, `ownerSource` = `pass_core`)
  but the post-owner UI gate is correctly vetoing via
  `source = post_owner_ui_gate` with `finalPassGranted === false`.

### §3.2 `ultra_low_rom_92deg`

Fixture: same shape as §3.1 with an extended 10-frame standing-recovery tail.

| Required for promotion | Observed on head | Pass? |
|---|---|---|
| `completionTruthPassed === true` | `false` | ❌ |
| `finalPassEligible === true` | `false` | ❌ |
| `isFinalPassLatched('squat', gate) === true` | `false` | ❌ |
| `canonicalShallowContractDrovePass === true` | `undefined` | ❌ |

Supporting observations are byte-identical in shape to §3.1:
`completion_truth_not_passed`, `minimum_cycle_timing_blocked`,
`legitimateKinematicShallowDescentOnsetFrameIndex === null`,
`effectiveDescentStartFrameSource === 'trajectory_descent_start'`, pass-core
positive but post-owner UI gate correctly vetoing.

### §3.3 Every single promotion precondition fails

Neither fixture satisfies **any** of the four required bits. The failure
is not marginal. The canonical shallow contract is actively blocking both
fixtures with `canonicalShallowContractBlockedReason === 'minimum_cycle_timing_blocked'`,
i.e. the 800 ms minimum-cycle floor is still unreachable for them, and
the new Source #4 that was designed to relax that floor is **not
triggering** on these synthetic sequences
(`legitimateKinematicShallowDescentOnsetFrameIndex === null`).

---

## §4. Exact blocker classification

Per the stop-report taxonomy in the implementation prompt:

> The stop report must explicitly state whether the blocker is:
> 1. canonical shallow contract still not driving pass, or
> 2. `canonicalShallowContractDrovePass` not yet trustworthy for promotion, or
> 3. assist-path ambiguity still unresolved for representative fixtures

**Blocker class: (1) — canonical shallow contract still not driving pass.**

Concretely, for both fixtures:

- `canonicalShallowContractSatisfied === false`.
- `canonicalShallowContractBlockedReason === 'minimum_cycle_timing_blocked'`
  (i.e. the 800 ms `SHALLOW_OFFICIAL_CLOSE_MIN_CYCLE_MS` floor is still
  not cleared).
- `canonicalShallowContractAntiFalsePassClear === false` flows from the
  same minimum-cycle miss.
- `effectiveDescentStartFrame` is being supplied by `trajectory_descent_start`
  (Source #2) — the pre-Branch-B anchor that P1 diagnoses already showed
  to sit too close to the peak on these shallow shapes.
- The Branch B Source #4 — `legitimateKinematicShallowDescentOnsetFrame` —
  is returning `null`. Its §4.1 conditions (design SSOT §4) evaluate to
  not-satisfied on these synthetic fixtures under current-head engine
  behavior, so it contributes no earlier anchor.

Classes (2) and (3) are secondary consequences of (1):

- (2) The `canonicalShallowContractDrovePass` diagnostic is only defined
  when `completionTruthPassed === true` (design SSOT §7.4 item 3). With
  `completionTruthPassed === false`, the diagnostic is `undefined` by
  design — this is correct behavior, not untrustworthiness.
- (3) The `pass_core_detected` assist path ambiguity is irrelevant on
  these fixtures today because the pass-core positive signal is being
  **correctly vetoed** by the PR-01 post-owner UI gate
  (`finalPassBlockedReason === 'completion_truth_not_passed'`). There is
  no illegal-state regression; the fixtures simply do not pass.

---

## §5. Why promotion is therefore forbidden

Promoting either fixture to `permanent_must_pass` without canonical
truth would require one of the following — all of which are explicitly
prohibited by the implementation prompt and/or Branch B design SSOT §9:

1. **Weakening E1 harness assertions** below the canonical four bits,
   e.g. accepting `pass_core_detected` as the completion-owner reason
   or accepting a lower `canonicalShallowContract*` bar. Prohibited by
   the prompt's §Success-path requirements and by SSOT §9 item 11.
2. **Adding a new conditional SKIP marker** or widening
   `ALLOWED_SKIP_MARKERS` in PR-F. Prohibited by the prompt and by SSOT
   §9 item 7.
3. **Rewriting the authority law** so pass-core qualifies as a sanctioned
   completion-owner opener. Prohibited by the prompt and by SSOT §9 item
   2, and explicitly deferred to an authority-law session by SSOT §7.5.
4. **Relaxing the 800 ms `SHALLOW_OFFICIAL_CLOSE_MIN_CYCLE_MS` floor**
   or the `KNEE_DESCENT_ONSET_*` band to make Source #4 fire. Prohibited
   by SSOT §9 item 1.
5. **Re-deriving or cherry-picking the synthetic fixtures** so Source #4
   happens to trigger on the promoted samples. Prohibited by SSOT §9
   item 4.

None of those are acceptable compensation; per the prompt, "do not
compensate for failed promotion by widening harness semantics." The only
legal action in this session is Path B.

---

## §6. State of the repository after this session

Confirmed by `git status --short` at session end (excluding
preexisting unrelated drift on `.codex/config.toml`, `.gitignore`, and
the prior design/diagnosis docs that were already untracked):

- **No edits** to `src/*`.
- **No edits** to `scripts/*` (including the E1 registry script).
- **No edits** to any fixture, threshold, authority-law, or proof-gate
  file.
- **No new** `ALLOWED_SKIP_MARKERS` entries.
- **No new** `conditional_until_main_passes` entries — the two existing
  ones remain exactly as before:
  - `shallow_92deg` → `conditional_until_main_passes` (skipReason:
    `pr01_completion_owner_not_yet_satisfied`)
  - `ultra_low_rom_92deg` → `conditional_until_main_passes` (skipReason:
    `pr01_completion_owner_not_yet_satisfied`)
- **No new smoke** script was added.
- This stop report (`docs/pr/PR-E1-P4-SHALLOW-PROMOTION-BLOCKED-REPORT.md`)
  is the only artifact written by this session.
- Temporary local probe scratch files (used only to drive the read-only
  fixture probe in §3) were deleted before session end.

---

## §7. What the next session MUST NOT do

Per the prompt and SSOT §9, none of the following are legal follow-ups
to this stop report:

1. No threshold relaxation on any of:
   `SHALLOW_OFFICIAL_CLOSE_MIN_CYCLE_MS`, `attemptAdmissionFloor`,
   `GUARDED_ULTRA_LOW_ROM_FLOOR`, `KNEE_DESCENT_ONSET_EPSILON_DEG`,
   `KNEE_DESCENT_ONSET_SUSTAIN_FRAMES`.
2. No pass-core opener revival.
3. No authority-law rewrite in a P4 / E1 session (reserved for a
   future authority-law SSOT session per Branch B SSOT §7.5).
4. No fixture cheat or fixture re-derivation.
5. No P2 / P3 naming/registry cleanup piggybacking on a shallow
   promotion PR.
6. No widening of skip markers as a substitute for promotion.
7. No downgrade of either fixture away from
   `conditional_until_main_passes` (e.g. to `skip_permanent` or
   `deprecated`) — Branch B SSOT §9 item 10 forbids this regardless.

---

## §8. What a future session COULD legitimately do (not this one)

Sketched only so the next reader does not mistake this stop report for
a dead-end. Each bullet below is a separate session and requires its
own prompt / SSOT citation; **none of them is authorized by this
document**.

- **Branch B source-logic review session** — investigate why
  `legitimateKinematicShallowDescentOnsetFrame` is not firing on these
  synthetic fixtures even though their kneeAngle shape (8 × 170° → 165°
  → 155° → 145° → 130° → 115° → 100° → 95° → 93° → 92°) superficially
  matches the design SSOT §3.5 example (170° → 165° drop at frame 8,
  5° monotonic drop with multi-frame sustain). The probe observed
  `legitimateKinematicShallowDescentBaselineKneeAngleAvg ≈ 96.04°`,
  which is lower than the standing 170° and suggests the baseline window
  is resolving over descending frames rather than the pre-descent
  standing hold; whether that is an implementation defect or a
  deliberate choice is outside the scope of this session. Any such
  review must stay within SSOT §4.4 admissible bands and §5 proof
  obligations, and must not relax thresholds.
- **Real-capture replay session** (per Branch B SSOT §8.3) — acquire
  the ≥ 5 per-frame real shallow recordings the calibration study
  requested, then re-evaluate whether Source #4's onset logic works on
  realistic pose-extraction output. This is categorized as a "follow-on
  confidence test" in the SSOT, not a blocker for promotion; promotion
  itself still requires the synthetic fixtures to pass canonically,
  which they currently do not.
- **Authority-law session** (per Branch B SSOT §7.5) — formally resolve
  the §7.2 (A) vs §7.3 (B) interpretation of `pass_core_detected` as
  a completion-owner reason. This session would use the
  `canonicalShallowContractDrovePass` diagnostic (already landed in
  Branch B) to quantify the canonical-vs-assist pass population on real
  captures, then decide whether to retire the `pass_core_detected`
  opener path or to formally sanction it.

When — and only when — one of those unblocks both E1 fixtures into a
state where every bit in §3's truth table flips to ✅, a follow-on
session may rerun this exact check and, on clean success, execute Path
A: registry promotion plus hard-green assertions plus downgrade
protection. Until then, E1 stays at `conditional_until_main_passes` and
the current E1 harness remains the correct machine-enforced owner.

---

## §9. One-line lock

**`shallow_92deg` and `ultra_low_rom_92deg` remain at
`conditional_until_main_passes` in the E1 registry because the canonical
shallow contract is still not driving pass on either fixture on current
head (`completionTruthPassed === false`,
`canonicalShallowContractBlockedReason === 'minimum_cycle_timing_blocked'`,
`legitimateKinematicShallowDescentOnsetFrameIndex === null`); no runtime,
script, or registry edits were made in this session.**
