# PR-RESULT-EXPLANATION-COVERAGE-02

## 목적

Public result 설명 레이어에서 실제로 자주 등장하는 `reason_codes` / `missing_signals`에 맞춰 카피와 선택 로직을 보강한다. 표현(`public-result-labels.ts`)만 변경하며 스코어링·빌더·계약·렌더러 레이아웃은 변경하지 않는다.

## 변경 파일 (고정)

- `src/components/public-result/public-result-labels.ts`
- `docs/pr/PR-RESULT-EXPLANATION-COVERAGE-02.md` (본 문서)

## Coverage 추가 요약

### reason_codes

- `pain_protected_mode`, `pain_caution_mode`: `REASON_CODE_LABELS` + `REASON_CODE_INSIGHT_PHRASES` 및 불릿 우선순위 상단에 반영.
- `camera_evidence_partial`, `asymmetry_detected`, `deconditioned_gate`, `stable_gate`: INSIGHT 문구를 다듬거나 유지(이미 있던 항목은 톤만 보강).
- `top_axis_asymmetry` vs `asymmetry_detected`: 1차 축으로서의 비대칭 vs 부가로 잡힌 비대칭을 한 줄에서 구분.

### missing_signals

- `camera_evidence_minimal`: `MISSING_SIGNAL_LABELS`에 등록하고, 짧은 사용자 행 한 줄로 노출(선택 로직에서 우선순위 반영).
- `pickLightMissingHintLine`: 첫 번째 displayable만 보던 방식을 폐기하고, 공개 흐름에 의미 있는 고정 우선순위로 1줄 선택.

### camera_evidence_minimal 결정

- **짧은 안전 문구를 노출**한다. 진단 나열이 아니라 “신호가 매우 제한적이라 설문 비중을 둔다”는 실행·신뢰 톤으로 제한한다.

## 검증

- `pickLightMissingHintLine` / `pickReasonInsightBullets`는 동일 시그니처 유지; `PublicResultRenderer` 수정 없음.
- `core.ts`, `build-free-survey-baseline.ts`, `build-camera-refined-result.ts`, 어댑터, `deep-result-v2-contract.ts` 미수정.

## 남는 리스크·의도적 침묵

- `*_survey_empty`, `*_step_missing` 등은 필터에서 계속 제외되며 사용자 행으로 풀지 않는다.
- 레거시 전용 reason 코드(예: 동물 도메인 어댑터)는 이번 PR에서 문구만 기존 테이블에 유지; canonical public 경로에서 미발생 시 불릿에 안 쓰일 수 있다.
