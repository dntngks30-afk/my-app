# Adaptive Signal Flow — Player to Next Session

**SSOT**: 현재 workout player 입력 → session complete → adaptive progression 데이터 흐름의 실제 상태.

**Last updated**: 2025-03 (pr/bridge-player-difficulty-to-adaptive-01)

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

## 7. Minimum-Diff Fix Recommendation

**현재 상황**: Player difficulty는 저장되지만 adaptive에 전혀 연결되지 않음.

**최소 수정 제안** (구현 시 별도 PR):

1. **Option A**: Session complete 시점에 `exercise_logs`의 difficulty를 `exercise_feedback`로 변환:
   - `exercise_logs`에서 `templateId` → `exercise_key`, `difficulty` → `perceived_difficulty` 매핑.
   - `session/complete/route.ts`에서 `feedbackPayload`가 없을 때 `exercise_logs`를 기반으로 `exerciseFeedback` 생성 후 `saveSessionFeedback` 호출.

2. **Option B**: Adaptive에서 `perceived_difficulty`를 사용하도록:
   - `loadRecentAdaptiveSignals`에서 `exercise_feedback.perceived_difficulty` select 추가.
   - `deriveAdaptiveModifiers`에서 `perceived_difficulty`를 사용하도록 로직 추가.

3. **Option C**: Client에서 `feedback` 전송:
   - SessionPanelV2에서 complete 시 `exercise_logs`를 `exerciseFeedback`로 변환해 `feedback`에 포함.

**권장**: Option A — 서버에서 complete 시점에 `exercise_logs` → `exercise_feedback` 브릿지 추가. Client 변경 없음, 기존 history 기록 유지.

---

## 8. Client Path Summary

| Client Path | exercise_logs | feedback |
|-------------|---------------|----------|
| SessionPanelV2 (ResetMapV2/Home) | ✅ Yes | ❌ No |
| SessionRoutinePanel (Routine tab) | ❌ No | ❌ No |
| RoutineHubClient | ✅ Optional | ❌ No |

**결론**: Client는 `feedback`을 전송하지 않음. 서버가 `exercise_logs`에서 `difficulty_feedback`를 파생하여 `session_feedback`에 저장함.
