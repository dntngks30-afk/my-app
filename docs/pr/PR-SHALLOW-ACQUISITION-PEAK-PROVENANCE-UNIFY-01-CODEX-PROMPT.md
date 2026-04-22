# PR-SHALLOW-ACQUISITION-PEAK-PROVENANCE-UNIFY-01 — CODEX Prompt

You are implementing a narrowly scoped camera-runtime PR in the MOVE RE repo.

## PR title
PR-SHALLOW-ACQUISITION-PEAK-PROVENANCE-UNIFY-01

## Parent SSOTs
- `docs/pr/PR-SHALLOW-OWNER-SPLIT-TRUTH-MAP-01.md`
- `docs/pr/PR-SHALLOW-ACQUISITION-PEAK-PROVENANCE-UNIFY-01.md`

Read both first. Obey them strictly.

## Mission
Fix only the first structural shallow failure group:
- Lane A — pre-attempt acquisition collapse
- Lane B — admitted/completion truth vs peak-owner truth split
- Lane E — peak-anchor provenance drift

Your job is **not** to make shallow pass.
Your job is to make acquisition owner and peak provenance owner read the same real shallow rep.

## What this PR IS
- an acquisition/current-rep read-boundary PR
- a baseline-freeze provenance PR
- a peak-latch provenance PR
- a same-rep peak-anchor unification PR

## What this PR is NOT
- NOT a shallow global pass broadening PR
- NOT a terminal blocker policy PR
- NOT a no_reversal fix PR
- NOT a descent_span_too_short fix PR
- NOT a standing-recovery threshold PR
- NOT a reset/setup contamination PR
- NOT an authority-law / registry / UI latch semantics PR
- NOT a deep/standard path PR

## Core law
Do not think:
- "open earlier"
- "ease shallow"
- "reduce thresholds"

Think:
- "if this same shallow rep exists, all upstream owners must agree that it exists"
- "peak provenance must belong to the same current rep, not a stale series-start anchor"

## Structural truth you must honor
The latest real-device traces show multiple bad combinations such as:
- `attemptStarted=false` + `completionBlockedReason=not_armed` + `baselineFrozen=false` + `peakLatched=false`
- `officialShallowPathAdmitted=true` while peak/owner-side still behaves like no valid peak provenance exists
- `peakLatchedAtIndex=0` or series-start-like anchor behavior in later same-rep shallow logic
- completion-side reversal/recovery truth appearing while peak/owner-side remains structurally unowned

These are owner/provenance disagreements, not just threshold misses.

## Required implementation target
Find the narrowest safe boundary that controls all of the following:
- shallow candidate -> attemptStarted elevation
- baselineFrozen creation/provenance
- peakLatched creation/provenance
- committedAtMs / peakAtMs provenance source
- current-rep vs stale-series-start peak-anchor selection

Then make the smallest safe change so that a legitimate shallow rep has coherent acquisition and peak provenance across owner layers.

## Mandatory constraints
You may change only the narrowest boundary needed for:
- current-rep acquisition
- baseline freeze provenance
- peak latch provenance
- same-rep peak anchor ownership

You must NOT change:
- global span thresholds
- global reversal thresholds
- global standing recovery thresholds
- completion terminal blocker semantics
- pass-core opener meaning
- authority-law semantics
- registry grant path
- UI latch semantics
- deep/standard semantics
- reset/setup contamination logic
- same-rep reset boundary policy

## Negative controls that must remain protected
- standing negatives
- seated negatives
They must remain blocked.
No generic acquisition broadening may spill into them.

## Positive controls that must remain intact
- deep standard pass traces
They must remain unchanged.

## Investigation steps you must perform before editing
1. Map the exact read chain for:
   - shallow candidate
   - attemptStarted
   - baselineFrozen
   - peakLatched
   - peakLatchedAtIndex
   - committedAtMs
   - peakAtMs
2. Identify where completion-side shallow admission can disagree with peak-owner-side provenance.
3. Identify where stale/series-start anchoring can leak into same-rep shallow logic.
4. Name the narrowest boundary you will change.

## Expected change shape
Acceptable examples:
- force baseline freeze provenance to derive from the same current shallow rep epoch once legitimately acquired
- prevent peak-latch provenance from reading stale series-start frames when current shallow rep commitment exists
- align admitted shallow rep and peak-owner-side provenance to the same rep epoch

Unacceptable examples:
- lowering span thresholds so the trace passes
- weakening no_reversal globally
- weakening standing recovery globally
- keeping stale state alive forever
- terminal blocker rewrites
- setup/reset policy rewrites

## Proof / replay requirements
Use latest real-device traces as primary proof.
Also keep:
- historical Lane A regression guards
- standing/seated negative guards
- deep positive guards

The proof must show better acquisition/peak provenance coherence, not just better pass rate.

## Acceptance criteria
### Must improve
At least one of the following becomes more coherent on latest replay traces, without threshold broadening:
- `attemptStarted`
- `baselineFrozen`
- `peakLatched`
- `peakLatchedAtIndex` provenance
- `committedAtMs` / `peakAtMs` same-rep alignment
- agreement between shallow admission and peak-owner-side ownership

### Must not regress
- standing negatives remain blocked
- seated negatives remain blocked
- deep standard remains intact
- terminal blocker policy remains unchanged
- authority / registry / UI latch semantics remain unchanged

### Explicit failure conditions
- threshold relaxation used to fake progress
- stale peak provenance still leaks from series start
- admitted rep and peak-owner rep still disagree in same trace
- PR expands into terminal blocker policy or reset/setup policy

## If blocked
If you discover that acquisition/peak provenance cannot be safely unified without touching terminal policy or reset/setup logic:
- STOP
- do not broaden scope
- report the exact blocking boundary
- propose the smallest next child PR

## Final report format
- files changed
- exact boundary changed
- why this is still acquisition/peak-provenance only
- why negatives remain protected
- why deep remains intact
- which traces are now mandatory proof fixtures
- what remains intentionally unsolved for later child PRs
