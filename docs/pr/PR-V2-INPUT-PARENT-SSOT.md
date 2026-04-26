# PR-V2-INPUT Parent SSOT — Squat V2 Input Signal Ownership

Created: 2026-04-27
Status: parent SSOT for four sequential input-signal PRs
Scope: public camera squat V2 input layer only

---

## 0. Why this parent SSOT exists

The current squat camera problem must not be solved by relaxing pass conditions again.
The repo direction is already correct: Squat V2 usable motion evidence is the runtime owner, while legacy completion/pass-core/finalPassEligible paths are trace/shadow only.

The remaining bottleneck is the quality and ownership of the input signal sent into V2.

This PR series therefore has one narrow thesis:

> Do not change what counts as a valid squat. Change only the quality, source, and observability of the signal that V2 evaluates.

---

## 1. Canonical ownership rules

### Runtime owner

`SquatMotionEvidenceV2.usableMotionEvidence` remains the runtime pass/progression owner.

### Legacy role

Legacy completion, pass-core, official shallow path, UI latch, and finalPassEligible are allowed only as diagnostics/shadow references.
They must not regain pass ownership.

### Input owner target

The final target is:

```txt
PoseFeaturesFrame[]
  -> squat-v2-input-owner.ts
  -> selected depth / lowerBodySignal / upperBodySignal / source diagnostics
  -> SquatMotionEvidenceFrameV2[]
  -> evaluateSquatMotionEvidenceV2()
```

Not this:

```txt
PoseFeaturesFrame[]
  -> ad hoc blended/proxy/raw depth choice inside evaluator
  -> hidden V2 input behavior
```

---

## 2. Absolute non-goals

These are forbidden across the whole PR-V2-INPUT series:

- Do not relax `MEANINGFUL_DESCENT_MIN`.
- Do not relax `RETURN_TOLERANCE_MIN` or return guards.
- Do not relax reversal requirements.
- Do not relax temporal closure, stale closure, same-frame, or tail freshness guards.
- Do not increase/decrease `MAX_SQUAT_CYCLE_MS`.
- Do not restore legacy completion owner.
- Do not restore finalPassEligible fallback ownership.
- Do not restore official shallow path owner.
- Do not change auto-progression authority.
- Do not change UI flow, route flow, result flow, payment/auth/onboarding/session generation, or `/app` execution core.
- Do not add a broad new state machine in PR 1 or PR 2.
- Do not run broad test suites unless explicitly requested.
- Do not read large unrelated files.

---

## 3. Four PR sequence

The PRs must run in this order.

### PR-V2-INPUT-01 — Squat V2 Raw Landmark Depth Owner

Goal: create a narrow input owner helper that chooses a better depth source before V2 evaluation.

Allowed behavior change:

- V2 can receive a better depth/lowerBodySignal curve.
- Existing V2 pass logic remains unchanged.

Primary output:

- new helper: `src/lib/camera/squat/squat-v2-input-owner.ts`
- evaluator integration in `src/lib/camera/evaluators/squat.ts`
- diagnostic-only metric type additions in `src/lib/camera/squat/squat-motion-evidence-v2.types.ts`

### PR-V2-INPUT-02 — Lower Body Dominance Lock

Goal: after better input is available, strengthen lower-body dominance diagnostics/blocking so arm-only, upper-body-only, standing small movement, and setup translation do not regain false pass paths.

Allowed behavior change:

- better blocker labels and stricter lower-body/upper-body separation.
- no pass threshold relaxation.

### PR-V2-INPUT-03 — V2 Attempt State Machine

Goal: expose a minimal traceable attempt state on top of existing V2 findings.

State machine is explanation/consistency only, not a new opener.

Allowed state labels:

```txt
idle -> baseline_ready -> descent_committed -> peak_latched -> reversal_confirmed -> return_confirmed -> stable_recovery -> pass
```

Do not replace `evaluateSquatMotionEvidenceV2` pass logic.

### PR-V2-INPUT-04 — Minimal Observability Surface

Goal: make real-device JSON diagnosis fast.

Expose compact fields:

- selected depth source
- depth curve usable/unusable
- finite-but-useless rejection
- lower-body dominance
- attempt state
- blocked reason
- relative peak
- rom band
- peak distance from tail
- reversal/return/stable indices
- epoch source and rolling fallback usage

Operator summary target:

```txt
V2 input: hip_center | curve usable | shallow | blocked=no_reversal | peak_tail=2f
```

---

## 4. Composer operating contract

Every child PR prompt must force this workflow.

### Phase 1 — PLAN mode only

Composer must start in PLAN mode.
It must not edit files yet.
It must read only:

1. this parent SSOT
2. the exact child PR file list
3. package/test scripts only if the prompt explicitly allows it

Composer must return:

- current repo facts it found
- exact files it will modify
- exact files it will not touch
- pass/fail authority that remains unchanged
- risk notes

### Phase 2 — Implement only after the plan

Composer may implement only after the user approves the plan or when the prompt explicitly says to proceed after printing the plan.

### Phase 3 — Narrow verification

Composer must run only narrow checks relevant to touched files.
If an existing global check is already known to fail for unrelated reasons, report that instead of burning tokens on broad debugging.

### Stop conditions

Composer must stop and report instead of editing if:

- the required files do not exist
- the current repo already contradicts this SSOT
- implementing the PR requires touching forbidden files
- implementing the PR requires changing V2 pass thresholds/guards
- implementing the PR requires restoring legacy pass authority

---

## 5. Common read/write boundaries

### Files generally allowed to read

- `docs/pr/PR-V2-INPUT-PARENT-SSOT.md`
- `src/lib/camera/evaluators/squat.ts`
- `src/lib/camera/squat/squat-motion-evidence-v2.ts`
- `src/lib/camera/squat/squat-motion-evidence-v2.types.ts`
- `src/lib/camera/pose-features.ts`
- `src/lib/camera/camera-trace.ts` only for PR 4
- `src/lib/camera/trace/camera-trace-diagnosis-summary.ts` only for PR 4

### Files generally forbidden unless the child prompt explicitly allows them

- `src/lib/camera/auto-progression.ts`
- public result files
- auth/payment/onboarding/session generation files
- `/app` execution UI files
- camera page UI files
- session map/session panel/player files
- legacy completion owner files, except read-only inspection if explicitly requested

---

## 6. PR-V2-INPUT-01 child SSOT summary

### Purpose

Create `squat-v2-input-owner.ts` as the first explicit owner of V2 squat input depth selection.

### Allowed implementation shape

The helper should analyze the active V2 evaluation frames and return:

```ts
type SquatV2OwnedDepthSource =
  | 'hip_center_baseline'
  | 'pelvis_proxy'
  | 'knee_flex_proxy'
  | 'legacy_primary'
  | 'legacy_raw'
  | 'none';
```

It should produce at least:

- selected depth series
- selected lower-body signal series
- selected source
- per-source curve usability diagnostics
- `depthCurveUsable`
- `finiteButUselessDepthRejected`

### Source priority

1. raw hip center / pelvis displacement when visible and curve-usable
2. pelvis proxy when hip center is insufficient
3. knee-flex or hip/knee/ankle geometry proxy when usable
4. legacy primary depth proxy fallback
5. legacy raw depth proxy fallback
6. none / zero fallback only when all sources are unusable

### Curve usability principle

A finite series is not automatically usable.
Reject finite-but-useless series when it is:

- collapsed near zero
- only a tail spike
- too sparse to show a continuous descent curve
- lacking enough post-peak structure for V2 to evaluate reversal/return

### Required PR-1 success markers

- shallow squat depth is no longer locked to legacy blended/proxy-only behavior when raw landmark depth is usable
- `selectedDepthSource`/equivalent metric is visible in V2 metrics
- `depthCurveUsable`/equivalent metric is visible
- finite-but-useless rejection is visible
- standing small movement still does not pass
- arm-only still does not pass
- setup/framing translation does not pass

---

## 7. Global real-device validation contract

After each PR, real-device validation is more important than smoke-only success.

Minimum PR-1 real-device check:

- shallow squat: 3 tries, at least 2 should naturally pass or clearly get closer with usable curve diagnostics
- deep squat: 1 natural pass remains possible
- standing small movement: must fail
- descent-start-only: must fail
- seated/bottom hold: must fail
- arm-only: must fail

If shallow still fails, the trace must show why within V2 input diagnostics.

**실기기 최종 수락 요약(2026-04-27):** [PR-V2-INPUT-ACCEPTANCE-2026-04-27.md](./PR-V2-INPUT-ACCEPTANCE-2026-04-27.md)

---

## 8. Model guidance

Composer is acceptable for PR 1, PR 2, and PR 4 because the intended edits are narrow.

PR 3 is riskier because it can accidentally become pass authority. If Composer is used for PR 3, the prompt must be stricter than PR 1/2 and must keep state as trace/explanation only.

---

## 9. One-line lock

This series is not a squat pass relaxation series.
It is a V2 input ownership and observability series.
