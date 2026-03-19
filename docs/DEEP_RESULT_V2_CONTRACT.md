# Deep Result V2 Contract

**입력 채널은 여러 개지만 결과 계약은 하나다.**

`evidence_level`과 `source_mode`로 채널 간 정밀도 차이를 표현한다.

---

## 1. 핵심 원칙

| 원칙 | 내용 |
|------|------|
| 단일 계약 | 무료 설문 / 카메라 / 유료 딥테스트 모두 `UnifiedDeepResultV2`를 반환 |
| 채널 분리 | 엔진/알고리즘은 각 채널별로 독립 유지. adapter 레이어만 계약을 정규화 |
| 하위 호환 | 기존 읽기 경로를 깨지 않음. `_compat` 필드에 원본 데이터 보존 |
| 런타임 검증 | `validateUnifiedDeepResultV2()`로 필수 필드 누락 검증 가능 |

---

## 2. 타입 정의

### SSOT 파일 위치

```
src/lib/result/deep-result-v2-contract.ts    ← TypeScript 타입 + 런타임 검증
src/lib/result/adapters/free-survey-adapter.ts
src/lib/result/adapters/camera-adapter.ts
src/lib/result/adapters/paid-deep-adapter.ts
```

### `UnifiedDeepResultV2` 필수 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `primary_type` | `UnifiedPrimaryType` | 1차 움직임 분류 타입 |
| `secondary_type` | `UnifiedPrimaryType \| null` | 2차 보조 타입 |
| `priority_vector` | `Record<string, number> \| null` | 6축 우선순위 벡터 (deep_paid v3만 제공) |
| `pain_mode` | `'none' \| 'caution' \| 'protected' \| null` | 통증/보호 모드 |
| `confidence` | `number [0~1]` | 분류 신뢰도 |
| `evidence_level` | `'lite' \| 'partial' \| 'full'` | 결과 정밀도 레벨 |
| `source_mode` | `'free_survey' \| 'camera' \| 'deep_paid'` | 입력 채널 |
| `missing_signals` | `string[]` | 누락 신호 목록 |
| `reason_codes` | `string[]` | 분류 근거 코드 목록 |
| `summary_copy` | `string` | 사용자 표시용 요약 문구 |

---

## 3. 채널별 정밀도 비교

| 채널 | evidence_level | priority_vector | pain_mode | confidence |
|------|---------------|----------------|-----------|-----------|
| free_survey | lite ~ partial | null | null | 설문 완료율 기반 |
| camera | lite ~ partial | null | null | 촬영 품질 기반 |
| deep_paid v2 | lite ~ partial | null | null | 알고리즘 gap 기반 |
| deep_paid v3 | lite ~ full | 6축 벡터 | none/caution/protected | 알고리즘 gap + calibration |

---

## 4. primary_type 매핑

### free_survey (AnimalAxis → UnifiedPrimaryType)

| Animal | UnifiedPrimaryType | 이유 |
|--------|--------------------|------|
| kangaroo | CORE_CONTROL_DEFICIT | 허리/골반 과부하 |
| hedgehog | UPPER_IMMOBILITY | 상체 가동성 제한(가슴 닫힘) |
| crab | LOWER_INSTABILITY | 좌우 불균형/편측 의존 |
| turtle | CORE_CONTROL_DEFICIT | 상부 전방화(목·어깨 긴장) |
| penguin | LOWER_MOBILITY_RESTRICTION | 발목 가동성 제한 |
| meerkat | CORE_CONTROL_DEFICIT | 전신 과긴장/호흡 잠김 |
| monkey | STABLE | 균형형 |
| armadillo / sloth | DECONDITIONED | 복합 패턴 |

### camera (movementType → UnifiedPrimaryType)

| Camera Type | UnifiedPrimaryType |
|-------------|-------------------|
| kangaroo | CORE_CONTROL_DEFICIT |
| hedgehog | UPPER_IMMOBILITY |
| crab | LOWER_INSTABILITY |
| monkey | STABLE |
| unknown | UNKNOWN |

### deep_paid v2 (result_type → UnifiedPrimaryType)

| result_type | UnifiedPrimaryType |
|-------------|-------------------|
| NECK-SHOULDER | UPPER_IMMOBILITY |
| LUMBO-PELVIS | CORE_CONTROL_DEFICIT |
| UPPER-LIMB | UPPER_IMMOBILITY |
| LOWER-LIMB | LOWER_INSTABILITY |
| DECONDITIONED | DECONDITIONED |
| STABLE | STABLE |

### deep_paid v3 (primary_type → UnifiedPrimaryType)

deep_v3의 `primary_type`과 UnifiedPrimaryType이 동일. direct mapping.

---

## 5. evidence_level 결정 규칙

### free_survey
```
answeredRatio >= 0.9 && confidence >= 0.6 → 'partial'
otherwise → 'lite'
```

### camera
```
resultEvidenceLevel:
  strong_evidence / shallow_evidence → 'partial'
  weak_evidence / insufficient_signal → 'lite'
captureQuality === 'ok' (fallback) → 'partial'
otherwise → 'lite'
```

### deep_paid v2
```
confidence >= 0.7 → 'partial'
otherwise → 'lite'
```

### deep_paid v3
```
confidence >= 0.8 → 'full'
confidence >= 0.6 → 'partial'
otherwise → 'lite'
```

---

## 6. 하위 호환 (`_compat`)

기존 읽기 경로(DeepTestResultContent, movement-test result page)는 변경하지 않는다.
adapter가 `_compat` 필드에 원본 데이터를 보존하므로 기존 소비 코드는 그대로 동작한다.

```typescript
// 기존 paid 읽기 경로 (변경 없음)
const att = result?.attempt;
const derived = att?.scores?.derived;
// → DeepTestResultContent에 기존 props 그대로 전달 가능

// 새 계약 사용 시
const unified = adaptPaidDeepResult(att);
// → unified.primary_type, unified.evidence_level, unified.priority_vector 사용
// → unified._compat.result_type, unified._compat.focus_tags 로 기존 UI 호환 유지
```

---

## 7. Acceptance Test 결과

`scripts/deep-result-v2-contract-smoke.mjs` 실행 결과:

```
[ FREE SURVEY ]
  ✅ kangaroo — 완료 설문
  ✅ monkey   — 균형형

[ CAMERA ]
  ✅ hedgehog — ok quality, strong evidence
  ✅ unknown  — insufficient signal

[ PAID DEEP ]
  ✅ deep_v2 — LOWER-LIMB (confidence 0.78)
  ✅ deep_v3 — LOWER_INSTABILITY (confidence 0.85, priority_vector)

[ ACCEPTANCE CHECKS ]
  ✅ source_mode enum exhaustive — free_survey/camera/deep_paid
  ✅ evidence_level enum exhaustive — full (v3 high confidence)
  ✅ priority_vector non-null for deep_v3
  ✅ priority_vector null for camera / free_survey
  ✅ pain_mode non-null for deep_v3 caution
  ✅ backwards-compat _compat.result_type preserved for paid
  ✅ backwards-compat _compat.movementType preserved for camera

Results: 16 passed, 0 failed
```

---

## 8. 다음 단계 (이번 PR 범위 밖)

- [ ] PR-V2-02: free survey 엔진 교체 (free_survey 결과를 직접 UnifiedDeepResultV2로 생성)
- [ ] PR-V2-03: camera 엔진 교체 (NormalizedCameraResult → UnifiedDeepResultV2 직접 반환)
- [ ] PR-V2-04: paid deep 엔진 교체 (API response를 UnifiedDeepResultV2로 정규화 후 반환)
- [ ] PR-V2-05: result 읽기 경로 단일화 (세 채널 결과를 하나의 렌더 컴포넌트로 통합)
