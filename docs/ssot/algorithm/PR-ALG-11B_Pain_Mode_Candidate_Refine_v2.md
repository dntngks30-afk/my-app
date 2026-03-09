# PR-ALG-11B: Pain Mode Candidate Refine + Shadow Compare v2

## 목적

- pain_mode_relaxed (v1) candidate는 caution→none 22.6%로 promote_to_active 불가
- active 결과는 유지하고, 더 좁은 candidate v2를 설계해 2차 shadow compare 수행
- apply gate 문서 15~30% 구간 명시적 보완

---

## 1. Apply Gate 문서 보완 (PR-ALG-10)

| caution -> none 비율 | 판정 |
|---------------------|------|
| ≤ 15% | **promote_to_active** 검토 가능 |
| > 15% and ≤ 30% | **keep_shadow** |
| > 30% | **adjust_candidate** |

※ pain-protected category 변화 0건이 전제.

---

## 2. Candidate v2 규칙

### 2.1 pain_mode_relaxed_v2 정의

| 조건 | pain_mode |
|------|-----------|
| maxInt ≥ 3 | protected |
| maxInt ≥ 2 | caution |
| maxInt = 1 AND primary_discomfort "해당 없음" | none |
| maxInt = 1 AND primary_discomfort ≠ "해당 없음" | caution |
| maxInt = 0 | none |

- v1: maxInt=1이면 항상 none
- v2: maxInt=1이더라도 primary_discomfort "해당 없음"인 경우에만 none, 그 외는 active와 동일(caution)

### 2.2 설계 원칙

- **narrower candidate**: v1보다 더 좁은 조건에서만 caution→none 허용
- **low-risk only**: 통증 강도 1 + "해당 없음" = 낮은 통증 + 낮은 위험 신호
- **safety first**: pain-protected / trunk-control-protected / sls-pain-protected 계열은 변화 최소화

---

## 3. Shadow Compare v2 결과

### 3.1 v1 (pain_mode_relaxed)

| 항목 | 값 |
|------|-----|
| total | 62 |
| pain_mode_changed | 14 (22.6%) |
| direction | caution → none 14건 |
| pain-protected 변화 | 0/4 (0%) |
| mixed 변화 | 11/47 (23.4%) |
| **권고** | **keep_shadow** |

### 3.2 v2 (pain_mode_relaxed_v2)

| 항목 | 값 |
|------|-----|
| total | 62 |
| pain_mode_changed | 0 (0.0%) |
| direction | (없음) |
| pain-protected 변화 | 0/4 (0%) |
| **권고** | **promote_to_active** (0% ≤ 15%) |

### 3.3 해석

- v2는 현재 persona+fixture 데이터셋에서 active와 동일한 결과
- maxInt=1 AND primary_discomfort "해당 없음" 조합이 현재 시나리오에 없음
- v2는 설계상 v1보다 좁은 조건에서만 완화 → 향후 해당 케이스 유입 시 안전하게 완화

---

## 4. 실행 방법

```powershell
# v1 리포트
npx tsx scripts/deep-v3-shadow-report.mjs pain_mode_relaxed

# v2 리포트
npx tsx scripts/deep-v3-shadow-report.mjs pain_mode_relaxed_v2
```

---

## 5. 수정 파일

| 파일 | 변경 |
|------|------|
| src/lib/deep-test/scoring/deep_v3.ts | resolvePainModeCandidate에 pain_mode_relaxed_v2 추가 |
| scripts/deep-v3-shadow-report.mjs | candidate 인자 지원 (pain_mode_relaxed \| pain_mode_relaxed_v2) |
| docs/ssot/algorithm/PR-ALG-10_Shadow_Analysis_Apply_Gate.md | 15~30% 구간 keep_shadow 명시 |

---

## 6. 후속 PR 결정

| 옵션 | 조건 |
|------|------|
| promote_to_active | v2를 active에 적용 (현재 데이터셋에서는 no-op, 향후 low-risk 케이스에만 완화) |
| keep_shadow | v2를 shadow로 유지, 추가 데이터 수집 후 재평가 |
| adjust_candidate | v2 조건 추가 조정 (예: trunk breakdown, SLS pain protected 등) |
