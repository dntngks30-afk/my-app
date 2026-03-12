# First Session Quality Guardrails

첫 세션 품질 보호 장치. 알고리즘 변경 없이 세션 생성 시 추가 규칙 적용.

## 1. 고난도 progression 금지 (Day 1)

**목표**: 첫 세션이 너무 어렵거나 부담스럽게 시작되는 것 방지.

**규칙**:
- Day 1 (첫 세션)에서 `difficulty === 'high'` 템플릿 제외
- Day 1에서 `progression_level >= 3` 템플릿 제외

**적용 위치**: `day-plan-generator` → `applyFirstSessionGuardrail`

**constraints_applied**: `first_session:no_high_difficulty` (Day 1일 때)

## 2. 변경 금지 영역

- deep_v3 scoring
- threshold
- priority_vector / pain_mode 계산
- session composer 구조
- exercise library 구조
- adaptive engine

## 3. 관련 파일

- `src/lib/workout-routine/strategies/filter-strategy.ts` — `applyFirstSessionGuardrail`
- `src/lib/routine-plan/day-plan-generator.ts` — Day 1 시 guardrail 적용
