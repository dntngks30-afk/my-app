# PR-ALG-08: Calibration Rules v1

## 목적

persona/scenario pack을 기준으로 deep_v3 scoring 민감도와 gate를 보정.
구조 변경 없이 가중치·신호·tie-break만 조정.

---

## 1. Calibration 대상 항목

| 항목 | 변경 여부 | 설명 |
|------|---------|------|
| lower_mobility | ✅ 적용 | SLS "발목이 꺾이며" + primary_discomfort 무릎·발목 → ankle mobility proxy |
| priority_vector tie-break | ✅ 적용 | 동점 시 axes 순서로 일관된 우선순위 |
| pain_mode | ❌ 유지 | 기존 threshold 유지 (과민/과소 리스크 없음) |
| stable/deconditioned gate | ❌ 유지 | 기존 gate 유지 |

---

## 2. 변경 전 문제

- **lower_mobility**: 항상 0. LOWER_MOBILITY_RESTRICTION persona가 비어 있음.
- **tie-break**: 동점 시 JavaScript sort가 비결정적. lower_stability vs lower_mobility 등 동일 시 일관성 부족.

---

## 3. 변경 후 의도

### A. lower_mobility 보정

- **신호**: `deep_sls_quality`에 "발목이 꺾이며" 포함 + `deep_basic_primary_discomfort` "무릎·발목"
- **규칙**: SLS "발목 꺾이며" → lower_mobility +2. primary_discomfort 무릎·발목 → lower_mobility +1 (추가)
- **의도**: 발목 가동성 제한(ankle mobility restriction)을 proxy로 반영. lower_stability(흔들림)와 분리.

### B. tie-break 일관성

- **규칙**: 동점 시 `axes` 배열 순서 (lower_stability > lower_mobility > upper_mobility > trunk_control > asymmetry) 우선
- **의도**: 동일 점수 시 항상 같은 primary_type 반환

---

## 4. Persona 기준 기대 효과

| persona | 기대 |
|---------|------|
| lower-mobility-ankle (신규) | LOWER_MOBILITY_RESTRICTION, priority_vector_contains lower_mobility |
| lower-instability-basic | LOWER_INSTABILITY 유지 (tie-break로 lower_stability 우선) |
| 기존 21개 | 모두 유지 (회귀 없음) |

---

## 5. 회귀 리스크

1. **lower_mobility**: SLS "발목 꺾이며" + primary_discomfort 무릎·발목인 기존 LOWER_INSTABILITY persona가 LOWER_MOBILITY_RESTRICTION으로 바뀔 수 있음 → lower-instability-basic은 squat "가끔 흔들림"으로 lower_stability가 더 높아 유지됨.
2. **tie-break**: 동점 시 이전과 다른 축이 선택될 수 있음 → axes 순서로 고정하여 일관성 확보.
3. **golden fixtures**: deep-v3-smoke 40개 통과.

---

## 6. 다음 PR(09)에서 shadow compare로 볼 항목

- pain_mode threshold (none/caution/protected) 민감도
- stable gate: deconditioned <= 2 조건 완화/강화
- deconditioned gate: D >= 6 and maxPart <= D-1 조건
- asymmetry: 보조축 vs 핵심축 역할

---

## 7. 수정 파일

- `src/lib/deep-test/scoring/deep_v3.ts`: lower_mobility 신호, tie-break
- `src/lib/deep-test/scenarios/personas.json`: lower-mobility-ankle persona 추가
