# PR-PUBLIC-SURVEY-EVIDENCE-DIRECT-07C

**제목:** feat(scoring): direct free-survey → DeepScoringEvidence (remove calculateScoresV2 bridge)  
**전제:** PR-07A (self-test), PR-07B (metadata `deep_v2`) 완료  
**범위:** `free-survey-to-evidence.ts` 입력 어댑터만 — UI/metadata/camera fusion/auth 불변

---

## 1. Findings

### 기존 브리지가 하던 일
- `calculateScoresV2`로 6도메인(동물 라벨) 0~100 점수 산출 + MONKEY/COMPOSITE/BASIC 분기
- 그 점수를 evidence 6축(`lower_stability`, `trunk_control` 등)으로 선형 매핑 + composite 시 `deconditioned=7`

### 새 direct adapter
- **동일 수식**을 `scoring.v2.ts`에서 인라인 (`W1/W2/W3`, `MAX_RAW`, q1≤2 캡)
- **동일 분기**를 `getCompositeTagV2`로 유지 (import만 `composite.rules`, `calculateScoresV2` 미사용)
- `freeSurveyAnswersToEvidence` export 시그니처·`DeepScoringEvidence` 출력 형태 불변

### 예상 분포 변화
- 회귀 스크립트로 `calculateScoresV2` vs `computeDomainScoresAndPattern` 축 점수·`resultType` **일치 확인** (대표 fixture 4종)
- 수치가 같으면 `runDeepScoringCore` 출력도 동일

---

## 2. Changes Made

| 파일 | 역할 |
|------|------|
| `src/lib/deep-v2/adapters/free-survey-to-evidence.ts` | `calculateScoresV2` 제거, `computeDomainScoresAndPattern` 인라인, 회귀용 export 추가 |
| `src/lib/deep-v2/builders/build-free-survey-baseline.ts` | 주석만 (07C 언급) |
| `scripts/free-survey-evidence-parity-smoke.mjs` | 레거시 `calculateScoresV2`와 도메인 점수·타입 parity 검증 |
| `package.json` | `test:free-survey-evidence-parity` 스크립트 |

### baseline / camera / downstream
- `buildFreeSurveyBaselineResult` → 여전히 `freeSurveyAnswersToEvidence` → `runDeepScoringCore` — 변경 없음
- camera refined는 baseline `UnifiedDeepResultV2`만 소비 — 불변

---

## 3. Final Rule

| 항목 | 값 |
|------|-----|
| public baseline input truth | `DeepScoringEvidence` (도메인 점수는 `scoring.v2`와 동일 수식으로 산출, `calculateScoresV2` 호출 없음) |
| metadata canonical | `deep_v2` (07B 유지, 이번 PR에서 변경 없음) |
| old payload | DB `result_v2_json` 불변; 읽기 경로 불변 |
| direct mapping 핵심 축 | penguin→lower_*, hedgehog→upper, kangaroo+turtle→trunk, crab→asymmetry, meerkat→deconditioned; MONKEY/composite/BASIC 분기 동일 |

---

## 4. Smoke

- `npx tsx scripts/free-survey-evidence-parity-smoke.mjs` — **4/4 passed**
- 수동: baseline/refined/claim 경로는 코드 경로상 동일 입력 체인

### Known risk
- `survey/page.tsx`는 여전히 UI용으로 `calculateScoresV2` 사용 (진행 요약 등) — baseline 스코어링 경로와 무관

---

## 5. Non-goals (확인)

- UnifiedDeepResultV2 contract 변경 없음
- PublicResultRenderer / refine-bridge / camera fusion / auth / session template 로직 변경 없음
- metadata 07B 롤백 없음
