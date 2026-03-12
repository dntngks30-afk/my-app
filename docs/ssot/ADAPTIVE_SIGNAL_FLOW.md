# Adaptive Signal Flow — Player to Next Session

**SSOT**: 현재 workout player 입력 → session complete → adaptive progression 데이터 흐름의 실제 상태.

**Last updated**: 2025-03 (pr/adaptive-modifier-weighting-v1)

---

## 1. Player Input Signals (현재 존재하는 것)

| Signal | Input Source | File:Line | Captured? |
|--------|--------------|-----------|-----------|
| **sets** | ExercisePlayerModal | `ExercisePlayerModal.tsx:43` | ✅ Yes |
| **reps** | ExercisePlayerModal | `ExercisePlayerModal.tsx:44` | ✅ Yes |
| **difficulty** | ExercisePlayerModal | `ExercisePlayerModal.tsx:45` | ✅ Yes (1–5, "체감 난이도") |
| **pain / discomfort** | — | — | ❌ No UI |
| **skip / replace** | — | — | ❌ No UI |
| **overall RPE** | — | — | ❌ No UI |
| **pain after** | — | — | ❌ No UI |
| **completion ratio** | — | — | ❌ No (completion_mode만 있음) |

**Evidence**: `src/app/app/(tabs)/home/_components/reset-map-v2/ExercisePlayerModal.tsx` lines 43–45, 127–136.

---

## 2. End-to-End Signal Map Table

| Signal | Input Source | Request Field | DB Table/Column | Adaptive Used? | History Used? |
|--------|--------------|---------------|-----------------|----------------|---------------|
| sets | ExercisePlayerModal | `exercise_logs[].sets` | `session_plans.exercise_logs` (JSON) | ❌ No | ✅ Yes |
| reps | ExercisePlayerModal | `exercise_logs[].reps` | `session_plans.exercise_logs` (JSON) | ❌ No | ✅ Yes |
| difficulty (1–5) | ExercisePlayerModal | `exercise_logs[].difficulty` | `session_plans.exercise_logs` (JSON) + **derived** → `session_feedback.difficulty_feedback` | ✅ Yes (via bridge) | ✅ Yes |
| overall RPE | — | `feedback.sessionFeedback.overallRpe` | `session_feedback.overall_rpe` | ✅ Yes (if present) | — |
| pain after | — | `feedback.sessionFeedback.painAfter` | `session_feedback.pain_after` | ✅ Yes (if present) | — |
| difficulty_feedback | — | `feedback.sessionFeedback.difficultyFeedback` | `session_feedback.difficulty_feedback` | ✅ Yes (if present) | — |
| completion ratio | — | `feedback.sessionFeedback.completionRatio` | `session_feedback.completion_ratio` | ✅ Yes (if present) | — |
| pain_delta | — | `feedback.exerciseFeedback[].painDelta` | `exercise_feedback.pain_delta` | ✅ Yes (if present) | — |
| skipped | — | `feedback.exerciseFeedback[].skipped` | `exercise_feedback.skipped` | ✅ Yes (if present) | — |
| was_replaced | — | `feedback.exerciseFeedback[].wasReplaced` | `exercise_feedback.was_replaced` | ✅ Yes (if present) | — |
| perceived_difficulty | — | `feedback.exerciseFeedback[].perceivedDifficulty` | `exercise_feedback.perceived_difficulty` | ❌ Not read by adaptive | — |
| **rpe** (exercise-level) | ExercisePlayerModal, SessionExerciseLogModal | `exercise_logs[].rpe` | `session_exercise_events.rpe` → `session_adaptive_summaries.avg_rpe` | ✅ Yes (via evaluator → modifier) | — |
| **discomfort** (exercise-level) | ExercisePlayerModal, SessionExerciseLogModal | `exercise_logs[].discomfort` | `session_exercise_events.discomfort` → `session_adaptive_summaries.avg_discomfort` | ✅ Yes (via evaluator → modifier) | — |

---

## 3. What Is Definitely History-Only

- **exercise_logs** (sets, reps, difficulty): `session_plans.exercise_logs`에만 저장됨.
- **adaptive**: `session_feedback`, `exercise_feedback`만 읽음. `exercise_logs`는 사용하지 않음.

**Evidence**:
- `src/lib/session/adaptive-progression.ts` lines 82–94: `session_feedback`, `exercise_feedback`만 select.
- `session_plans.exercise_logs`는 `loadRecentAdaptiveSignals`에서 사용되지 않음.

---

## 4. What Is Definitely Adaptive-Used (when populated)

- `session_feedback`: `overall_rpe`, `pain_after`, `difficulty_feedback`, `completion_ratio`
- `exercise_feedback`: `pain_delta`, `was_replaced`, `skipped`

**Evidence**: `src/lib/session/adaptive-progression.ts` lines 82–94, 186–228.

- `perceived_difficulty`는 `exercise_feedback` 스키마에 있으나, `loadRecentAdaptiveSignals`에서 select하지 않음.

---

## 5. Is Player Difficulty Adaptive-Effective Right Now?

**Yes — via server-side bridge (pr/bridge-player-difficulty-to-adaptive-01).**

- Player difficulty (1–5)는 `exercise_logs[].difficulty`로 전송됨.
- `exercise_logs`는 `session_plans.exercise_logs`에 저장됨 (history).
- **Bridge**: `/api/session/complete`에서 explicit feedback이 없을 때, `exercise_logs`의 difficulty 평균을 `session_feedback.difficulty_feedback`로 파생하여 저장.
- Adaptive는 `session_feedback.difficulty_feedback`를 읽음 (`deriveAdaptiveModifiers` → `hasLowTolerance` when `too_hard`).

---

## 6. Exact Code File Evidence

| Conclusion | File | Lines |
|------------|------|-------|
| Player captures difficulty | `ExercisePlayerModal.tsx` | 45, 127–136, 256–277 |
| SessionPanelV2 sends exercise_logs only | `SessionPanelV2.tsx` | 171–176 |
| No feedback sent by clients | `SessionPanelV2.tsx`, `SessionRoutinePanel.tsx`, `RoutineHubClient.tsx` | 171–176, 512–516, 429–435 |
| **Bridge: derive from exercise_logs** | `session/complete/route.ts` | `deriveDifficultyFeedbackFromExerciseLogs`, `ensureFeedbackWithDerivedDifficulty` |
| Complete API persists derived feedback | `session/complete/route.ts` | 296–304 (saveSessionFeedback) |
| Exercise_logs stored in session_plans | `session/complete/route.ts` | 241, 246 |
| Adaptive reads session_feedback.difficulty_feedback | `adaptive-progression.ts` | 228 (`too_hard` → hasLowTolerance) |

---

## 7. Adaptive Trace (pr/adaptive-trace-and-explanation-01)

**Storage**: `session_plans.generation_trace_json.adaptation`

**Trace shape** (실제 코드 필드):

```json
{
  "reason": "pain_flare" | "low_tolerance" | "high_tolerance" | "none",
  "source_sessions": [1, 2],
  "applied_modifiers": {
    "target_level_delta": -1 | 0 | 1,
    "force_short": true,
    "force_recovery": true,
    "avoid_exercise_keys": ["key1"],
    "max_difficulty_cap": "low" | "medium" | "high"
  },
  "signal_summary": {
    "avg_rpe": "number | null",
    "avg_pain_after": "number | null",
    "avg_completion_ratio": "number | null",
    "skip_count": 0,
    "replace_count": 0,
    "difficulty_mix": { "too_easy": 0, "ok": 1, "too_hard": 0 }
  },
  "reason_summary": "이전 수행 난이도를 반영해 강도를 소폭 조정했어요",
  "pain_mode": "none" | "caution" | "protected",
  "priority_vector_keys": ["key1"],
  "event_based_summary": {
    "completion_ratio": 0.85,
    "avg_rpe": 6.5,
    "avg_discomfort": 4,
    "dropout_risk_score": 0,
    "discomfort_burden_score": 0,
    "flags": [],
    "trigger_reasons": []
  }
}
```

**Evidence**: `src/lib/session/adaptive-progression.ts` lines 297–361 (`buildAdaptationTrace`).

**Adaptive modifiers produced** (deriveAdaptiveModifiers output):

| Reason | targetLevelDelta | forceShort | forceRecovery | avoidExerciseKeys | maxDifficultyCap |
|--------|------------------|------------|---------------|-------------------|------------------|
| pain_flare | -1 | true | true | problemKeys | low/medium (protected/caution) |
| low_tolerance | -1 | true | false | problemKeys | low/medium (protected/caution) |
| high_tolerance | 1 | false | false | [] | — |
| none | 0 | — | — | [] | — |

---

## 8. User-Facing Explanation

**Where**: `SessionPanelV2` rationale box (세션 패널 내부).

**When**: `reason !== 'none'`일 때만 `adaptation_summary` 한 줄 표시.

**Source**:
- Create success: `toSummaryPlan(plan, adaptationTrace)` → `plan_json.meta.adaptation_summary`
- Plan-summary API: `generation_trace_json.adaptation.reason_summary` → `adaptation_summary`

**Text strings** (REASON_SUMMARY):

| reason | reason_summary |
|--------|----------------|
| pain_flare | 최근 통증/부담 기록을 반영해 회복 중심으로 조정했어요 |
| low_tolerance | 이전 수행 난이도를 반영해 강도를 소폭 조정했어요 |
| high_tolerance | 이전 수행이 원활해 강도를 소폭 올렸어요 |
| none | (표시 안 함) |

**Evidence**: `src/app/app/(tabs)/home/_components/reset-map-v2/SessionPanelV2.tsx` (`getPlanRationale`), `plan-summary/route.ts` lines 136–146.

---

## 9. Client Path Summary

| Client Path | exercise_logs | feedback |
|-------------|---------------|----------|
| SessionPanelV2 (ResetMapV2/Home) | ✅ Yes | ❌ No |
| SessionRoutinePanel (Routine tab) | ❌ No | ❌ No |
| RoutineHubClient | ✅ Optional | ❌ No |

**결론**: SessionPanelV2, RoutineHubClient는 SessionFeedbackQuickForm으로 feedback 전송 가능. 서버가 `exercise_logs`에서 `difficulty_feedback`를 파생하여 `session_feedback`에 저장함.

---

## 10. Adaptive Summary Consumption Path (pr/adaptive-summary-consumption-verify)

**SSOT**: session_adaptive_summaries 생성/소비 경로.

### 생성 경로
1. `complete` API → `writeSessionExerciseEvents` (session_exercise_events)
2. `runEvaluatorAndUpsert` → session_exercise_events 읽기 → evaluateSession → session_adaptive_summaries upsert

**입력**: session_exercise_events (rpe, discomfort, completed, skipped, actual_reps, prescribed_reps)

**출력**: session_adaptive_summaries (completion_ratio, avg_rpe, avg_discomfort, dropout_risk_score, discomfort_burden_score, flags)

### 소비 경로
1. `createSession` → `loadLatestAdaptiveSummary` (session_adaptive_summaries 최신 1건)
2. `resolveAdaptiveModifier` → volume_modifier (completion_ratio), complexity_cap (skipped_exercises), recovery_bias (dropout_risk_score)
3. adaptiveOverlay에 merge → buildSessionPlanJson

### Trace 가시성
- `generation_trace_json.adaptation.event_based_summary`: session_adaptive_summaries 기반 avg_rpe, avg_discomfort, completion_ratio, dropout_risk_score, discomfort_burden_score, flags
- `signal_summary`: session_feedback 기반 (overall_rpe, pain_after, completion_ratio, difficulty_mix)

### 신호별 반영 상태
| 신호 | 저장 | 집계 | modifier 사용 | trace 노출 |
|------|------|------|---------------|------------|
| overall_rpe | session_feedback | deriveAdaptiveModifiers | hasLowTolerance (≥8) | signal_summary.avg_rpe |
| pain_after | session_feedback | deriveAdaptiveModifiers | hasPainFlare | signal_summary.avg_pain_after |
| completion_ratio | session_feedback | deriveAdaptiveModifiers | hasLowTolerance, hasHighTolerance | signal_summary.avg_completion_ratio |
| difficulty_feedback | session_feedback | deriveAdaptiveModifiers | hasLowTolerance (too_hard) | signal_summary.difficulty_mix |
| avg_rpe (event) | session_adaptive_summaries | evaluateSession | dropout_risk_score (≥8) | event_based_summary.avg_rpe |
| avg_discomfort (event) | session_adaptive_summaries | evaluateSession | discomfort_burden_score (≥60→recovery_bias), dropout_risk_score | event_based_summary.avg_discomfort |
| discomfort_burden_score | session_adaptive_summaries | evaluateSession | **recovery_bias (≥60)** | event_based_summary.discomfort_burden_score |
