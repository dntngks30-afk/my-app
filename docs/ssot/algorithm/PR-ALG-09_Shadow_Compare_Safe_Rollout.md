# PR-ALG-09: Shadow Compare / Safe Rollout

## 목적

calibration 변경을 바로 전면 적용하지 않고, 분포/차이/리스크를 먼저 관측 가능하게 만든다.
active 결과는 유지하고, candidate 규칙 결과를 shadow로 같이 계산해 diff를 저장한다.

---

## 1. Shadow Compare 목적

- **안전한 rollout**: threshold 변경 전 분포·차이 확인
- **데이터 기반 판단**: PR-ALG-10에서 실제 적용 여부 결정
- **회귀 방지**: active는 그대로, shadow만 저장/분석용

---

## 2. Active vs Shadow 정책

| 항목 | 정책 |
|------|------|
| 사용자 노출 | active 결과만 사용. UI/결과 페이지 변경 없음 |
| 저장 | active + shadow_compare block |
| shadow_compare | 분석·분포 확인용. 런타임 의사결정에 미사용 |

---

## 3. 1차 Candidate 비교 대상 (pain_mode 우선)

| candidate | 설명 | threshold |
|------------|------|-----------|
| pain_mode_relaxed | caution 완화 | protected 3+ (동일), caution 2+ (현재 1+), none 0-1 |

- **active**: protected 3+, caution 1+, none 0
- **shadow (relaxed)**: protected 3+, caution 2+, none 0-1
- **차이**: maxInt=1일 때 active=caution, shadow=none → pain_mode_changed

---

## 4. 저장 구조

| 위치 | 필드 | 설명 |
|------|------|------|
| deep_test_attempts.scores | shadow_compare | optional. active vs shadow diff block |

```json
{
  "shadow_compare": {
    "active_rule_version": "deep_v3_calibration_v1",
    "shadow_rule_version": "deep_v3_pain_mode_candidate_relaxed",
    "candidate_name": "pain_mode_relaxed",
    "active_primary_type": "CORE_CONTROL_DEFICIT",
    "shadow_primary_type": "CORE_CONTROL_DEFICIT",
    "active_secondary_type": null,
    "shadow_secondary_type": null,
    "active_priority_vector": {...},
    "shadow_priority_vector": {...},
    "active_pain_mode": "caution",
    "shadow_pain_mode": "none",
    "diff_flags": ["pain_mode_changed"],
    "comparison_reason": "pain_mode_relaxed vs active",
    "compare_version": "shadow_compare_v1"
  }
}
```

---

## 5. diff_flags 정의

| flag | 의미 |
|------|------|
| primary_type_changed | active와 shadow의 primary_type 다름 |
| secondary_type_changed | active와 shadow의 secondary_type 다름 |
| priority_order_changed | priority_vector 순서/값 다름 |
| pain_mode_changed | active와 shadow의 pain_mode 다름 |
| gate_changed | (향후) stable/deconditioned gate 판정 다름 |

---

## 6. Rollout 원칙

1. **active unchanged**: 사용자 체감 결과 변경 금지
2. **shadow additive only**: 기존 구조에 shadow_compare만 추가
3. **deterministic**: 같은 answers → 같은 active/shadow
4. **compare smallest set**: 1차는 pain_mode만. 이후 확장 가능

---

## 7. PR-ALG-10에서 실제 threshold 적용 여부 판단 기준

- shadow_compare 데이터 수집 후:
  - pain_mode_changed 비율
  - primary_type_changed로 인한 session/adaptive 영향
  - persona pack 회귀 여부
- 위 기준으로 적용/미적용 결정
