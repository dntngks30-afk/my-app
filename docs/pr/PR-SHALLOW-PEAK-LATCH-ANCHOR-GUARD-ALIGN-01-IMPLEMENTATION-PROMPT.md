# Implementation Prompt — PR-SHALLOW-PEAK-LATCH-ANCHOR-GUARD-ALIGN-01

Use GPT-5.4 or an equivalently strong reasoning model.

This is a **narrow squat-only guard-alignment PR**.
It is not a broad shallow recovery PR.
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

Before editing, restate these locked truths to yourself:
- opener law is completion-owner only
- pass-core is not an opener
- registry is block-only
- this PR fixes anchor-guard alignment only
- weird-pass reopen is an automatic failure

## Real-device diagnosis to honor

Recent device traces show that shallow reps can already reach:
- `officialShallowPathAdmitted = true`
- `officialShallowStreamBridgeApplied = true`
- `officialShallowAscentEquivalentSatisfied = true`
- `officialShallowClosureProofSatisfied = true`
- `officialShallowReversalSatisfied = true`

but still remain blocked with:
- `officialShallowPathClosed = false`
- `completionBlockedReason = descent_span_too_short` or `ascent_recovery_span_too_short`

And the dominant hidden guard candidate exposed by writer-miss observability is:
- `peak_latch_anchor_guard_failed`

Meaning:
this PR must align peak/latch anchor truth with the same admitted shallow rep that already satisfies official shallow close proof.

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
- `src/lib/camera/squat/squat-completion-canonical.ts`

Optional narrow scope:
- `src/lib/camera/squat-completion-state.ts` only if same-rep anchor truth must be passed through to the writer
- tiny helper extraction directly supporting same-rep anchor provenance or writer guard alignment

Testing / proof scope:
- `scripts/camera-pr-shallow-peak-latch-anchor-guard-align-01-smoke.mjs`
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
- no global descent span threshold changes
- no global ascent recovery span threshold changes
- no broad shallow threshold sweep
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

### Step 1 — locate the exact anchor guard conjuncts

In `src/lib/camera/squat/squat-completion-canonical.ts`, identify the exact conjunct(s) that currently cause:
- `peak_latch_anchor_guard_failed`
- or equivalent writer rejection even when official shallow close proof is already complete.

Do not patch symptoms before isolating the exact conjuncts.

### Step 2 — classify the anchor failure mode

Determine which specific failure mode is active on current head:
- `peakLatched === false`
- `peakLatchedAtIndex === null`
- `peakLatchedAtIndex === 0` / series-start reuse
- stale anchor from a prior rep
- baseline-frozen / peak-latched synchronization drift
- writer consuming weaker anchor truth than the official shallow close proof path already established

Your patch must solve the actual failure mode, not a guessed symptom.

### Step 3 — align writer anchor truth to same admitted shallow rep

Allowed fix direction:
- make the writer accept anchor truth only when it is same-rep truthful and belongs to the currently admitted official shallow rep
- synchronize `peakLatched` / `peakLatchedAtIndex` with the same-rep official shallow stream bridge only when the rep is already admitted and closure-proof-complete
- reject stale or series-start anchor positions that do not belong to the current admitted shallow rep

Forbidden fix direction:
- generic threshold relaxation
- clearing `descent_span_too_short` / `ascent_recovery_span_too_short` without fixing anchor provenance
- allowing anchorless reps to pass

### Step 4 — preserve diagnostics

If the fix changes writer behavior, preserve enough diagnostics to show:
- why the shallow rep passed
- that it passed through official shallow close ownership
- that the anchor was same-rep truthful
- that weird-pass blockers were not bypassed

### Step 5 — stop narrow if needed

If the shallow rep still cannot be safely recovered without reopening weird-pass risk, stop narrow.
Do not compensate with shortcut logic.
Document the exact remaining guard gap instead.

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
- `scripts/camera-pr-shallow-peak-latch-anchor-guard-align-01-smoke.mjs`

Required sections:

### Must-pass
1. repeated meaningful shallow same-rep reps pass reliably
2. admitted shallow rep with full same-rep reversal / recovery / closure-proof no longer dies solely because of anchor misalignment
3. final writer produces `officialShallowPathClosed = true`, `completionSatisfied = true`, and canonical completion-owner pass

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

### Anchor integrity
13. a shallow rep cannot pass without same-rep anchor truth
14. series-start / stale anchor positions cannot be reused as current-rep writer truth
15. `peakLatchedAtIndex = 0` or null cannot silently pass unless the writer has explicitly and truthfully aligned anchor provenance to the current admitted rep
16. deep standard cycle still passes via standard path

### Integration requirement
Add this smoke to `scripts/camera-pr-f-regression-proof-gate.mjs` as a mandatory script.
No skip-marker expansion is allowed.

## Acceptance criteria

This PR is accepted only if all are true:
- meaningful shallow squat passes reliably on current head
- practical bar: meaningful shallow squat passes 10/10 when performed consistently
- weird-pass families remain blocked
- no `completionTruthPassed = false` / `finalPassGranted = true` illegal state reappears
- no pass-core reopening occurs
- no registry path grants pass
- deep standard path remains green
- recovered shallow success is explainable through official shallow close ownership with same-rep anchor truth

## Required final report

At the end, provide:
1. exact files changed
2. which exact writer conjunct(s) caused `peak_latch_anchor_guard_failed`
3. what changed in anchor provenance / synchronization
4. why the new alignment is still completion-owner canonical
5. which weird-pass families were re-verified as still blocked
6. smoke results including the new anchor smoke and full PR-F proof gate
7. any residual narrow risk that remains

## One-line lock

Implement a narrow same-rep peak/latch anchor guard alignment at the final writer boundary, and fail the PR immediately if the fix reopens any weird-pass family or broadens pass authority.