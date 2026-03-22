# PR-FREE-SURVEY-MULTI-AXIS-DECONDITIONED-PATTERN-02

**목적:** 신규 multi-axis free survey path에서 누락된 구 COMPOSITE_SLOTH 의미(확산형 deconditioned) 보강. helper rule 패치만 — 구조/계약/renderer/camera 불변.

---

## Old sloth meaning

`getCompositeTagV2` STEP 4-3 조건:
- `top1 < 68` — 지배적 단일 축 없음
- `52 ≤ avg ≤ 62` — 전체 도메인 점수가 중간대
- `std < 10` — 좁은 분산 (축들이 서로 비슷하게 모여 있음)
- `crab ≥ 55` — 비대칭 신호 존재
- `meerkat ≤ 55` — deconditioned 독립 우세 아님
- (armadillo 배타, `top1 ≥ 55` 전제)

**의미**: 한 축이 압도하지 않고 전체가 중간대에 좁게 퍼진 **확산형 부하** + **비대칭 신호**.  
구 경로에서 sloth도 `deconditioned = 7.0` 강제 → DECONDITIONED gate 통과.

---

## Current gap

PR-01에서 `applyDeconditionedBoostRule`은 **BROAD_CONCERN** (armadillo-like: 4+ 축 ≥ 0.65 + decond ≥ 0.50)만 처리.  
sloth 패턴의 특성:
- maxM < 0.68 → BROAD의 `≥ 0.65` 기준에 못 미침
- 평균 0.52~0.62 중간대 → STABLE(< 0.55 전체)과 BROAD(≥ 0.65 다수) 사이의 **틈새 영역**

결과: PR-01 이후 sloth-like 패턴 → movement 최고축이 primary_type으로 오분류(CORE_CONTROL_DEFICIT 등).

---

## Rule added

**`applyDiffuseDeconditionedRule`** (DIFFUSE_CONCERN — 구 COMPOSITE_SLOTH 대응):

```
movement = [lower_stability, lower_mobility, upper_mobility, trunk_control, asymmetry]
maxM  = max(movement normalized)
avgM  = mean(movement normalized)
stdM  = stdev(movement normalized)

diffuse 조건 (구 sloth threshold → normalized 직접 대응):
  maxM < 0.68          (top1 < 68 대응)
  0.52 ≤ avgM ≤ 0.62  (avg 52~62 대응)
  stdM < 0.10          (std < 10 대응)
  asymmetry_norm ≥ 0.55 (crab ≥ 55 대응)
  decond_norm ≤ 0.55    (meerkat ≤ 55 대응)
  broadAlreadyFired = false

→ deconditioned = 7.0 강제
→ core gate: decond(7.0) ≥ 6 ✓, maxPart ≤ 2.5 ≤ 6 ✓ → DECONDITIONED
```

**BROAD vs DIFFUSE 구분:**

| 구분 | 원형 | 조건 | decond |
|------|------|------|--------|
| BROAD | armadillo-like | 4+ 축 ≥ 0.65 + decond ≥ 0.50 | 7.0 강제 |
| DIFFUSE | sloth-like | maxM < 0.68 + 중간대 좁은 분산 + asymmetry + decond ≤ 0.55 | 7.0 강제 |

**우선순위**: BROAD → DIFFUSE (BROAD 발동 시 DIFFUSE 스킵, 이중 boost 방지).

---

## Why core.ts was not modified

`runDeepScoringCore`의 DECONDITIONED gate: `decond ≥ 6 && maxPart ≤ decond−1`.  
이 조건은 BROAD(기존)와 DIFFUSE(신규) 모두 `decond = 7.0` evidence를 입력하면 자동으로 충족된다.  
input evidence shaping만으로 원하는 분류 결과를 얻을 수 있으므로 core 분기 추가 불필요 — 채널 독립 core의 설계 원칙 유지.

---

## Changes made

| 파일 | 수정 내용 |
|------|---------|
| `src/lib/deep-v2/adapters/free-survey-to-evidence.ts` | DIFFUSE 상수 7개 추가, `applyDiffuseDeconditionedRule` 함수 추가, `buildFreeSurveyDeepEvidence`에 step 4-A/4-B 순서로 연결 |
| `scripts/free-survey-multi-axis-regression.mjs` | `sloth-like-02`(BROAD-caught), `sloth-diffuse-01`(DIFFUSE-direct) 픽스처 추가; KNOWN_DIFFS 갱신 |

---

## Regression results

```
sloth-like-02    : 구 CORE_CONTROL_DEFICIT → 신 DECONDITIONED  (BROAD rule 발동)
sloth-diffuse-01 : 구 CORE_CONTROL_DEFICIT → 신 DECONDITIONED  (DIFFUSE rule 발동)
```

`sloth-diffuse-01` (F1=3,F2=2,F3=2,나머지=2):
- normalized: maxM=0.587 < 0.68 ✓, avgM=0.523 ✓, stdM=0.033 < 0.10 ✓, asymmetry_norm=0.587 ≥ 0.55 ✓, decond_norm=0.50 ≤ 0.55 ✓
- BROAD fires: NO (highCount=0)
- DIFFUSE fires: YES → deconditioned=7.0 → DECONDITIONED

전체: **18/22 일치 (4 known diffs)**, 예상 외 변경 없음.  
`deep-v2-03-free-survey-baseline-smoke.mjs`: **45/45 PASS**.

분포 변화:

| 타입 | 구 | 신(PR-01) | 신(PR-02) |
|------|-----|-----------|-----------|
| STABLE | 6 | 6 | 6 |
| LOWER_INSTABILITY | 2 | 2 | 2 |
| UPPER_IMMOBILITY | 2 | 4 | 4 |
| CORE_CONTROL_DEFICIT | 6 | 4 | **4** |
| DECONDITIONED | 4 | 4 | **6** |

---

## Known risk

- **COMPOSITE_SLOTH 완전 커버**: 구 sloth 조건 `avg 52–62 & std<10`은 정수 응답에서 도달 가능한 창이 좁음. `sloth-diffuse-01`은 이 창에 해당하는 최소 대표 케이스. 엣지케이스 추가는 follow-up.
- **DIFFUSE threshold 튜닝**: 임계값(DIFFUSE_AVG_MIN=0.52, DIFFUSE_AVG_MAX=0.62, DIFFUSE_STD_MAX=0.10 등)은 구 sloth 조건에서 직접 도출됨. 실사용 데이터 기반 재검토는 follow-up 예정.
