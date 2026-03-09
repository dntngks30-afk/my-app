# PR-ALG-14: Real DB pain_mode active vs legacy analysis

## 목적

실제 deep_test_attempts 데이터를 기준으로 현재 active pain_mode와 shadow candidate(pain_mode_legacy)의 차이를 집계/분석한다.
알고리즘 규칙 변경 없음. 분석 스크립트/쿼리/문서만 추가.

---

## 1. 실행 방법

### 1.1 스크립트 (Supabase env 필요)

```powershell
# 기본: 최근 30일, limit 500
npx tsx scripts/deep-v3-shadow-db-report.mjs

# 옵션
npx tsx scripts/deep-v3-shadow-db-report.mjs --days 7 --limit 200 --sample 10
```

| 인자 | 기본값 | 설명 |
|------|--------|------|
| --days | 30 | 분석 기간 (일) |
| --limit | 500 | 최대 비교 건수 |
| --sample | 20 | sample row 출력 수 |
| --candidate | pain_mode_legacy | shadow candidate 필터 |

### 1.2 SQL (수동 실행)

```powershell
# Supabase SQL Editor 또는 psql
# sql/deep_v3_pain_mode_shadow_analysis.sql
```

- `interval '30 days'`, `LIMIT 500` 등은 쿼리 내에서 수정

### 1.3 env 없을 때

- 스크립트: SQL 경로 안내 + preview 출력 후 exit 0
- 쿼리/스크립트 구조만 확인 가능

---

## 2. 핵심 지표

| 지표 | 설명 |
|------|------|
| total_compared | shadow_compare 있는 final 건수 |
| pain_mode_changed | diff_flags에 pain_mode_changed 포함 건수 |
| changed_rate_pct | pain_mode_changed / total * 100 |
| direction | active_pain_mode -> shadow_pain_mode 분포 |
| protected_to_caution | protected -> caution (high-risk) 건수 |

---

## 3. Direction 해석

| direction | 의미 |
|-----------|------|
| none -> caution | active=none, legacy=caution (low-risk 완화: maxInt=1+해당없음 → active가 none) |
| caution -> none | active=caution, legacy=none (역방향, legacy가 더 완화) |
| protected -> caution | **위험** active가 완화됨 |
| caution -> protected | active가 더 보수적 |

---

## 4. 권고 기준

| 조건 | 권고 |
|------|------|
| protected_to_caution > 0 | **recalibrate** |
| changed_rate > 30% | **monitor_more** |
| changed_rate ≤ 15%, total ≥ 10 | **keep_active** |
| total < 10 | 데이터 부족, 추가 수집 후 재분석 |

---

## 5. 다음 액션

| 권고 | 액션 |
|------|------|
| keep_active | 현재 active 유지 |
| monitor_more | 주기적 재분석, 비율 추이 확인 |
| recalibrate | pain_mode 규칙 재검토, PR-ALG-15 등 |

---

## 6. 생성 파일

| 파일 | 역할 |
|------|------|
| sql/deep_v3_pain_mode_shadow_analysis.sql | 조회 전용 SQL |
| scripts/deep-v3-shadow-db-report.mjs | Supabase 기반 집계 스크립트 |
