# PR-RF-STRUCT-11E — Observability Sink-Only Cleanup

> This PR follows `docs/REFACTORING_SSOT_2026_04.md`, `docs/REFACTORING_SSOT_2026_04_STRUCTURAL_TOP10.md`, and the STRUCT-11 series documents. It is a **design SSOT only** for behavior-preserving boundary cleanup.

## 1. Title

**PR-RF-STRUCT-11E — Observability Sink-Only Cleanup**

Behavior-preserving structural freeze for the **trace / debug / diagnostic / export** layer so that runtime truth is only **mirrored into sinks** and is never silently re-promoted into pass/gate/navigation ownership.

---

## 2. Problem Statement

PR-RF-STRUCT-11A unified the squat owner-truth read boundary.
PR-RF-STRUCT-11B froze the **post-owner / pre-latch** gate layer.
PR-RF-STRUCT-11C froze readiness/setup source routing.
PR-RF-STRUCT-11D froze the contract between domain latch truth and page-level success/navigation orchestration.

That means the runtime decision chain is now sufficiently separated as:

**owner truth → UI gate → final blocker chain → latch truth → page success latch → navigation scheduler → route push**

What remains unresolved is the final structural layer:

**how those already-decided truths are mirrored into trace/debug/export surfaces without those surfaces becoming a shadow source-of-truth again**

Today the observability layer is useful, but structurally noisy:

- `src/lib/camera/camera-trace.ts` stores owner/gate/latch/navigation-adjacent fields on one compact attempt surface fileciteturn40file0
- `diagnosisSummary.squatCycle` includes completion owner, UI progression, setup suppression, quality-only warnings, and diagnostic-only helper fields in one mixed block fileciteturn40file0
- `TraceDebugPanel.tsx` renders live readiness, latest diagnosis, squat observations, success snapshots, and cue/playback observability without an explicit provenance labeling system fileciteturn41file0
- success snapshots, trace bundles, and observation events are all legitimate sinks, but the current structure does not formally lock that they are **consumers only**

11E does **not** delete observability.
It freezes the rule that observability is a **sink-only layer**:

- runtime truth may flow into it
- it may not flow back out as runtime truth
- mirror fields must be labeled by provenance
- mixed debug surfaces must not blur owner/gate/latch/page-navigation boundaries

---

## 3. Scope

This PR is limited to **observability sink-only cleanup** for squat camera runtime-adjacent surfaces.

Included:

- Freeze the sink-only role of:
  - `camera-trace.ts`
  - attempt snapshots
  - squat observation events
  - success snapshots
  - terminal/export bundles
  - `TraceDebugPanel.tsx`
- Define provenance classes for mirrored fields:
  - owner truth mirrors
  - UI gate / final blocker mirrors
  - latch / navigation mirrors
  - setup/readiness mirrors
  - quality / interpretation-only mirrors
  - observability-only derived summaries
- Clarify which fields are allowed to be compact mixed exports and which must retain labeled ownership
- Clarify that page/debug panels may **display** runtime-adjacent values but may not **feed** them back into runtime decisions

Excluded:

- pass/fail semantic changes
- owner truth semantic changes
- gate/final blocker semantic changes
- readiness/setup routing changes
- page navigation contract changes
- export schema redesign for external consumers beyond compatibility-preserving labeling/normalization
- removal of existing diagnostic value

---

## 4. Non-goals

This PR must **not**:

- change `readSquatPassOwnerTruth(...)` meaning
- change `computeSquatPostOwnerPreLatchGateLayer(...)` meaning
- change `finalPassEligible` / `finalPassBlockedReason` meaning
- change `isFinalPassLatched(...)` meaning
- change `triggerLatchedNavigation(...)` or route timing/path behavior
- change `recordAttemptSnapshot(...)` trigger timing
- remove success snapshots / terminal bundles / squat observations as product tooling
- redesign UI/UX for debug screens beyond provenance clarity

11E is **sink-only boundary cleanup**, not runtime contract redesign.

---

## 5. 11D Result Review

### 5.1 What 11D got right

11D should be treated as structurally successful for its intended layer.

Current repo state now has an explicit page-side route execution helper and clearer page contract markers:

- domain latch truth is still produced by library truth (`isFinalPassLatched(...)`, `finalPassEligible`)
- page success-event latch remains separate
- route execution is funneled through a single page helper
- step-key idempotency is explicitly guarded in page orchestration

So 11E does **not** need to reopen page navigation ownership questions from 11D.

### 5.2 What 11D intentionally did not solve

11D stopped at the page orchestration boundary.
It did not clean up how runtime truths are serialized, summarized, exported, and rendered for debugging/diagnostic use.
That is correct.
This remaining sink-only/provenance debt belongs to 11E.

### 5.3 Review verdict

**Verdict: PASS with observability sink/provenance debt intentionally left for 11E.**

11D does not need rollback.
It narrows 11E by ensuring navigation ownership is already separated before observability cleanup begins.

---

## 6. User-visible Truth To Preserve

The following user-facing/runtime behavior must remain unchanged:

1. Camera pass/retry/fail timing must remain unchanged.
2. Success freeze / failure freeze / debug modal / auto-next behavior must remain unchanged.
3. Existing trace/debug/export tooling should continue to work in dev/diagnostic use.
4. Diagnostic visibility should remain rich; 11E must not “simplify by deleting truth”.
5. Any cleanup must preserve backward compatibility where current dev tooling expects fields.

---

## 7. Current Observability Surface Map

## 7.1 Attempt snapshot surface (`camera-trace.ts`)

`AttemptSnapshot` currently mixes:

- gate-adjacent top-level fields such as `progressionPassed`, `finalPassLatched`, `captureQuality`, `confidence`, `topReasons`
- `readinessSummary` mirrors
- `diagnosisSummary` which then nests step-specific runtime-adjacent diagnostics

This is operationally useful, but the surface is not explicitly labeled by ownership class. fileciteturn40file0

## 7.2 Squat diagnosis surface (`diagnosisSummary.squatCycle`)

`diagnosisSummary.squatCycle` currently includes all of the following on one block:

- completion/owner-related mirrors such as `completionOwnerPassed`, `completionOwnerReason`, `completionOwnerBlockedReason`
- UI gate mirrors such as `uiProgressionAllowed`, `uiProgressionBlockedReason`
- setup/readiness mirrors such as `liveReadinessSummaryState`, `readinessStableDwellSatisfied`, `setupMotionBlocked`
- latch-adjacent mirror `finalPassTimingBlockedReason`
- interpretation-only fields such as `qualityOnlyWarnings`, `passSeverity`, `resultInterpretation`
- observability-only derived helpers such as calibration/debug-only traces

This is valuable, but it currently reads like a single “truth block” even though it actually spans multiple provenance layers. fileciteturn40file0

## 7.3 Observation event surface (`SquatAttemptObservation` family)

Observation events such as `pre_attempt_candidate`, `attempt_started`, `capture_session_terminal`, `shallow_observed`, and related fields are already sink-like by design.
But because they are compact and runtime-shaped, they still need an explicit rule that they may never become gate inputs. fileciteturn40file0

## 7.4 Success diagnostic surface

Success snapshots and terminal bundles are also sink surfaces.
They mirror already-latched success state and are correct to exist.
But 11E must formally classify them as **downstream consumers of already-decided truth**, not side channels that may influence runtime ownership.

## 7.5 Debug panel surface (`TraceDebugPanel.tsx`)

`TraceDebugPanel.tsx` renders:

- live readiness
- attempt snapshots
- squat observations
- overhead observations
- latest diagnosis
- success snapshots
- cue/playback observability

This is useful, but it currently presents many values without explicit provenance labels like:

- owner
- gate
- readiness/setup route
- latch/navigation
- interpretation-only
- sink-only derived summary

That makes the panel valuable for debugging humans but structurally ambiguous for future maintainers. fileciteturn41file0

---

## 8. Structural Bottlenecks

### Bottleneck 1 — Runtime-adjacent mirrors are stored without a formal provenance vocabulary

Fields like:

- `completionOwnerPassed`
- `uiProgressionAllowed`
- `liveReadinessSummaryState`
- `finalPassLatched`
- `successOpenedBy`

can currently appear close together in snapshots and panels. Without a formal vocabulary, future code can start to treat “the last exported value” as if it were runtime truth.

### Bottleneck 2 — Mixed compact exports blur ownership classes

A compact export is fine.
What is not yet frozen is the rule that mixed exports are still only **mirrors**, not owners.

### Bottleneck 3 — Debug panel is readable but not provenance-explicit

The panel helps humans inspect the system, but it does not yet strongly teach the distinction between:

- owner truth
- gate truth
- page latch/navigation truth
- interpretation-only quality fields
- sink-only derived/calibration fields

### Bottleneck 4 — Success/terminal exports sit close to runtime transition code

Because success snapshots and terminal bundles are recorded close to runtime effects, future contributors may accidentally assume they are authoritative runtime state rather than post-decision sink outputs.

### Bottleneck 5 — Sink-only rule exists informally, not contractually

Several comments imply trace/debug is dev-only or non-blocking, but 11E needs a stronger contract:

- sink code may read runtime truth
- runtime code must not read sink code to make gate/latch/navigation decisions

### Bottleneck 6 — This is not a schema-deletion problem

The issue is not “too many fields”.
The issue is **missing structural ownership labels and sink-only guarantees**.

---

## 9. Boundary Freeze Proposal

## 9.1 Freeze target

11E freezes the final layer:

**runtime truth → observability sinks → human/dev tooling**

This sits strictly **after** 11D.
It must not reopen runtime ownership.

## 9.2 Canonical provenance classes

11E defines six provenance classes.

### A. Owner truth mirrors

Examples:

- `completionOwnerPassed`
- `completionOwnerReason`
- `completionOwnerBlockedReason`
- pass owner lineage / owner-trace fields

Rule:

- These are mirrors of owner truth
- They may be exported and displayed
- They may not be re-consumed as runtime owner inputs outside the original runtime chain

### B. UI gate / final blocker mirrors

Examples:

- `uiProgressionAllowed`
- `uiProgressionBlockedReason`
- `finalPassBlockedReason`
- `captureQuality`
- `progressionPassed`

Rule:

- These are mirrors of post-owner/pre-latch gate outcomes
- They may be exported and displayed
- They may not be re-consumed as live gate logic inputs

### C. Setup / readiness mirrors

Examples:

- `liveReadinessSummaryState`
- `readinessStableDwellSatisfied`
- `setupMotionBlocked`
- `setupMotionBlockReason`
- `attemptStartedAfterReady`
- readiness summary fields in trace/debug panel

Rule:

- These are mirrors of the routed readiness/setup sources defined by 11C
- The observability layer must not redefine those routes

### D. Latch / navigation mirrors

Examples:

- `finalPassLatched`
- `passLatched`
- `successOpenedBy`
- `navigationTriggered`
- `autoNextObservation`
- success snapshot / terminal bundle transition metadata

Rule:

- These are mirrors of 11D handoff/orchestration outcomes
- They may be displayed/exported
- They may not become a second latch/navigation owner

### E. Interpretation-only mirrors

Examples:

- `qualityOnlyWarnings`
- `passSeverity`
- `resultInterpretation`
- `confidenceDowngradeReason`
- `squatInternalQuality`

Rule:

- These are not owner/gate/latch truths
- They are explanatory / interpretive outputs only

### F. Observability-only derived summaries

Examples:

- compact export summaries
- calibration debug blocks
- aggregate counters / quick stats
- panel-only summaries
- clipboard/export formatting

Rule:

- These are sink-only derived views
- They are not allowed to flow back into runtime decision logic

---

## 10. Locked Ordering

11E freezes the following order.

### 10.1 Runtime truth path

owner truth
→ UI gate / final blocker truth
→ latch truth
→ page navigation truth

### 10.2 Sink mirroring path

runtime truths
→ attempt snapshot / observation / success snapshot / terminal bundle
→ compact export / panel rendering

### 10.3 Human tooling path

sink outputs
→ dev panel / clipboard export / diagnostics review

### Frozen statement

Runtime truth may flow into observability.
Observability may flow into human tooling.
Observability must **not** flow back into runtime truth.

---

## 11. What 11E Should Lock Explicitly

1. `camera-trace.ts` and related storage/builders are sink producers, not runtime truth owners.
2. `TraceDebugPanel.tsx` is a sink consumer/view, not a runtime truth source.
3. Mixed diagnosis/compact export blocks must retain provenance labels even when flattened.
4. Interpretation-only fields must never be presented as owner/gate/latch truth.
5. readiness/setup mirrors must remain downstream of 11C routed sources.
6. latch/navigation mirrors must remain downstream of 11D contract outputs.
7. no runtime gate/latch/navigation code may start reading trace storage or exported snapshots as live truth.
8. observability-only derived blocks must be explicitly marked as derived/sink-only when rendered/exported.

---

## 12. File Impact Surface

### Primary

- `src/lib/camera/camera-trace.ts` fileciteturn40file0
- `src/components/camera/TraceDebugPanel.tsx` fileciteturn41file0

### Supporting sink surfaces

- `src/lib/camera/trace/camera-trace-observation-builders.ts`
- `src/lib/camera/trace/camera-trace-attempt-builder.ts`
- `src/lib/camera/trace/camera-trace-storage.ts`
- `src/lib/camera/camera-trace-bundle.ts`
- `src/lib/camera/camera-success-diagnostic.ts`

### Upstream runtime producers (out of scope for semantic change)

- `src/lib/camera/auto-progression.ts`
- `src/app/movement-test/camera/squat/page.tsx`
- readiness/setup producers
- voice/playback runtime producers

11E must not redesign those upstream producers.
It only clarifies how their outputs are mirrored downstream.

---

## 13. Regression Proof Strategy

### A. Meaning lock

Implementation PR for 11E must prove no change in meaning for:

- pass/retry/fail opening
- readiness/setup behavior
- final pass/latch/navigation behavior
- success snapshot trigger timing
- terminal bundle trigger timing

### B. Sink-only lock

Implementation PR for 11E must prove:

- trace storage is never read as live gate/latch input
- panel/export views do not redefine truth ownership
- provenance labels are explicit for mixed runtime-adjacent surfaces

### C. Compatibility lock

Implementation PR for 11E must preserve:

- existing trace usefulness
- existing debug/export access paths
- existing success snapshot and observation event coverage
- backward-compatible fields where current dev tooling relies on them

### D. Suggested proof surfaces

Minimum expectation for future implementation PR:

- narrow smoke for provenance labels / sink-only markers
- no changes to 11A / 11B / 11C / 11D smoke meaning
- selected dev export/panel verification

---

## 14. Residual Risks

1. Some mixed compact exports may remain visually dense even after provenance cleanup.
   That is acceptable if ownership is explicit.

2. Backward compatibility may require keeping some legacy field names while adding clearer labels/comments.

3. Human readers may still misuse debug values conceptually.
   11E reduces structural ambiguity but cannot eliminate all human error.

4. If future code begins importing sink helpers into runtime decision paths, 11E’s contract must be re-enforced in review/testing.

---

## 15. Approval Questions

1. Should 11E prefer adding provenance labels/comments/sections over renaming existing exported fields when compatibility risk is high?

2. Should `TraceDebugPanel.tsx` explicitly group displayed fields by provenance section (owner / gate / readiness / latch / interpretation / derived) even if the underlying data remains compact?

3. Is it acceptable to keep compact mixed exports as long as the document explicitly states they are sink-only mirrors and not live truth?

4. Should 11E add narrow smoke coverage that detects obvious reverse-dependency risks, such as runtime files importing trace storage/export helpers for live gate decisions?

5. Is there any current runtime caller known to read trace storage or exported payloads as decision truth? If yes, implementation PR must preserve compatibility very carefully and may need a separate corrective PR.

---

## Final design conclusion

11A solved owner read boundary.
11B solved post-owner / pre-latch gate ordering.
11C solved readiness/setup source routing.
11D solved success latch ↔ page navigation handoff.

So 11E should now do one narrow final thing:

**freeze observability as a sink-only layer with explicit provenance labeling**

That preserves rich diagnostics while preventing trace/debug/export surfaces from becoming a shadow runtime truth system.