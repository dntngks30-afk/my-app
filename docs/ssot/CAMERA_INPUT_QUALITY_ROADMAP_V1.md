# MOVE RE Camera Input Quality Roadmap SSOT v1

Last updated: 2026-04-28
Owner scope: Public camera funnel / camera interpretation / Deep Result V2 refinement

## 0. Purpose

This document is the single source of truth for the next camera-quality PR series after `PR-CAMERA-REFINE-CONFIDENCE-CAP-01`.

The purpose of this roadmap is to improve camera input quality and its usefulness for survey-result refinement without regressing pass/progression behavior.

MOVE RE camera principle:

> Pass easily, judge strictly.

This means:

- Pass is a progression gate.
- Quality is an interpretation signal.
- Low-quality pass is allowed.
- Low-quality pass must not look like high-confidence refined evidence.
- Camera is optional movement evidence over survey baseline.
- Camera must refine survey truth, not replace it.

---

## 1. Completed baseline: PR-CAMERA-REFINE-CONFIDENCE-CAP-01

Status: implemented and committed as `436854a`.

Commit summary:

- Added result-layer confidence cap for low-quality camera-refined Deep Result V2.
- Changed files:
  - `src/lib/deep-v2/builders/build-camera-refined-result.ts`
  - `scripts/camera-refined-confidence-cap-smoke.mjs`
- No pass/progression files were modified.

Implemented policy:

- strong evidence: no cap
- partial / moderate evidence: mild cap at `0.78`
- minimal / unusable motion-quality evidence: conservative cap at `0.62`
- legacy / invalid / missing minimal evidence keeps baseline-led behavior and no extra confidence cap

Locked result:

- `resolveRefinedEvidenceLevel()` now receives capped `refinedConfidence`, not uncapped `coreResult.confidence`.
- `refined.result.confidence` now uses capped `refinedConfidence`.
- low-quality camera pass can remain `camera_pass === true` while refined confidence is capped.
- session summary / `effective_confidence` intentionally receives capped confidence when appropriate.

PR1 smoke coverage:

- `node scripts/camera-refined-confidence-cap-smoke.mjs` passed 8/8 according to implementation report.
- `npm run test:camera-pr7-squat-completion` passed 18/18 according to implementation report.
- `npm run test:camera-pr6-bridge` passed 14/14 according to implementation report.
- `npm run test:camera-prf-proof-gate` failed due to pre-existing broader shallow/fixture gate issues, including missing Desktop fixture files and stale closure failures.

Important remaining risk:

`test:camera-prf-proof-gate` failure is not considered a blocker for PR1 because PR1 does not modify pass/progression files. However, it must not be ignored in the quality roadmap. Starting from PR2, every PR must distinguish:

1. pre-existing fixture/gate failures
2. new failures caused by the current PR
3. tests not runnable due to missing local Desktop fixtures

---

## 2. Locked product and engineering rules

### 2.1 Camera role

Survey baseline remains the canonical starting truth.
Camera provides optional movement evidence.
Camera can refine, down-weight, or support the baseline, but must not become an independent diagnosis engine.

### 2.2 Pass / quality separation

Pass/progression fields are owned by camera progression/completion logic.
Quality/refinement fields are owned by interpretation/result layers.

The following must remain separated:

- `completionSatisfied`
- `finalPassEligible`
- `progressionPassed`
- `camera_pass`
- camera evidence quality
- refinement evidence strength
- refined result confidence
- result `evidence_level`

### 2.3 Never regress these behaviors

The following must remain true across PR2~PR5:

- shallow meaningful squat remains passable
- standing-only false pass remains blocked
- seated/bottom-hold false pass remains blocked
- jitter/noise false pass remains blocked
- arm-only false pass remains blocked
- low-quality pass remains possible
- low-quality pass does not produce high-confidence refined result
- minimal camera evidence remains baseline-led
- `cameraWeight` mapping remains unchanged unless PR5 explicitly changes it with high-reasoning approval

Current locked camera weight mapping before PR5:

- strong: `0.6`
- partial: `0.4`
- minimal: `0.0`

---

## 3. Absolute do-not-touch list for PR2~PR4

Unless a PR explicitly says otherwise, do not modify:

- `src/lib/camera/auto-progression.ts`
- `src/lib/camera/squat-completion-state.ts`
- `src/lib/camera/squat-reversal-confirmation.ts`
- `src/lib/camera/squat-event-cycle.ts`
- `src/lib/camera/pose-features.ts`
- `squat-absurd-pass-registry.ts`
- pass thresholds
- completion owners
- latch gates
- `SQUAT_EASY_PASS_CONFIDENCE`
- `getPassThresholdEffective`
- `getSquatProgressionCompletionSatisfied`
- `computeSquatUiProgressionLatchGate`
- `getSquatMotionEvidenceV2BlockedReason`
- `squatPassProgressionIntegrityBlock`
- `isCameraPassCompleted()`
- `camera_pass` semantics
- DB schema
- public result contract
- auth/pay/onboarding/readiness/session-create flows
- camera UI flow

If a planned implementation needs any of these, stop and escalate to high-reasoning Ask/Plan first.

---

## 4. Roadmap overview

### PR2 — PR-CAMERA-QUALITY-OBSERVABILITY-02

Name: Camera input quality observability

Goal:
Add internal observability for why camera input quality is low, without changing pass/progression, scoring behavior, or user-facing UI.

Model:
Composer 2.0 allowed after Plan Mode.
High-reasoning model not mandatory.

Why:
This PR is additive trace work. It should not modify behavior.

Expected files:

- `src/lib/camera/camera-evidence-summary.ts`
- `src/lib/camera/normalize.ts`
- `scripts/camera-input-quality-observability-smoke.mjs`

Allowed only if needed:

- `src/lib/deep-v2/builders/build-camera-refined-result.ts` for trace pass-through only
- `src/lib/camera/squat/squat-internal-quality.ts` for read/trace only
- `src/lib/camera/overhead/overhead-internal-quality.ts` for read/trace only
- `src/lib/camera/stability.ts` for read/trace only

Candidate internal trace fields:

- `validFrameRatio`
- `keyJointVisibilityScore`
- `keyJointDropoutRate`
- `bodyBoxStabilityScore`
- `selectedWindowFrameCount`
- `selectedWindowDurationMs`
- `movementAmplitudeScore`
- `squatBottomStabilityScore`
- `squatRecoveryContinuityScore`
- `overheadStableTopSegmentScore`
- `leftRightSignalBalance`
- `signalIntegrityTier`

PR2 acceptance:

- Adds internal trace explaining why quality is low.
- Does not change pass/progression behavior.
- Does not change scoring behavior.
- Does not change user-facing UI.
- Does not change PR1 confidence cap behavior.
- New smoke proves trace exists and pass/progression fields are unchanged.

---

### PR3 — PR-CAMERA-BEST-WINDOW-QUALITY-03

Name: Best-window quality selection, interpretation-only

Goal:
Select the most analyzable motion window for quality interpretation only.

Model:
High-reasoning model required.
Recommended flow: GPT-5.5 Ask/Plan -> Sonnet 4.6 or GPT-5.5 Implement.
Composer-only implementation is not allowed.

Why:
Best-window logic touches frame quality, temporal stability, landmark reliability, and motion segmentation. If implemented incorrectly, quality can leak into pass/progression.

Expected files, to be confirmed by Plan:

- `src/lib/camera/stability.ts`
- `src/lib/camera/camera-evidence-summary.ts`
- `src/lib/camera/squat/squat-internal-quality.ts`
- `src/lib/camera/overhead/overhead-internal-quality.ts`

Read-only if needed:

- `src/lib/camera/pose-features.ts`
- `src/lib/camera/auto-progression.ts`

PR3 acceptance:

- Quality can use a selected best window.
- Pass/progression does not use the quality window as owner.
- Fallback exists when no high-quality window is available.
- Pass/progression outputs remain unchanged for known fixtures.
- Low-quality explanation improves through trace.

---

### PR4 — PR-CAMERA-QUALITY-ENRICHMENT-04

Name: Interpretation-only camera quality enrichment

Goal:
Improve squat and overhead quality interpretation signals without changing pass/progression.

Model:
Composer 2.0 allowed after Plan Mode.
High-reasoning model not mandatory unless Plan finds pass/progression dependency.

Candidate quality signals:

Squat:

- depth quality
- descent control
- bottom stability
- recovery continuity
- trunk angle control
- knee tracking
- left-right asymmetry
- landmark dropout penalty
- frame integrity penalty

Overhead:

- arm elevation quality
- stable top hold quality
- shoulder-relative range
- head-relative compensation
- lumbar extension compensation
- left-right asymmetry
- hold coherence
- frame integrity penalty

Expected files:

- `src/lib/camera/squat/squat-internal-quality.ts`
- `src/lib/camera/overhead/overhead-internal-quality.ts`
- `src/lib/camera/camera-evidence-summary.ts`
- `src/lib/camera/normalize.ts`
- `scripts/camera-interpretation-quality-enrichment-smoke.mjs`

PR4 acceptance:

- Same pass result can produce more accurate quality tier/confidence/limitations.
- Low-quality pass becomes more conservative in interpretation.
- Strong-quality pass is preserved.
- PR1 confidence cap still works.
- No pass/progression files are modified.

---

### PR5 — PR-CAMERA-SURVEY-FUSION-V2-05

Name: Camera-to-survey axis fusion v2

Goal:
Make high-quality camera evidence meaningfully refine survey baseline scoring while keeping survey baseline as the primary truth.

Model:
High-reasoning model required.
Recommended flow: GPT-5.5 Ask/Plan -> Sonnet 4.6 or GPT-5.5 Implement.
Composer-only implementation is not allowed.

Why:
This PR changes scoring semantics and can affect primary type, priority vector, confidence, session summary, and first-session planning.

Expected files:

- `src/lib/deep-v2/adapters/camera-to-evidence.ts`
- `src/lib/deep-v2/builders/build-camera-refined-result.ts`
- `src/lib/camera/camera-evidence-summary.ts`
- `src/lib/deep-result/buildSessionDeepSummaryFromPublicResult.ts`
- `src/lib/deep-scoring-core/core.ts` read-first, modify only if Plan proves necessary
- `src/lib/deep-scoring-core/types.ts` read-first, modify only if Plan proves necessary
- `scripts/camera-to-survey-axis-fusion-v2-smoke.mjs`

Axis policy:

Squat may refine:

- `lower_stability`
- `lower_mobility`
- `trunk_control`
- `asymmetry`

Overhead may refine:

- `upper_mobility`
- `trunk_control`
- `asymmetry`

Be conservative with:

- `deconditioned`
- `pain_mode`

PR5 acceptance:

- strong camera evidence can refine relevant axes.
- partial camera evidence refines weakly.
- minimal camera evidence preserves baseline-led behavior.
- no camera-only diagnosis is created.
- session summary receives coherent confidence/effective_confidence.
- first session generation does not become mismatched or overly weak.

---

## 5. Model usage policy

Default strategy:
Use Plan Mode before every PR.
Use Composer 2.0 when scope is additive, trace-only, or interpretation-only with no pass/progression dependency.
Use high-reasoning models only where semantics or temporal motion logic can regress.

| PR | Plan Mode | Implementation model | High-reasoning required |
|---|---|---|---|
| PR2 Observability | Required | Composer 2.0 allowed | No |
| PR3 Best Window | Required | GPT-5.5 or Sonnet 4.6 | Yes |
| PR4 Quality Enrichment | Required | Composer 2.0 allowed | No, unless Plan finds pass/progression dependency |
| PR5 Survey Fusion v2 | Required | GPT-5.5 or Sonnet 4.6 | Yes |

---

## 6. Required recurring verification

Every PR must report:

- changed files
- whether any pass/progression file changed
- whether `camera_pass` semantics changed
- whether `cameraWeight` mapping changed
- whether PR1 confidence cap still works
- tests run
- pre-existing failures vs new failures
- remaining risks

Recommended baseline checks:

```bash
node scripts/camera-refined-confidence-cap-smoke.mjs
npm run test:camera-pr7-squat-completion
npm run test:camera-pr6-bridge
npm run test:camera-prf-proof-gate
```

If `test:camera-prf-proof-gate` fails, report whether the failure matches known pre-existing fixture/gate failures or was introduced by the current PR.

---

## 7. Non-goals for this roadmap

The PR2~PR5 series does not aim to:

- replace survey baseline with camera
- create camera-only diagnosis
- make pass harder for better quality
- loosen false-pass guards
- redesign camera UI
- redesign result UI
- change payment/auth/onboarding/session readiness
- change DB schema
- make medical claims

---

## 8. Definition of done for the roadmap

The roadmap is complete when:

1. low-quality camera input is internally explainable
2. best analyzable motion windows can be selected for interpretation
3. squat and overhead quality signals are more informative
4. strong camera evidence meaningfully refines relevant survey axes
5. partial camera evidence refines only weakly
6. minimal camera evidence preserves baseline truth
7. pass/progression behavior remains stable
8. false-pass guard behavior remains stable
9. first-session generation remains coherent with the final result
