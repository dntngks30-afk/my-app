# PR-ALG-10: Shadow Analysis v1 / Apply Gate

## 목적

shadow_compare 결과를 집계/분석하고, candidate를 active에 승격할 수 있는지 판단하는 기준을 정의한다.
이번 PR은 threshold를 active에 적용하지 않는다. 분석 도구와 승격 기준만 추가한다.

---

## 1. Shadow 분석 도구

| 스크립트 | 역할 |
|----------|------|
| deep-v3-shadow-report.mjs | persona + golden fixture 기반 shadow_compare 집계, diff 분포, apply gate 권고 |

```powershell
npx tsx scripts/deep-v3-shadow-report.mjs
```

---

## 2. Report 출력 항목

1. **candidate별 총 비교 건수**
2. **diff_flags별 건수** (pain_mode_changed, primary_type_changed 등)
3. **pain_mode direction 분포** (caution -> none, protected -> caution 등)
4. **primary_type / priority_vector changed 비율**
5. **Scenario category별 pain_mode_changed 비율**
   - pain-protected: protected 계열 persona
   - pain-caution: caution 계열
   - low-risk: stable, basic
   - mixed: 기타
6. **추천 상태**: keep_shadow | adjust_candidate | promote_to_active

---

## 3. Apply Gate 기준

### 3.1 pain_mode candidate 승격 금지 조건

| 조건 | 판정 |
|------|------|
| pain-protected category에서 pain_mode_changed 발생 | **keep_shadow** |
| protected -> caution 또는 protected -> none | **keep_shadow** |

### 3.2 caution -> none 비율 구간별 판정 (PR-ALG-11B 보완)

| caution -> none 비율 | 판정 |
|---------------------|------|
| ≤ 15% | **promote_to_active** 검토 가능 |
| > 15% and ≤ 30% | **keep_shadow** |
| > 30% | **adjust_candidate** |

※ pain-protected category 변화 0건이 전제. 위 비율은 해당 전제 충족 시 적용.

### 3.3 기타 보류 조건

| 조건 | 판정 |
|------|------|
| primary_type_changed가 high-risk persona에서 발생 | **adjust_candidate** |

### 3.4 promote_to_active 검토 가능 조건

| 조건 | 판정 |
|------|------|
| pain-protected category 변화 0건 | 전제 |
| caution -> none 비율 ≤ 15% | **promote_to_active** 검토 가능 |
| stable/low-risk persona에서만 주로 변화 | 보조 확인 |

---

## 4. Candidate 상태 분류

| 상태 | 의미 |
|------|------|
| keep_shadow | 승격 금지. shadow로 유지 |
| adjust_candidate | candidate 규칙 조정 후 재분석 필요 |
| promote_to_active | 기준 충족. 후속 PR에서 active 적용 검토 |

---

## 5. pain_mode_relaxed 현재 권고

- **기준**: Report 스크립트 실행 결과 기반
- **자동 promote 없음**: 문서/스크립트만 제공, 코드 변경 없음
- **실행 예시**:
  ```
  caution -> none: 14건 (22.6%)
  pain-protected category 변화: 0건
  권고: keep_shadow
  ```
- **해석**: caution->none 비율이 15%~30% 구간이므로 keep_shadow. 15% 이하로 떨어지면 promote 검토 가능.

---

## 6. PR-ALG-11에서 실제 적용 시

1. Report로 현재 분포 확인
2. Apply gate 기준 충족 여부 검증
3. promote_to_active 권고 시에만 active threshold 변경 PR 진행
