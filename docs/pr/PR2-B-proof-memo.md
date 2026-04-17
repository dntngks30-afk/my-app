# PR2-B follow-up proof memo (lower pair separation)

## Scope
- This follow-up addresses **proof gap only** for PR2-B.
- No PR1 source-selection policy change.
- No upper/trunk/deconditioned/stable retune.
- No safety guardrail or phase semantic rewrite.

## What was added
- PR2-A harness now supports deterministic offline fixture mode (`templatePool` injection + static template fallback) so before/after snapshots can be generated without Supabase connectivity.
- Lower-pair comparison script generates a compact diff summary for required surfaces:
  - `first_session_intent_anchor`
  - `rationale`
  - `session_focus_axes`
  - `segment_counts` / `segment_shape`
  - `main_emphasis_shape`
  - `guardrail_summary`

## Artifacts produced
- `artifacts/pr2b/lower-pair-before.json`
- `artifacts/pr2b/lower-pair-after.json`
- `artifacts/pr2b/lower-pair-diff-summary.json`
- `artifacts/pr2b/lower-pair-preview-materialized-continuity.json`

## Readout
- `LOWER_INSTABILITY` remains control/stability-led.
- `LOWER_MOBILITY_RESTRICTION` main emphasis shifts from trunk-dominant to include lower-mobility signal.
- Guardrail summary remains unchanged (`first_session_guardrail_applied=true`, safety/pain flags unchanged).
- Preview/bootstrap summary and materialized session plan now consume synchronized lower-pair gold-path rule source.
- `core_stability` / `calf_release` 확장 태그는 dominant-axis guard 태그 세트에도 동기화됨.
