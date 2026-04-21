# Implementation Prompt — PR-SHALLOW-SAME-REP-ADMISSION-CLOSE-RECOVERY-01

Use GPT-5.4 or an equivalently strong reasoning model.

You are implementing a **narrow squat-only recovery PR**.

Read these files first and treat them as binding, in this order:

1. `docs/SSOT_SQUAT_COMPLETION_FIRST_QUALITY_STRICT_2026_04.md`
2. `docs/pr/PR-SQUAT-COMPLETION-FIRST-QUALITY-STRICT-TRUTH-MAP-01.md`
3. `docs/pr/PR-01-SQUAT-COMPLETION-FIRST-AUTHORITY-FREEZE.md`
4. `docs/pr/P1-SQUAT-LEGITIMATE-SHALLOW-EVIDENCE-RECOVERY.md`
5. `docs/pr/PR-CAM-SQUAT-AUTHORITY-LAW-RESOLUTION.md`
6. `docs/pr/P3-SQUAT-ABSURD-PASS-REGISTRY-NORMALIZATION.md`
7. `docs/pr/P2-SQUAT-AUTHORITY-NAMING-COMMENT-CLEANUP.md`
8. `docs/pr/PR-SHALLOW-SAME-REP-ADMISSION-CLOSE-RECOVERY-01.md`

Then inspect the real current repo paths before editing.

---

## Mission

Recover **legitimate shallow squat** on real-device truth by restoring:

- same-rep official shallow admission, and
- same-rep official shallow close,

while keeping all previously blocked weird-pass families locked.

This PR is successful only if:

- meaningful shallow squat passes reliably;
- weird passes do not reopen;
- opener law remains unchanged;
- P3 block-only registry remains unchanged in meaning;
- deep standard path remains unchanged.

---

## Non-negotiable law

The canonical final-pass opener remains:

```text
completionTruthPassed
AND completionOwnerPassed
AND completionOwnerReason !== 'not_confirmed'
AND completionBlockedReason == null
AND cycleComplete
AND UI / progression gate clear
AND block-only vetoes clear
=> finalPassEligible / finalPassGranted / finalPassLatched may be true
```

You may not weaken, bypass, or re-derive that law.

Additional locked truths:

- pass-core remains non-opener assist / veto / trace only;
- absurd-pass registry remains block-only;
- quality interpretation remains separate from pass/fail truth;
- `pass_core_detected` remains a closed legacy label, never an active opener;
- weird-pass families must stay blocked.

---

## Required diagnosis boundary

Current real-device truth says the remaining shallow failure is narrow:

### Residual A — admission failure
Some shallow reps still die too early with:
- `not_armed`
- `freeze_or_latch_missing`
- `baselineFrozen = false`
- `peakLatched = false`

while the same rep already shows shallow-band depth and attempt-like motion.

### Residual B — close failure
Some shallow reps already reach:
- admitted official shallow path,
- reversal satisfied,
- ascent-equivalent satisfied,
- closure-proof satisfied,

but still die with:
- `descent_span_too_short`
- or `ascent_recovery_span_too_short`
- and therefore never reach `completionTruthPassed = true`.

The PR must fix only these same-rep shallow residuals.

---

## Allowed scope

Primary expected files:
- `src/lib/camera/squat-completion-state.ts`
- `src/lib/camera/evaluators/squat.ts` pass-through only if required

Optional narrow helper scope:
- a small helper file or helper extraction directly supporting shallow admission / shallow close in completion-state ownership

Testing / proof scope:
- a new focused shallow recovery smoke
- proof-gate addition for that smoke

---

## Forbidden scope

Do **not** do any of the following:

1. no authority-law rewiring
2. no final-pass surface redesign
3. no `auto-progression.ts` opener-law rewrite
4. no P3 registry logic change
5. no registry broadening into a grant path
6. no pass-core shortcut reopening
7. no UI latch redesign
8. no deep / standard path retune
9. no generic threshold sweeps across all squat paths
10. no non-squat changes
11. no setup/readiness redesign beyond narrow same-rep shallow contract needs
12. no conditional skip broadening in proof gate

If any proposed fix would reopen weird-pass risk, reject that fix.

---

## Implementation direction

### Part A — narrow same-rep shallow admission recovery

Inside `squat-completion-state.ts`, recover official shallow admission for real-device shallow reps that currently die as:
- `not_armed`
- `freeze_or_latch_missing`

but only when same-rep shallow evidence is already sufficiently strong.

Allowed idea:
- official shallow admission may recover when the same rep already proves:
  - readiness stable;
  - attempt starts after ready;
  - no setup contamination;
  - shallow-band or ultra-low-ROM depth truth;
  - downward commitment reached;
  - same-rep descend evidence;
  - no stale / mixed-rep contamination.

Forbidden idea:
- any admission recovery that would let standing, seated, setup-contaminated, stale, mixed-rep, or non-reversal motion into pass.

Important:
Admission recovery is **not** close recovery.
Do not mark success here.
Only recover entry into the authoritative shallow contract.

### Part B — narrow same-rep shallow close recovery

Inside `squat-completion-state.ts`, recover close from:
- `descent_span_too_short`
- `ascent_recovery_span_too_short`

only when the same rep already proves all of the following:

- `officialShallowPathAdmitted === true`
- same-rep descend confirmed
- same-rep reversal confirmed after descend
- same-rep recovery confirmed after reversal
- `officialShallowReversalSatisfied === true`
- `officialShallowAscentEquivalentSatisfied === true`
- `officialShallowClosureProofSatisfied === true`
- no setup contamination
- no stale / mixed-rep contamination

This is not a global span relaxation.
It is a **narrow shallow close rule** for already-proven same-rep shallow closure.

### Part C — no-op pass-through only if needed

If a focused smoke needs extra diagnostic fields to assert same-rep shallow admission / close truth, add only narrow pass-through fields.
Do not add new semantics consumers.

---

## Hard safety rules

### Rule 1 — No weird-pass reopeners

After this PR, the following must still fail:
- standing still
- seated hold / still seated
- setup-motion contaminated
- stale prior rep reuse
- mixed-rep contamination
- no real descent
- no real reversal
- no real recovery
- too-fast / early pass
- pass-core-only adversarial probe
- non-squat motion accidentally opening squat pass

### Rule 2 — Deep standard path untouched

Deep standard squat is already healthy and must remain behaviorally unchanged.

### Rule 3 — No split-brain same-rep lie

Do not recover shallow success by mixing evidence across rep boundaries.
No stale peak + later reversal + later recovery composition is allowed.

### Rule 4 — If best-effort recovery still fails, stop narrow

If the shallow rep still cannot be recovered without broadening weird-pass risk, do not compensate by reopening pass shortcuts.
Document the exact remaining same-rep evidence gap instead.

---

## Required smoke / proof work

Add a dedicated focused smoke:

- `scripts/camera-pr-shallow-same-rep-admission-close-recovery-01-smoke.mjs`

Required sections:

### Must-pass
1. repeated meaningful shallow same-rep reps pass reliably
2. real-device-like admitted shallow rep with reversal/recovery/closure-proof no longer dies purely on `descent_span_too_short`
3. real-device-like shallow rep that currently dies as `not_armed` / `freeze_or_latch_missing` is admitted when same-rep shallow evidence is already sufficient

### Must-stay-blocked
4. standing still remains blocked
5. seated hold remains blocked
6. setup contamination remains blocked
7. stale prior rep remains blocked
8. mixed-rep contamination remains blocked
9. no reversal remains blocked
10. no recovery remains blocked
11. early-pass shortcut remains blocked
12. pass-core-only adversarial case remains blocked

### Integration requirement
Add this smoke to `scripts/camera-pr-f-regression-proof-gate.mjs` as a mandatory script.
No skip-marker expansion is allowed.

---

## Acceptance criteria

The PR is accepted only if all of these are true:

1. meaningful shallow squat passes reliably on current head;
2. the practical bar is that meaningful shallow squat should pass 10/10 when performed consistently;
3. weird-pass families remain blocked;
4. no `completionTruthPassed = false` / `finalPassGranted = true` illegal state reappears;
5. no pass-core reopening occurs;
6. no registry path grants pass;
7. deep standard path remains green;
8. recovered shallow success is explainable through official shallow contract + canonical completion-owner truth.

---

## Required final report

At the end, provide:

1. exact files changed;
2. what changed in shallow admission;
3. what changed in shallow close;
4. why the change is still completion-owner canonical;
5. which weird-pass families were explicitly re-verified as still blocked;
6. smoke results including the new shallow recovery smoke and full PR-F proof gate;
7. any residual narrow risk that remains.

---

## One-line lock

Implement a narrow same-rep shallow admission + close recovery inside canonical completion-state ownership, and fail the PR immediately if the fix reopens any weird-pass family or broadens pass authority.