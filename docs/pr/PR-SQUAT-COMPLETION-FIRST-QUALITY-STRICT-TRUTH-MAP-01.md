# PR Truth Map — Squat Completion-First / Quality-Strict / Veto-Last

> Parent SSOT: `docs/SSOT_SQUAT_COMPLETION_FIRST_QUALITY_STRICT_2026_04.md`
>
> This document defines the minimum-change PR sequence that installs the new squat authority philosophy into the current repo without a broad rewrite.

---

## 1. Why this PR map exists

The repo already contains useful pieces:

- a frozen final-pass surface,
- a pass/quality split in downstream semantics,
- late blocker logic for known absurd-pass classes,
- rep-bound stale-pass guards,
- rich debug observability.

But those pieces are not aligned under one final philosophy.

So this PR map is designed to do one thing:

**Install the new philosophy into the existing structure with the smallest high-value sequence of changes.**

This is not a greenfield redesign.
It is a controlled authority correction sequence.

---

## 2. Core strategy

The fastest safe strategy is:

1. **Do not destroy the existing final-pass surface contract.**
2. **Change who is allowed to open it.**
3. **Keep quality strict and separate.**
4. **Keep absurd-pass blocking explicit and narrow.**
5. **Lock illegal states with regression coverage only after authority is corrected.**

This means we deliberately prefer:

- narrow authority rewiring,
- narrow consumer rebinding,
- narrow veto normalization,
- then harness lock.

We deliberately avoid:

- full evaluator rewrite,
- broad threshold retuning,
- pose-feature redesign,
- route/UI changes,
- non-squat scope expansion.

---

## 3. Target end state

After the sequence lands, the squat chain should read like this:

### Step 1 — Completion-owner truth
The current rep is either a completed squat rep or not.
This is the only opener.

### Step 2 — Final-pass surface
Product pass surface opens from completion-owner truth, then applies allowed absurd-pass vetoes.

### Step 3 — Quality interpretation
If passed, strict quality semantics classify the pass as:

- `clean_pass`
- `warning_pass`
- `low_quality_pass`

### Step 4 — Trace / forensics
Pass-core, bridge, shallow, event-cycle, and legacy completion fields remain visible for diagnosis only.

---

## 4. PR sequence overview

### PR-01 — Completion-First Final Pass Authority Freeze

**Priority:** P0  
**Purpose:** Stop the current recurrence class at the authority layer.

This PR is the first and mandatory PR.
Without it, later consumer or regression work is cosmetic.

#### Goal

Make squat final pass open only from completion-owner truth.

#### Locked truth

- completion-owner is the only opener,
- pass-core is demoted from opener to assist/veto/trace,
- shallow assist layers cannot directly open final pass,
- final-pass surface contract stays stable if possible.

#### Files expected in scope

- `src/lib/camera/auto-progression.ts`
- `src/lib/camera/squat-completion-state.ts`
- `src/lib/camera/evaluators/squat.ts`
- optional narrow helper file for authority adapter / contradiction invariant

#### Files intentionally out of scope

- `pose-features`
- `pass-window`
- route/page/UI files
- overhead or other movement modules
- broad threshold tuning

#### Required design rules

1. `finalPassEligible === true` only when completion-owner truth is true for the same rep.
2. `pass_core_detected` may not bypass completion-owner contradiction checks.
3. `completionTruthPassed === false` and final pass true becomes illegal.
4. same-rep ownership must remain explicit and traceable.
5. final blocker layer may only veto absurd-pass families.

#### Acceptance criteria

- the current recurrence class (`completion false / final pass true`) is impossible,
- standing/seated/setup/stale/mixed-rep classes stay blocked,
- legitimate shallow real reps are still allowed to pass when completion-owner truth is satisfied,
- final surface fields remain stable for downstream consumers.

#### Residual risk after PR-01

A few legitimate shallow misses may still remain if upstream shallow evidence formation is fragile.
That is acceptable.
The point of PR-01 is to eliminate split-brain authority, not to perfect every shallow rep immediately.

---

### PR-02 — Result Semantics Rebind to Completion-First Final Surface

**Priority:** P1  
**Purpose:** Align diagnosis, summary, and snapshot consumers to the new authority model.

#### Goal

After PR-01, all squat pass/fail semantics must be derived from the corrected final-pass surface.

#### Why this PR exists

Even after authority is corrected, downstream consumers can still lie if they continue to read sink-only completion/debug fields as pass/fail truth.

#### Files expected in scope

- `src/lib/camera/squat-result-severity.ts`
- `src/lib/camera/trace/camera-trace-diagnosis-summary.ts`
- `src/lib/camera/camera-success-diagnostic.ts`
- `src/lib/camera/camera-trace-bundle.ts`

#### Locked truth

- pass/fail meaning comes from corrected final-pass truth only,
- quality inputs may refine success but may not turn success into failure,
- legacy completion/debug fields remain sink-only.

#### Acceptance criteria

- no successful final-pass attempt serializes as `failed` / `movement_not_completed`,
- low-quality successful passes still surface as `low_quality_pass`,
- diagnosis/bundle/snapshot all agree on the same successful attempt.

---

### PR-03 — Absurd-Pass Registry Normalization

**Priority:** P1.5  
**Purpose:** Replace scattered special-case vetoes with one explicit policy surface.

#### Goal

Normalize the late blocker layer into a narrow absurd-pass registry.

#### Why this PR exists

The repo already has several ad hoc blockers for known false-pass families.
That is useful, but the role of these blockers is philosophically unclear unless normalized.

#### Files expected in scope

- `src/lib/camera/auto-progression.ts`
- optional new helper such as `src/lib/camera/squat/squat-absurd-pass-registry.ts`
- optional narrow smoke files

#### Locked truth

- registry may only block,
- registry may not grant,
- registry entries must be explicit,
- blocked reasons must stay truthful and class-specific.

#### Initial registry inventory

- standing still
- seated hold / still seated at pass
- setup-motion contaminated
- stale prior rep
- mixed-rep timing contamination
- contaminated blended early peak
- no real descent
- no real reversal / ascent equivalent
- no real recovery

#### Acceptance criteria

- registry reasons are explicit and stable,
- no registry entry acts as an opener,
- absurd-pass classes are easier to audit and test than in the scattered pre-normalized state.

---

### PR-04 — Illegal-State / Regression Harness Lock

**Priority:** P2  
**Purpose:** Stop silent reintroduction of authority split and absurd-pass reopeners.

#### Goal

Lock the new philosophy with focused fixture and smoke coverage.

#### Why this PR exists

The camera squat stack has regressed repeatedly not because no fixes landed, but because no single harness was asserting the new cross-layer illegal states together.

#### Files expected in scope

- focused smoke scripts
- fixture files where needed
- no product-logic rewrite beyond tiny test hooks if absolutely necessary

#### Illegal states to lock

1. `completionOwnerPassed !== true` and final pass true
2. `completionTruthPassed === false` and final pass true
3. final-pass success serialized downstream as failure
4. standing/seated/setup/stale/mixed-rep pass surviving to final surface
5. assist-only shallow signals reopening pass without canonical completion-owner truth

#### Acceptance criteria

- these illegal states are asserted directly,
- existing good shallow and standard/deep positive paths remain green,
- new blockers do not degrade into generic `completion_not_satisfied` lies when a more truthful reason exists.

---

## 5. Fastest practical route

If speed is the priority, the minimum meaningful route is:

- **PR-01 first**
- then **PR-04 immediately if regressions are the current operational pain**
- then PR-02 and PR-03 in whichever order best matches the active pain point

Recommended order for correctness + trust:

1. PR-01 authority freeze
2. PR-02 semantics rebind
3. PR-03 absurd-pass registry normalization
4. PR-04 regression harness lock

Recommended order for fastest recurrence shutdown when operational confidence is low:

1. PR-01 authority freeze
2. PR-04 regression lock
3. PR-02 semantics rebind
4. PR-03 registry normalization

---

## 6. What not to do during this sequence

Until the sequence above is complete, do not start with:

- depth threshold experiments,
- broad ultra-low-ROM re-opening,
- new event-cycle promotion logic,
- broad pass-core philosophy reversals,
- consumer semantics rewrites before authority is settled,
- cross-movement normalization.

Those are high-risk and likely to recreate split truth.

---

## 7. Decision table

### If the problem is:

**completion false / final pass true**  
-> PR-01

**successful attempt shown as failed downstream**  
-> PR-02

**new absurd-pass family keeps slipping through**  
-> PR-03

**same class keeps returning after every fix**  
-> PR-04

---

## 8. Final rule for future squat PRs

Any future squat PR must declare which of these four layers it touches:

1. completion-owner authority
2. final-pass surface
3. quality/semantics consumer
4. absurd-pass veto registry

A PR that crosses more than one layer must justify why that coupling is necessary.
Otherwise, split it.

---

## 9. One-line lock

**The current repo should not be redesigned all at once; it should be corrected in sequence by freezing completion-first authority, rebinding semantics, normalizing absurd-pass vetoes, and then locking the new illegal states with regression coverage.**
