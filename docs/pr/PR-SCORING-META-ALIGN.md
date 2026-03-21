# PR-SCORING-META-ALIGN

**제목:** feat(scoring): align public scoring metadata to canonical deep family  
**범위:** metadata alignment only — scoring algorithm, result shape, auth/pay/execution 무변경  
**상태:** IMPLEMENTED  
**전제:** PR-PUBLIC-SELFTEST-REMOVE-07A (07A) 완료 상태

---

## 1. Findings

### 1-1. Metadata 필드 인벤토리

| 위치 | 필드 | 변경 전 | 변경 후 | 구분 |
|------|------|---------|---------|------|
| `UnifiedDeepResultV2._compat.scoring_version` (baseline) | `_compat.scoring_version` | `'free_survey_v2_core'` | `'deep_v2'` | canonical truth field |
| `UnifiedDeepResultV2._compat.scoring_version` (refined) | `_compat.scoring_version` | `'camera_fusion_v2'` | `'deep_v2'` | canonical truth field |
| `FreeSurveyBaselineMeta.scoring_version` | type literal + runtime | `'free_survey_v2_core'` | `'deep_v2'` | type + runtime |
| `CameraRefinedResult.refined_meta.scoring_version` | type literal + runtime | `'camera_fusion_v2'` | `'deep_v2'` | type + runtime |
| `baseline/page.tsx` DB recovery path | hardcoded string | `'free_survey_v2_core'` | `'deep_v2'` | page state fix |

### 1-2. Canonical vs Compat 구분

| 구분 | 값 | 위치 |
|------|-----|------|
| **canonical** | `'deep_v2'` | 모든 public result `_compat.scoring_version`, `baseline_meta.scoring_version`, `refined_meta.scoring_version` |
| **canonical** | `'deep_v3'` | 유료 딥테스트(`/api/deep-test/finalize`) 전용 |
| **legacy compat** | `'free_survey_v2_core'` | DB에 이미 저장된 구 payload에만 존재; 새 payload에는 사용하지 않음 |
| **legacy compat** | `'camera_fusion_v2'` | DB에 이미 저장된 구 payload에만 존재; 새 payload에는 사용하지 않음 |
| **legacy compat** | `'free_v2'`, `'camera_v1'` | `result/adapters/` 구 어댑터 전용; public 메인 경로 아님 |

### 1-3. Legacy stamp 생성 지점 (변경 전)

1. `src/lib/deep-v2/builders/build-free-survey-baseline.ts` (2곳): `_compat.scoring_version`, `baseline_meta.scoring_version`
2. `src/lib/deep-v2/builders/build-camera-refined-result.ts` (2곳): `_compat.scoring_version`, `refined_meta.scoring_version`  
3. `src/app/movement-test/baseline/page.tsx` (1곳): DB recovery 경로 hardcode

### 1-4. Downstream risk point 분석

| 경로 | 위험 여부 | 상태 |
|------|-----------|------|
| `buildSessionDeepSummaryFromPublicResult.ts` | **기존부터 방어됨** — `rawScoringVersion !== 'deep_v3'` → `'deep_v2'` normalize | 안전 (강화 주석 추가) |
| `getTemplatesForSessionPlan` | **기존부터 방어됨** — `deep_v3` → `'deep_v2'`로 normaliz, 그 외 → `'deep_v2'` | 안전 |
| `getFilteredExerciseTemplates` | `filter.scoringVersion ?? 'deep_v2'` 기본값 | 안전 |
| DB 저장 (`createPublicResult`) | `result_v2_json` 그대로 저장 → `_compat.scoring_version`이 deep_v2로 저장됨 | ✅ 정렬됨 |
| DB read (`getPublicResult`, `getLatestClaimedPublicResultForUser`) | raw payload 그대로 반환 → normalization은 consumer에서 | 안전 |

### 1-5. 핵심 확인: empty-plan 재발 경로

SSOT §3-7의 empty-plan 이슈 핵심:  
`_compat.scoring_version` 값이 template pool 조회 키(`scoring_version` 컬럼)로 **그대로 들어갈 때** 발생.

현재 방어 경로:
```
public result._compat.scoring_version  
  → buildSessionDeepSummaryFromPublicResult.ts  
    (rawScoringVersion === 'deep_v3' ? 'deep_v3' : 'deep_v2')  
  → session create route → getTemplatesForSessionPlan  
    (scoringVersion === 'deep_v3' ? 'deep_v2' : scoringVersion ?? 'deep_v2')
```

**결론:** 두 단계 normalization이 이미 있어 `free_survey_v2_core`/`camera_fusion_v2`가 
template pool 조회로 새지 않았다. 이번 PR은 그 방어를 더 명시적으로 문서화하고,
새 payload에서 canonical 값을 직접 씀으로써 구조적 재발 가능성을 줄인다.

---

## 2. Files Changed

| 파일 | 역할 | 변경 내용 |
|------|------|-----------|
| `src/lib/deep-v2/types.ts` | `FreeSurveyBaselineMeta` 타입 정의 | `scoring_version` 타입 리터럴 `'free_survey_v2_core'` → `'deep_v2'` |
| `src/lib/deep-v2/builders/build-free-survey-baseline.ts` | baseline 결과 생성 | `_compat.scoring_version`, `baseline_meta.scoring_version` → `'deep_v2'` |
| `src/lib/deep-v2/builders/build-camera-refined-result.ts` | camera refined 결과 생성 | `CameraRefinedResult` 타입 + `_compat.scoring_version`, `refined_meta.scoring_version` → `'deep_v2'` |
| `src/app/movement-test/baseline/page.tsx` | baseline 결과 페이지 DB recovery | hardcoded `'free_survey_v2_core'` → `'deep_v2'` |
| `src/lib/deep-result/buildSessionDeepSummaryFromPublicResult.ts` | session create 어댑터 | normalization 주석 명시적 강화 (알려진 legacy stamp 목록 + 규칙 문서화) |

### Canonicalization 레이어

**전략: builder 단계 canonicalization + downstream 방어 명시적 문서화**

- **새 결과 생성 시:** builder에서 `'deep_v2'`로 직접 씀 (strategy 1)
- **old persisted payload 읽을 때:** `buildSessionDeepSummaryFromPublicResult`의 normalization guard가 자동 처리 (strategy 3 — 이미 구현됨, 주석으로 강화)
- **downstream hard guard:** `buildSessionDeepSummaryFromPublicResult` + `getTemplatesForSessionPlan` 이중 방어 (strategy 4 — 이미 구현됨, 명시적 문서화)

**왜 builder 단계가 가장 안전한가:**
- persistence/write 단계에서 변환하면 builder 출력과 저장값이 달라져 디버깅이 어려움
- read/normalize 단계만 사용하면 새 결과에도 legacy stamp가 계속 쌓임
- builder 단계 fix → 새 결과는 처음부터 canonical, old payload는 기존 normalize guard 처리

---

## 3. Final Canonical Metadata Rule

| 항목 | 값 |
|------|-----|
| **baseline canonical scoring family** | `'deep_v2'` |
| **refined (camera fusion) canonical scoring family** | `'deep_v2'` |
| **compat/historical legacy stamp 보존 여부** | DB에 저장된 구 payload의 `_compat.scoring_version`은 그대로 보존됨 (schema 변경 없음). 새 payload는 `'deep_v2'` |
| **downstream normalization rule** | `rawScoringVersion === 'deep_v3' ? 'deep_v3' : 'deep_v2'` — `free_survey_v2_core`, `camera_fusion_v2`, `free_v2`, `camera_v1`, undefined 모두 `'deep_v2'`로 normalize |

---

## 4. Why This Is Safe

### 알고리즘 변경이 아닌 이유
- `runDeepScoringCore`, `freeSurveyAnswersToEvidence`, `calculateScoresV2`, `buildCameraRefinedResult`의 scoring 계산 로직은 한 줄도 바뀌지 않았다.
- `primary_type`, `secondary_type`, `confidence`, `evidence_level`, `priority_vector` 등 결과 필드값은 동일하다.
- `_compat.scoring_version` 필드 값만 바뀌며, 이 값은 scoring output이 아니라 식별 메타데이터다.

### Backward compatible한 이유
- DB에 이미 저장된 구 payload(`free_survey_v2_core`, `camera_fusion_v2`)는 schema 변경 없이 그대로 남는다.
- 구 payload를 읽을 때 `buildSessionDeepSummaryFromPublicResult`가 `deep_v2`로 normalize하므로 동작은 동일하다.
- `UnifiedDeepResultV2._compat.scoring_version`은 `string?` 타입이므로 validate 로직과 무관하다.

### Empty-plan 재발 방지에 도움이 되는 이유
- 새 payload에서 `free_survey_v2_core`/`camera_fusion_v2`가 더 이상 생성되지 않는다.
- 구 payload도 이미 normalize guard가 있으므로 template pool 조회에서 알 수 없는 값이 들어갈 수 없다.
- 두 단계 방어가 이제 canonical source와 정렬되어 있다.

---

## 5. Smoke Results (예상 / 수동 검증 필요)

| 시나리오 | 상태 |
|----------|------|
| survey 완료 → baseline 결과 렌더 | 알고리즘 무변경, 렌더 정상 예상 |
| camera refine → refined 결과 렌더 | 알고리즘 무변경, 렌더 정상 예상 |
| baseline/refined 결과 저장 후 새로고침 (DB recovery) | `scoring_version: 'deep_v2'` 로 복구됨 |
| old payload (`free_survey_v2_core` 저장된 DB row) claim → session create | normalization guard가 `'deep_v2'`로 변환, template 조회 성공 |
| session create 흐름 | `buildSessionDeepSummaryFromPublicResult`에서 `scoring_version = 'deep_v2'` 출력 |

### Known risks / 남은 과제
- DB에 이미 저장된 구 payload는 그대로 남음 — 정상 (normalize 처리됨)
- `result/adapters/free-survey-adapter.ts`의 `'free_v2'` 스탬프 정리 — 별도 PR (이 파일은 공개 메인 경로에서 사용되지 않음)
- `calculateScoresV2` 의존 제거(direct DeepEvidence adapter) — PR-07C 범위, 이번 PR 아님

---

## 6. Non-goals

- survey scoring algorithm 변경 없음
- `freeSurveyAnswersToEvidence` 내부 `calculateScoresV2` bridge 제거 없음
- `UnifiedDeepResultV2` contract shape 변경 없음
- `PublicResultRenderer` UI 변경 없음
- auth / pay / onboarding / readiness / session-create 계약 변경 없음
- self-test 관련 cleanup (PR-07A에서 완료됨)
- DB 마이그레이션 없음 (schema 변경 불필요)
