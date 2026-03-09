# PR-ALG-06: Evaluation / Trace SSOT

## 목적

deep result → session plan → execution → adaptation을 한 세션 기준으로 끝까지 복기 가능하게 만든다.
calibration 이전 단계로서 observability / traceability / replayability를 강화한다.

---

## 1. 현재 SSOT 맵

| 영역 | SSOT 위치 | 저장 경로 |
|------|-----------|-----------|
| **analysis** | deep_test_attempts.scores.derived | deep finalize 시 저장 |
| **plan** | session_plans (plan_json, snapshots, trace) | session create 시 저장 |
| **execution** | session_feedback, exercise_feedback | session complete 시 저장 |
| **adaptation** | generation_trace_json.adaptation | session create 시 (adaptive v1/v2) |

---

## 2. 각 저장 경로

| 데이터 | 테이블/컬럼 | 시점 |
|--------|-------------|------|
| deep derived | deep_test_attempts.scores.derived | finalize |
| plan_json | session_plans.plan_json | create |
| deep_summary_snapshot | session_plans.deep_summary_snapshot_json | create |
| profile_snapshot | session_plans.profile_snapshot_json | create |
| generation_trace | session_plans.generation_trace_json | create |
| execution_summary | session_plans.execution_summary_json | complete |
| exercise_logs | session_plans.exercise_logs | complete |
| session_feedback | session_feedback | complete |
| exercise_feedback | exercise_feedback | complete |

---

## 3. generation_trace_json 표준 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| session_number | number | 세션 번호 |
| total_sessions | number | 총 세션 수 |
| resolved_phase | number | phase |
| chosen_theme | string | 테마 |
| confidence_source | string | effective_confidence \| legacy_confidence |
| scoring_version | string | deep_v2 \| deep_v3 |
| safety_mode | string? | red \| yellow \| none |
| phase_lengths | number[]? | [4] |
| phase_policy | string? | front_loaded \| equal |
| phase_policy_reason | string? | |
| adaptation | AdaptationTrace | adaptive trace |

---

## 4. adaptation trace 표준 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| reason | string | pain_flare \| low_tolerance \| high_tolerance \| none |
| source_sessions | number[] | 근거 세션 번호 |
| applied_modifiers | object | target_level_delta, force_short, force_recovery, avoid_exercise_keys, max_difficulty_cap |
| signal_summary | object? | avg_rpe, avg_pain_after, avg_completion_ratio, skip_count, replace_count |
| pain_mode | string? | none \| caution \| protected |
| priority_vector_keys | string[]? | |

---

## 5. execution_summary_json 계약

| 필드 | 타입 | 설명 |
|------|------|------|
| session_number | number | 세션 번호 |
| completed_at | string | ISO 8601 |
| completion_mode | string | all_done \| partial_done \| stop_early |
| completion_ratio | number? | 0~1 |
| overall_rpe | number? | 1~10 |
| pain_after | number? | 0~10 |
| difficulty_feedback | string? | too_easy \| ok \| too_hard |
| skip_count | number | |
| replace_count | number | |
| problem_exercise_keys | string[] | pain_delta 높음, skipped, was_replaced |
| feedback_saved | boolean | |
| summary_version | string | execution_summary_v1 |

---

## 6. replay/debug 절차

1. session_plans에서 해당 세션 row 조회
2. source_deep_attempt_id → deep_test_attempts.scores.derived
3. deep_summary_snapshot_json → create 시점 deep summary
4. generation_trace_json → 생성 이유, adaptation
5. execution_summary_json → 실행 결과 요약
6. session_feedback, exercise_feedback → raw signal (필요 시)

---

## 7. calibration 단계에서 사용할 예정 필드

- execution_summary: completion_ratio, overall_rpe, pain_after, difficulty_feedback, problem_exercise_keys
- adaptation: reason, signal_summary, applied_modifiers
- generation_trace: phase, safety_mode, adaptation

---

## 8. backward compatibility 정책

- execution_summary_json: nullable (기존 row), complete 시 항상 저장 (feedback 없음 → 기본값 summary)
- 기존 generation_trace_json 구조 유지
- 필드 추가 시 optional만 허용
