# First Session Quality Guardrails (PR-SESSION-QUALITY-01)

첫 세션 품질 보호 장치. 알고리즘 변경 없이 세션 생성 시 추가 규칙 적용.

## 1. 첫 세션 강도 보호 (plan-generator)

**목표**: 첫 세션이 너무 어렵거나 부담스럽게 시작되는 것 방지.

**규칙**:
- session_number === 1에서 `difficulty === 'high'` 템플릿 제외
- session_number === 1에서 `progression_level >= 3` 템플릿 제외
- 첫 세션 Main segment: 최대 1개 (MAX_FIRST_SESSION_MAIN_COUNT)
- 첫 세션 총 운동 수: 최대 5개 (MAX_FIRST_SESSION_TOTAL_EXERCISES)

**적용 위치**: `plan-generator` → `buildSessionPlanJson` (candidates filter + mainCount cap)

**constraint_flags**: `first_session_guardrail_applied: true` (첫 세션일 때)

## 2. pain_mode 기반 안전 보호

**목표**: pain_mode caution/protected 시 위험 동작 제외.

**규칙**:
- `avoid_if_pain_mode` (exercise metadata) 확인 → isExcludedByPainMode
- `getPainModeExtraAvoid`: protected 시 knee_load, wrist_load, shoulder_overhead, ankle_instability, **deep_squat** 추가

**적용 위치**: `priority-layer`, `plan-generator`

## 3. priority_vector 반영 강화

**목표**: 첫 세션이 deep result와 일관되게 느껴지게.

**규칙**:
- priority_vector 상위 1~2개 축 → `session_focus_axes` (meta)
- `session_rationale`: "하체 안정과 좌우 균형을 먼저 회복하기 위한 구성입니다" (priority 기반)

## 4. 세션 품질 검증 helper

**함수**: `validateSessionPlanQuality(plan)` (session-plan-quality.ts)

**검증 항목**:
- exercise_count >= minimum
- exercise_count <= max_first_session (첫 세션)
- pain_mode conflict 없음
- priority_axis 반영 (session_focus_axes)

## 5. Day Plan 경로 (routine)

**day-plan-generator** (7일 루틴): `applyFirstSessionGuardrail` (filter-strategy) — Day 1 시 동일 규칙.

## 6. 변경 금지 영역

- deep_v3 scoring
- threshold
- priority_vector / pain_mode 계산
- session composer 구조 전면 수정
- exercise library 구조
- adaptive engine

## 7. 관련 파일

- `src/lib/session/plan-generator.ts` — First session guardrail, session_focus_axes, session_rationale
- `src/lib/session/priority-layer.ts` — pain_mode extra avoid (deep_squat)
- `src/lib/session/session-plan-quality.ts` — validateSessionPlanQuality
- `src/lib/workout-routine/strategies/filter-strategy.ts` — applyFirstSessionGuardrail (day-plan)
- `src/lib/routine-plan/day-plan-generator.ts` — Day 1 시 guardrail 적용
