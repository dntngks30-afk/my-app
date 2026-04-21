# P1 Follow-on Classification Decision

> **Session type**: read-only classification only.
> No `src/*`, `scripts/*`, threshold, mock, fixture, authority, proof-gate,
> blocker, or naming changes. This document is the session's sole output.

- Prior diagnostics: [P1-DIAGNOSIS-SHALLOW-FIXTURES.md](./P1-DIAGNOSIS-SHALLOW-FIXTURES.md),
  [P1-DIAGNOSIS-V2-SHALLOW-SIGNAL-SHAPE-BLOCKER.md](./P1-DIAGNOSIS-V2-SHALLOW-SIGNAL-SHAPE-BLOCKER.md)
- Authority law: [PR-01-SQUAT-COMPLETION-FIRST-AUTHORITY-FREEZE.md](./PR-01-SQUAT-COMPLETION-FIRST-AUTHORITY-FREEZE.md)
- Parent PR: [P1-SQUAT-LEGITIMATE-SHALLOW-EVIDENCE-RECOVERY.md](./P1-SQUAT-LEGITIMATE-SHALLOW-EVIDENCE-RECOVERY.md)
- SSOT: `docs/SSOT_SQUAT_COMPLETION_FIRST_QUALITY_STRICT_2026_04.md`
- Classifying prompt: [P1-FOLLOWON-CLASSIFICATION-PROMPT.md](./P1-FOLLOWON-CLASSIFICATION-PROMPT.md)

---

## §1. Scope and stop condition recap

P1 recovery attempt stopped per parent prompt's hard-stop rules. Two stop
conditions were hit simultaneously:

- **"두 fixture 중 하나라도 여전히 미복구"** — both `shallow_92deg` and
  `ultra_low_rom_92deg` remained `retry` / `completion_truth_not_passed`
  after applying both Lever A and Lever B within spec-approved parameters.
- **"복구를 위해 threshold 완화가 필요해짐"** — for the specific synthetic
  fixture's `squatDepthProxy` trajectory, any anchor early enough to satisfy
  `cycleDurationMs ≥ SHALLOW_OFFICIAL_CLOSE_MIN_CYCLE_MS (800ms)` requires
  `k ≤ ~0.0035`, roughly **43× below the spec floor k = 0.15**.

Lever B (separating `reversalAtMs` from `peakAtMs` when
`ownerAuthoritativeReversalSatisfied === true`) fully cleared the canonical
contract's `anti=0` secondary gap. Lever A (4th source for
`effectiveDescentStartFrame`) improved `descendStartAtMs` by 80ms
(1480 → 1400) but could not reach the ≤1160ms needed for the 800ms cycle floor.

`src/*` tree was fully reverted to HEAD. PR-01 authority remains intact.
Absurd-pass blockers remain unweakened. The two fixtures continue as
`conditional_until_main_passes` in the E1 registry.

This session must classify whether the next correct move is **Branch A —
fixture calibration** or **Branch B — new authority-safe descent source**.

---

## §2. What P1 proved

1. **Lever B is a valid, narrow authority-safe ordering repair.** It cleanly
   eliminates the `reversalAtMs === peakAtMs` degenerate-ordering blocker when
   (and only when) `ownerAuthoritativeReversalSatisfied` is already true. It
   does not weaken reversal truth and does not reopen pass-core authority.
   It would be a safe, small addition whenever the product team decides to
   land it in isolation.

2. **Lever A's spec-approved k range cannot move the anchor far enough on the
   current synthetic fixture.** With `attemptAdmissionFloor = 0.02`,
   threshold ∈ [0.003, 0.005] across k ∈ [0.15, 0.25]. The measured
   `squatDepthProxy` first exceeds 0.003 at the frame already ~320ms before
   peak (1400ms). Earlier frames sit at 10⁻⁷–10⁻³ levels — structurally
   below any authority-safe threshold scale anchored to
   `attemptAdmissionFloor`.

3. **The authority separation is internally consistent throughout.** With
   Lever B applied, `ownerAuthoritativeReversalSatisfied`,
   `descendConfirmed`, `reversalConfirmedAfterDescend`, and
   `recoveryConfirmedAfterReversal` are all `true`. The canonical shallow
   contract's only remaining fail is `minimum_cycle_timing_blocked`, which
   is a **timing input** gap, not a completion-owner authority gap.

4. **The failure is NOT a PR-01 authority regression and NOT an absurd-pass
   weakening.** `canonicalShallowContractSplitBrainDetected` still fires as
   designed. Final pass remains correctly closed under
   `completion_truth_not_passed`. No illegal state was reintroduced.

---

## §3. What P1 did not prove

P1 did NOT produce evidence that answers the core classification question:

- **No real-user shallow recording was compared.** All data is from the
  E1 `squatPoseLandmarksFromKneeAngle` synthetic mock.
- **No phaseHint emission pattern from the real pose-feature pipeline was
  measured.** The mock emits zero phaseHint; we do not know whether real
  MediaPipe-driven pose extraction would emit `phaseHint === 'descent'` at
  ~840ms for a 165° knee angle in a legitimate shallow rep.
- **No direct comparison between mock-derived `squatDepthProxy` trajectories
  and real-recording `squatDepthProxy` trajectories.** The mock's extreme
  logistic-style saturation at near-standing knee angles (4.49 × 10⁻⁷
  baseline → 5.46 × 10⁻⁷ at 165°, a delta of ~10⁻⁷) may or may not match
  the behavior of the real pose-feature formula on realistic MediaPipe input.
- **No evidence that the current authority-safe source family fails on real
  shallow reps.** P1 only proved it fails on one specific synthetic fixture.

These gaps are the central reason the next step must be chosen carefully,
because Branch A and Branch B require structurally different work products.

---

## §4. Branch A case — Fixture calibration problem

### §4.1 Evidence for Branch A

**A1. The synthetic mock under-shifts hip position relative to anthropometry.**

Mock formula (from `P1-DIAGNOSIS-SHALLOW-FIXTURES.md` §2):
```
depthT = clamp((170 − kneeAngleDeg) / 110)
hipY   = 0.38 + depthT * 0.12
kneeY  = 0.58 + depthT * 0.04
```

At the first descent frame (165°): `depthT ≈ 0.0454` → `hipY` shifts by
`≈ 0.0055` normalized frame units. At peak (92°): hip shifts by `≈ 0.085`.
For a person occupying ~0.8 of the vertical frame (i.e. a ~140cm body span),
0.085 normalized ≈ 12cm hip drop — approximately **half** the ~20–25cm hip
drop that a real 92° squat would produce on a full-torso subject. The early
descent gradient is therefore structurally flatter than a realistic
MediaPipe recording would produce for the same knee-angle schedule.

**A2. The mock emits no `phaseHint`.**

`phaseHint === 'descent'` is a legitimate authority-safe source tier #1 in
`effectiveDescentStartFrame` (see `squat-completion-core.ts`'s ordering:
`descentFrame` is the primary, not a fallback). The mock provides only raw
landmarks and therefore cannot emit any phaseHint. Real pose-feature
extraction is designed to produce phaseHints and, per the earlier P1
diagnosis §4.4, is expected to do so for legitimate shallow reps:

> *"The same real-world rep where pose-feature extraction emits earlier
> descent phaseHints would not trigger this failure."* — P1-DIAGNOSIS §4.4

**A3. The current source family's primary channel is phaseHint, not
threshold.**

The three current sources in priority order are:
1. `descentFrame` (phaseHint-based) — primary
2. `trajectoryDescentStartFrame` (depth >= floor × 0.4) — fallback
3. `sharedDescentEpochFrame` (pass-window-owned truth) — secondary

The design treats the threshold-based source as a fallback, not the
contract. A fixture that exercises only the fallback channel is therefore
stress-testing a fallback branch rather than the real-path evidence chain.

**A4. P1 parent doc explicitly scopes pose-feature redesign as OUT of scope.**

From `P1-SQUAT-LEGITIMATE-SHALLOW-EVIDENCE-RECOVERY.md` §Scope:
> *"no pose-feature system redesign"* — explicit out-of-scope item.

A new authority-safe descent source that sidesteps the logistic saturation
would either reach into pose-feature derivation (out of scope) or introduce
a parallel kinematic signal (kneeAngle, kneeAngle derivative, trunk lean, …)
with its own absurd-pass proof and split-brain guard — functionally a
pose-feature-system-level addition.

### §4.2 What Branch A would look like

- A calibration / representativeness study session with zero code changes.
- Comparison artifact: real-recording `PoseFeaturesFrame.derived` trajectories
  for legitimate shallow (~92°) reps vs the synthetic fixture trajectories
  for the same knee-angle schedule.
- Pass/fail question: does real pose-feature extraction (on real
  MediaPipe-driven input) produce at least one of
  - `phaseHint === 'descent'` at ≤1160ms, or
  - `squatDepthProxy` crossing `0.02 × 0.15 = 0.003` at ≤1160ms, or
  - a `sharedDescentTruth.descentStartAtMs` ≤ 1160ms?
- If yes → the fixture is the abnormal element. Re-derive the fixture from
  real recordings (or model-trained pose output) and Lever A + Lever B may
  then recover the fixtures without any new product source.
- If no → Branch A is falsified; promote the prior answer to Branch B.

### §4.3 Weakness of Branch A

Branch A implicitly trusts that the product's existing source family is
adequate for real shallow reps. Absent real-user data we cannot verify this
directly. Branch A's next session is precisely the one that would produce
that verification, so the weakness is converted into the session's goal
rather than left as an unacknowledged risk.

---

## §5. Branch B case — New authority-safe descent source needed

### §5.1 Evidence for Branch B

**B1. The P1-DIAGNOSIS §5 table listed only threshold-bearing levers.**

Levers A, C, D, E are all variants of "tune a threshold" or "change the
fixture". None addresses the structural property that the source family
depends on `attemptAdmissionFloor`-scaled relative depth. If real reps
also produce shallow-early logistic-flat gradients, the same failure class
would manifest on real data too. Branch B is the only option in that case.

**B2. `squatDepthProxy` logistic shape is a product property, not a mock
artifact — in the knee-angle dimension.**

If the product's `squatDepthProxy` formula has a knee-angle logistic term
that saturates near-standing, a real rep with the same knee-angle schedule
would show the same near-zero early values in that *dimension*, independent
of the mock's hipY amplitude. The threshold-based fallback channel would
then be just as late for real reps. (Note: this argument depends on how
much `squatDepthProxy` actually draws from hipY vs knee-angle. We don't
know the blend.)

**B3. The canonical contract's `minCycle` check compares against a
fixed-millisecond floor (800ms), not a fraction of observed rep duration.**

Any authority-safe anchor tied to a depth-threshold crossing will always
be temporally close to peak for shallow / ultra-low-ROM reps by construction
(because the signal is, by definition, shallow). This is a structural
tension between "depth-threshold-based descent anchor" and "absolute-ms
cycle floor" that no k tuning within [0.15, 0.25] can resolve.

**B4. The fixtures' registry status explicitly anticipates an upstream
evidence-formation PR.**

E1 registry rationale (as quoted in `P1-DIAGNOSIS-SHALLOW-FIXTURES.md`):
> *"These shallow misses are deferred to a follow-on shallow-evidence PR
> (PR-F upstream evidence formation)."*

This phrasing envisions an evidence-formation change, not a mock change.
Branch B is consistent with this prior framing.

### §5.2 What Branch B would look like

- A new design PR: `PR-*-SQUAT-SHALLOW-DESCENT-SOURCE-EXPANSION` (or
  equivalently-named).
- New SSOT section or companion SSOT: definition of a new descent-source
  tier keyed to a non-depth-threshold authority-safe signal (e.g., knee-angle
  derivative or trunk-lean-anchored onset), with explicit authority
  accounting.
- New absurd-pass proof bundle: proves the new source does not admit
  `standing_still`, `setup_motion_contaminated`, `no_real_descent`, or
  `contaminated_blended_early_peak_false_pass` families.
- New split-brain guard: proves the new source cannot contradict
  completion-owner truth.
- Implementation follows the new SSOT only after all three proofs land.

### §5.3 Weakness of Branch B

Branch B is a large investment — new SSOT, new proofs, new smoke family.
Committing to it before falsifying Branch A would risk solving a problem
we have not yet proven exists on real reps. Per the engineering discipline
of smallest-reversible-step, a calibration study that falsifies Branch A
is cheaper and must come first.

---

## §6. Primary classification decision

**Primary: Branch A — Fixture calibration problem.**

Reasoning ranking (highest weight first):

1. **The mock's quantitative under-shift of hipY is measurable and large**
   (~2× below realistic anthropometry in the direction that matters). This
   alone makes the mock a non-representative proxy for real shallow motion
   in the pose-feature pipeline.

2. **The mock structurally cannot emit phaseHint**, which is the primary
   (tier 1) source the engine was designed around. The fallback-only stress
   test is not a fair proof that the engine's real-path evidence chain is
   insufficient.

3. **P1 parent doc's explicit out-of-scope clause** forbids pose-feature
   system redesign. Branch B's core deliverable is functionally a new
   pose-feature-tier authority source, which would either violate that
   scope clause or require escalation to a higher-level SSOT change.

4. **Cheap falsifier exists**: a calibration study can distinguish A from B
   without any code change by comparing real vs synthetic trajectories on
   the same knee-angle schedule. That falsifier must run before spending
   Branch B effort.

5. **Branch B cannot be correctly designed without Branch A's data anyway.**
   Any new authority-safe descent source needs to be proved safe against
   real pose noise profiles, which Branch A's study is the correct vehicle
   to characterize.

Branch A is therefore primary. Branch B is held as the fallback if and only
if the Branch A calibration session empirically falsifies Branch A by
showing that realistic pose input also fails the current source family.

Branch C (insufficient evidence) is rejected: although real-recording
evidence is absent, Branch A vs Branch B can still be ranked because
Branch A's prerequisites are cheaper and its falsifier is well-defined.
Jumping to Branch B without the Branch A falsifier first would invert
engineering discipline.

---

## §7. Why the rejected branch (B) is not the next move

- **Premature investment**: Branch B requires a new SSOT, a new absurd-pass
  proof bundle, a new split-brain guard, and a new smoke family. That is a
  multi-PR effort whose scope is not justified by a single synthetic
  fixture's failure.
- **Wrong-problem risk**: if real pose extraction does emit phaseHint at
  ~840ms for legitimate shallow reps (plausible per design expectations),
  Branch B would solve a problem that does not exist on the real-path
  evidence chain. Branch A's calibration study must rule this out before
  committing to Branch B.
- **Out-of-scope tension**: P1 parent doc explicitly forbids pose-feature
  system redesign. Branch B's design crosses into that forbidden territory
  or requires a higher-level SSOT escalation that the current classification
  session is not authorized to declare.
- **Authority accounting load**: Branch B adds a new tier to the authority
  ladder. Adding authority tiers without empirical necessity violates the
  "smallest authority-safe change that clears the blocker" principle implicit
  in PR-01 §12 residual-risk policy.

If Branch A's calibration session falsifies Branch A empirically, Branch B
becomes the correctly-scoped next PR. Until then it is premature.

---

## §8. Exact next session recommendation

**Next session type: fixture calibration representativeness study.**
**Session mode: read-only + narrow non-product artifact generation only.**

### §8.1 Session scope

- No `src/*` changes.
- No `scripts/*` changes that touch the engine.
- No authority-law, threshold, proof-gate, blocker, or naming changes.
- No fixture value changes in this session (the fixture change itself,
  if any, lands in a later session after the comparison is complete).
- Allowed artifacts: one new comparison report doc under `docs/pr/`; ad-hoc
  temporary capture scripts that are removed by session end; no committed
  runtime code.

### §8.2 Required comparison

Produce a table comparing, for each of at least 2 real-user shallow
recordings at ~92° peak:

| Measurement | Real recording | Synthetic `shallow_92deg` | Gap |
|---|---|---|---|
| `kneeAngleAvg` trajectory (200–2000ms) | … | … | … |
| `squatDepthProxy` trajectory | … | … | … |
| `squatDepthProxyBlended` trajectory | … | … | … |
| First `phaseHint === 'descent'` timestamp | … | … | … |
| `sharedDescentTruth.descentStartAtMs` | … | … | … |
| First frame meeting `relDepth ≥ 0.003` (k=0.15) | … | … | … |
| `effectiveDescentStartFrame.timestampMs` | … | … | … |
| Resulting `cycleDurationMs` | … | … | … |
| `canonicalShallowContractBlockedReason` | … | … | … |

Data source for real recordings: either existing telemetry captures, a
controlled in-person re-recording with live MediaPipe output, or a
previously-archived session known to contain legitimate shallow reps. The
session's first task is to identify a valid data source.

### §8.3 Decision gate produced by the session

- **If real-recording column satisfies the canonical contract** (gate.status
  passes on current engine with no modifications): **Branch A confirmed.**
  Schedule a fixture re-derivation session (still docs-first) to replace the
  synthetic `squatPoseLandmarksFromKneeAngle` fixtures with real-data
  fixtures. Lever A + Lever B may then be re-evaluated against the re-derived
  fixtures and, if they also pass, retired as unnecessary.
- **If real-recording column also fails**: **Branch A falsified → Branch B
  confirmed.** Schedule a new authority-safe descent source design PR with
  its own SSOT, absurd-pass proof bundle, and split-brain guard.
- **If real recordings are unavailable or inconclusive**: session must stop
  and produce a data-collection plan; no P4/P3/P2 advances.

### §8.4 Blocked-until-resolved

P4, P3, and P2 all remain blocked until this classification branch is
empirically resolved. The E1 registry entries for `shallow_92deg` and
`ultra_low_rom_92deg` remain `conditional_until_main_passes`. Promotion to
`permanent_must_pass` is forbidden. Downgrade is forbidden. PR-F SKIP
markers remain.

---

## §9. Hard prohibitions for the next session

The following are prohibited in the next (calibration study) session unless
separately re-authorized by an explicit new prompt that supersedes this
decision:

1. **Threshold relaxation** — Lever C, k < 0.15, lowering
   `SHALLOW_OFFICIAL_CLOSE_MIN_CYCLE_MS`, softening `attemptAdmissionFloor`,
   or any scalar knob tuning outside existing spec ranges.
2. **Pass-core opener revival** — no reintroduction of any pre-PR-01
   pass-core-first opener shortcut; pass-core remains non-opener assist,
   veto, and trace only.
3. **Authority shortcut reopening** — no assist-only or bridge-based
   reopening of final pass without canonical completion-owner truth; SSOT
   §6 illegal state #8 must stay closed.
4. **Fixture-side cheat that merely hides the failure class** — injecting
   `phaseHint`, artificially moving landmark positions to cross thresholds
   without representing real motion, or any mock tweak whose sole purpose
   is to flip the fixture green without representing real-user pose is
   forbidden. Only realistic re-derivation from real-recording data is
   permitted, and only in a follow-on session, not this classification one.
5. **Advancing to P4 / P3 / P2** — all three remain blocked until this
   classification branch is empirically resolved. The parent
   `PLANMODE-P1-P4-P3-P2-IMPLEMENTATION-PROMPT` sequence cannot proceed.
6. **Committing runtime code** — this classification session and its
   immediate calibration successor both produce docs / read-only artifacts
   only. No `src/*` or engine `scripts/*` commits.
7. **Broadening `ALLOWED_SKIP_MARKERS`** as a substitute for recovery — the
   PR-F proof gate's conditional SKIP markers must stay at current breadth.
   No new markers to paper over calibration results.

---

## §10. Final lock

This decision document selects **Branch A (fixture calibration problem)** as
the primary classification for the failed P1 recovery. The next authorized
session is a **fixture representativeness study** whose sole output is a
comparison between real-recording and synthetic shallow trajectories under
the current engine. That session either confirms Branch A (fixture
re-derivation follow-on) or falsifies it and escalates to Branch B
(new authority-safe descent source design PR). P4, P3, and P2 remain
blocked until this classification branch is empirically resolved.
