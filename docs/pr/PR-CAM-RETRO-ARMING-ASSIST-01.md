# PR-CAM-RETRO-ARMING-ASSIST-01 — Retro-arm meaningful first squat motion without changing thresholds

## Problem

- Latest JSON shows some meaningful shallow/moderate attempts already reached `relativeDepthPeak` ~ 0.44, `downwardCommitmentReached` = true, `phaseHint` = `committed_bottom_or_downward_commitment`, while completion still says `not_armed`.
- Current arm paths are peak-anchored / 10-frame standing / 4-frame fallback only.
- Therefore the first meaningful rep can partially occur before the completion slice is opened.

## Why this is not a completion/reversal PR

- No completion thresholds changed.
- No reversal thresholds changed.
- No event-cycle changes.
- No anchor changes.
- No rescue changes.
- Only adds a late structural retro-arming path after existing rule arms.

## Scope

- Add retro-arming path after existing rule arms (order: peak-anchored → 10-frame → 4-frame → retro → idle).
- Require short stable standing (3 frames) plus strong motion excursion from that baseline.
- Expose retro-arm observability (`armingRetroApplied`, compact `ra`, highlighted metrics).

## Non-goals

- No threshold lowering for existing rule/HMM arms.
- No pass widening.
- No event path reopening.
- No peak anchor changes.
- No completion-state modifications.

## Acceptance

- Meaningful first rep no longer gets lost as `not_armed` when a valid short standing run exists right before it in the buffer.
- Standing sway / fake dip remain blocked.
- Existing peak-anchored / 10-frame / 4-frame arms unchanged for their fixtures.
- HMM assist thresholds unchanged.

## Regression smokes (rerun manually)

- `npx tsx scripts/camera-pr-hmm-04a-squat-arming-assist-smoke.mjs`
- `npx tsx scripts/camera-cam28-shallow-completion-slice-smoke.mjs`
- `npx tsx scripts/camera-pr-arming-baseline-handoff-01-smoke.mjs`

## Commit message

`fix(camera): retro-arm meaningful first squat motion without changing thresholds`
