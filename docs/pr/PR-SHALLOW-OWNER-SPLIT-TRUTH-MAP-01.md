# PR-SHALLOW-OWNER-SPLIT-TRUTH-MAP-01

## Status
Parent SSOT for shallow ultra-low-ROM failure decomposition.
This document does **not** authorize implementation broadening. It locks the canonical failure lanes that child PRs must address one by one.

## Purpose
This PR is **not** a shallow-pass implementation PR.
This PR exists to stop the repo from repeatedly chasing one candidate cause at a time (`not_armed`, `no_reversal`, `span_too_short`, etc.) without first locking the structural owner split visible in the latest real-device traces.

The goal of this parent SSOT is to define the canonical truth map for shallow failure so that all later child PRs are:
- lane-scoped
- owner-aware
- device-replay-first
- explicitly non-broadening

## Product law
For one real shallow rep, acquisition owner, peak/anchor owner, completion owner, terminal blocker owner, and reset/setup boundary owner must not silently disagree about whether the same rep exists, where it starts, what its peak is, whether it reversed, and why it failed.

## Source-of-truth bundles
Use the latest device trace bundles as the canonical truth source. Synthetic fixtures are secondary guards only.

- device bundle 2026-04-21 (latest previous generation)
- device bundle 2026-04-22 (latest current generation)

## Locked observation
The current shallow failure is **not one bug**.
It is at least a multi-lane owner split problem.
Trying to "fix shallow" through a single-cause PR has repeatedly produced partial motion, blocker drift, or new regressions.

## Canonical failure lanes

### Lane A — pre-attempt acquisition collapse
Representative shape:
- `attemptStarted=false`
- `completionBlockedReason=not_armed`
- `baselineFrozen=false`
- `peakLatched=false`
- pass-core often blocked by `peak_not_latched`
- event cycle notes often include `freeze_or_latch_missing`

Meaning:
The rep exists as shallow candidate / descend evidence, but the runtime does not elevate it into a stable current rep.

### Lane B — admitted/completion truth vs peak-owner truth split
Representative shape:
- `attemptStarted=true`
- `officialShallowPathAdmitted=true`
- `officialShallowClosureProofSatisfied=true`
- `officialShallowReversalSatisfied=true`
- but `baselineFrozen=false` and/or `peakLatched=false`
- pass-core still behaves as if owner truth is missing (`peak_not_latched` or equivalent)

Meaning:
Completion-side truth has seen the rep, but peak/owner-side truth has not accepted the same rep provenance.

### Lane C — terminal blocker owner split
Representative shape:
- completion side blocks with `descent_span_too_short` or another shallow close blocker
- pass-core side blocks with `no_standing_recovery` or another different terminal reason
- both are reading the same user motion but with different terminal owner assumptions

Meaning:
Terminal blocker computation is not consuming one canonical owner input.

### Lane D — same-rep reset / setup-tail contamination
Representative shape:
- a rep partially opens or fully opens
- then setup/tail/new-rep contamination intrudes (`step_in_or_camera_close_area_spike`, `large_framing_translation`, etc.)
- the same shallow rep collapses back into pre-attempt / `not_armed` logic or otherwise loses ownership continuity

Meaning:
The product cannot yet distinguish same-rep continuation vs reset/setup contamination cleanly enough.

### Lane E — peak-anchor provenance drift
Representative shape:
- `peakLatchedAtIndex=0` or series-start-like anchoring during same-rep logic
- `peak_anchor_at_series_start` or equivalent provenance drift notes
- admitted rep later depends on a stale or mis-originated anchor

Meaning:
Peak/anchor provenance is not consistently tied to current shallow rep commitment.

## Canonical laws for all child PRs

### Law 1
No child PR may claim to fix shallow globally.
Each child PR must explicitly name which lane(s) it addresses.

### Law 2
No child PR may broaden pass semantics, threshold semantics, registry semantics, authority semantics, or UI latch semantics unless a later parent SSOT explicitly authorizes that class of change.

### Law 3
If one layer says `officialShallowClosureProofSatisfied=true` while another owner layer still behaves like no same rep exists, that is an owner split, not merely a threshold issue.

### Law 4
If same-rep truth reverts to pre-attempt truth without a clearly justified reset boundary, that is a reset-boundary bug, not a shallow-pass-threshold bug.

### Law 5
If terminal blocker reasons disagree across owner layers for the same rep, fix owner alignment before touching blocker thresholds.

## Child PR split plan

### Child PR 1
`PR-SHALLOW-ACQUISITION-PEAK-PROVENANCE-UNIFY-01`

Target lanes:
- Lane A
- Lane B
- Lane E (only insofar as it is acquisition/peak provenance, not terminal policy)

Goal:
Unify current-rep acquisition and peak provenance boundaries so the same shallow rep is either owned or not owned consistently.

### Child PR 2
`PR-SHALLOW-TERMINAL-OWNER-ALIGN-01`

Target lane:
- Lane C

Goal:
Make completion terminal blocker and pass-core terminal blocker consume the same owner input for the same shallow rep.

### Child PR 3
`PR-SHALLOW-SAME-REP-RESET-BOUNDARY-01`

Target lane:
- Lane D

Goal:
Separate same-rep continuation from reset/setup/tail contamination without weakening negative controls.

### Child PR 4
`PR-SHALLOW-SPAN-MEASUREMENT-ORIGIN-ALIGN-01`

Target residuals:
- residual span-origin disagreements left after owner/provenance unification

Goal:
Align span measurement origin to canonical same-rep ownership.
This is not a global span-threshold easing PR.

## Explicit non-goals for this parent SSOT
- no implementation broadening
- no pass-rate chasing
- no threshold sweeps
- no deep/standard semantics edits
- no standing/seated weakening
- no "quick shallow fix" patching

## Acceptance for this parent SSOT
This document is accepted when later shallow child PR review can reject scope drift by asking one simple question:

> Which locked lane from this truth map are you fixing, and which lanes are explicitly out of scope?

If a proposed PR cannot answer that question precisely, it is not ready.
