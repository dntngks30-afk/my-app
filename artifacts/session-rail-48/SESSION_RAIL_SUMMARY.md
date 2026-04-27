# Session rail truth summary

Generated: 2026-04-27T04:12:45.374Z
Harness: session-rail-truth-harness.mjs v1.0.0
Template pool: fixture_m01_m48_session_plan_v1 (count=48)

## 1. Executive summary

- **Rail model:** Next-session materialization only — this harness calls `buildSessionPlanJson` once per session index with a production-like `usedTemplateIds` rolling window (last 4 sessions).
- **Frequency:** `target_frequency` 2/3/4/5 maps to `total_sessions` 8/12/16/20 (see section 2).
- **secondary_type A/B:** Final classification from this run: **(run --mode secondary-type-ab or all)**

## 2. Frequency → total_sessions truth

| target_frequency | total_sessions |
| --- | --- |
| 2 | 8 |
| 3 | 12 |
| 4 | 16 |
| 5 | 20 |

## 3. Phase distribution (equal policy fixture: deep_level=2, safety none, red_flags false)

| total_sessions | Phase1 | Phase2 | Phase3 | Phase4 |
| --- | --- | --- | --- | --- |
| 8 | 1–2 | 3–4 | 5–6 | 7–8 |
| 12 | 1–3 | 4–6 | 7–9 | 10–12 |
| 16 | 1–4 | 5–8 | 9–12 | 13–16 |
| 20 | 1–5 | 6–10 | 11–15 | 16–20 |

## 4. Six baseline type rail summary

Static-neutral artifacts: `C:\projects\my-app\artifacts\session-rail-48\static-neutral`
- Per case: `*_freq*.json`
- Matrix: `rail-matrix.json`

## 5. Adaptive branch comparison

Branches: `neutral`, `low_tolerance_or_pain_flare`, `high_tolerance` (overlay/modifier injected from session 2+; session 1 identical).

Artifacts: `C:\projects\my-app\artifacts\session-rail-48\adaptive-branch`

## 6. secondary_type A/B summary

Artifacts: `C:\projects\my-app\artifacts\session-rail-48\secondary-type-ab`
- `ab-summary.json` — per-session classification + aggregate.

## 7. Final classification (secondary_type)

**(run --mode secondary-type-ab or all)**

---

## Manual interpretation guide

- **metadata-only:** segment template ids, focus axes, and rationale match between A/B; only `secondary_type` (and derived meta echo) differs.
- **material:** any session shows different template selection or rationale/focus axes.
- **inconclusive:** confounder check failed or mixed outcomes.

