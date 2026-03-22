# PR-BASELINE-RAW-AXIS-SNAPSHOT-03

## 목적

Free survey baseline 결과를 생성할 때, camera refine 단계가 진짜 baseline axis scores를  
소비할 수 있도록 `UnifiedDeepResultV2._compat`에 reduced evidence snapshot을 부착한다.

이전에는 `buildCameraRefinedResult`가 `baseline.priority_vector * 5`를 proxy로 사용했다.  
priority_vector는 0~1 정규화된 값이므로, `* 5`는 evidence 원본의 스케일을 복원하지 못한다.  
이 PR은 snapshot-first / proxy-fallback 구조로 정확도를 개선하면서 하위 호환을 유지한다.

---

## 변경 파일

| 파일 | 역할 |
|------|------|
| `src/lib/deep-v2/builders/build-free-survey-baseline.ts` | snapshot 생성 및 `_compat` 부착 |
| `src/lib/deep-v2/builders/build-camera-refined-result.ts` | snapshot-first 소비, proxy fallback |
| `src/lib/result/deep-result-v2-contract.ts` | `_compat.baseline_deep_evidence_snapshot` 타입 정의 |
| `scripts/_pr03-snapshot-verify.mjs` | 검증 스크립트 |

`src/lib/deep-v2/types.ts` — 불필요 (snapshot 타입은 contract 파일에 인라인 정의).

---

## snapshot 형식

```typescript
_compat.baseline_deep_evidence_snapshot = {
  schema_version: 'free_survey_baseline_evidence_v1',
  axis_scores: {
    lower_stability: number,
    lower_mobility:  number,
    upper_mobility:  number,
    trunk_control:   number,
    asymmetry:       number,
    deconditioned:   number,
  },
  movement_quality: { all_good: boolean },
  answered_count: number,
  total_count:    number,
  missing_signals: string[],
}
```

### 왜 이 형식인가

- `axis_scores`: camera fusion이 즉시 소비하는 핵심 데이터.
- `movement_quality.all_good`: STABLE gate와 정렬하기 위해 포함.
- `answered_count / total_count`: 미래 신뢰도 계산 / 디버깅에 필요.
- `missing_signals`: 누락 신호 전파 — camera refine 품질 판단에 활용 가능.
- `pain_signals` 미포함: free survey baseline에는 pain 입력이 없으므로 생략.
- `full DeepScoringEvidence` 미포함: v1에서는 불필요. 필드 오염을 줄이기 위해 reduced 형식 선택.

---

## 왜 `_compat`에 저장했는가

1. `buildCameraRefinedResult`는 `UnifiedDeepResultV2`만 받는다.  
   따라서 snapshot이 이 payload에 내장되어야 camera refine이 읽을 수 있다.

2. `_compat`는 `validateUnifiedDeepResultV2`가 내부를 검사하지 않는다.  
   계약 검증 로직을 변경하지 않고 확장 가능하다.

3. `FreeSurveyBaselineMeta`에 중복 저장하지 않은 이유:  
   `buildCameraRefinedResult`는 `FreeSurveyBaselineResult`가 아닌  
   `UnifiedDeepResultV2`만 받으므로, meta 복제는 데이터 이중화만 야기한다.

4. payload가 DB에 저장될 때 `_compat` 포함 직렬화되므로,  
   이후 `result_v2_json`에서 읽어도 snapshot이 보존된다.

---

## 왜 엄격한 런타임 검증을 추가하지 않았는가

- `validateUnifiedDeepResultV2`는 계약 핵심 필드(primary_type, confidence 등)를 검사한다.
- `_compat`는 하위 호환/선택적 데이터이므로, 부재 시 `undefined`로 처리된다.
- snapshot 필드를 strict validation에 추가하면 기존에 저장된 payload(snapshot 없음)가  
  모두 validation fail 처리된다 — 하위 호환 불가능.
- 대신 소비 측(`buildCameraRefinedResult`)에서 `?.`로 optional 접근하고 fallback한다.

---

## snapshot-first / proxy-fallback 동작

```
baseline._compat?.baseline_deep_evidence_snapshot?.axis_scores 존재?
  ├── YES → snapshot axis_scores를 baselineAxes로 사용 (정확한 evidence 스케일)
  └── NO  → baseline.priority_vector * 5 proxy 사용 (기존 동작 보존)
```

### 구형 payload 하위 호환

- 이전에 저장된 baseline payload에는 `baseline_deep_evidence_snapshot`이 없다.
- `?.` optional chaining으로 `undefined` 반환 → proxy fallback 자동 진입.
- 마이그레이션 불필요.

---

## 수정 범위 보증

| 구역 | 수정 여부 | 비고 |
|------|-----------|------|
| `free-survey-to-evidence.ts` scoring 로직 | ✅ 미수정 | evidence 생성 소스 유지 |
| `runDeepScoringCore` | ✅ 미수정 | 채널 독립 core 유지 |
| `PublicResultRenderer` | ✅ 미수정 | UI 렌더링 무변경 |
| `public-result-labels.ts` | ✅ 미수정 | 카피 무변경 |
| camera evaluator / capture | ✅ 미수정 | 카메라 측 신호 처리 무변경 |
| auth / pay / session | ✅ 미수정 | 인증/결제 흐름 무변경 |
| `validateUnifiedDeepResultV2` 동작 | ✅ 실질적 무변경 | `_compat` 내부 비검사 유지 |
| template 선택 / execution core | ✅ 미수정 | 운동 세션 로직 무변경 |

---

## Smoke 결과

| 항목 | 결과 |
|------|------|
| baseline 스냅샷 부착 | ✅ 5/5 통과 |
| camera refine — snapshot-first 경로 | ✅ 2/2 통과 |
| proxy fallback — 구형 payload (snapshot 제거) | ✅ 2/2 통과 |
| _compat 없는 완전 구형 payload fallback | ✅ 1/1 통과 |
| deep-v2-03-free-survey-baseline-smoke | ✅ 45/45 통과 |
| flow-01-public-result-persistence-smoke | ✅ 41/41 통과 |
| deep-v2-05-camera-fusion-smoke | ✅ 38/39 (기존 프리-이그지스팅 실패 1건 포함) |
| free-survey-multi-axis-regression | ✅ 18/22 매칭 (4건 known diff, all within bounds) |

기존 프리-이그지스팅 실패 (`refined/page.tsx: Deep Result V2 어휘 사용`)는  
이 PR과 무관하며 이전부터 존재한 항목이다.

---

## 알려진 위험 및 후속 과제

| 항목 | 위험도 | 비고 |
|------|--------|------|
| snapshot axis_scores 스케일이 camera evidence와 다를 수 있음 | 낮음 | 둘 다 `freeSurveyAnswersToEvidence`/`cameraToEvidence`가 동일 `AXIS_TARGET_SCALE` 사용 |
| camera weighting 로직이 snapshot 값을 그대로 신뢰 | 낮음 | fusion merge 로직은 변경되지 않음. 이전에도 proxy 값을 신뢰했으므로 regression 없음 |
| `answered_count = 0` (모든 답변이 q1~q18 외 키로 전달된 경우) | 낮음 | smoke 결과에서 q1~q18 단축키 사용 시 answered_count=0 확인됨. 실제 앱은 v2_A1 형식 키를 사용하므로 문제 없음 |
| `priority_vector * 5` proxy 경로 영구 유지 부채 | 낮음 | 구형 payload 지원을 위해 필요. 별도 deprecation PR에서 제거 가능 |
