# Implementation Prompt — PR-SHALLOW-ANCHOR-PROVENANCE-RESET-AND-SPAN-ALIGN-01

Use GPT-5.4 or an equivalently strong reasoning model.

This is a **narrow squat-only anchor-provenance and span-alignment PR**.
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
11. `docs/pr/PR-SHALLOW-CLOSE-COMMIT-CONTRACT-ALIGN-01.md`
12. `docs/pr/PR-SHALLOW-ANCHOR-PROVENANCE-RESET-AND-SPAN-ALIGN-01.md`

Before editing, restate these locked truths to yourself:
- opener law is completion-owner only
- pass-core is not an opener
- registry is block-only
- this PR fixes current-rep anchor provenance and span alignment only
- weird-pass reopen is automatic failure

## Real-device diagnosis to honor

Recent shallow device traces show three classes that must all be respected:

### Class A — pre-attempt / arming still fails
Early windows show:
- `completionBlockedReason = not_armed`
- `baselineFrozen = false`
- `peakLatched = false`
- `peakLatchedAtIndex = 0`
- eventCycle notes include `freeze_or_latch_missing`
- shallow intent is already visible

### Class B — admitted shallow with visible close truth still blocked by span labels
Later windows can show:
- `officialShallowPathAdmitted = true`
- `officialShallowStreamBridgeApplied = true`
- `officialShallowAscentEquivalentSatisfied = true`
- `officialShallowClosureProofSatisfied = true`
- `officialShallowReversalSatisfied = true`
- still `officialShallowPathClosed = false`
- `completionBlockedReason = descent_span_too_short` or `ascent_recovery_span_too_short`

### Class C — stronger late state still uses series-start anchor
Late windows can show:
- `baselineFrozen = true`
- `peakLatched = true`
- still `peakLatchedAtIndex = 0`
- eventCycle notes like `peak_anchor_at_series_start`, `descent_weak`, `recovery_tail_weak`
- and the rep still never closes

Meaning:
this PR must not assume the remaining issue is only writer commit coherence.
The dominant residual is that **current-rep shallow close truth and peak/latch anchor provenance are still not aligned to the same admitted rep boundary**.

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
- `src/lib/camera/squat/squat-completion-canonical.ts` only if final writer truth must be aligned after upstream provenance reset
- tiny helper extraction directly supporting current-rep anchor provenance or span alignment

Testing / proof scope:
- `scripts/camera-pr-shallow-anchor-provenance-reset-and-span-align-01-smoke.mjs`
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

### Step 1 — isolate where stale series-start anchor survives

In `src/lib/camera/squat-completion-state.ts`, identify the exact branch/conjuncts where:
- `peakLatchedAtIndex = 0`
- `peak_anchor_at_series_start`
- or equivalent stale anchor provenance
continues to survive after the current shallow rep is already admitted.

Do not patch symptoms before isolating this provenance retention point.

### Step 2 — classify the provenance drift

Determine which specific drift is active on current head:
- global/series-start anchor reused for the current admitted shallow rep
- `baselineFrozen` / `peakLatched` becoming true without current-rep anchor index reset
- current-rep close proof using one rep boundary while span evaluation still uses another
- admitted shallow bridge/reversal/recovery truth forming before anchor provenance is re-bound to the current rep

Your patch must solve the actual provenance drift, not a guessed symptom.

### Step 3 — reset anchor provenance to the current admitted rep

Allowed fix direction:
- once the shallow rep is already admitted and genuine same-rep shallow close truth begins to form, reset anchor provenance to the current admitted rep boundary
- prevent series-start/stale anchor reuse for current shallow close evaluation
- synchronize baselineFrozen / peakLatched / peakLatchedAtIndex to current admitted rep truth when the rep is legitimately in the official shallow close path

Forbidden fix direction:
- generic threshold relaxation
- pass-core shortcut
- writer-only exception without fixing upstream provenance
- allowing anchorless reps to pass

### Step 4 — align span evaluation to the reset anchor provenance

After anchor provenance is reset to the current admitted rep, align:
- `descent_span_too_short`
- `ascent_recovery_span_too_short`
- related weak-span interpretation
so they evaluate the same current admitted rep instead of stale series-start truth.

### Step 5 — preserve diagnostics

If provenance reset changes close behavior, preserve enough diagnostics to show:
- why the shallow rep closed
- which anchor provenance path was used
- that weird-pass blockers were not bypassed

### Step 6 — stop narrow if needed

If the admitted shallow rep still cannot be safely recovered without reopening weird-pass risk, stop narrow.
Do not compensate with shortcut logic.
Document the exact remaining provenance/ span gap instead.

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
- `scripts/camera-pr-shallow-anchor-provenance-reset-and-span-align-01-smoke.mjs`

Required sections:

### Must-pass
1. repeated meaningful shallow same-rep reps pass reliably
2. admitted shallow reps with genuine same-rep close truth and current-rep anchor provenance now close and pass
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

### Provenance integrity
13. series-start / stale anchor provenance cannot be reused as current-rep shallow truth
14. `peakLatchedAtIndex = 0` cannot silently survive into current admitted shallow span evaluation without explicit current-rep reset
15. no state remains where current-rep shallow close truth is satisfied but span evaluation still reads stale series-start provenance
16. deep standard cycle still passes via standard path
17. no `completionTruthPassed = false` / `finalPassGranted = true`

### Integration requirement
Add this smoke to `scripts/camera-pr-f-regression-proof-gate.mjs` as a mandatory script.
No skip-marker expansion is allowed.

## Acceptance criteria

This PR is accepted only if all are true:
- meaningful shallow squat passes reliably on current head
- practical bar: meaningful shallow squat passes 10/10 when performed consistently
- admitted shallow no longer stalls because stale/series-start anchor provenance survives into close-span evaluation
- weird-pass families remain blocked
- no pass-core reopening occurs
- no registry path grants pass
- deep standard path remains green
- recovered shallow success is explainable through current-rep anchor provenance aligned with official shallow close truth inside canonical completion-owner flow

## Required final report

At the end, provide:
1. exact files changed
2. where stale/series-start anchor provenance was retained
3. what changed in current-rep anchor reset and span alignment
4. why the new alignment is still completion-owner canonical
5. which weird-pass families were re-verified as still blocked
6. smoke results including the new provenance smoke and full PR-F proof gate
7. any residual narrow risk that remains

## One-line lock

Implement a narrow same-rep anchor provenance reset and span alignment for shallow reps, and fail the PR immediately if the fix reopens any weird-pass family or broadens pass authority.