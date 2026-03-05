# PHASE 1 — ASK MODE FINDINGS (Legacy Route Containment)

## A) 진입점(버튼/라우트/API) 위치

| file:line | 유형 | 현재 값/동작 |
|-----------|------|-------------|
| src/app/app/deep-test/result/_components/DeepTestResultContent.tsx:454 | CTA Link | `href="/app/routine"` — "움직임 리셋 시작하기" 클릭 시 /app/routine 이동 |
| src/app/app/home/error.tsx:45 | CTA Link | `href="/app/routine"` — "루틴으로" fallback |
| src/app/app/routine/player/error.tsx:48 | CTA Link | `href="/app/routine"` — 에러 시 복귀 |
| src/app/app/_components/TodayRoutineCard.tsx:39 | CTA Link | `href="/app/routine/player"` — 오늘 루틴 플레이어 |
| src/app/app/routine/_components/RoutineHubClient.tsx:532 | Auth next | `next=/app/routine` — 로그인 후 리다이렉트 대상 |
| src/app/app/routine/player/page.tsx:254,926 | router | `router.replace('/app/routine')`, `router.push('/app/routine')` — 내부 네비게이션 |
| src/app/app/page.tsx:8 | Root redirect | `/app` → `/app/home` (이미 구현) |

## B) 데이터/상태 흐름

| 입력 | 처리 | 저장/렌더 |
|------|------|----------|
| Deep test 완료 → CTA 클릭 | Link href="/app/routine" | /app/routine 페이지 렌더 (RoutineHubClient) |
| /app/routine 직접 입력 | Next.js 라우팅 | routine/page.tsx → RoutineHubClient |
| /app/routine/player?routineId=&day= | player/page.tsx | params 없으면 router.replace('/app/routine') |
| 북마크/딥링크 | 동일 | 레거시 페이지 노출 |

## C) 관련 endpoint/쿼리

| API/경로 | 용도 |
|----------|------|
| /api/routine/list | 루틴 목록 (RoutineHubClient) |
| /api/workout-routine/* | 루틴 CRUD |
| /api/session/active | 세션 상태 (HomePageClient) |
| DB 변경 없음 | 이번 containment는 라우팅만 |

## D) 현재 가드/조건 — 왜 문제 발생

| 조건 | 현재 상태 |
|------|----------|
| next.config | redirect 없음 — 레거시 경로 그대로 접근 가능 |
| middleware | 없음 |
| AppAuthGate | 인증만 검사, pathname 기반 redirect 없음 |
| navV2 | query `navV2=0` 시 navV1(루틴 탭) 노출 가능 |
| CTA | Deep test 결과에서 /app/routine으로 직접 링크 |

## E) 레거시/중복 구현

| 기능 | SSOT (canonical) | 레거시/중복 |
|------|-------------------|-------------|
| 메인 홈 | /app/home (지도 V2) | /app/routine (루틴 허브) |
| BottomNav | src/app/app/_components/BottomNav.tsx (navV2 기본) | src/components/shared/BottomNav.tsx (navV1 스타일, /app/routine 링크) |
| 플레이어 | /app/home 지도 → SessionPanelV2 → ExercisePlayerModal | /app/routine/player (별도 페이지) |
| 기록/여정 | /app/checkin (navV2 "여정") | — |
| 마이 | /app/profile (navV2 "마이") | — |

**실제 존재하는 레거시 라우트**: /app/routine, /app/routine/player  
**존재하지 않는 라우트** (redirect 추가 시 방어): /app/reset, /app/record, /app/my

---

## PHASE 2 — PLAN

**Canonical**: /app/home (지도 V2). Production에서 navV2 항상 ON.

**변경 파일 (4개)**:
1. `src/app/app/deep-test/result/_components/DeepTestResultContent.tsx` — CTA href /app/routine → /app/home
2. `src/app/app/home/error.tsx` — fallback href /app/routine → /app/home
3. `src/app/app/routine/player/error.tsx` — "홈으로" href /app/routine → /app/home
4. `next.config.ts` — legacy routes 308 redirect → /app/home

**next.config redirect 대상**:
- /app/routine, /app/routine/:path*
- /app/reset, /app/reset/:path*
- /app/record, /app/record/:path*
- /app/my, /app/my/:path*

**Layout guard 생략**: next.config redirect가 1차 차단. 4파일 이내로 유지.
