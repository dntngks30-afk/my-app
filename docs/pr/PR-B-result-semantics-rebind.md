# PR-B — Result Semantics Rebind

> This PR follows `docs/SSOT_SHALLOW_SQUAT_PASS_TRUTH_MAP_2026_04.md` as the parent SSOT and assumes the PR-A implementation reported in this room has landed.
> PR-A froze squat product success truth at the post-owner final-pass surface. PR-B consumes that frozen truth in result severity, diagnosis summary, snapshots, and bundle summary.

---

## 1. Why this PR exists

After PR-A, squat runtime success truth is frozen at the final-pass surface.

Per the PR-A report, the implementation now does all of the following:

- defines a `SquatFinalPassTruthSurface`,
- builds it from `getSquatPostOwnerFinalPassBlockedReason(...)` plus owner-source trace,
- keeps `progressionPassed === (finalPassBlockedReason == null) === finalPassGranted`,
- exposes that truth through the real gate path,
- and makes `isFinalPassLatched('squat', gate)` read `finalPassEligible === true` when that field exists.

That means the product pass path is already frozen.

But downstream semantics are still split.
Today the repo still contains consumers that derive squat result meaning from `completionTruthPassed`, including:

- `src/lib/camera/squat-result-severity.ts`
- `src/lib/camera/trace/camera-trace-diagnosis-summary.ts`
- `src/lib/camera/camera-success-diagnostic.ts`
- `src/lib/camera/camera-trace-bundle.ts`

So the current illegal split-brain remains possible:

- product final-pass surface says success,
- but severity says `failed`,
- and interpretation says `movement_not_completed`.

PR-B exists to remove exactly that split-brain and nothing more.

---

## 2. Core diagnosis to lock

The remaining problem is not motion detection, not pass-core, and not setup/readiness.

The problem is a **consumer truth mismatch**:

- gate / latch / product flow already use final-pass truth,
- result severity and snapshot interpretation still use completion-state truth.

That is no longer allowed after PR-A.

Once a squat attempt has reached final pass, downstream semantics may still describe quality limits or warnings,
but they may not describe the attempt as “not completed.”

---

## 3. Goal

Rebind squat result semantics from completion-state truth to frozen final-pass truth.

After PR-B:

- pass/fail semantics must come from the final-pass surface only,
- quality tier / warnings / limitations may still refine *successful* outcomes,
- completion-state fields may remain visible for debug and forensics,
- but they may no longer own `passSeverity` or `resultInterpretation`.

---

## 4. Scope

### In scope

- Rebind `buildSquatResultSeveritySummary(...)` so that pass/fail meaning is driven by final-pass truth.
- Rebind all squat result-semantics consumers in the approved scope.
- Remove success→failed / success→movement_not_completed split-brain from:
  - diagnosis summary,
  - success snapshot,
  - bundle summary.
- Preserve all existing gate logic and debug sink fields.

### Out of scope

- No threshold changes.
- No pass-core logic changes.
- No `readSquatPassOwnerTruth(...)` changes.
- No `getSquatPostOwnerFinalPassBlockedReason(...)` changes.
- No `computeSquatUiProgressionLatchGate(...)` changes.
- No `completionTruthPassed` removal.
- No owner naming normalization yet.
- No regression harness / fixture expansion yet.
- No overhead reach semantic changes.
- No page, route, readiness, onboarding, or app-shell changes.

---

## 5. Locked truth for PR-B

### 5.1 Product pass/fail truth

For squat only, pass/fail semantics must now be driven by the frozen final-pass surface from PR-A.

Allowed source order for semantics consumers:

1. `gate.finalPassEligible`
2. `gate.squatCycleDebug?.squatFinalPassTruth?.finalPassGranted`
3. an explicitly named equivalent surface introduced by PR-A

Forbidden pass/fail truth sources:

- `completionTruthPassed`
- `completionPassReason`
- `completionBlockedReason`
- `cycleComplete`
- raw `currentSquatPhase`
- raw `eventCycle*`

These fields may remain visible for diagnostics, but they may not decide whether semantics say “pass” or “failed.”

### 5.2 Quality refinement truth

The following are still allowed to refine successful outcomes:

- `captureQuality`
- `qualityOnlyWarnings`
- `squatInternalQuality.qualityTier`
- `squatInternalQuality.limitations`

These fields may downgrade a successful pass from `clean_pass` to `warning_pass` or `low_quality_pass`,
but they may not turn a final-pass success into `failed`.

### 5.3 Completion-state truth remains sink-only

The following may remain in payloads:

- `completionTruthPassed`
- `completionPassReason`
- `completionBlockedReason`
- `completionOwnerPassed`
- `completionOwnerReason`
- `completionOwnerBlockedReason`

But after PR-B they are debug / compat / sink-only.
They are no longer result-semantics inputs.

---

## 6. Required design changes

### A. Rebind the severity helper

`buildSquatResultSeveritySummary(...)` must be rebound so that its pass/fail branch uses final-pass truth.

Preferred contract:

```ts
buildSquatResultSeveritySummary({
  finalPassGranted: boolean,
  captureQuality: string,
  qualityOnlyWarnings?: string[],
  qualityTier?: string | null,
  limitations?: string[],
})
```

Meaning:

- `finalPassGranted=false` → `failed` / `movement_not_completed`
- `finalPassGranted=true` + low quality signals → `low_quality_pass` / `movement_completed_but_quality_limited`
- `finalPassGranted=true` + limitations only → `warning_pass` / `movement_completed_with_warnings`
- `finalPassGranted=true` + no limiting factors → `clean_pass` / `movement_completed_clean`

A temporary compatibility alias is allowed only if necessary for a minimal-diff rollout,
but runtime consumers in this PR must all pass final-pass truth explicitly.
If a compat alias remains, final-pass truth must win whenever both are present.

### B. Rebind diagnosis summary

`src/lib/camera/trace/camera-trace-diagnosis-summary.ts` currently computes squat `passSeverity` and `resultInterpretation` from `sc.completionTruthPassed`.
That must be changed to final-pass truth from the frozen gate surface.

Allowed input examples:

- `gate.finalPassEligible === true`
- `sc.squatFinalPassTruth?.finalPassGranted === true`

Forbidden:

- `sc.completionTruthPassed === true` as the primary pass/fail input.

### C. Rebind success snapshot

`src/lib/camera/camera-success-diagnostic.ts` currently records squat success snapshot severity using `completionTruthPassed`.
That must be changed to final-pass truth.

Important rule:

A snapshot written by `recordSquatSuccessSnapshot(...)` is already a success-path artifact.
After PR-B, such a snapshot must never record:

- `passSeverity='failed'`
- `resultInterpretation='movement_not_completed'`

unless the snapshot writer itself is no longer being used on a success path.

### D. Rebind bundle summary

`src/lib/camera/camera-trace-bundle.ts` currently builds `summary.resultSeverity` from `sq.completionTruthPassed`.
That must be changed to final-pass truth from the attempt/gate surface.

The bundle must align with the diagnosis summary and success snapshot:

- same helper,
- same pass/fail source,
- same quality refinement inputs.

### E. Keep debug payloads rich, but stop conflating them with semantics

Existing diagnostic fields should remain visible where already surfaced.
PR-B should not delete useful debug payload just because it no longer owns semantics.

Examples of allowed output after PR-B:

- final-pass success + `completionTruthPassed=false`
- final-pass success + `completionBlockedReason` still visible
- final-pass success + warnings / limitations shown

The important rule is not to hide the split history.
It is to stop letting that history lie about final product outcome.

---

## 7. Files allowed

Allowed implementation files:

- `src/lib/camera/squat-result-severity.ts`
- `src/lib/camera/trace/camera-trace-diagnosis-summary.ts`
- `src/lib/camera/camera-success-diagnostic.ts`
- `src/lib/camera/camera-trace-bundle.ts`
- `docs/pr/PR-B-result-semantics-rebind.md`

Optional additional file only if needed for a narrow shared helper or type:

- `src/lib/camera/squat/squat-final-pass-truth.ts`

### Files forbidden in this PR

- `src/lib/camera/auto-progression.ts`
- any evaluator file
- any readiness/setup file
- any route/page component
- any overhead module
- any fixture/harness file outside a narrowly needed smoke update

Reason:
PR-B is a consumer rebind PR, not a gate PR.
PR-A already froze the truth surface. PR-B must consume it, not redesign it.

---

## 8. Behavior-preserving requirements

This PR must not change whether squat passes.
It changes only how already-produced outcomes are described.

### Must remain true

1. Known working shallow squat still passes.
2. Known working ultra-low-ROM real down → reversal → recovery pass still passes.
3. Deep/standard successful squat still passes.
4. Standing still still fails.
5. Sitting still still fails.
6. Sitting down only still fails.
7. Standing up only still fails.
8. Setup step-back / camera tilt / unstable bbox false pass still fails.
9. `pass_core_detected` success must still never be re-vetoed by completion-state.

### Must not change

- final-pass gate result
- blocked reason ordering
- owner source priority
- pass-core stale guard behavior
- setup/readiness veto strength
- page latch behavior

---

## 9. Illegal states after PR-B

For squat-only semantics surfaces, these become illegal:

- final-pass success and `passSeverity === 'failed'`
- final-pass success and `resultInterpretation === 'movement_not_completed'`
- success snapshot and `passSeverity === 'failed'`
- success snapshot and `resultInterpretation === 'movement_not_completed'`
- diagnosis summary says success in gate fields but failure in severity fields
- bundle summary says success in gate fields but failure in severity fields

Equivalent allowed successful outcomes are only:

- `clean_pass`
- `warning_pass`
- `low_quality_pass`

with matching `movement_completed_*` interpretations.

---

## 10. Acceptance criteria

### A. Severity helper alignment

`buildSquatResultSeveritySummary(...)` must derive pass/fail from final-pass truth, not completion-state truth.

### B. Diagnosis summary alignment

In `camera-trace-diagnosis-summary.ts`, a squat gate result with `finalPassEligible=true` must never serialize as:

- `passSeverity='failed'`
- `resultInterpretation='movement_not_completed'`

### C. Success snapshot alignment

`recordSquatSuccessSnapshot(...)` must never emit a successful snapshot whose severity says failure.

### D. Bundle summary alignment

`camera-trace-bundle.ts` must surface the same severity classification as diagnosis summary and success snapshot for the same successful attempt.

### E. Quality semantics preserved

A successful pass with low capture quality or quality warnings must still be able to produce:

- `low_quality_pass` / `movement_completed_but_quality_limited`

A successful pass with limitation-only signals must still be able to produce:

- `warning_pass` / `movement_completed_with_warnings`

### F. Failure semantics preserved

A truly blocked attempt with `finalPassEligible=false` must still serialize as:

- `failed` / `movement_not_completed`

---

## 11. Regression proof checklist

Minimum validation set:

1. **Known shallow success**
   - gate says `finalPassEligible=true`
   - diagnosis summary, success snapshot, and bundle summary all avoid `failed`

2. **Known deep/standard success**
   - same alignment holds

3. **Known blocked setup / readiness case**
   - gate says `finalPassEligible=false`
   - semantics still serialize as `failed`

4. **Known blocked non-squat-motion case**
   - standing still / sitting still / frame jump remain `failed`

5. **Low-quality successful pass**
   - final pass granted
   - semantics say `low_quality_pass`, not `failed`

6. **Warning-only successful pass**
   - final pass granted
   - semantics say `warning_pass`, not `failed`

---

## 12. Suggested smoke coverage

Recommended existing smoke/tests to keep in the loop:

- `scripts/camera-cam-squat-result-severity-01-smoke.mjs`
- `scripts/camera-cam-result-severity-surface-01-smoke.mjs`

Optional narrow new smoke only if needed:

- a PR-B-specific smoke that feeds one mocked successful gate and asserts:
  - `finalPassEligible=true`
  - diagnosis summary ≠ failed
  - success snapshot ≠ failed
  - bundle summary ≠ failed

No broad harness work in this PR.
That belongs to PR-D.

---

## 13. Residual risks intentionally left after PR-B

PR-B does not normalize owner/debug naming.
So fields such as:

- `passOwner`
- `finalSuccessOwner`
- `completionOwnerReason`
- `motionOwnerSource`

may still be visually inconsistent across debug surfaces.
That is acceptable.
It belongs to PR-C.

PR-B also does not add full illegal-state fixture locking.
That belongs to PR-D.

---

## 14. Follow-up ordering

- **PR-A**: Final Pass Truth Surface Freeze
- **PR-B**: Result Semantics Rebind
- **PR-C**: Owner Naming Normalization
- **PR-D**: Regression Harness Lock

This order remains mandatory.
PR-B is valid only because PR-A already froze the truth surface.

---

## 15. Model recommendation

This PR is more delicate than PR-A because it touches multiple consumer surfaces and helper contract alignment.

- **Preferred workflow**: Ask → Composer 2.0 for path discovery and exact consumer inventory, then **Sonnet 4.6** for final implementation
- **Composer 2.0 alone is acceptable only if** the change stays strictly inside the allowed files and does not broaden into gate-layer edits

Reason:
This PR is still bounded, but it is a cross-consumer source-of-truth rebind PR, not just a single-file contract freeze.

---

## 16. One-line lock

**After PR-A, squat semantics may still explain history with completion-state fields, but pass/fail meaning itself must come only from the frozen final-pass truth surface.**
