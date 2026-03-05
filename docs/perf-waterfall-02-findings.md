# PHASE 1 — ASK Findings (병목 위치)

## A) Home 진입 워터폴

### API 호출 목록 (file:line)

| # | API/함수 | 파일:라인 | 타이밍 | 용도 |
|---|----------|-----------|--------|------|
| 1 | `getSessionSafe()` | HomePageClient.tsx:51, 85 | CSR, mount | 토큰 획득 |
| 2 | `GET /api/home/dashboard` | HomePageClient.tsx:57-59 | CSR, Effect1 | loading gate, 403 체크 |
| 3 | `getActiveSession()` → `GET /api/session/active` | HomePageClient.tsx:86 | CSR, Effect2 | progress + activePlan (실제 데이터) |

### 중복/워터폴 분석

- **2개 API 병렬 호출**: dashboard와 session/active가 동시에 실행됨.
- **dashboard 응답 미사용**: dashboard는 7일 루틴(user_routines, workout_routines, routine_completions) 데이터를 반환하지만, 지도(ResetMapV2)는 **session_program_progress + session_plans**만 사용. dashboard 응답은 사용되지 않음.
- **loading gate**: dashboard 완료 시점에 `setLoading(false)`. session/active는 별도로 완료되며, 그 시점에 sessionProgress/activePlan 설정.
- **중복 호출 가능성**: React Strict Mode(dev)에서 useEffect 2회 실행 시, 두 API가 각각 2회 호출될 수 있음. `activeFetchedRef` 같은 가드 없음.

### 결론

- dashboard 호출 제거 가능: AppAuthGate가 이미 plan_status 검증 수행.
- session/active만 사용하고 loading gate를 session/active 완료로 통일.

---

## B) 패널 오픈 워터폴

### 세션 클릭 → 패널 open까지 fetch

| 단계 | fetch | 파일:라인 | 조건 |
|------|-------|-----------|------|
| 1 | 노드 클릭 | ResetMapV2.tsx:31-33 | `setSelectedSessionId(session.id)` |
| 2 | `getSessionPlan(N)` | ResetMapV2.tsx:57-59 | selectedStatus === 'completed' (과거 세션만) |
| 3 | - | - | current 세션: activePlan.plan_json 사용 (이미 로드됨) |

### plan_json 출처

- **current 세션**: `activePlan.plan_json` (getActiveSession 응답에 포함) → 추가 fetch 없음.
- **completed 세션**: `GET /api/session/plan?session_number=N` → ResetMapV2.tsx:57 `getSessionPlan()` 1회 호출.

### media/sign 호출

- 패널 open 시점에는 **media/sign 호출 없음**.
- 사용자가 운동 행의 ▶ 클릭 시 ExercisePlayerModal이 열리면서 그때 media/sign 호출.

---

## C) 모달 오픈 워터폴 (미디어)

### /api/media/sign 호출

| 위치 | 파일:라인 | 시점 | 캐시 |
|------|-----------|------|------|
| ExercisePlayerModal | ExercisePlayerModal.tsx:75 | 모달 open 시 (item 확정 후) | mediaCache (module-level, ExercisePlayerModal 내부) |

### 흐름

1. `mediaCache.get(item.templateId)` 확인 → hit이면 fetch 생략.
2. miss 시 `POST /api/media/sign` body: `{ templateIds: [item.templateId] }` → **운동 1개당 1회 호출**.
3. RoutineHubClient의 payloadCache와 **별개**. Home 지도 경로는 공용 캐시 없음.

### 서버 측 캐시 (api/media/sign/route.ts)

- `payloadCache`: templateId별 60초 TTL.
- `inflightMap`: 동일 templateIds 조합 4초 dedupe.

### 문제

- 패널 open 시 exercises의 templateIds를 한 번에 prefetch하지 않음.
- 모달 open 시마다 개별 sign 호출 → N개 운동 = N회 호출 (캐시 miss 시).

---

## D) 번들/렌더 병목

### Re-render

- **HomePageClient**: sessionProgress, activePlan 변경 시 전체 리렌더. ResetMapV2로 props 전달.
- **ResetMapV2**: selectedSessionId, pastPlanCache 변경 시 리렌더. JourneyMapV2, SessionPanelV2에 전달.
- **JourneyMapV2**: React.memo 없음. 부모 리렌더 시 함께 리렌더. `onNodeTap`은 useCallback으로 고정.
- **SessionPanelV2**: exercises, openItem 등 변경 시 리렌더. PanelInner, ExerciseList 포함.

### map 전체 리렌더

- `total`, `currentSession` 변경 시 JourneyMapV2 리렌더 (sessionProgress 로드 후).
- `selectedSessionId` 변경 시에도 JourneyMapV2 리렌더 (onNodeTap은 동일).

---

## STOP 조건 검토

**동일 API 2회 이상 호출**: 
- dashboard와 session/active는 서로 다른 API.
- session/active는 1회만 호출되는 구조(중복 가드 없음 → Strict Mode에서 2회 가능).
- **승인 완료**: dashboard 제거 + session/active 단일화 + active 캐시 도입 적용.
