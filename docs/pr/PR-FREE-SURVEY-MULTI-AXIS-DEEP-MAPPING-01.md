# PR-FREE-SURVEY-MULTI-AXIS-DEEP-MAPPING-01

**목적:** 무료 설문 18문항 해석기를 animal-domain intermediate 중심에서 deep axis 6개 직접 다축 매핑으로 전환.
스코어링 시맨틱 전환 PR — 질문·결과 계약·deep core 불변.

---

## 1. Findings used (ASK 결과 반영)

| 판단 | 반영 내용 |
|------|---------|
| animal-domain → evidence 변환의 단일 매핑 구조는 도메인 간 중복 신호를 포착하지 못함 | 다축 매핑으로 전환 |
| G 그룹은 guarding/tension 성격이 강하므로 deconditioned 과대 유입 경계 필요 | G 그룹 deconditioned share 낮게 설정 (0.10~0.30) |
| MONKEY gate (top1 < 55)를 per-family concern으로 직접 대응 가능 | `applyStableCandidateRule`: 모든 family concern < 0.55 조건 사용 |
| COMPOSITE_ARMADILLO → deconditioned=7.0 강제 효과를 BROAD_CONCERN 규칙으로 대체 | 4+ 축 ≥ 0.65 AND decond ≥ 0.50 시 boost |
| trunk_control은 여러 그룹 기여로 axis_max가 커서 global normalized로 stable 판정 시 오판 | per-family concern 방식으로 stable 검출 |

---

## 2. Changes made

### 수정 파일

| 파일 | 내용 |
|------|------|
| `src/lib/deep-v2/adapters/free-survey-to-evidence.ts` | 핵심 변환 파일 전면 재작성 (신규 active path + 구 경로 회귀 보존) |
| `scripts/free-survey-multi-axis-regression.mjs` | 신규 — 구/신 경로 비교 스크립트 |
| `scripts/deep-v2-03-free-survey-baseline-smoke.mjs` | scoring_version pre-existing 테스트 수정 (`'free_survey_v2_core'` → `'deep_v2'`) |

### 다축 매핑 구조

```
그룹  질문의미           기여 axes
────  ────────────────   ────────────────────────────────────────────────────
A     경추·어깨 전방화    upper_mobility(0.35~0.45), trunk_control(0.55~0.65)
B     가슴 닫힘·흉추 굴곡 upper_mobility(0.55~0.85), trunk_control(0.15~0.45)
C     허리 과부하         lower_stability(0.10~0.20), lower_mobility(0.15~0.30),
                          trunk_control(0.55~0.60), deconditioned(C2: 0.15)
D     무릎·발목 불안정    lower_stability(0.45~0.80), lower_mobility(0.20~0.55)
F     편측 의존·비대칭    lower_stability(0.10~0.15), trunk_control(0.10~0.20),
                          asymmetry(0.65~0.80)
G     전신 긴장·guarding  upper_mobility(0.35~0.55), trunk_control(0.35),
                          deconditioned(0.10~0.30)
```

### 축별 파라미터

```
              AXIS_MAX  TARGET_SCALE  의미
lower_stability  13.08       2.5      구 penguin evidence max와 동일
lower_mobility    8.52       0.5      직접 매핑 도입, 보수적 상한
upper_mobility   22.88       2.5      구 hedgehog evidence max와 동일
trunk_control    27.96       2.5      구 max 3.0에서 보수적 조정
asymmetry        10.48       2.0      구 crab evidence max와 동일
deconditioned     3.48       2.0      구 meerkat evidence max와 동일
```

### 스케일 공식

```
axis_raw[a]   = Σ_q answer[q] * slotWeight[q] * axisShare[q,a]   (미응답 = 2 치환)
normalized[a] = axis_raw_capped[a] / axis_max[a]                 (0~1)
final[a]      = normalized[a] * AXIS_TARGET_SCALE[a]             (core 기대 magnitude)
```

### q1 캡 대체 방식 (applyFamilyCapRules)

- family의 q1 ≤ 2이면 해당 family의 축 기여를 family-max의 75%로 clamp
- 구 코드의 `domain score ≤ 75` 효과를 per-family 레벨로 재현

### stable helper 설계 (applyStableCandidateRule)

- 판정 기준: 모든 6개 family의 per-family concern (= `(q1*1.4 + q2*1.2 + q3*1.0) / 14.4`) < 0.55
- = 구 MONKEY gate "top1 domain score < 55" 와 동일 의미
- 판정 시: movement 축 zeroing, all_good=true, deconditioned 소량 유지 (≤ 3.0)
- per-family 방식 채택 이유: trunk_control은 axis_max=27.96(큼)으로 global normalized로는 C=4 단독에서 0.47 < 0.55 → 오판 가능

### deconditioned helper 설계 (applyDeconditionedBoostRule)

- BROAD_CONCERN 조건: movement 5축 중 4개 이상 normalized ≥ 0.65 AND decond normalized ≥ 0.50
- 발동 시: deconditioned = 7.0 강제 (구 COMPOSITE forced 7.0과 동일)
- G군 보호: G단독 높아도 다른 movement 축이 highCount < 4이면 부스트 미발동
- COMPOSITE_SLOTH 대응(확산 패턴)은 이번 PR 제외 → follow-up 예정

### missing signals 설계 (buildMissingSignalsFromSurveyAnswers)

- 항상: `pain_intensity_missing`, `pain_location_missing`, `objective_movement_test_missing`
- B 전체 미응답: `upper_survey_empty`
- D 전체 미응답: `lower_survey_empty`
- C 전체 미응답: `trunk_survey_empty`
- F 전체 미응답: `asymmetry_survey_empty` (신규)

---

## 3. Final rule

| 항목 | 값 |
|------|-----|
| **public free survey input truth** | `buildFreeSurveyDeepEvidence` (direct multi-axis) |
| **축 점수 최종 스케일** | `normalized[a] * AXIS_TARGET_SCALE[a]`, 최대 2.5 수준 |
| **q1 캡 대체 방식** | per-family q1≤2 → family 기여 75% 상한 |
| **stable helper 동작** | all family concern < 0.55 → movement zeroing + all_good=true |
| **deconditioned helper 동작** | 4+ movement axes ≥ 0.65 + decond ≥ 0.50 → decond=7.0 강제 |
| **missing signals 동작** | 실제 미응답 문항 그룹 기반 (animal-domain 0점 기준 제거) |
| **metadata canonical** | 변경 없음 (`deep_v2`) |
| **camera refine와 관계** | `freeSurveyAnswersToEvidence` → `buildFreeSurveyDeepEvidence` 로 active path 전환. camera refine path (`build-camera-refined-result.ts`)는 `DeepScoringEvidence` 인터페이스만 소비하므로 영향 없음 |
| **animal-domain 구 경로** | `computeDomainScoresAndPatternForRegression` 으로 회귀 비교용 유지 |

---

## 4. Smoke / regression results

### Baseline
- `deep-v2-03-free-survey-baseline-smoke.mjs`: **45/45 PASS**
- STABLE, LOWER_INSTABILITY, UPPER_IMMOBILITY, CORE_CONTROL_DEFICIT, DECONDITIONED 분류 모두 정상

### Camera refine
- `deep-v2-05-camera-fusion-smoke.mjs`: 38/39 (1건 pre-existing 실패 — `refined/page.tsx: PRIMARY_TYPE_LABELS` 체크, 우리 변경과 무관)

### 회귀 비교 (`free-survey-multi-axis-regression.mjs`)
- **18/20 일치** | 변경 2건 — 모두 알려진 의도적 개선

| fixture | 구 결과 | 신 결과 | 비고 |
|---------|---------|---------|------|
| G 강세 (긴장) | CORE_CONTROL_DEFICIT | **UPPER_IMMOBILITY** | G 그룹이 상체 긴장 → 더 의미적으로 정확 |
| G=4, 나머지=2 | CORE_CONTROL_DEFICIT | **UPPER_IMMOBILITY** | 동일 이유 |

### 분포 비교

| 타입 | 구 | 신 |
|------|----|----|
| STABLE | 6 | 6 |
| LOWER_INSTABILITY | 2 | 2 |
| UPPER_IMMOBILITY | 2 | **4** |
| CORE_CONTROL_DEFICIT | 6 | **4** |
| DECONDITIONED | 4 | 4 |

### Parity smoke (구 calculateScoresV2 대비)
- `free-survey-evidence-parity-smoke.mjs`: **4/4 PASS** (회귀 helper 정상)

### 알려진 known risk
- COMPOSITE_SLOTH 패턴(확산형, 구 sloth gate) 대응 규칙 미구현 → follow-up PR 예정
- G 그룹 단독 강세: 구 CORE_CONTROL_DEFICIT → 신 UPPER_IMMOBILITY 행동 변화 (의도적)

---

## NOT in this PR
- PublicResultRenderer 변경
- public-result-labels.ts 변경
- runDeepScoringCore 변경
- camera evaluator / build-camera-refined-result 변경
- auth/pay/session create 변경
- baseline raw axis snapshot 저장
