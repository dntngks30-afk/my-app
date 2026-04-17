# PR2-D proof memo — CORE_CONTROL_DEFICIT first-session distinctness

## Assumptions

- Parent truth is `docs/pr/PR-POST-52-FOLLOWUP-PRIORITIES-SSOT.md`.
- PR2 truth is `docs/pr/PR2-first-session-quality-tuning-master-ssot.md`.
- PR2-D owns only `CORE_CONTROL_DEFICIT` session-1 felt quality.

## Findings

- Before this change, the `CORE_CONTROL_DEFICIT` PR2-A snapshot already had the correct `trunk_control` intent, focus axis, and rationale.
- The weak point was actual Main composition: the Main emphasis still carried an upper/shoulder distractor (`shoulder_stability`, `upper_mobility`) and could read like a generic safe routine rather than body-connection/core-control led.
- Follow-up proof split strict trunk/core from lower support. That showed the first PR2-D pass reduced the upper distractor but let lower support replace trunk/core signal.
- This follow-up keeps the upper distractor removed while restoring the strict trunk/core floor: strict trunk/core tags stay at `3`, trunk vectors stay at `2`, support tags are reported separately at `2`, and upper distractors drop from `1` to `0`.

## Root cause

- Trunk/core intent fit existed only as the default generic first-session branch.
- First-session safety replacement ranked replacement candidates using raw `session_focus_axes` as if they were template tags, so trunk/core replacement did not strongly prefer center-control candidates or discourage upper distractors.
- The support candidate used by the trunk/core Main path was still read as lower-only support, so honest proof counted it as lower support replacing trunk/core rather than contributing to trunk-led control.

## Follow-up correction

- `applyTrunkCoreSession1TemplateProjection(...)` is shared by materialized generation, bootstrap preview, and PR2-A proof readout.
- The projection is gated to `anchorType === 'trunk_control'`.
- It gives the safe Main support candidate (`M12`) a trunk/core session-1 reading (`core_control`, `trunk_control`) only inside the trunk/core anchor path.
- Lower-pair, upper-mobility, deconditioned, and stable anchors keep the original template readout.

## Files changed

- `src/lib/session/trunk-core-session1-shared.ts`
- `src/lib/session/plan-generator.ts`
- `src/lib/session/bootstrap-summary.ts`
- `src/lib/session/constraints/applyFirstSessionPolicy.ts`
- `scripts/pr2a-first-session-anchor-comparison-harness.mjs`
- `scripts/pr2d-core-snapshot-diff.mjs`
- `scripts/pr2d-core-preview-materialized-continuity-check.mjs`
- `artifacts/pr2d/*`

## Why this is safe relative to SSOT

- PR1 source-selection policy is untouched.
- The change is gated to `trunk_control` first-session scoring/replacement fit.
- The trunk/core template projection is also gated to `trunk_control`, so non-core anchors do not inherit the supplemental `core_control` / `trunk_control` readout.
- Lower-pair and upper-mobility shared rules are not changed.
- Pain/safety/difficulty guardrails are not weakened.
- Prep/Main/Cooldown phase semantics are not reclassified.
- Auth, payment, onboarding, UI, and execution core are untouched.

## Acceptance test checklist

- `CORE_CONTROL_DEFICIT` before/after snapshot generated with PR2-A harness.
- Main upper distractor signal decreases (`1 -> 0`).
- Strict trunk/core tag floor is maintained (`3 -> 3`).
- Trunk target-vector floor is maintained (`2 -> 2`).
- Strict trunk/core tags and trunk target-vector counts are reported separately from lower-support contribution.
- Lower-support contribution is visible as support (`0 -> 2` support tags, `0 -> 1` lower vector), not counted as strict trunk/core improvement.
- Guardrail summary remains unchanged.
- Segment/phase shape remains unchanged.
- Preview/bootstrap and materialized paths both resolve `trunk_control`.
- Lower pair, upper mobility, deconditioned, and stable snapshots are unchanged in the non-core regression check.

## Explicit non-goals

- No lower-pair retuning.
- No upper mobility retuning.
- No deconditioned/stable polishing.
- No cross-anchor rewrite.
- No source-selection, auth, payment, onboarding, UI, or trace/audit redesign.
