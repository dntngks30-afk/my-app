# PR-SQUAT-MOTION-EVIDENCE-V2 — Design Room Memory

> 설계방 전용 기억문서.  
> 이 문서는 구현 지시서가 아니라, PR1~PR7을 진행할 때 반복 참조할 구조·권한·순서·금지사항 메모다.  
> 런타임 코드를 직접 수정하지 않는다.

---

## 0. Purpose

MOVE RE public camera squat flow has been stuck in a repeated PR loop:

- valid shallow squat does not pass
- valid deep squat only passes after staying near bottom and rising very slowly/repeatedly
- earlier attempts fixed one blocker but reopened another
- pass authority became spread across pass-core, completion-state, auto-progression, final blockers, latch/page, trace/debug

The design decision is now:

```txt
Do not patch the old squat pass engine again.
Introduce a new simple motion-evidence owner.
Demote the old large engine into quality analysis / debug / data.
```

This memory doc exists so every future design/implementation prompt stays aligned.

---

## 1. Product Reframe

The public camera squat step is not a precision squat judge.

It is a usable motion evidence channel.

### Old mental model to avoid

```txt
Camera decides whether the user performed a technically correct squat rep.
```

### New locked model

```txt
Camera checks whether there is usable lower-body flexion/extension motion evidence.
```

Pass means:

```txt
usable motion evidence acquired
```

Pass does not mean:

```txt
perfect squat form
medical-grade movement assessment
precise rep scoring
```

---

## 2. Core Ownership Law

### Runtime owner

```txt
SquatMotionEvidenceEngineV2
```

This engine owns squat camera progression.

### Runtime progression field

```txt
usableMotionEvidence: boolean
```

### Consumers only

- auto-progression
- page latch/navigation
- trace/debug
- old squat engine
- guardrails
- quality analyzer
- analytics/data collection

### Hard law

```txt
No downstream layer may turn usableMotionEvidence=true into false.
No downstream layer may turn usableMotionEvidence=false into true.
```

---

## 3. Legacy Engine Reframe

The existing large squat system must not be thrown away blindly.
It contains useful signals.

But it must lose pass authority.

### New role

```txt
LegacySquatQualityAnalyzer
```

### Allowed uses

- ROM interpretation
- low-ROM warning
- signal quality
- recovery timing interpretation
- asymmetry/instability clues if available
- debug panel
- trace summary
- analytics/data collection
- future model tuning

### Forbidden uses

- deciding progression
- blocking V2 pass
- overriding V2 fail
- acting as final blocker
- acting as latch owner
- converting quality warning into pass denial

### Mental model

```txt
old engine: judge -> commentator
old engine: owner -> analyzer
old engine: blocker -> warning
```

---

## 4. Current Real-Device Truth

As of this design memory:

```txt
standing false pass: currently not happening
seated false pass: currently not happening
valid shallow squat: does not pass
valid deep squat: only passes after staying near bottom and slowly/repeatedly rising
```

Therefore current priority is not more false-pass hardening.

Current priority:

```txt
make normal shallow/deep usable motion pass naturally
without reopening standing/seated false pass
```

---

## 5. Golden Trace Principle

Golden trace does not mean overfitting to one user.

It means:

```txt
A clearly valid real-device case must not be failed.
A clearly invalid real-device case must not pass.
```

Initial minimal golden set:

```txt
valid_shallow_must_pass_01
valid_deep_must_pass_01
standing_must_fail_01
seated_must_fail_01
```

These are not universal thresholds.
They are regression contracts.

Correct use:

```txt
This real shallow squat completed down -> up -> return. V2 must find usable evidence.
```

Incorrect use:

```txt
This trace has relativePeak=0.08, so hardcode threshold around 0.08.
```

Golden traces expand later through dogfooding.

---

## 6. PR Roadmap Overview

```txt
PR1: SSOT update — reframe SquatRepEngineV2 as SquatMotionEvidenceEngineV2
PR2: Golden Trace Harness — lock real-device pass/fail contracts
PR3: V2 engine in parallel — no runtime wiring
PR4: Shadow Compare — compare legacy vs V2 on golden traces
PR5: Runtime Owner Swap — V2 becomes squat progression owner
PR6: Legacy Quality Analyzer — demote old engine into analysis/debug/data
PR7: Data Collection + Observability Lock — persist derived metrics and lock sink-only traces
```

---

## 7. PR1 — SSOT Update

### Goal

Update the parent SSOT language from strict squat rep judging to usable motion evidence acquisition.

### Target doc

```txt
docs/pr/PR-SQUAT-ENGINE-V2-RESET-SSOT.md
```

### Required conceptual changes

- `SquatRepEngineV2` -> `SquatMotionEvidenceEngineV2`
- `passed` -> `usableMotionEvidence`
- pass meaning -> usable lower-body motion evidence
- legacy squat logic -> `LegacySquatQualityAnalyzer`
- quality warnings must not block progression
- auto-progression/page/debug/trace are consumers only

### Do not touch

- runtime code
- tests
- thresholds
- camera behavior
- auto-progression
- page

### Acceptance

SSOT includes the law:

```txt
SquatMotionEvidenceEngineV2 is the only runtime owner for squat camera progression.
Legacy squat logic may analyze quality, but must not decide progression.
```

---

## 8. PR2 — Golden Trace Harness

### Goal

Create a small fixture-based contract around real-device traces.

### Add files

```txt
fixtures/camera/squat/golden/manifest.json
fixtures/camera/squat/golden/README.md
scripts/camera-squat-v2-00-golden-trace-harness.mjs
docs/pr/PR-SQUAT-V2-00-GOLDEN-TRACE-HARNESS.md
```

### Initial fixture classes

```txt
valid_shallow_must_pass_01
valid_deep_must_pass_01
standing_must_fail_01
seated_must_fail_01
```

### Harness modes

```bash
npx tsx scripts/camera-squat-v2-00-golden-trace-harness.mjs --report
npx tsx scripts/camera-squat-v2-00-golden-trace-harness.mjs --strict
```

### Report mode

- reports missing fixtures
- reports current mismatch
- does not necessarily fail current-main issues

### Strict mode

- fails on missing required fixtures
- fails on expectation mismatch
- becomes required after V2 starts working

### Do not touch

- V2 engine
- runtime camera logic
- pass-core
- completion-state
- auto-progression
- page
- thresholds

### Acceptance

- manifest is readable
- missing fixture output is clear
- pass/fail expectation check exists
- report/strict modes exist

---

## 9. PR3 — V2 Engine in Parallel

### Goal

Create `SquatMotionEvidenceEngineV2` without runtime wiring.

### Add files

```txt
src/lib/camera/squat/squat-motion-evidence-v2.types.ts
src/lib/camera/squat/squat-motion-evidence-v2.ts
scripts/camera-squat-v2-01-motion-evidence-engine-smoke.mjs
docs/pr/PR-SQUAT-V2-01-MOTION-EVIDENCE-ENGINE.md
```

### Decision shape

```ts
export type SquatMotionPatternV2 =
  | 'none'
  | 'standing_only'
  | 'descent_only'
  | 'bottom_hold'
  | 'down_up_return';

export type SquatMotionRomBandV2 =
  | 'micro'
  | 'shallow'
  | 'standard'
  | 'deep';

export interface SquatMotionEvidenceDecisionV2 {
  usableMotionEvidence: boolean;
  motionPattern: SquatMotionPatternV2;
  romBand: SquatMotionRomBandV2;
  blockReason: string | null;
  qualityWarnings: string[];
  evidence: {
    descent: boolean;
    reversal: boolean;
    nearStandingReturn: boolean;
    stableAfterReturn: boolean;
    sameRepOwnership: boolean;
  };
  metrics: {
    relativePeak?: number;
    descentMs?: number;
    ascentMs?: number;
    returnMs?: number;
    estimatedFps?: number;
  };
}
```

### Simple pass contract

Pass means:

```txt
body visible enough
+ descent
+ reversal/upward motion
+ near-standing return
+ not micro bounce
+ not standing-only
+ not seated/bottom-hold-only
```

### Expected examples

Valid shallow:

```json
{
  "usableMotionEvidence": true,
  "motionPattern": "down_up_return",
  "romBand": "shallow",
  "qualityWarnings": ["low_rom"]
}
```

Standing:

```json
{
  "usableMotionEvidence": false,
  "motionPattern": "standing_only",
  "blockReason": "no_descent"
}
```

### Do not touch

- runtime wiring
- auto-progression
- page
- pass-core
- completion-state
- final blockers
- legacy deletion

### Acceptance

Synthetic smoke covers at least:

```txt
standing only -> fail
seated/bottom hold -> fail
valid shallow down-up-return -> pass
valid deep down-up-return -> pass
```

---

## 10. PR4 — Shadow Compare

### Goal

Run V2 against golden traces without changing runtime behavior.

### Add files

```txt
scripts/camera-squat-v2-01b-shadow-compare.mjs
docs/pr/PR-SQUAT-V2-01B-SHADOW-COMPARE.md
```

### Output table

```txt
fixture                       expected    legacy    v2    status
valid_shallow_must_pass_01     pass        fail      pass  PASS
valid_deep_must_pass_01        pass        late/fail pass  PASS
standing_must_fail_01          fail        fail      fail  PASS
seated_must_fail_01            fail        fail      fail  PASS
```

### Purpose

- prove V2 fixes the current valid shallow/deep bottleneck
- prove V2 does not reopen standing/seated false pass
- prove V2 does not depend on legacy blockers

### Do not touch

- runtime behavior
- auto-progression
- page
- legacy deletion

### Acceptance

Strict V2 shadow compare passes against available golden fixtures.

---

## 11. PR5 — Runtime Owner Swap

### Goal

Make V2 the actual runtime owner for squat camera progression.

### Likely targets

```txt
src/lib/camera/evaluators/squat.ts
src/lib/camera/auto-progression.ts
related types
docs/pr/PR-SQUAT-V2-02-RUNTIME-OWNER-SWAP.md
```

### Required changes

- evaluator computes `SquatMotionEvidenceDecisionV2`
- evaluator exposes it as debug/decision field, e.g. `debug.squatMotionEvidenceV2`
- auto-progression squat branch consumes `decision.usableMotionEvidence`
- legacy pass-core/completion-state remain debug/compat only
- final blocker cannot flip V2 pass
- page latch cannot re-evaluate squat motion completion

### Forbidden

- new final blockers
- shallow promotion patches
- threshold tuning to force pass
- page rewrite
- overhead reach changes
- authenticated /app execution changes

### Acceptance

Commands:

```bash
npx tsx scripts/camera-squat-v2-00-golden-trace-harness.mjs --strict
npx tsx scripts/camera-squat-v2-01b-shadow-compare.mjs --strict
```

Real device:

```txt
valid shallow squat -> passes naturally
valid deep squat -> passes without long bottom hold / repeated slow rise
standing -> no pass
seated -> no pass
```

---

## 12. PR6 — Legacy Quality Analyzer Demotion

### Goal

Demote the old large squat engine into quality/debug/data analysis.

### Likely targets

```txt
src/lib/camera/squat-completion-state.ts
src/lib/camera/squat/squat-completion-core.ts
src/lib/camera/trace/camera-trace-diagnosis-summary.ts
src/lib/camera/camera-trace.ts
src/lib/camera/auto-progression.ts
docs/pr/PR-SQUAT-V2-03-LEGACY-QUALITY-ANALYZER.md
```

### Allowed legacy output

```json
{
  "legacyQuality": {
    "evidenceLabel": "low_rom",
    "relativeDepthPeak": 0.08,
    "recoveryQuality": "slow_return",
    "signalQuality": "medium",
    "legacyCompletionBlockedReason": "not_standing_recovered"
  }
}
```

### Required demotions

These must not own progression:

```txt
completionSatisfied
completionBlockedReason
official_shallow_cycle
low_rom_cycle
ultra_low_rom_cycle
standard_cycle
evidenceLabel
retry tags
quality/confidence labels
```

### Acceptance

- V2 remains sole runtime owner
- legacy outputs appear only as debug/quality/trace/compat
- grep/search proof is included in PR report
- golden harness strict passes
- shadow compare strict passes

---

## 13. PR7 — Data Collection + Observability Lock

### Goal

Persist useful derived motion metrics and lock trace/debug as sink-only.

### Collect derived metrics only

Recommended event shape:

```ts
type CameraMotionAttemptEvent = {
  motionType: 'squat';
  engineVersion: 'squat_motion_evidence_v2';
  usableMotionEvidence: boolean;
  motionPattern: string;
  romBand: string;
  blockReason: string | null;
  qualityWarnings: string[];
  metrics: {
    relativePeak?: number;
    descentMs?: number;
    ascentMs?: number;
    returnMs?: number;
    estimatedFps?: number;
  };
  legacyQuality?: {
    evidenceLabel?: string;
    recoveryQuality?: string;
    signalQuality?: string;
  };
  device?: {
    platform?: string;
    viewportWidth?: number;
    viewportHeight?: number;
  };
};
```

### Avoid storing

```txt
raw video
face/PII-heavy data
full raw landmark stream by default
large frame dumps
```

### Required observability separation

Trace/debug must clearly separate:

```txt
V2 runtime owner decision
legacy quality analyzer output
page/navigation state
analytics event output
```

### Forbidden

- trace/debug/data influencing pass
- V2 pass logic changes
- auto-progression owner changes
- final blockers
- page navigation changes
- overhead reach changes

### Acceptance

- derived motion event can be inspected
- no raw video storage
- no full raw landmark stream by default
- V2 remains sole owner
- golden harness strict passes

---

## 14. Model Allocation

### Composer 2.0 is enough

```txt
PR1 SSOT update
PR2 Golden Trace Harness
PR4 Shadow Compare, if scoped to scripts only
```

### GPT-5.5 recommended / required

```txt
PR3 V2 engine design
PR5 runtime owner swap
PR6 legacy authority demotion
PR7 if DB/schema/analytics path is involved
```

Rule:

```txt
Ask/Composer = read-only structure discovery and script/doc work
GPT-5.5 = risky runtime ownership changes
```

---

## 15. Implementation Prompt Pattern

Every implementation prompt must include:

```txt
Read required docs first.
State exact scope.
State exact do-not-touch list.
State acceptance commands.
State authority impact.
Report changed files.
Report whether any pass owner was added, removed, or demoted.
```

Every PR report must answer:

```txt
Which authority did this PR create, remove, demote, or preserve?
Can any downstream layer still flip V2 usableMotionEvidence?
Did this PR add any final blocker or shallow patch? If yes, reject.
```

---

## 16. Review Checklist

### Reject the PR if it does any of these

```txt
adds another shallow promotion patch
adds another final blocker for squat
uses legacy completionBlockedReason to block V2 pass
uses quality warning to deny progression
lets page latch re-evaluate squat completion
lets trace/debug feed back into runtime pass
runs V1 and V2 heavy paths permanently after migration
changes overhead reach or /app execution surfaces
```

### Approve only if

```txt
scope is narrow
owner boundaries are clearer after the PR
V2 remains simple
golden/shadow scripts pass when applicable
legacy code loses authority instead of gaining another wrapper
```

---

## 17. Final Memory

The goal is not to make the old engine pass shallow squat.

The goal is:

```txt
Replace old pass ownership with a simple motion evidence owner.
Keep old engine as analyzer/data asset.
Prevent every other layer from owning progression.
```

If a future PR does not reduce or clarify pass authority, it is probably part of the old failure loop.
