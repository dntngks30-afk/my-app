# PR-ALG-15: lower_mobility / stable-deconditioned baseline analysis

## 목적

실제 deep_test_attempts 데이터를 기준으로:
1) lower_mobility 축이 실제로 얼마나 발생하는지
2) lower_stability / trunk_control과 어떻게 겹치는지
3) stable / deconditioned gate가 과다/과소 판정되는지

를 읽을 수 있는 분석 도구와 문서를 만든다.
알고리즘 규칙 변경 없음. 조회/분석/문서만 추가.

---

## 1. 실행 방법

### 1.1 스크립트 (Supabase env 필요)

```powershell
# 기본: 최근 30일, limit 500
npx tsx scripts/deep-v3-lower-mobility-report.mjs

# 옵션
npx tsx scripts/deep-v3-lower-mobility-report.mjs --days 7 --limit 200 --sample 10 --mode gate
```

| 인자 | 기본값 | 설명 |
|------|--------|------|
| --days | 30 | 분석 기간 (일) |
| --limit | 500 | 최대 건수 |
| --sample | 20 | sample row 출력 수 |
| --mode | all | lower_mobility \| gate \| all |

### 1.2 SQL (수동 실행)

```powershell
# sql/deep_v3_lower_mobility_gate_analysis.sql
```

### 1.3 env 없을 때

- 스크립트: SQL 경로 안내 + preview 출력 후 exit 0

---

## 2. 핵심 지표

| 지표 | 설명 |
|------|------|
| total_final | deep_v3 final 건수 |
| stable_rate | primary_type=STABLE 비율 |
| deconditioned_rate | primary_type=DECONDITIONED 비율 |
| lower_mobility_nonzero | priority_vector.lower_mobility > 0 비율 |
| LOWER_MOBILITY_RESTRICTION primary | primary_type 해당 비율 |
| lm_plus_ls_overlap | lower_mobility + lower_stability 동시 발생 |
| lm_plus_tc_overlap | lower_mobility + trunk_control 동시 발생 |

---

## 3. 운영 해석

| 현상 | 해석 |
|------|------|
| lower_mobility non-zero < 1% | 축이 너무 희귀, need_shadow_candidate 검토 |
| stable_rate > 80% | stable gate 과다 완화 가능성 |
| deconditioned_rate > 50% | deconditioned가 mobility/stability 덮어쓰는지 검토 |
| lm + ls/tc overlap 높음 | lower_mobility가 stability/trunk와 혼재 |

---

## 4. 권고 기준

| 조건 | 권고 |
|------|------|
| total < 10 | **collect_more_data** |
| lower_mobility non-zero < 1%, total ≥ 50 | **need_shadow_candidate** |
| stable_rate > 80% | **recalibrate_gate** |
| deconditioned_rate > 50% | **recalibrate_gate** |
| 그 외 | **keep_current** |

---

## 5. 다음 액션

| 권고 | 액션 |
|------|------|
| keep_current | 현재 규칙 유지 |
| need_shadow_candidate | lower_mobility shadow candidate 검토 |
| recalibrate_gate | stable/deconditioned gate 보정 검토 |
| collect_more_data | 추가 데이터 수집 후 재분석 |

---

## 6. 생성 파일

| 파일 | 역할 |
|------|------|
| sql/deep_v3_lower_mobility_gate_analysis.sql | 조회 전용 SQL |
| scripts/deep-v3-lower-mobility-report.mjs | Supabase 기반 집계 스크립트 |
