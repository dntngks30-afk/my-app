# 7일 루틴 회귀 원인 규명 보고서

**작성일**: 2026-03-06  
**목적**: main 머지 이후 "7일 루틴으로 회귀" 현상 원인 규명

---

## 1. DIFF 분석 요약

### 1.1 `e0f8b57` — fix(nav): remove navV2 query and lock V2

| 파일 | 변경 내용 |
|------|----------|
| **HomePageClient.tsx** | `navV2 = searchParams.get('navV2') !== '0'` → `navV2 = process.env.NODE_ENV === 'production' ? true : (searchParams.get('navV2') !== '0')` |
| **BottomNav.tsx** | prod에서 `setNavV2(true)` 강제, `href`에서 `?navV2=1` 제거 |
| **middleware.ts** | 신규: `/app/*`에서 `navV2` 쿼리 제거 → canonical URL |

**판단**: 레거시 회귀 방지 목적의 정상 변경. 7일 루틴 회귀 직접 원인 아님.

---

### 1.2 `8b8527a` — feat(session): paywall, past session read-only, daily cap

| 파일 | 변경 내용 |
|------|----------|
| **ResetMapV2.tsx** | `currentSession` → `effectiveCurrentSession` (daily cap 시 `null`), `todayCompleted`/`nextUnlockAt` 추가, 과거 세션 `getSessionPlan` |
| **JourneyMapV2.tsx** | `currentSession: number \| null` 지원, `pathBoundary = currentSession ?? completed` |
| **HomePageClient.tsx** | `todayCompleted`, `nextUnlockAt` state 추가, ResetMapV2에 전달 |

**핵심 변경**:
```ts
// ResetMapV2.tsx
const isLockedNext = !!(todayCompleted && !activePlan)
const effectiveCurrentSession = isLockedNext ? null : nextSessionNum
```

- `todayCompleted && !activePlan`일 때 `effectiveCurrentSession = null`
- 이때 헤더 "현재 세션"에 `—` 표시
- 지도: `pathBoundary = completed`로 완료 경로만 표시, current 노드 없음

**판단**: daily cap 로직 추가. `effectiveCurrentSession = null` 시 UI가 다소 어색해 보일 수 있으나, "7일" 표시와는 무관.

---

### 1.3 `504c960` — fix(session): compute phase by total_sessions

| 파일 | 변경 내용 |
|------|----------|
| **session/complete/route.ts** | `getTheme(sessionNumber)` → `getThemeForSession(totalSessions, sessionNumber)` (computePhase 사용) |

**판단**: phase 계산만 변경. total_sessions는 8/12/16/20으로 유지. 7일 회귀와 직접 관련 없음.

---

### 1.4 `d3b54a7` — fix(map): render by total_sessions

| 파일 | 변경 내용 |
|------|----------|
| **JourneyMapV2.tsx** | `visibleSessions = sessions.filter(s => s.id <= safeTotal)`, `safeTotal = Math.min(20, total ?? 20)` |

**핵심**: `total`에 따라 표시 노드 수 결정.
- `total = 8` → 8개 노드
- `total = 7` → **7개 노드** (7일 루틴처럼 보일 수 있음)

---

## 2. total_sessions = 7 가능 경로

`session/active` 및 `session_program_progress` 흐름:

```
FREQUENCY_TO_TOTAL: 2→8, 3→12, 4→16, 5→20
DEFAULT_TOTAL_SESSIONS = 16
```

- `target_frequency` 2,3,4,5 → 8,12,16,20
- `target_frequency` 1 또는 미등록 → 16
- **코드상 total_sessions = 7이 되는 경로는 없음**

**가능한 예외**:
1. DB에 `session_program_progress.total_sessions = 7`인 레거시 데이터 존재
2. Path B 도입 전 `workout_routine` 연동 시 잘못된 값이 저장된 경우

---

## 3. 7일 루틴으로 보이는 경로 정리

### 경로 A: `/my-routine` 페이지 접근

| 진입점 | 파일 | 설명 |
|--------|------|------|
| Stripe 결제 성공 | StripeSuccessClient.tsx:325, 380 | "운동 루틴 시작하기" → `/my-routine` |
| 일일 알림 | daily-workout-sender.ts | 링크: `/my-routine` |
| Retest 비교 | RetestComparisonClient.tsx:126, 405 | `router.push('/my-routine')` |

이 경로들로 들어오면 항상 7일 루틴 화면으로 이동.

### 경로 B: 지도에서 7개 노드만 표시

| 조건 | 결과 |
|------|------|
| `sessionProgress?.total_sessions === 7` | `visibleSessions`가 7개 → 7일 루틴처럼 보임 |
| `session/active` 실패 → `sessionProgress = null` | `total = 8` (fallback) → 8개 노드 |

---

## 4. 결론 및 권장 조치

### 4.1 최우선 원인

**진입점이 7일 루틴으로 고정**: 결제 성공, 알림, Retest 비교 등이 모두 `/my-routine`으로 연결됨.

### 4.2 권장 조치

1. **진입점 수정**: `/my-routine` → `/app/home` (세션 지도)로 변경
   - `StripeSuccessClient.tsx`
   - `daily-workout-sender.ts`
   - `RetestComparisonClient.tsx`

2. **DB 점검**: `session_program_progress`에서 `total_sessions = 7`인 row 검색
   ```sql
   SELECT user_id, total_sessions, completed_sessions
   FROM session_program_progress
   WHERE total_sessions = 7;
   ```
   - 존재 시: 8/12/16/20 중 적절한 값으로 마이그레이션

3. **방어 로직**: `total_sessions`가 7이면 8로 보정
   ```ts
   // HomePageClient.tsx 또는 session/active
   const safeTotal = [8, 12, 16, 20].includes(total) ? total : 8;
   ```

### 4.3 최근 머지 커밋과의 관계

- `e0f8b57`, `8b8527a`, `504c960`은 7일 루틴 회귀의 **직접 원인으로 보이지 않음**.
- `8b8527a`의 daily cap 로직으로 `effectiveCurrentSession = null`이 되는 경우가 많아지면, "현재 세션 없음" 체감이 더 커질 수 있음.
- 실제 회귀는 **진입점이 7일 루틴으로 고정**된 점과 **DB/레거시 데이터** 가능성이 더 큼.
