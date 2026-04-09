# PR-RF-01 — auto-progression pure helper extraction only

> This PR follows `docs/REFACTORING_SSOT_2026_04.md` and is limited to behavior-preserving extraction unless explicitly stated otherwise.

Parent SSOT: `docs/REFACTORING_SSOT_2026_04.md`

Status: Draft SSOT for refactoring only  
Target PR: `PR-RF-01`  
Primary target: `src/lib/camera/auto-progression.ts`

---

## 0. Intent

`PR-RF-01` is the **first and smallest allowed slice** of the `auto-progression.ts` refactor track.
Its purpose is not to improve camera behavior, pass quality, or gate design.
Its purpose is to make the current file safer to reason about by extracting **pure, private helpers** while preserving existing output truth exactly.

This PR is successful only if:

- the file becomes easier to read,
- top-level control flow becomes easier to inspect,
- later RF PRs become safer to stage,
- and **no runtime-observable camera gate behavior changes at all**.

This PR must stay strictly inside the parent SSOT's `A1. Pure helper extraction only` stage.
It must **not** drift into RF-02, RF-03, or later structural slices.

---

## 1. Scope

### In scope

Only the following are allowed in `PR-RF-01`:

1. Extract **private pure helpers** from large inline logic inside `src/lib/camera/auto-progression.ts`
2. Extract repeated read/derivation logic without changing its meaning
3. Extract repeated result-object assembly logic without changing branch ownership or payload shape
4. Introduce helper-local private types/interfaces if they remain internal to the file and do not affect the exported contract
5. Reorder **private helper declarations** for readability, while keeping the runtime call graph semantically identical

### Canonical extraction targets allowed in RF-01

The allowed helper groups are limited to behavior-preserving reads/derivations already described by the parent SSOT's A1 boundary:

- confidence / noise / metric read helpers
- pass confirmation helpers
- failure reason helpers
- user guidance helpers
- repeated threshold/frame derivation helpers used by `isFinalPassLatched(...)` and `evaluateExerciseAutoProgress(...)`
- repeated inline branch payload assembly helpers

### Scope boundary

RF-01 must remain inside the current behavior-owner file:

- keep all public exports in `src/lib/camera/auto-progression.ts`
- keep extracted helpers **private**
- prefer **same-file extraction** only
- do **not** split to new modules in RF-01 unless the file becomes mechanically impossible to maintain otherwise

Default-safe path for RF-01:

- same-file
- private helper extraction
- pure calculations only
- no top-level orchestration redesign

### Explicitly out of RF-01 scope even if related

The following belong to later PRs and must not be pulled into RF-01:

- squat UI gate isolation (`RF-02` class work)
- squat final-pass blocker isolation (`RF-03` class work)
- debug / observability surface builder isolation (`RF-04` class work)
- orchestration thinning beyond helper extraction (`RF-05+` class work)

---

## 2. Non-goals

RF-01 is **not** allowed to do any of the following.

### No logic changes

Do not change:

- thresholds
- comparison operators
- blocked reason strings
- truth output semantics
- gate ordering
- pass / retry / fail / detecting routing
- public export names
- returned object field presence / absence
- retry recommendation behavior
- UI message text
- debug payload field names or values

### No hidden logic cleanup under refactor naming

Do not:

- "simplify" boolean expressions if that changes precedence risk
- unify squat / overhead branches just because they look similar
- normalize or sort reason arrays
- change fallback order
- centralize helpers when doing so could subtly alter path-local semantics
- rename a helper and then change logic to match the new name

### No contract drift

Do not change:

- `ExerciseGateResult`
- `SquatCycleDebug`
- `CameraGuideTone`
- `ExerciseProgressionState`
- any exported type/value surface currently exposed by `auto-progression.ts`
- any consumer import path or signature

### No new runtime behavior

Do not add:

- memoization
- caching
- logging
- tracing
- new debug fields
- new fallbacks
- new flags
- new observability inputs

### Locked non-goal alignment with parent SSOT

RF-01 must not accidentally become:

- a camera quality PR
- a squat / overhead threshold PR
- a pass semantics PR
- a readiness / session contract PR
- a debug schema redesign PR

If any of those begin to happen, the work is no longer RF-01.

---

## 3. Locked truth outputs

This section defines the outputs and semantics that must remain identical before and after extraction.

### 3.1 Parent camera invariants locked for RF-01

The following parent-locked truth outputs must stay identical:

- `completionSatisfied`
- `completionPassReason`
- `completionBlockedReason`
- `finalPassEligible`
- `finalPassBlockedReason`
- `passOwner`
- `finalSuccessOwner`
- `uiProgressionAllowed`
- `uiProgressionBlockedReason`
- `passConfirmationSatisfied`
- `captureQuality`

RF-01 may only reorganize how these are derived internally. It may not change what they mean, when they appear, or what values they produce.

### 3.2 Public export lock

The following public exports are locked in both name and semantics:

- `isGatePassReady`
- `isFinalPassLatched`
- `getCameraGuideTone`
- `evaluateExerciseAutoProgress`
- any currently re-exported camera progression types/constants from this file

### 3.3 `isFinalPassLatched(...)` lock

`isFinalPassLatched(stepId, gate)` must preserve exactly:

- overhead easy-only detection semantics
- strict vs easy threshold selection semantics
- strict vs easy stable-frame requirement semantics
- non-overhead default threshold selection
- the requirement that invalid capture quality blocks final pass
- the requirement that completion truth is satisfied before final pass can open
- the requirement that pass confirmation truth is satisfied before final pass can open
- the same blocked-reason formatting behavior

No threshold, comparison operator, fallback order, or reason formatting may change.

### 3.4 `evaluateExerciseAutoProgress(...)` branch-order lock

The current branch order is locked and must remain semantically identical.

At minimum, RF-01 must preserve the existing high-level ordering:

1. derive evaluator / guardrail / confidence / threshold / completion / confirmation / reason / guidance context
2. early detecting return(s)
3. pass return when progression has passed
4. severe-fail handling, including existing squat softening behavior where applicable
5. retry return(s)
6. default detecting return

RF-01 may move repeated inline calculations into helpers, but must not change early-return precedence.

### 3.5 Returned object shape lock

Every returned result object must preserve:

- exact field names
- exact value sources
- same optional spread behavior
- same `uiMessage`
- same `retryRecommended`
- same `passConfirmationSatisfied`
- same `finalPassEligible`
- same `finalPassBlockedReason`
- same debug payload inclusion / omission timing

### 3.6 Reason / guidance lock

The following must remain semantically identical:

- common reason derivation
- failure reason derivation
- user guidance derivation
- retry message selection
- detecting message selection
- hard-blocker selection logic
- any current overhead easy/low-ROM exemptions already encoded in the file

Array contents and array order are both locked unless the current implementation already changes them conditionally.

### 3.7 Separate-logic-change boundary lock

If RF-01 changes any of the following, it is no longer a refactor PR under the parent SSOT:

- threshold
- blocked reason
- next action / progression routing meaning
- source priority
- idempotency semantics
- trace schema
- response contract
- expected smoke output

---

## 4. Files changed

### Required

- `docs/pr/PR-RF-01-AUTO-PROGRESSION-PURE-HELPER-EXTRACTION.md`
- `src/lib/camera/auto-progression.ts`

### Explicitly not required for RF-01

RF-01 should not require changes to:

- evaluator files
- guardrail files
- pose feature files
- page/UI files
- voice guidance files
- trace storage files
- public result code
- session or readiness code

### Preferred implementation shape

The preferred and safest RF-01 shape is:

- keep extraction in `auto-progression.ts`
- keep helpers private
- keep constants where they already live
- keep public exports where they already live
- avoid cross-file movement in RF-01

If implementation pressure suggests cross-file extraction, that pressure should be treated as a sign the work may belong to a later PR instead.

---

## 5. Why behavior-preserving

RF-01 is behavior-preserving because it is limited to **structural extraction of logic that is already pure in practice**.
It does not authorize semantic rewrites.

### Why this extraction qualifies as behavior-preserving

RF-01 remains within the parent SSOT because:

1. it extracts helpers only from existing inline logic
2. it does not change the public contract
3. it does not change the top-level control-flow ordering
4. it does not move truth ownership to another layer
5. it does not move debug/observability closer to runtime decision ownership
6. it keeps output truth identical on the same fixtures

### Structural benefit without semantic drift

The current file already contains separable logic domains such as:

- threshold/frame derivation
- pass confirmation derivation
- failure reason derivation
- user guidance derivation
- result-object assembly
- final blocked-reason formatting

RF-01 only makes those domains explicit as private helpers.
It does not redefine them.

### What would disqualify RF-01 from being behavior-preserving

Any of the following would invalidate this PR's label:

- changing early-return order
- altering path-local easy-only semantics by over-sharing helpers
- changing the source used for `passConfirmationSatisfied` in one branch
- changing when `squatCycleDebug` is attached
- changing string formatting of blocked reasons
- changing reason/guidance array order

---

## 6. Regression proof

RF-01 must prove exact output parity, not just compile success.

### Required proof standard

For a representative fixed input matrix, pre/post outputs must be identical for:

- `isGatePassReady`
- `isFinalPassLatched`
- `getCameraGuideTone`
- `evaluateExerciseAutoProgress`

### Minimum parity matrix

The regression proof should cover at least the following branches:

#### A. Public helper parity

- `isFinalPassLatched` on non-overhead path
- `isFinalPassLatched` on overhead strict path
- `isFinalPassLatched` on overhead easy-only path
- invalid capture quality blocked path

#### B. `evaluateExerciseAutoProgress` branch parity

- zero sampled frame -> early detecting
- incomplete early capture -> early detecting
- normal pass
- overhead easy-only pass
- severe invalid -> fail
- severe invalid + squat meaningful attempt -> softened retry path
- invalid -> retry
- low-confidence-retry -> retry
- default detecting path

#### C. Output-shape parity

- squat result with `squatCycleDebug`
- non-squat result without `squatCycleDebug`
- pass result shape
- retry result shape
- fail result shape
- detecting result shape

### Mandatory exact-equality checks

The regression compare must verify identical:

- booleans
- numbers
- strings
- arrays and array order
- nested debug payload shape
- optional field presence / absence

### Parent merge-gate alignment for camera refactor PRs

RF-01 should not merge without confirming parity for the parent-locked gates:

- `finalPassEligible`
- `finalPassBlockedReason`
- `completionPassReason`
- `completionBlockedReason`

and without preserving relevant existing camera smoke coverage already used around the gate layer.

### Manual sanity checklist

In addition to snapshot compare, manually confirm:

- same blocked-reason text
- same `uiMessage`
- same `retryRecommended`
- same `passConfirmationSatisfied`
- same squat softening behavior
- same overhead easy-only pass opening behavior

---

## 7. Residual risks

Even under a behavior-preserving plan, RF-01 still carries the following residual risks.

### Risk 1 — helper-sharing drift

Trying to centralize repeated logic can silently make two similar-but-not-identical branches behave the same.

Mitigation:
share only when the required inputs and outputs are provably identical; otherwise preserve duplication.

### Risk 2 — branch-order drift

Moving code into helpers often encourages control-flow flattening.
That can change early-return precedence without obvious code diffs.

Mitigation:
keep one visible top-level decision skeleton in `evaluateExerciseAutoProgress(...)`.

### Risk 3 — result assembly drift

Generic factories can accidentally change field sources, omit optional spreads, or normalize branch-specific payloads.

Mitigation:
use branch-specific pure assemblers if needed; do not force one generic result factory if it obscures exact parity.

### Risk 4 — array-order drift

Set-based dedupe, helper-level normalization, or convenience sorting can break exact-output parity.

Mitigation:
preserve current construction order exactly.

### Risk 5 — false confidence from green build

TypeScript/build success does not prove behavior equivalence.

Mitigation:
require exact pre/post snapshot parity on representative inputs.

---

## 8. Follow-up PRs

RF-01 is only the parent SSOT's first extraction slice.
Later structural work must stay separate.

### PR-RF-02 — squat UI gate isolation

Scope after RF-01:

- isolate squat UI progression gate computation
- keep owner truth source unchanged
- keep gate ordering unchanged
- keep blocked reason strings unchanged
- keep thresholds unchanged

### PR-RF-03 — squat final-pass blocker isolation

Scope after RF-02:

- move UI-only final-pass blockers behind a clearer file boundary
- keep completion truth untouched
- keep blocker semantics unchanged

### PR-RF-04 — debug / observability surface builder isolation

Scope after RF-03:

- isolate debug stamp/build logic
- keep debug fields unchanged
- do not make debug surface an input owner for runtime truth

### PR-RF-05 — final orchestration thinning

Scope after RF-04:

- keep `evaluateExerciseAutoProgress(...)` as a thinner orchestrator
- preserve the same branch ordering and result semantics

### Logic-change PR boundary after RF track

Only after RF-01 through later behavior-preserving slices are proven stable should any actual behavior-change PR be proposed.
Those must not be labeled as refactor PRs.

---

## 9. Merge criteria

RF-01 may merge only if all of the following are true:

- scope stayed within `auto-progression.ts`
- extraction remained private and behavior-preserving
- no contract drift occurred
- branch order remained unchanged
- locked truth outputs remained unchanged
- exact regression parity was demonstrated
- no unrelated cleanup or style churn was mixed in

If any one of these fails, RF-01 must be split further or reclassified as a logic-change PR.

---

## 10. One-line truth

`PR-RF-01` succeeds only when `src/lib/camera/auto-progression.ts` becomes structurally easier to read **while every gate truth output remains exactly the same**.
