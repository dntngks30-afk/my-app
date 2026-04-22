# CODEX ASK — Official Shallow Owner SSOT + PR별 정밀 구현 프롬프트

이 문서는 다음 두 목적을 위해 작성되었다.

1. `dntngks30-afk/my-app` 리포의 `docs/pr/` 아래에 **부모 설계 SSOT** 문서를 생성시키는 **CODEX ASK 프롬프트**
2. 그 부모 SSOT를 기준으로 후속 구현을 분할하는 **PR-1 ~ PR-6 정밀 프롬프트**

기준 진단은 다음 두 문서에 잠긴 truth를 따른다.

- 얕은 정상 rep는 이미 `admitted / closureProof / streamBridge`까지 한 번 이상 올라오는데도 `officialShallowPathClosed=false`로 끝나거나, pass-core와 completion owner가 다른 truth를 읽어 `uiProgressionAllowed=false`, `finalPassEligible=false`가 되는 owner/closure 충돌 상태다. fileciteturn5file0 fileciteturn5file1
- 따라서 문제는 threshold가 아니라 **official shallow owner 단일화, owner freeze, standard veto 격리, false-pass guard 독립화, same-epoch provenance 고정**이다. fileciteturn5file0 fileciteturn5file1

---

## 1) CODEX ASK용 부모 SSOT 생성 프롬프트

아래 전체를 CODEX ASK에 그대로 붙여넣어라.

```md
Repository: `dntngks30-afk/my-app`

Goal:
- Create exactly one new design-only SSOT markdown file:
  - `docs/pr/PR-CAM-SQUAT-OFFICIAL-SHALLOW-OWNER-LOCK-SSOT.md`

Important:
- This is a **design room**, not an implementation room.
- Do not modify runtime code, tests, scripts, thresholds, comments, or existing docs except for creating this one new markdown file.
- Do not create multiple docs.
- Do not rename existing files.
- The output of this task is exactly one new SSOT doc under `docs/pr/`.

You must inspect and align with current repo context, especially:
- existing docs/pr naming/style
- current squat camera shallow docs
- current authority/final-pass docs
- current shallow regression/promotion docs
- any currently-landed shallow truth docs relevant to pass authority

Suggested parents to inspect first:
- `docs/SHALLOW_SQUAT_TRUTH_SSOT_2026_04_01.md`
- `docs/pr/PR-F-shallow-real-path-permanent-lock-truth-map.md`
- `docs/pr/PR-E-residual-risk-closure-truth-map.md`
- `docs/pr/PR-E1-conditional-shallow-lock-promotion-map.md`
- any current shallow/authority/freeze design docs under `docs/pr/`
- any current squat authority smoke scripts relevant to pass freeze

The new SSOT must lock the following truths.

# Core diagnosis
This is not a threshold problem.
This is not “just lower shallow criteria.”
This is an owner/closure conflict problem.

Current shallow failure families include:
1. shallow observed but not admitted strongly enough (`not_armed`, `peak_not_latched`, `baselineFrozen=false`, `peakLatched=false`)
2. shallow admitted and closure proof exists, but standard veto closes it again (`descent_span_too_short`, `ascent_recovery_span_too_short`, standard peak/reversal/standing vetoes)
3. pass-core and completion owner disagree, so UI/final latch stay closed
4. standing/seated weird pass defenses are mixed into the same bucket as shallow success gating
5. quality/robustness reasons are contaminating pass gate

# Locked product law
PASS must be easy for legitimate shallow reps.
Judgment must remain strict.
Weird false pass must remain impossible.

Depth is quality, not completion.
Shallow pass must be solved by owner semantics, not by broad threshold relaxation.

# Required truth layers
The doc must clearly separate these layers:

1. Observation truth
- shallowCandidateObserved
- attemptLikeMotionObserved
- shallow band observation
- downward commitment
- descend/reversal/recovery hints
- observation is not pass ownership

2. Admission truth
- determines whether the current epoch is an official shallow attempt
- must require: ready-after-start, intentional descent, same motion epoch, not standing-still, not seated-hold, not setup motion
- must NOT require standard peak latch, standard span, or standard standing hold as baseline shallow admission conditions

3. Closure truth
- determines whether an admitted shallow attempt completed a real rep cycle
- must be defined around descend -> reversal -> recovery existence plus recovery proof
- must not use `descent_span_too_short`, `ascent_recovery_span_too_short`, `peak_not_latched`, `no_reversal_after_peak`, `no_standing_recovery` as final shallow veto once shallow closure truth itself is proven

4. False-pass guard
- must be independent from shallow success path
- must hard-fail:
  - no descent
  - no reversal
  - no recovery
  - still seated at pass
  - seated hold
  - standing still / jitter-only
  - setup-motion-blocked
  - ready-before-start violations
  - cross-epoch stitched proof
  - synthetic/assist-only closure without raw epoch provenance

5. Final owner sink
- once `officialShallowPathClosed == true` and false-pass guard is clear:
  - `completionOwnerPassed = true`
  - `uiProgressionAllowed = true`
  - `finalPassEligible = true`
  - `finalPassLatched = true`
- after this freeze, standard vetoes may remain as diagnostics only and may not overturn shallow owner truth

# Required new locked law: same-epoch provenance
The SSOT must explicitly lock that:
- descend, reversal, recovery, upward return, seated-state-at-pass, and recovery proof must belong to the same motion epoch
- boolean export agreement alone is not sufficient
- assist/bridge/backfill may not create pass ownership without raw epoch provenance

# Required new locked law: sink-only after freeze
The SSOT must explicitly lock that after official shallow owner freeze:
- UI gate
- final pass eligibility
- final latch
must all read the same frozen owner snapshot and must not re-derive pass from secondary standard logic.

# Official shallow closure paths
The doc must define two acceptable shallow closure families:

A. Strict shallow cycle
- descend confirmed
- reversal confirmed
- recovery confirmed
- stillSeatedAtPass = false
- near-standing or meaningful standing recovery proven

B. Shallow ascent equivalent
- descend confirmed
- directional reversal confirmed
- upward return magnitude sufficient
- stillSeatedAtPass = false
- recovery proof present
- used for true low-ROM users whose rep is real but not deep

# Explicit forbidden solution classes
The SSOT must forbid:
- broad threshold lowering
- hidden fixture-only pass exceptions
- broad reopening shortcuts
- second pass owner
- UI-only owner
- mocked pass
- cross-rep laundering
- standard veto re-overturning official shallow owner after freeze

# PR split that the SSOT must define
The document must end by recommending this exact order:

1. PR-1 — Shallow Owner Authority Freeze
2. PR-2 — False Pass Guard Lock
3. PR-3 — Official Shallow Admission Promotion
4. PR-4 — Official Shallow Closure Rewrite
5. PR-5 — Quality Semantics Split
6. PR-6 — Regression Harness Lock

# Regression matrix that must be locked in the doc
Must-pass:
- `device_shallow_fail_01` ~ `device_shallow_fail_10` as primary shallow pass fixtures
- `device_deep_01`
- `device_deep_02`

Conditional / reclassification bucket:
- `device_shallow_fail_11` ~ `device_shallow_fail_13`
- keep them separate until raw same-epoch provenance confirms they are true shallow reps and not false-pass boundary cases

Must-fail:
- `device_standing_01`
- `device_standing_02`
- `device_seated_01`
- `device_seated_02`

# Required assertions to state in the doc
For primary shallow must-pass fixtures:
- `officialShallowPathAdmitted == true`
- `officialShallowPathClosed == true`
- `completionOwnerPassed == true`
- `uiProgressionAllowed == true`
- `finalPassEligible == true`
- `finalPassLatched == true`
- `stillSeatedAtPass == false`
- standard veto cannot overturn the frozen shallow owner

For must-fail fixtures:
- `finalPassEligible == false`
- `finalPassLatched == false`
- fail reason should come from false-pass guard semantics, not from shallow success semantics

For all fixtures:
- pass semantics and quality semantics remain split

# Writing rules for the new doc
- Make it read like a real `docs/pr/` parent SSOT in this repo
- Keep scope narrow and contractual
- Be explicit about non-goals
- Prefer truth-map style
- Do not include implementation patch code
- Do not modify existing files
- Create only the new markdown file

After writing the file, return:
- the exact path created
- a short summary of the locked laws
- no implementation beyond the doc creation
```

---

## 2) PR-1 — Shallow Owner Authority Freeze

아래 전체를 구현방에 그대로 붙여넣어라.

```md
Repository: `dntngks30-afk/my-app`

Parent SSOT:
- `docs/pr/PR-CAM-SQUAT-OFFICIAL-SHALLOW-OWNER-LOCK-SSOT.md`

Task:
Implement **PR-1 — Shallow Owner Authority Freeze** only.

Critical scope:
- This is an implementation PR.
- Touch only the narrow squat pass-authority chain needed to define and freeze a single official shallow owner.
- Do not implement PR-2~PR-6 in this PR.
- No broad threshold retuning.
- No new pass class.
- No broad evaluator refactor.
- No UI copy/product flow work.
- No overhead reach work.
- No unrelated cleanup.

Objective:
Introduce a single final shallow owner so that once official shallow closure is satisfied and hard-fail guard is clear, all downstream pass consumers read the same frozen truth.

You must inspect current owner/final-pass chain first, including at least:
- squat completion owner logic
- squat pass-core owner logic
- final pass eligibility path
- UI progression gate
- final latch path
- any helper that can still overturn shallow truth after owner resolution

Locked law:
After freeze, these must be sink-only readers of the same frozen owner snapshot:
- `completionOwnerPassed`
- `uiProgressionAllowed`
- `finalPassEligible`
- `finalPassLatched`

Required behavior:
- Introduce one official shallow owner truth surface
- If official shallow owner is not closed, existing standard logic may still govern
- If official shallow owner is closed and hard-fail guard is clear, downstream consumers must not re-derive pass via secondary standard veto logic
- standard veto reasons may remain as diagnostics only after freeze

Explicit prohibitions:
- Do not loosen standing/seated protections here
- Do not rewrite shallow admission here
- Do not rewrite shallow closure here
- Do not move quality semantics here
- Do not add fixture-only pass logic
- Do not add a second hidden owner

Acceptance:
- owner mismatch between pass-core / completion / UI / final latch is removed for frozen shallow-owner path
- existing deep/standard pass path remains intact
- no existing must-fail family reopens
- code diff stays narrow and authority-focused

Deliverables:
- code changes only for PR-1 scope
- brief summary of files changed
- exact explanation of the owner freeze rule you implemented
- list of validations run

If repo already has partial owner-freeze helpers, prefer narrowing and consolidating rather than inventing parallel surfaces.
```

---

## 3) PR-2 — False Pass Guard Lock

```md
Repository: `dntngks30-afk/my-app`

Parent SSOT:
- `docs/pr/PR-CAM-SQUAT-OFFICIAL-SHALLOW-OWNER-LOCK-SSOT.md`

Task:
Implement **PR-2 — False Pass Guard Lock** only.

Goal:
Separate weird false-pass prevention from shallow success gating.

Required direction:
Create or consolidate a dedicated hard-fail guard layer for shallow owner closure / finalization that independently blocks:
- no real descent
- no real reversal
- no real recovery
- still seated at pass
- seated hold without upward recovery
- standing still / jitter-only
- setup-motion-blocked
- ready-before-start success
- cross-epoch stitched proof
- assist-only closure without raw epoch provenance

Critical rule:
This PR must strengthen false-pass guard independence, not make shallow pass stricter again via standard shallow/standard span veto.

You must inspect:
- standing/seated false-pass paths
- setup/framing blocker usage
- any existing still-seated / seated-hold / jitter / standing-only filters
- whether those protections are currently coupled to shallow success gating or to standard veto logic

Explicit same-epoch requirement:
The guard must not trust exported booleans alone.
It must preserve or verify that descend/reversal/recovery/proof belong to the same motion epoch.

Prohibitions:
- no threshold broadening for shallow pass
- no closure rewrite here
- no quality split here
- no regression matrix rewrite here
- no UI/product flow changes

Acceptance:
- standing and seated families remain hard-fail
- false-pass reason path is explicit and orthogonal to shallow success closure
- guard reason is not “standard shallow veto” disguised as false-pass handling
- no shallow must-pass path is reopened by accident

Deliverables:
- narrow hard-fail guard implementation
- exact list of blocked families
- note on epoch provenance ownership
- validations run
```

---

## 4) PR-3 — Official Shallow Admission Promotion

```md
Repository: `dntngks30-afk/my-app`

Parent SSOT:
- `docs/pr/PR-CAM-SQUAT-OFFICIAL-SHALLOW-OWNER-LOCK-SSOT.md`

Task:
Implement **PR-3 — Official Shallow Admission Promotion** only.

Goal:
Promote true shallow observation into official shallow admission earlier and more reliably, without turning observation into pass.

Diagnosis to solve:
Current shallow cases are often observed but never become a robust owner-admissible attempt because admission is over-coupled to `not_armed`, `peak_not_latched`, `baselineFrozen=false`, `peakLatched=false`, or similar standard/pre-anchor constraints.

Required admission rule:
Admission should recognize a true shallow attempt when all are true:
- readiness satisfied after valid start
- same motion epoch
- intentional descent exists
- shallow band / shallow rep evidence exists
- not standing-still
- not seated-hold
- not setup-motion-blocked

Admission must NOT depend on:
- standard peak latch as a hard prerequisite
- standard frame span
- standard standing hold
- broad standard reversal streak rules

Important:
Admission is not closure.
This PR should only improve official shallow attempt recognition, not final pass criteria.

Prohibitions:
- do not make admission itself grant pass
- do not rewrite final closure here
- do not weaken false-pass guards
- do not move quality semantics here

Acceptance:
- shallow observation no longer dies too early at admission for legitimate shallow reps
- admission remains same-epoch and anti-weird-pass safe
- standing/seated/setup/jitter do not gain admission wrongly
- diff is narrow and admission-focused

Deliverables:
- code changes for admission only
- precise explanation of what changed in admission law
- exact validations run
```

---

## 5) PR-4 — Official Shallow Closure Rewrite

```md
Repository: `dntngks30-afk/my-app`

Parent SSOT:
- `docs/pr/PR-CAM-SQUAT-OFFICIAL-SHALLOW-OWNER-LOCK-SSOT.md`

Task:
Implement **PR-4 — Official Shallow Closure Rewrite** only.

Goal:
Rewrite shallow closure so legitimate shallow reps can close on rep-cycle truth rather than being re-killed by standard shallow/standard path span veto.

Required closure families:

A. Strict Shallow Cycle
- descend confirmed
- reversal confirmed
- recovery confirmed
- stillSeatedAtPass = false
- near-standing or meaningful standing recovery proven

B. Shallow Ascent Equivalent
- descend confirmed
- directional reversal confirmed
- upward return magnitude sufficient
- stillSeatedAtPass = false
- recovery proof present

Key law:
Once official shallow closure truth itself is proven, these must no longer serve as final shallow veto:
- `descent_span_too_short`
- `ascent_recovery_span_too_short`
- `peak_not_latched`
- `no_reversal_after_peak`
- `no_standing_recovery`

Those may remain diagnostic/quality signals, but not final closure killers for official shallow owner.

You must inspect:
- official shallow closure code
- standard span veto usage
- ascent/recovery timing veto usage
- peak/reversal veto reuse inside shallow path
- any bridge/backfill logic now used to fake closure

Critical restriction:
Do not make closure permissive by removing cycle truth.
Closure must still require real descend -> reversal -> recovery proof on same epoch.

Prohibitions:
- no quality split here
- no regression harness work here
- no fixture-only exception
- no broad standard/deep path retune

Acceptance:
- legitimate shallow closure can complete when cycle truth is present
- standard veto no longer overturns already-proven shallow closure
- weird false pass remains blocked by PR-2 guard
- deep/standard path behavior remains stable

Deliverables:
- narrow closure rewrite
- clear before/after explanation
- validations run
```

---

## 6) PR-5 — Quality Semantics Split

```md
Repository: `dntngks30-afk/my-app`

Parent SSOT:
- `docs/pr/PR-CAM-SQUAT-OFFICIAL-SHALLOW-OWNER-LOCK-SSOT.md`

Task:
Implement **PR-5 — Quality Semantics Split** only.

Goal:
Remove quality/robustness penalties from pass gate ownership and keep them as post-pass quality interpretation.

Symptoms to fix:
Signals like:
- `hard_partial`
- `capture_quality_low`
- `confidence_too_low`
- weak recovery
- asymmetry
- low ROM
- bottom weakness
should not by themselves overturn a legitimate shallow pass if rep cycle truth and false-pass guard are already satisfied.

Required rule:
Pass gate answers:
- was there a legitimate rep cycle?
- is weird false pass blocked?

Quality layer answers:
- how clean was the rep?
- how limited was ROM/control/symmetry/recovery/confidence?

You must inspect:
- where quality flags leak into progression gate
- where diagnostics become pass blockers
- where low-confidence / weak-recovery / hard-partial logic still overturns pass ownership

Prohibitions:
- no change to hard false-pass families
- no new leniency for no-cycle motion
- no UI wording overhaul unless strictly needed for existing semantics
- no regression harness changes here

Acceptance:
- legitimate shallow pass can survive low-quality interpretation
- weird pass cannot survive due to PR-2 guard
- quality is still recorded strictly after pass
- deep/standard path quality semantics stay coherent

Deliverables:
- narrow quality/pass separation changes
- summary of which signals moved from gate to quality
- validations run
```

---

## 7) PR-6 — Regression Harness Lock

```md
Repository: `dntngks30-afk/my-app`

Parent SSOT:
- `docs/pr/PR-CAM-SQUAT-OFFICIAL-SHALLOW-OWNER-LOCK-SSOT.md`

Task:
Implement **PR-6 — Regression Harness Lock** only.

Goal:
Lock the new shallow-owner truth with explicit fixture-based regression coverage.

Required matrix:

Primary must-pass:
- `device_shallow_fail_01` ~ `device_shallow_fail_10`
- `device_deep_01`
- `device_deep_02`

Conditional/reclassification bucket:
- `device_shallow_fail_11` ~ `device_shallow_fail_13`
- keep separated until raw same-epoch provenance verifies they are true shallow reps rather than false-pass-boundary cases

Must-fail:
- `device_standing_01`
- `device_standing_02`
- `device_seated_01`
- `device_seated_02`

Required assertions for shallow primary pass:
- `officialShallowPathAdmitted == true`
- `officialShallowPathClosed == true`
- `completionOwnerPassed == true`
- `uiProgressionAllowed == true`
- `finalPassEligible == true`
- `finalPassLatched == true`
- `stillSeatedAtPass == false`
- standard veto cannot overturn frozen shallow owner
- pass semantics / quality semantics remain split

Required assertions for must-fail:
- `finalPassEligible == false`
- `finalPassLatched == false`
- fail reason follows hard-fail guard semantics, not shallow success semantics

Required harness law:
A promoted shallow owner fixture may not silently downgrade to conditional/skip.
If the truth regresses, the harness must fail loudly.

Prohibitions:
- no runtime behavior change in this PR except minimal harness/plumbing support if absolutely necessary
- no threshold retuning here
- no broad refactor here

Acceptance:
- regression suite encodes the new owner truth map
- primary shallow 10/10 pass expectation is explicit
- standing/seated never-pass families are explicit
- conditional bucket is explicit and non-silent
- downgrade protection is explicit

Deliverables:
- scripts/tests/harness updates for the locked matrix
- summary of assertions added
- validations run
```

---

## 8) 추천 사용 순서

1. 먼저 **부모 SSOT 생성 프롬프트**를 CODEX ASK에 넣어서  
   `docs/pr/PR-CAM-SQUAT-OFFICIAL-SHALLOW-OWNER-LOCK-SSOT.md`를 생성
2. 그 다음 PR-1 ~ PR-6를 **각각 별도 방 / 별도 PR**로 수행
3. 특히 구현 순서는 반드시 아래를 유지

- PR-1 — Shallow Owner Authority Freeze
- PR-2 — False Pass Guard Lock
- PR-3 — Official Shallow Admission Promotion
- PR-4 — Official Shallow Closure Rewrite
- PR-5 — Quality Semantics Split
- PR-6 — Regression Harness Lock

이 순서를 바꾸면 shallow를 먼저 열다가 weird false pass가 다시 부활할 위험이 크다.

---

## 9) 한 줄 잠금

이번 작업의 핵심은 이것 하나다.

**“얕은 정상 rep의 존재 조건”과 “이상한 통과 금지 조건”을 같은 bucket에서 떼어내고, official shallow owner가 close된 뒤에는 그 owner를 어떤 standard veto도 다시 뒤집지 못하게 freeze하는 것.**
