# PR-ALG-13A: Promote pain_mode relaxed low-risk candidate to active

## 목적

- shadow candidate (v2/v3)가 승격 조건 충족: changed 1.6%, pain-protected 0, low-risk 1건만 변화
- 해당 candidate를 active pain_mode 규칙으로 승격
- 이전 active는 shadow compare 대상으로 유지

---

## 1. Active pain_mode 규칙 변경

### 1.1 승격 전 (legacy)

| 조건 | pain_mode |
|------|-----------|
| maxInt ≥ 3 | protected |
| maxInt ≥ 1 | caution |
| maxInt = 0 | none |

### 1.2 승격 후 (active)

| 조건 | pain_mode |
|------|-----------|
| maxInt ≥ 3 | protected |
| maxInt ≥ 2 | caution |
| maxInt = 1 AND primary_discomfort "해당 없음" | none |
| maxInt = 1 AND primary_discomfort ≠ "해당 없음" | caution |
| maxInt = 0 | none |

---

## 2. Old active shadow 유지 방식

| 항목 | 값 |
|------|-----|
| shadow candidate | pain_mode_legacy |
| shadow rule | 이전 active (caution at 1+) |
| shadow_compare | active vs pain_mode_legacy |

- finalize 시 shadow_compare에 active (new) vs shadow (legacy) diff 저장
- report: `npx tsx scripts/deep-v3-shadow-report.mjs`

---

## 3. 수정 파일

| 파일 | 변경 |
|------|------|
| src/lib/deep-test/scoring/deep_v3.ts | resolvePainMode → low-risk 규칙, resolvePainModeCandidate → pain_mode_legacy, L369 타입 수정 |
| src/app/api/deep-test/finalize/route.ts | shadow candidate pain_mode_legacy |
| scripts/deep-v3-shadow-compare.mjs | pain_mode_legacy |
| scripts/deep-v3-shadow-report.mjs | pain_mode_legacy |

---

## 4. PR-ALG-12B 병합 시

- stable-low-pain persona가 있으면 expected_analysis.pain_mode를 "caution" → "none"으로 변경
