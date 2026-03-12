# PR: refactor - strengthen adaptive modifier weighting with clearer trace

## 1. Root-cause 요약

- **질문**: adaptive 신호가 trace에 보이지만 실제 modifier 영향이 충분한가?
- **발견**: resolveAdaptiveModifier에서 discomfort_burden_score가 전달되지만 사용되지 않음. avg_discomfort ≥ 7 (discomfort_burden ≥ 60)인 경우에도 recovery_bias가 dropout_risk_score ≥ 50에만 의존. event-level discomfort만 높고 skip/RPE는 낮은 경우 recovery가 발동하지 않음.
- **해결**: discomfort_burden_score ≥ 60을 recovery_bias 조건에 추가. event-level discomfort만으로도 회복 세션 유도.

## 2. 변경된 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/lib/session/adaptive-modifier-resolver.ts` | recovery_bias = dropout_risk_score >= 50 \|\| discomfort_burden_score >= 60 |
| `src/lib/session/adaptive-progression.ts` | AdaptationTrace.event_based_summary에 trigger_reasons 타입 추가 |
| `src/app/api/session/create/route.ts` | event_based_summary.trigger_reasons 계산 및 병합 |
| `scripts/adaptive-modifier-resolver-smoke.mjs` | resolveAdaptiveModifier 시나리오 테스트 추가 |

## 3. 신호별 modifier 영향도 (after)

| 신호 | 저장 | 집계 | modifier 사용 | trace 노출 |
|------|------|------|---------------|------------|
| overall_rpe | session_feedback | deriveAdaptiveModifiers | hasLowTolerance (≥8) | signal_summary.avg_rpe |
| pain_after | session_feedback | deriveAdaptiveModifiers | hasPainFlare (≥5) | signal_summary.avg_pain_after |
| completion_ratio | session_feedback | deriveAdaptiveModifiers | hasLowTolerance (<0.6), hasHighTolerance (≥0.9) | signal_summary.avg_completion_ratio |
| difficulty_feedback | session_feedback | deriveAdaptiveModifiers | hasLowTolerance (too_hard) | signal_summary.difficulty_mix |
| avg_rpe (event) | session_adaptive_summaries | evaluateSession | dropout_risk_score (≥8) | event_based_summary.avg_rpe |
| avg_discomfort (event) | session_adaptive_summaries | evaluateSession | discomfort_burden_score (≥6→40, ≥7→60, ≥8→80), recovery_bias (≥60) | event_based_summary.avg_discomfort |
| discomfort_burden_score | session_adaptive_summaries | evaluateSession | **recovery_bias (≥60)** ← NEW | event_based_summary.discomfort_burden_score |
| dropout_risk_score | session_adaptive_summaries | evaluateSession | recovery_bias (≥50) | event_based_summary.dropout_risk_score |
| skipped_exercises | session_adaptive_summaries | evaluateSession | complexity_cap (≥2) | event_based_summary (via flags) |

## 4. 이전에 약했던 신호

- **discomfort_burden_score**: resolveAdaptiveModifier에서 읽지 않음. dropout_risk_score에만 포함됨 (discomfort_burden ≥ 60 → dropout_risk +20). 따라서 avg_discomfort 6 (discomfort_burden 40) 또는 avg_discomfort 7 + skip/RPE 0인 경우 recovery_bias가 발동하지 않음.

## 5. Weighting/threshold 변경

| 변경 | Before | After |
|------|--------|-------|
| recovery_bias | dropout_risk_score >= 50 | dropout_risk_score >= 50 \|\| discomfort_burden_score >= 60 |
| trigger_reasons | 없음 | event_based_summary.trigger_reasons (completion_ratio_low, discomfort_burden_high 등) |

## 6. Before/after 시나리오

**시나리오**: avg_discomfort 7.5, avg_rpe 5, skip 0, completion 0.9
- **Before**: discomfort_burden_score = 60, dropout_risk_score = 20 (discomfort만 20). recovery_bias = false (50 미만).
- **After**: discomfort_burden_score ≥ 60 → recovery_bias = true. forceRecovery 유도, mainCount 감소.

## 7. Trace/debug 증거

`generation_trace_json.adaptation.event_based_summary`:
```json
{
  "completion_ratio": 0.85,
  "avg_rpe": 5,
  "avg_discomfort": 7.5,
  "dropout_risk_score": 20,
  "discomfort_burden_score": 60,
  "flags": ["high_discomfort"],
  "trigger_reasons": ["discomfort_burden_high"]
}
```

## 8. 리스크, 롤백, 다음 단계

- **리스크**: 낮음. discomfort_burden_score는 이미 evaluator에서 계산됨. recovery_bias 추가 조건만 확장.
- **롤백**: 해당 커밋 revert.
- **다음 단계**: 실제 세션에서 avg_discomfort 6~8 입력 후 다음 세션 생성 시 recovery_bias/forceRecovery 발동 확인.
