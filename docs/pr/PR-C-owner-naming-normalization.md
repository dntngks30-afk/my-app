# PR-C — Owner Naming Normalization

> This PR follows `docs/SSOT_SHALLOW_SQUAT_PASS_TRUTH_MAP_2026_04.md` as the parent SSOT and assumes PR-A + PR-B have landed on `main`.
> PR-A froze squat product success truth at the post-owner final-pass surface.
> PR-B rebound result semantics to that surface.
> PR-C does **not** change pass, semantics, thresholds, or gate order.
> PR-C only normalizes **names, source reading, and cross-surface contract alignment** so the frozen truth cannot be misread or silently widened.

---

## 1. Why this PR exists

PR-A and PR-B solved the two hardest layers:

- PR-A froze squat product success truth at the final-pass surface.
- PR-B made severity/interpretation consumers read that truth instead of `completionTruthPassed`.

That is correct.

But PR-B still leaves a naming and source-alignment gap across surfaces:

- `gate.finalPassEligible`
- `squatFinalPassTruth.finalPassGranted`
- `finalPassGrantedForSemantics`
- `completionTruthPassed`
- `passOwner`
- `finalSuccessOwner`
- `cycleDecisionTruth: 'completion_state'`

These fields are now carrying related but different meanings.
Some are product truth, some are debug sink, some are legacy labels, and some are consumer-only pass-through fields.

If this naming layer stays loose, the repo can regress in two ways even without changing engine logic:

1. a new consumer reads the wrong field because the names do not clearly separate roles,
2. a consumer widens truth by OR-merging multiple fields instead of reading one authoritative source.

That second risk is already visible in PR-B style code such as:

```ts
 gate.finalPassEligible === true || squatFinalPassTruth?.finalPassGranted === true
```

That is not true source priority.
That is a truth union.
If the two fields ever diverge, that union hides an illegal mismatch instead of exposing it.

PR-C exists to remove exactly that ambiguity.

---

## 2. Review conclusion on PR-B

### 2.1 What is correct in PR-B

PR-B is directionally correct and should be treated as accepted.

It correctly does all of the following:

- makes `buildSquatResultSeveritySummary(...)` prefer `finalPassGranted` over `completionTruthPassed`,
- rebinds diagnosis summary severity to final-pass truth,
- rebinds success snapshot severity to final-pass truth,
- rebinds bundle summary severity to final-pass truth,
- keeps `completionTruthPassed` visible as debug / legacy sink,
- adds a narrow smoke guard that checks the split-brain cases.

So PR-B successfully moved pass/fail semantics away from completion-state truth. fileciteturn20file0

### 2.2 What remains structurally loose after PR-B

PR-B still leaves four residual issues that must be solved by PR-C.

#### A. OR-merge instead of authoritative read

Consumers currently compute final-pass semantics with patterns like:

- `gate.finalPassEligible === true || squatFinalPassTruth?.finalPassGranted === true`

That does not express source priority.
It silently turns disagreement into success.
PR-C must replace this with one explicit read boundary.

#### B. Consumer-only field name is awkward and leaky

`finalPassGrantedForSemantics` is technically functional, but it is not a stable SSOT name.
It sounds temporary and consumer-local.
PR-C must normalize this to one canonical sink name or typed surface.

#### C. Legacy meta label still points at completion-state

`cycleDecisionTruth: 'completion_state'` is now misleading in any surface that is also carrying final-pass semantics.
It may still be describing one historical layer, but it is no longer the reader-facing pass semantics truth.
PR-C must clarify or deprecate this label.

#### D. Type surface is still uneven across attempt/success/bundle payloads

`AttemptSnapshot` gained `finalPassGrantedForSemantics`, but `SquatSuccessSnapshot` does not yet carry the same canonical field.
PR-C must make the cross-surface naming consistent.

---

## 3. Goal

Normalize the naming and source-reading contract for squat pass semantics after PR-A + PR-B.

After PR-C:

- there is one explicit helper or typed read boundary for squat final-pass semantics,
- all consumer surfaces use the same canonical sink field names,
- debug / legacy / compat fields remain visible but are clearly marked as non-authoritative,
- illegal mismatches between final-pass fields are surfaced, not hidden,
- no gate behavior changes,
- no severity classification changes,
- no threshold changes.

---

## 4. Scope

### In scope

- Normalize sink/consumer field names for squat final-pass semantics.
- Introduce one explicit read helper for final-pass semantics source selection.
- Remove OR-union truth reads in approved consumer surfaces.
- Align attempt / diagnosis / success snapshot / bundle naming.
- Clarify or deprecate misleading meta labels that still imply completion-state is the current pass semantics owner.
- Add narrow observability for mismatch detection if multiple final-pass fields disagree.

### Out of scope

- No threshold changes.
- No `auto-progression` gate behavior changes.
- No `buildSquatResultSeveritySummary(...)` behavior changes.
- No new pass path.
- No owner priority changes.
- No removal of `completionTruthPassed`.
- No regression harness expansion beyond a narrow naming/mismatch smoke if needed.
- No overhead changes.
- No page/route/auth/app changes.

---

## 5. Locked truth for PR-C

### 5.1 Authoritative pass semantics source

After PR-A, the authoritative squat pass semantics source is the frozen final-pass surface.

That must be read through **one** boundary only.

Preferred source order:

1. `gate.finalPassEligible` when available
2. `squatFinalPassTruth.finalPassGranted` when the gate field is unavailable
3. legacy `undefined` / no-truth state

Important:

This is not an OR merge.
It is a source selection rule.

If both 1 and 2 exist and disagree, PR-C must expose a mismatch flag instead of silently returning success.

### 5.2 Legacy completion fields

These remain non-authoritative:

- `completionTruthPassed`
- `completionPassReason`
- `completionBlockedReason`
- `completionOwnerPassed`
- `completionOwnerReason`
- `completionOwnerBlockedReason`

They remain useful for forensics and historical trace.
They must not be renamed into something that looks like the current product pass truth.

### 5.3 Meta labels must reflect role clearly

Fields or labels that point at completion history must be named so they cannot be mistaken for current pass semantics truth.

That means PR-C must either:

- rename ambiguous labels, or
- keep them but mark them legacy/compat-only and add a new canonical semantics label.

---

## 6. Required design changes

### A. Introduce one read helper for final-pass semantics

Create one narrow helper, conceptually like:

```ts
interface SquatFinalPassSemanticsRead {
  finalPassGranted: boolean | undefined;
  source: 'gate_final_pass_eligible' | 'squat_final_pass_truth' | 'none';
  mismatchDetected: boolean;
}
```

Recommended function shape:

```ts
readSquatFinalPassSemanticsTruth(...)
```

Rules:

- if `gate.finalPassEligible` is boolean, use it,
- else if `squatFinalPassTruth.finalPassGranted` is boolean, use it,
- else return `undefined`,
- if both exist and differ, set `mismatchDetected=true`.

Forbidden:

- `a === true || b === true`
- any widened truth union that hides divergence.

### B. Replace `finalPassGrantedForSemantics` with a canonical sink name

`finalPassGrantedForSemantics` is too ad hoc.
PR-C must normalize it.

Preferred result:

- canonical sink name: `finalPassGranted`
- explicit source tag: `finalPassSemanticsSource`
- optional mismatch flag: `finalPassSemanticsMismatchDetected`

If backward compatibility is needed, the old field may remain temporarily as deprecated alias,
but the new canonical field must be the one consumers use.

### C. Align attempt / diagnosis / success snapshot / bundle surfaces

The same semantics fields must exist with the same names and meanings across these surfaces where applicable:

- attempt diagnosis (`AttemptSnapshot.diagnosisSummary.squatCycle`)
- success snapshot (`SquatSuccessSnapshot`)
- bundle summary (`CaptureSessionBundleSummary` or nested attempt summary)

At minimum, the following meaning set must align:

- canonical final-pass semantics value
- semantics source label
- mismatch flag (if both truth fields disagree)

### D. Clarify `cycleDecisionTruth`

`cycleDecisionTruth: 'completion_state'` is no longer acceptable as the only reader-facing label in surfaces that also carry final-pass semantics.

PR-C must do one of the following:

#### Option 1 — preferred

Keep `cycleDecisionTruth` only as a legacy/historical label and add a new canonical label such as:

- `passSemanticsTruth: 'final_pass_surface'`

#### Option 2

Rename `cycleDecisionTruth` to a clearly historical label such as:

- `completionHistoryTruth`

The preferred direction is Option 1 because it minimizes risk to existing readers.

### E. Normalize owner naming without changing owner logic

`passOwner`, `finalSuccessOwner`, and `motionOwnerSource` are related but not clearly partitioned.
PR-C must document and align their roles without changing the logic that computes them.

Required role lock:

- `motionOwnerSource` = where the frozen final-pass surface got its motion owner trace (`pass_core`, `completion_state`, `none`)
- `passOwner` / `finalSuccessOwner` = legacy lineage/debug naming, not the same as final-pass semantics source

If needed, PR-C may add a short source-role comment or a compact role label, but must not rewrite owner logic.

### F. Surface mismatch instead of hiding it

If `gate.finalPassEligible` and `squatFinalPassTruth.finalPassGranted` both exist and differ, PR-C must not silently OR them.

Allowed outputs:

- use the authoritative source,
- set `mismatchDetected=true`,
- optionally record a narrow debug note.

Forbidden output:

- auto-success because one of two disagreeing fields is `true`.

---

## 7. Files allowed

Allowed implementation files:

- `src/lib/camera/camera-trace.ts`
- `src/lib/camera/trace/camera-trace-diagnosis-summary.ts`
- `src/lib/camera/camera-success-diagnostic.ts`
- `src/lib/camera/camera-trace-bundle.ts`
- `docs/pr/PR-C-owner-naming-normalization.md`

Optional shared helper/type file only if it keeps scope narrower:

- `src/lib/camera/squat/squat-final-pass-semantics.ts`

Optional touch only if strictly required for type/export alignment and no behavior changes:

- `src/lib/camera/auto-progression.ts`

### Files forbidden in this PR

- `src/lib/camera/squat-result-severity.ts` behavior changes
- evaluator files
- readiness/setup files
- route/page files
- overhead files
- broad test harness files

Reason:
PR-C is a naming/alignment PR, not a gate PR and not a semantics-logic PR.

---

## 8. Behavior-preserving requirements

This PR must preserve all PR-A and PR-B behavior.

### Must remain true

1. known shallow success still passes,
2. known deep/standard success still passes,
3. blocked setup/readiness cases still fail,
4. standing/sitting/frame-jump false positives still fail,
5. `buildSquatResultSeveritySummary(...)` classification behavior remains unchanged,
6. successful semantics remain non-failed after PR-B,
7. completion-state fields remain visible for debug.

### Must not change

- pass rate
- blocked reason ordering
- latch behavior
- severity mapping rules
- owner priority
- stale-rep guard behavior

---

## 9. Illegal states after PR-C

These become explicit illegal states that PR-C must expose rather than hide:

- `gate.finalPassEligible !== squatFinalPassTruth.finalPassGranted` when both exist
- canonical final-pass semantics field absent while both upstream sources are present
- consumer surface still using OR-union truth instead of authoritative read
- `cycleDecisionTruth='completion_state'` presented without any canonical final-pass semantics label in the same consumer surface
- `SquatSuccessSnapshot` lacking the canonical final-pass semantics sink while attempt and bundle surfaces have it

---

## 10. Acceptance criteria

### A. Single read boundary

All PR-C consumer surfaces must read final-pass semantics through one shared helper or one identical source-selection contract.

### B. No OR-union truth read remains

There must be no remaining squat semantics read of the form:

- `gate.finalPassEligible === true || ...`
- `truthA || truthB`

for authoritative pass semantics.

### C. Canonical sink naming aligned

Attempt / diagnosis / success snapshot / bundle surfaces must use the same canonical final-pass semantics field naming.

### D. Mismatch surfaced

If both upstream final-pass fields exist and disagree, the consumer surface must record a mismatch flag rather than silently widen truth.

### E. Historical labels clarified

`cycleDecisionTruth` must either be clearly marked historical/legacy or accompanied by a canonical final-pass semantics label.

### F. No logic drift

All PR-B smoke expectations must still hold.

---

## 11. Regression proof checklist

Minimum validation set:

1. **PR-B success mismatch case**
   - `finalPassEligible=true`, `completionTruthPassed=false`
   - semantics still non-failed
   - canonical source label says gate/final-pass surface

2. **Legacy compat case**
   - older payload without new canonical sink still reads compatibly where intended
   - no crash, no forced engine change

3. **Mismatch exposure case**
   - mocked payload with `finalPassEligible=false` and `squatFinalPassTruth.finalPassGranted=true`
   - consumer does not OR them into success
   - mismatch flag is visible

4. **Bundle/attempt/snapshot alignment case**
   - same successful attempt produces same canonical final-pass semantics fields across surfaces

5. **Historical label clarity case**
   - completion-history label does not masquerade as current pass semantics truth

---

## 12. Suggested smoke coverage

Keep PR-B smokes green:

- `scripts/camera-pr-b-semantics-rebind-smoke.mjs`
- `scripts/camera-cam-squat-result-severity-01-smoke.mjs`
- `scripts/camera-cam-result-severity-surface-01-smoke.mjs`

Optional narrow new smoke for PR-C only if needed:

- mismatch detection smoke for authoritative-source selection
- cross-surface field-name alignment smoke

No broad fixture expansion yet.
That still belongs to PR-D.

---

## 13. Residual risks intentionally left for PR-D

PR-C does not build the broad regression harness.
It only normalizes names and source-reading.

After PR-C, remaining work for PR-D is still:

- automated illegal-state fixture locking,
- real-device regression matrix,
- must-pass / must-block scenario freeze,
- mismatch-state permanent guardrails.

---

## 14. Follow-up ordering

- **PR-A**: Final Pass Truth Surface Freeze
- **PR-B**: Result Semantics Rebind
- **PR-C**: Owner Naming Normalization
- **PR-D**: Regression Harness Lock

This order remains mandatory.
PR-C may clarify names and source reading, but it must not reopen PR-A or PR-B meaning.

---

## 15. Model recommendation

This PR is mostly a contract and naming normalization task across a small set of consumer files.

- **Recommended**: Composer 2.0
- **Use Ask → Composer 2.0 → Sonnet 4.6 only if** the implementation starts broadening into shared helper extraction plus compat cleanup across multiple payload types

Reason:
PR-C is narrower and less semantically risky than PR-B, as long as it stays out of gate logic.

---

## 16. One-line lock

**PR-C does not change squat truth; it makes the frozen final-pass truth impossible to misread by giving it one canonical name, one canonical read path, and explicit mismatch visibility across all consumer surfaces.**
