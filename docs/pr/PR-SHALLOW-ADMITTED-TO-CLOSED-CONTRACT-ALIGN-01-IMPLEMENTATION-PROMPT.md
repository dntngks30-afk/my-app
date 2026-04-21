# Implementation Prompt — PR-SHALLOW-ADMITTED-TO-CLOSED-CONTRACT-ALIGN-01

Use GPT-5.4 or an equivalently strong reasoning model.

This is a **narrow squat-only shallow-contract PR**.
It is not a broad recovery PR.
It is not an authority PR.
It is not a registry PR.
It is not a threshold sweep PR.

Read these files first, in this exact order, and treat them as binding:

1. `docs/SSOT_SQUAT_COMPLETION_FIRST_QUALITY_STRICT_2026_04.md`
2. `docs/pr/PR-SQUAT-COMPLETION-FIRST-QUALITY-STRICT-TRUTH-MAP-01.md`
3. `docs/pr/PR-01-SQUAT-COMPLETION-FIRST-AUTHORITY-FREEZE.md`
4. `docs/pr/P1-SQUAT-LEGITIMATE-SHALLOW-EVIDENCE-RECOVERY.md`
5. `docs/pr/PR-CAM-SQUAT-AUTHORITY-LAW-RESOLUTION.md`
6. `docs/pr/P3-SQUAT-ABSURD-PASS-REGISTRY-NORMALIZATION.md`
7. `docs/pr/P2-SQUAT-AUTHORITY-NAMING-COMMENT-CLEANUP.md`
8. `docs/pr/PR-SHALLOW-AUTHORITATIVE-CLOSE-WRITER-MISS-OBSERVABILITY-01.md`
9. `docs/pr/PR-SHALLOW-PEAK-LATCH-ANCHOR-GUARD-ALIGN-01.md`
10. `docs/pr/PR-SHALLOW-ADMITTED-TO-CLOSED-CONTRACT-ALIGN-01.md`

Before editing, restate these locked truths to yourself:
- opener law is completion-owner only
- pass-core is not an opener
- registry is block-only
- this PR fixes the admitted-to-closed shallow contract only
- weird-pass reopen is automatic failure

## Real-device diagnosis to honor

Recent shallow device traces repeatedly show:
- `officialShallowPathAdmitted = true`
- later sometimes `officialShallowStreamBridgeApplied = true`
- later sometimes `officialShallowAscentEquivalentSatisfied = true`
- later sometimes `officialShallowClosureProofSatisfied = true`
- later sometimes `officialShallowReversalSatisfied = true`
- but still `officialShallowPathClosed = false`
- and final blockers remain dominated by `descent_span_too_short` and `no_reversal`

In some windows the traces also show:
- `baselineFrozen = true`
- `peakLatched = true`

and still never close.

Meaning:
this PR must not assume the remaining issue is only writer-anchor alignment.
The dominant residual is that the **admitted shallow contract still cannot truthfully transition to closed**.

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
- pass-core remains non-opener assist / veto / trace only
- absurd-pass registry remains block-only
- `pass_core_detected` remains a closed legacy label
- weird-pass families must stay blocked
- deep standard success path must remain behaviorally unchanged

## Allowed scope

Primary expected file:
- `src/lib/camera/squat-completion-state.ts`

Optional narrow scope:
- `src/lib/camera/squat/squat-completion-canonical.ts` only if needed so the writer stays truthful after upstream contract alignment
- tiny helper extraction directly supporting same-rep shallow admitted-to-closed logic

Testing / proof scope:
- `scripts/camera-pr-shallow-admitted-to-closed-contract-align-01-smoke.mjs`
- `scripts/camera-pr-f-regression-proof-gate.mjs`

## Absolute prohibitions

Do not do any of the following:

### authority / opener
- no `auto-progression.ts` opener-law changes
- no completion-owner law changes
- no pass-core reopening
- no `pass_core_detected` revival
- no final surface semantics changes

### blocker / registry
- no P3 registry logic changes
- no registry grant path
- no block-only rule weakening
- no blocked-reason generic merge

### UI / latch
- no UI latch redesign
- no `isFinalPassLatched` meaning change
- no `finalPassEligible` / `finalPassGranted` redesign

### thresholds / tuning
- no broad descent span threshold sweep
- no broad ascent recovery threshold sweep
- no deep/standard tuning
- no timing/epoch/arming sweep

### scope / architecture
- no non-squat changes
- no setup/readiness redesign
- no evaluator-wide redesign
- no consumer workaround
- no broad refactor

### proof discipline
- no skip-marker expansion
- no smoke weakening
- no proof gate weakening

## Implementation strategy

### Step 1 — isolate the admitted-to-closed veto layer

In `src/lib/camera/squat-completion-state.ts`, locate the exact branch/conjuncts that keep an already admitted shallow rep at:
- `officialShallowPathAdmitted = true`
- `officialShallowPathClosed = false`

Expected veto family includes:
- `descent_span_too_short`
- `no_reversal`
- possibly `no_standing_recovery`

Do not patch symptoms before isolating the exact close-contract veto layer.

### Step 2 — identify where admitted shallow is still judged by the wrong law

Determine which specific mismatch is active on current head:
- admitted shallow is still evaluated by a standard-like descent span rule
- admitted shallow is still evaluated by a stricter reversal rule than the official shallow bridge/closure proof path already allows
- admitted shallow bridge/closure proof is visible but not authoritative for close
- close state depends on a pre-admission or pre-bridge assumption that remains inappropriate after admission

Your patch must solve the actual mismatch, not a guessed symptom.

### Step 3 — align the admitted-to-closed shallow contract

Allowed fix direction:
- once the rep is already admitted into the official shallow path, make the close law depend on same-rep shallow contract truth
- ensure admitted shallow can transition to `closed` when genuine same-rep descend/reversal/recovery/bridge/closure truth is present
- keep the contract explicit about when admitted shallow must still remain blocked

Forbidden fix direction:
- broad threshold relaxation
- pass-core shortcut
- writer-only exception without fixing the upstream shallow close contract
- letting admitted-but-incomplete reps close

### Step 4 — preserve diagnostics

If the contract alignment changes close behavior, preserve enough diagnostics to show:
- why the shallow rep closed
- which shallow truth path closed it
- that weird-pass blockers were not bypassed

### Step 5 — stop narrow if needed

If the admitted shallow rep still cannot be safely recovered without reopening weird-pass risk, stop narrow.
Do not compensate with shortcut logic.
Document the exact remaining contract gap instead.

## Hard safety rules

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

Deep standard squat must remain behaviorally unchanged.

No stale peak + later reversal + later recovery composition is allowed.
No split-brain same-rep lie is allowed.

## Required smoke / proof work

Add:
- `scripts/camera-pr-shallow-admitted-to-closed-contract-align-01-smoke.mjs`

Required sections:

### Must-pass
1. repeated meaningful shallow same-rep reps pass reliably
2. admitted shallow rep with genuine same-rep shallow close truth now becomes `officialShallowPathClosed = true`
3. canonical completion-owner truth then becomes satisfied and final pass opens through the existing law

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

### Contract integrity
13. admitted shallow alone cannot close
14. admitted shallow with no genuine same-rep reversal/recovery still fails
15. deep standard cycle still passes via standard path
16. no `completionTruthPassed = false` / `finalPassGranted = true`

### Integration requirement
Add this smoke to `scripts/camera-pr-f-regression-proof-gate.mjs` as a mandatory script.
No skip-marker expansion is allowed.

## Acceptance criteria

This PR is accepted only if all are true:
- meaningful shallow squat passes reliably on current head
- practical bar: meaningful shallow squat passes 10/10 when performed consistently
- admitted shallow no longer stalls indefinitely at `closed = false` when same-rep close truth is genuinely present
- weird-pass families remain blocked
- no pass-core reopening occurs
- no registry path grants pass
- deep standard path remains green
- recovered shallow success is explainable through official shallow admitted-to-closed contract truth inside canonical completion-owner flow

## Required final report

At the end, provide:
1. exact files changed
2. which exact close-contract conjunct(s) kept admitted shallow from closing
3. what changed in the admitted-to-closed contract
4. why the new alignment is still completion-owner canonical
5. which weird-pass families were re-verified as still blocked
6. smoke results including the new contract smoke and full PR-F proof gate
7. any residual narrow risk that remains

## One-line lock

Implement a narrow same-rep official shallow admitted-to-closed contract alignment, and fail the PR immediately if the fix reopens any weird-pass family or broadens pass authority.