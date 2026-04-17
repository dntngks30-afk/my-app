# PR2-D proof memo — CORE_CONTROL_DEFICIT first-session distinctness

## Assumptions

- Parent truth is `docs/pr/PR-POST-52-FOLLOWUP-PRIORITIES-SSOT.md`.
- PR2 truth is `docs/pr/PR2-first-session-quality-tuning-master-ssot.md`.
- PR2-D owns only `CORE_CONTROL_DEFICIT` session-1 felt quality.

## Findings

- Before this change, the `CORE_CONTROL_DEFICIT` PR2-A snapshot already had the correct `trunk_control` intent, focus axis, and rationale.
- The weak point was actual Main composition: the Main emphasis still carried an upper/shoulder distractor (`shoulder_stability`, `upper_mobility`) and could read like a generic safe routine rather than body-connection/core-control led.

## Root cause

- Trunk/core intent fit existed only as the default generic first-session branch.
- First-session safety replacement ranked replacement candidates using raw `session_focus_axes` as if they were template tags, so trunk/core replacement did not strongly prefer center-control candidates or discourage upper distractors.

## Files changed

- `src/lib/session/trunk-core-session1-shared.ts`
- `src/lib/session/plan-generator.ts`
- `src/lib/session/bootstrap-summary.ts`
- `src/lib/session/constraints/applyFirstSessionPolicy.ts`
- `scripts/pr2d-core-snapshot-diff.mjs`
- `scripts/pr2d-core-preview-materialized-continuity-check.mjs`
- `artifacts/pr2d/*`

## Why this is safe relative to SSOT

- PR1 source-selection policy is untouched.
- The change is gated to `trunk_control` first-session scoring/replacement fit.
- Lower-pair and upper-mobility shared rules are not changed.
- Pain/safety/difficulty guardrails are not weakened.
- Prep/Main/Cooldown phase semantics are not reclassified.
- Auth, payment, onboarding, UI, and execution core are untouched.

## Acceptance test checklist

- `CORE_CONTROL_DEFICIT` before/after snapshot generated with PR2-A harness.
- Main upper distractor signal decreases.
- Strict trunk/core tags and trunk target-vector counts are reported separately from lower-support contribution.
- Lower-support contribution is visible as support, not counted as strict trunk/core improvement.
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
