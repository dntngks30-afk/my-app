# PR: refactor - verify and strengthen adaptive summary consumption path

## 1. Root-cause 요약

- **질문**: 새로 저장되는 feedback 신호가 adaptive summary에 집계되고, 다음 세션 생성에 반영되는가?
- **검증 결과**:
  - **Path A (session_feedback)**: overall_rpe, pain_after, completion_ratio, difficulty_feedback → loadRecentAdaptiveSignals → deriveAdaptiveModifiers → adaptiveOverlay. **이미 연결됨.**
  - **Path B (session_adaptive_summaries)**: session_exercise_events (rpe, discomfort) → runEvaluatorAndUpsert → session_adaptive_summaries → loadLatestAdaptiveSummary → resolveAdaptiveModifier. **이미 연결됨.**
- **발견된 끊김**: loadLatestAdaptiveSummary가 avg_rpe, avg_discomfort를 select하지 않아 trace에 노출되지 않음. modifier 로직은 dropout_risk_score, discomfort_burden_score를 통해 간접 사용 중.

## 2. Canonical Adaptive Summary SSOT 경로

| 경로 | 생성 | 소비 |
|------|------|------|
| **session_feedback** | complete → saveSessionFeedback | createSession → loadRecentAdaptiveSignals → deriveAdaptiveModifiers |
| **session_adaptive_summaries** | complete → writeSessionExerciseEvents → runEvaluatorAndUpsert | createSession → loadLatestAdaptiveSummary → resolveAdaptiveModifier |

단일 SSOT: 각 경로는 독립. createSession이 둘 다 소비하고 merge.

## 3. 변경된 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/lib/session/adaptive-modifier-resolver.ts` | loadLatestAdaptiveSummary select에 avg_rpe, avg_discomfort 추가 |
| `src/lib/session/adaptive-progression.ts` | AdaptationTrace에 event_based_summary 타입 추가 |
| `src/app/api/session/create/route.ts` | adaptation trace에 event_based_summary 병합 (summary 있을 때) |
| `docs/ssot/ADAPTIVE_SIGNAL_FLOW.md` | Section 10 추가, rpe/discomfort 맵, event_based_summary 문서화 |

## 4. 신호별 반영 상태

| 신호 | 저장 | 집계 | modifier 사용 | trace 노출 |
|------|------|------|---------------|------------|
| overall_rpe | session_feedback | deriveAdaptiveModifiers | hasLowTolerance (≥8) | signal_summary.avg_rpe |
| pain_after | session_feedback | deriveAdaptiveModifiers | hasPainFlare | signal_summary.avg_pain_after |
| completion_ratio | session_feedback | deriveAdaptiveModifiers | hasLowTolerance, hasHighTolerance | signal_summary.avg_completion_ratio |
| difficulty_feedback | session_feedback | deriveAdaptiveModifiers | hasLowTolerance (too_hard) | signal_summary.difficulty_mix |
| avg_rpe (event) | session_adaptive_summaries | evaluateSession | dropout_risk_score (≥8) | event_based_summary.avg_rpe |
| avg_discomfort (event) | session_adaptive_summaries | evaluateSession | discomfort_burden_score, dropout_risk_score | event_based_summary.avg_discomfort |

## 5. 수정한 끊김

- **Before**: loadLatestAdaptiveSummary가 avg_rpe, avg_discomfort를 읽지 않음. generation_trace_json.adaptation에 session_adaptive_summaries 기반 신호 미노출.
- **After**: avg_rpe, avg_discomfort select 추가. event_based_summary를 adaptation trace에 병합하여 "왜 이 세션이 조정되었는지" event 기반으로 확인 가능.

## 6. Before/after 증거

- **Before**: plan-summary API 또는 session_plans.generation_trace_json.adaptation에 event_based_summary 없음.
- **After**: createSession cold path 실행 시 adaptation.event_based_summary에 completion_ratio, avg_rpe, avg_discomfort, dropout_risk_score, discomfort_burden_score, flags 포함.

## 7. 리스크, 롤백, 다음 단계

- **리스크**: 낮음. additive 변경. modifier 로직 변경 없음.
- **롤백**: 해당 커밋 revert.
- **다음 단계**: 실제 세션 완료 → 다음 세션 생성 플로우에서 event_based_summary 값 확인. avg_rpe/avg_discomfort가 null이면 exercise-level 입력이 아직 없음 (pr/exercise-level-rpe-discomfort-v1 머지 후 활성화).
