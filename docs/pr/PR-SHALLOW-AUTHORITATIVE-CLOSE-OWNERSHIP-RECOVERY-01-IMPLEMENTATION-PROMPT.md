# Implementation Prompt — PR-SHALLOW-AUTHORITATIVE-CLOSE-OWNERSHIP-RECOVERY-01

Use GPT-5.4 or an equivalently strong reasoning model.

You are implementing a **narrow squat-only owner-write recovery PR**.

Read these files first and treat them as binding, in this order:

1. `docs/SSOT_SQUAT_COMPLETION_FIRST_QUALITY_STRICT_2026_04.md`
2. `docs/pr/PR-SQUAT-COMPLETION-FIRST-QUALITY-STRICT-TRUTH-MAP-01.md`
3. `docs/pr/PR-01-SQUAT-COMPLETION-FIRST-AUTHORITY-FREEZE.md`
4. `docs/pr/P1-SQUAT-LEGITIMATE-SHALLOW-EVIDENCE-RECOVERY.md`
5. `docs/pr/PR-CAM-SQUAT-AUTHORITY-LAW-RESOLUTION.md`
6. `docs/pr/P3-SQUAT-ABSURD-PASS-REGISTRY-NORMALIZATION.md`
7. `docs/pr/P2-SQUAT-AUTHORITY-NAMING-COMMENT-CLEANUP.md`
8. `docs/pr/PR-SHALLOW-SAME-REP-ADMISSION-CLOSE-RECOVERY-01.md`
9. `docs/pr/PR-SHALLOW-AUTHORITATIVE-CLOSE-OWNERSHIP-RECOVERY-01.md`

Then inspect the current repo before editing.

---

## Mission

Recover **legitimate shallow squat** by making same-rep official shallow close own the authoritative completion write.

This PR is successful only if:
- meaningful shallow squat now passes reliably;
- weird-pass families remain blocked;
- opener law remains unchanged;
- P3 block-only registry remains unchanged in meaning;
- deep standard path remains unchanged.

This is an owner-write PR, not a broad recovery PR.

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
- `pass_core_detected` remains a closed legacy label;
- weird-pass families must stay blocked;
- deep standard success path must remain behaviorally unchanged.

---

## Required diagnosis boundary

Current real-device truth says the prior shallow recovery attempt still fails at one dominant place:

### Dominant residual
Same-rep shallow reps can already reach:
- `officialShallowPathAdmitted = true`
- `reversalConfirmedAfterDescend = true`
- `recoveryConfirmedAfterReversal = true`
- `officialShallowStreamBridgeApplied = true`
- `officialShallowAscentEquivalentSatisfied = true`
- `officialShallowClosureProofSatisfied = true`
- `officialShallowReversalSatisfied = true`

but still end as:
- `officialShallowPathClosed = false`
- `completionBlockedReason = descent_span_too_short`
- `completionTruthPassed = false`
- `finalPassBlockedReason = completion_truth_not_passed`

Therefore the next fix must not be another broad signal-recovery attempt.
It must fix the **single owner-write boundary** that still rewrites or preserves blocked shallow close despite complete same-rep shallow close proof.

---

## Allowed scope

Primary expected file:
- `src/lib/camera/squat-completion-state.ts`

Optional narrow scope:
- a tiny helper extraction directly supporting authoritative shallow close ownership
- `src/lib/camera/evaluators/squat.ts` pass-through only if strictly required for diagnostics / proof

Testing / proof scope:
- a new focused shallow owner-write smoke
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
8. no deep / standard retune
9. no generic threshold sweeps across all squat paths
10. no non-squat changes
11. no broad admission redesign unless absolutely required to preserve the final owner write
12. no conditional skip broadening in proof gate

If a candidate fix would reopen weird-pass risk, reject that fix.

---

## Implementation strategy

### Step 1 — locate the authoritative close writer

In `squat-completion-state.ts`, find the exact place that finally decides:
- `completionSatisfied`
- `completionPassReason`
- `completionBlockedReason`
- `officialShallowPathClosed`
- `officialShallowPathBlockedReason`
- official shallow cycle success / failure classification

Do not patch around the edges before identifying this write boundary.

### Step 2 — verify why the prior recovery failed

Determine which one is true on current head:
- close recovery never reaches the final owner-write branch;
- close recovery runs, but a later canonical block rewrites it back to `descent_span_too_short`;
- close recovery updates diagnostics only, not authoritative close state;
- close recovery depends on a guard that real-device traces do not satisfy even when closure proof is already complete.

Your final patch must solve the real mechanism, not a guessed symptom.

### Step 3 — integrate recovery at the owner-write boundary

Make same-rep shallow close recover **at the final authoritative owner-write layer**.

Allowed recovery only when all are true:
- `officialShallowPathAdmitted === true`
- same-rep descend confirmed
- same-rep reversal confirmed after descend
- same-rep recovery confirmed after reversal
- `officialShallowReversalSatisfied === true`
- `officialShallowAscentEquivalentSatisfied === true`
- `officialShallowClosureProofSatisfied === true`
- temporal order integrity satisfied
- no setup contamination
- no stale / mixed-rep contamination

If those are all true, the owner write must produce:
- `officialShallowPathClosed = true`
- `completionSatisfied = true`
- canonical completion-owner pass
- no lingering `descent_span_too_short` / `ascent_recovery_span_too_short` block on that same rep

If those are not all true, the rep must remain blocked.

### Step 4 — preserve diagnostics

Do not lose visibility.
If the owner-write fix changes close behavior, keep enough diagnostics to show:
- the rep passed through official shallow close ownership;
- the pass was same-rep truthful;
- no weird-pass blocker was bypassed.

### Step 5 — only touch admission if strictly necessary

If the owner-write path cannot be reached without a tiny admission preservation tweak, keep it narrow:
- ready-state only
- same-rep only
- no setup contamination
- no stale / mixed-rep contamination
- no direct success write

Admission is not the primary target in this PR.
Authoritative close ownership is.

---

## Hard safety rules

### Rule 1 — No weird-pass reopeners

After this PR, all of these must still fail:
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

### Rule 4 — If best-effort owner-write recovery still fails, stop narrow

If shallow still fails without a safe owner-write solution, do not compensate by reopening shortcuts.
Document the exact remaining owner-write gap instead.

---

## Required smoke / proof work

Add a dedicated focused smoke:
- `scripts/camera-pr-shallow-authoritative-close-ownership-recovery-01-smoke.mjs`

Required sections:

### Must-pass
1. repeated meaningful shallow same-rep reps pass reliably
2. admitted shallow rep with full same-rep reversal / recovery / closure-proof no longer dies on `descent_span_too_short`
3. the final owner write produces `officialShallowPathClosed = true`, `completionSatisfied = true`, and canonical completion-owner pass

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

### Ownership integrity
13. diagnostic close-proof fields alone cannot pass if owner close is not satisfied
14. the final owner write cannot silently revert a proven same-rep shallow close back to `descent_span_too_short`
15. deep standard cycle still passes through standard path

### Integration requirement
Add this smoke to `scripts/camera-pr-f-regression-proof-gate.mjs` as a mandatory script.
No skip-marker expansion is allowed.

---

## Acceptance criteria

The PR is accepted only if all are true:

1. meaningful shallow squat passes reliably on current head;
2. practical bar: meaningful shallow squat passes 10/10 when performed consistently;
3. weird-pass families remain blocked;
4. no `completionTruthPassed = false` / `finalPassGranted = true` illegal state reappears;
5. no pass-core reopening occurs;
6. no registry path grants pass;
7. deep standard path remains green;
8. recovered shallow success is explainable through official shallow close ownership inside canonical completion-owner truth.

---

## Required final report

At the end, provide:

1. exact files changed;
2. where the authoritative close writer was located;
3. what changed at the final owner-write boundary;
4. why the prior recovery failed and why the new one should survive the final canonical write;
5. which weird-pass families were explicitly re-verified as still blocked;
6. smoke results including the new owner-write smoke and full PR-F proof gate;
7. any residual narrow risk that remains.

---

## One-line lock

Implement a narrow same-rep official shallow close owner-write recovery inside canonical completion-state ownership, and fail the PR immediately if the fix reopens any weird-pass family or broadens pass authority.