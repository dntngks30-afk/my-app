# PR-ALG-12B: Pain Mode Candidate Coverage Expansion + Shadow Compare v3

## 목적

- no-op인 pain_mode_relaxed_v2를 대체해, 일부 low-risk 케이스에는 실제 변화가 생기되 high-risk는 보호되는 중간 candidate를 만든다.
- active 결과는 유지하고 shadow compare만 수행한다.

---

## 1. v1/v2/v3 비교 요약

| candidate | total | pain_mode_changed | caution→none | pain-protected | low-risk 변화 | 권고 |
|-----------|-------|-------------------|---------------|----------------|---------------|------|
| pain_mode_relaxed (v1) | 63 | 15 (23.8%) | 15건 | 0/4 | 2/8 | keep_shadow |
| pain_mode_relaxed_v2 | 63 | 1 (1.6%) | 1건 | 0/4 | 1/8 | promote_to_active |
| pain_mode_relaxed_v3 | 63 | 1 (1.6%) | 1건 | 0/4 | 1/8 | promote_to_active |

---

## 2. Candidate v3 규칙

### 2.1 pain_mode_relaxed_v3 정의

v2와 동일 규칙:

| 조건 | pain_mode |
|------|-----------|
| maxInt ≥ 3 | protected |
| maxInt ≥ 2 | caution |
| maxInt = 1 AND primary_discomfort "해당 없음" | none |
| maxInt = 1 AND primary_discomfort ≠ "해당 없음" | caution |
| maxInt = 0 | none |

### 2.2 설계 원칙

- **narrower than v1**: v1 23.8% → v3 1.6%
- **meaningful unlike v2 (기존)**: fixture 보강으로 v3가 0건이 아님
- **safety first**: pain-protected 0, low-risk에서만 1건 변화

---

## 3. 추가된 fixture/persona

| id | 설명 |
|----|------|
| stable-low-pain | maxInt=1, primary "해당 없음", 품질 양호. shadow v2/v3 완화 검증용 |

- active: pain_mode caution
- v2/v3: pain_mode none (caution→none 1건)

---

## 4. Shadow Compare v3 결과

| 항목 | 값 |
|------|-----|
| total | 63 |
| pain_mode_changed | 1 (1.6%) |
| direction | caution → none 1건 |
| pain-protected 변화 | 0/4 (0%) |
| low-risk 변화 | 1/8 (12.5%) |
| mixed 변화 | 0/47 (0%) |
| **권고** | **promote_to_active** |

---

## 5. 실행 방법

```powershell
# v1 리포트
npx tsx scripts/deep-v3-shadow-report.mjs pain_mode_relaxed

# v2 리포트
npx tsx scripts/deep-v3-shadow-report.mjs pain_mode_relaxed_v2

# v3 리포트
npx tsx scripts/deep-v3-shadow-report.mjs pain_mode_relaxed_v3
```

---

## 6. 수정 파일

| 파일 | 변경 |
|------|------|
| src/lib/deep-test/scoring/deep_v3.ts | v2/v3 candidate 추가, L365 타입 수정 |
| src/lib/deep-test/scenarios/personas.json | stable-low-pain persona 추가 |
| scripts/deep-v3-shadow-report.mjs | v2/v3 candidate 인자 지원 |

---

## 7. 후속 PR 결정

| 옵션 | 조건 |
|------|------|
| promote_to_active | v3를 active에 적용 (1.6% ≤ 15%, low-risk만 완화) |
| keep_shadow | v3를 shadow로 유지, 추가 데이터 수집 후 재평가 |
| adjust_candidate | v3 조건 추가 조정 |
