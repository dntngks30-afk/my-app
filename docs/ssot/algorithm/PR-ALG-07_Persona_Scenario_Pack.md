# PR-ALG-07: Offline Persona / Scenario Pack

## 목적

deep_v3, session composer, adaptive 변경 시 회귀를 잡을 수 있는 대표 사용자 시나리오 세트.
실제 사용자 DB를 건드리지 않고, 오프라인 fixture / scenario 기반으로 기대 결과를 고정한다.

---

## 1. Scenario Pack 개요

| 항목 | 내용 |
|------|------|
| 위치 | `src/lib/deep-test/scenarios/personas.json` |
| persona 수 | 22개 (PR-ALG-08에서 lower-mobility-ankle 추가) |
| 검증 스크립트 | `scripts/deep-v3-persona-check.mjs`, `scripts/session-scenario-check.mjs` |

---

## 2. Persona 범주

| 범주 | id 예시 | 설명 |
|------|---------|------|
| LOWER_INSTABILITY | lower-instability-basic, lower-instability-severe | 한발서기/스쿼트 무릎 흔들림 |
| LOWER_MOBILITY_RESTRICTION | lower-mobility-ankle | 스쿼트 양호, 한발서기 발목 꺾임 |
| CORE_CONTROL_DEFICIT | trunk-control-protected, core-control-lumbo | 벽천사 허리 과신전, 한발서기 골반 꺾임 |
| UPPER_IMMOBILITY | upper-immobility-basic, upper-limb-wrist | 벽천사 팔꿈치/손목 제한 |
| DECONDITIONED | deconditioned-basic, deconditioned-severe, deconditioned-caution | 경험 없음, 연령/활동성 불리 |
| STABLE | stable-basic, stable-experienced, stable-elder | 모든 동작 양호 |
| pain_mode protected | pain-mode-protected, trunk-control-high-pain, sls-pain-protected | 강한 통증 |
| pain_mode caution | pain-mode-caution, lower-instability-severe | 중간 통증 |
| asymmetry | asymmetry-strong | 다중 부위, 좌우 차이 |
| mixed | mixed-lower-trunk | lower_stability + trunk_control 혼합 |

---

## 3. 각 Persona 구조

```json
{
  "id": "string",
  "label": "string",
  "description": "string",
  "input": { "deep_basic_*", "deep_squat_*", "deep_wallangel_*", "deep_sls_*" },
  "expected_analysis": {
    "primary_type": "LOWER_INSTABILITY | CORE_CONTROL_DEFICIT | UPPER_IMMOBILITY | DECONDITIONED | STABLE",
    "pain_mode": "none | caution | protected",
    "priority_vector_contains": ["lower_stability", "trunk_control", ...]
  },
  "expected_plan_hints": {
    "preferred_target_vectors": ["glute_medius", "hip_mobility", ...],
    "avoided_characteristics": ["knee_load", "lower_back_pain", ...],
    "expected_session_bias": "stability | mobility | prep-heavy | recovery | balanced"
  }
}
```

---

## 4. 검증 스크립트 역할

| 스크립트 | 역할 | DB 필요 |
|----------|------|---------|
| deep-v3-persona-check | fixture answers → deep_v3 derived. primary_type, pain_mode, priority_vector 검증 | 없음 |
| session-scenario-check | deep summary → session plan. focus/avoid overlap, segments 구조 검증 | Supabase |

---

## 5. 기대값 설계 원칙

- **expectation bands, not brittle exactness**: exact snapshot보다 핵심 기대값 중심
- **layered validation**: analysis → plan → adaptation 분리
- **representative, not exhaustive**: 대표 케이스만, 회귀 잘 잡는 시나리오 우선

---

## 6. 향후 PR-ALG-08 Calibration 활용

- persona pack을 calibration 단계에서 golden reference로 사용
- threshold tuning 시 persona 기대값과의 일치도 모니터링
- adaptation readiness: completion low/high, pain flare/no flare 시나리오 확장

---

## 7. 실행 방법

```powershell
# Analysis 검증 (DB 불필요)
npx tsx scripts/deep-v3-persona-check.mjs

# Session plan 검증 (Supabase 필요, 없으면 SKIP)
npx tsx scripts/session-scenario-check.mjs
```

---

## 8. Backward Compatibility

- fixture/script 추가만. 런타임 로직 변경 없음.
- 기존 deep_v3 scoring, session generator, adaptive 규칙 수정 금지.
