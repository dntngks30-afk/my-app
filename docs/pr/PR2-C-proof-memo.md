# PR2-C implementation memo (upper mobility expressiveness)

## Scope
- This PR addresses **UPPER_IMMOBILITY first-session expressiveness only**.
- No PR1 source-selection policy changes.
- No lower pair, trunk/core, deconditioned/stable retune.
- No safety guardrail or phase semantic rewrite.

## What changed
- Added upper-only session-1 tuning in `plan-generator` so `UPPER_IMMOBILITY` keeps upper-main-capacity candidates available for Main (instead of consuming them in non-main segments first).
- Added upper-only intent-fit weighting to favor upper-main tags and reduce trunk-only fallback in Main for `upper_mobility` intent.
- Kept guardrails and phase constraints unchanged.
- Follow-up: synchronized the same upper-only expressiveness truth into `bootstrap-summary` preview path (shared helper read-boundary).

## Proof artifacts
- `artifacts/pr2c/upper-before.json`
- `artifacts/pr2c/upper-after.json`
- `artifacts/pr2c/upper-diff-summary.json`
- `artifacts/pr2c/upper-preview-materialized-continuity.json`
- `artifacts/pr2c/upper-fallback-reservation-proof.json`
- `artifacts/pr2c/all-before.json`
- `artifacts/pr2c/all-after.json`
- `artifacts/pr2c/lower-regression-check.json`

## Readout
- `UPPER_IMMOBILITY` Main emphasis changed from mixed `trunk_control + upper_mobility` to `upper_mobility`-dominant only in the harness snapshot.
- Guardrail summary remained unchanged (`pain_mode`, `safety_mode`, `first_session_guardrail_applied`, `pain_gate_applied`).
- Lower pair snapshots remained unchanged in before/after regression check.
- Follow-up continuity proof confirms preview/bootstrap path and materialized path both stay upper-dominant for `UPPER_IMMOBILITY` in focus axes + main emphasis shape while keeping first-session guardrail flag.
- Follow-up 3 proof confirms final conservative fallback pass가 실제로 exercised된 조건에서도 non-main이 reserved upper-main candidate를 선점하지 않고 Main upper 방향성을 유지한다.
