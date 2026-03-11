# PR: feat - exercise-level rpe/discomfort → session_exercise_events

## 1. Root-cause 요약

- **문제**: session_exercise_events의 rpe, discomfort가 항상 null로 저장되어 avg_rpe/avg_discomfort 기반 adaptive signal이 동작하지 않음.
- **원인**: exercise_logs에 rpe/discomfort 필드가 없었고, buildSessionExerciseEvents에서 하드코딩 `rpe: null, discomfort: null` 사용.
- **해결**: ExerciseLogItem에 rpe/discomfort 추가, UI에서 수집, complete API → buildSessionExerciseEvents → session_exercise_events로 전달.

## 2. 변경된 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/lib/session/client.ts` | ExerciseLogItem에 rpe?, discomfort? 추가 |
| `src/lib/session/session-exercise-events.ts` | ExerciseLogItem 확장, buildSessionExerciseEvents에서 log.rpe/discomfort 사용 |
| `src/app/api/session/complete/route.ts` | parseAndValidateExerciseLogs에 rpe, discomfort 파싱 추가 |
| `src/app/app/(tabs)/home/_components/reset-map-v2/ExercisePlayerModal.tsx` | RPE(1,3,5,7,10), 불편감(0,2,5,7,10) 퀵 선택 UI |
| `src/app/app/routine/_components/SessionExerciseLogModal.tsx` | 운동별 RPE/불편감 퀵 선택 UI |

## 3. UI 삽입 지점 및 근거

| 경로 | 삽입 지점 | 근거 |
|------|-----------|------|
| **ExercisePlayerModal** | 운동별 완료 시 (세트/횟수/난이도 아래) | 사용자가 이미 머무르는 surface. 탭 1~2회로 입력 가능. |
| **SessionExerciseLogModal** | 운동별 행 내 (난이도 아래) | Routine 탭 일괄 저장 시 동일한 exercise_logs 경로 사용. |

두 경로 모두 completeSession → exercise_logs → buildSessionExerciseEvents → session_exercise_events로 수렴. SSOT 단일.

## 4. Exercise-event payload shape

```ts
// ExerciseLogItem (client → complete API)
{
  templateId: string;
  name: string;
  sets: number | null;
  reps: number | null;
  difficulty: number | null;
  rpe?: number | null;      // 1~10
  discomfort?: number | null; // 0~10
}
```

## 5. Persistence 경로

| 필드 | 저장 위치 |
|------|-----------|
| rpe | session_exercise_events.rpe (INT NULL) |
| discomfort | session_exercise_events.discomfort (INT NULL) |

흐름: complete API → parseAndValidateExerciseLogs → exerciseLogsArray → buildSessionExerciseEvents → writeSessionExerciseEvents.

## 6. 리스크 / 후속 작업

- **리스크**: 낮음. optional 필드 추가, 기존 flow 유지.
- **후속**: session_adaptive_summaries의 avg_rpe, avg_discomfort는 runEvaluatorAndUpsert에서 session_exercise_events 기반으로 계산됨. 이제 non-null 값이 들어오면 adaptive-evaluator가 정상 동작.

## 7. 수동 검증 절차

1. `/app/home` 또는 `/app/routine`에서 current 세션 열기
2. 운동 완료 시 ExercisePlayerModal 또는 SessionExerciseLogModal에서 RPE/불편감 선택 (선택 사항)
3. 세션 완료 → completeSession 호출
4. DB 확인: `session_exercise_events`에서 해당 session_plan_id의 rpe, discomfort 컬럼이 non-null인지 확인
