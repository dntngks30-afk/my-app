# PR: UI-Home-01 — Home pivot (remove Day buttons/player entry), route routine via /app/routine

## 변경 요약

### 삭제한 홈 요소
- **Day 1~7 버튼/필** — `DAYS`, `DayPill`, `DaySelectorSkeleton` 완전 제거
- **start-day 호출** — `handleStartClick`, `POST /api/routine-engine/start-day` 제거
- **플레이어 링크** — `/app/routine/player` 링크 및 `handleDayPillClick` 제거
- **MainCta** — 7일 엔진 기반 CTA(리셋 시작, 오늘 완료 등) 제거
- **CountdownTicker** — 휴식 권장 카운트다운 제거

### BottomNav 변경
- 루틴 탭 `href`: `/app/routine/player` → `/app/routine` 고정
- `isTabActive`: `/app/routine` 및 `/app/routine/*` 하위 경로 모두 활성 처리
- `prefetch` 조건 제거(기본값 사용)

### 새로운 홈 UI
- **섹션 1 (여정도)**: 현재 여정도 텍스트 (세션 진행도는 데이터 없음 시 생략)
- **섹션 2 (나의 상태 요약)**: "심층 테스트를 완료하면 맞춤 루틴이 시작됩니다" + 심층 테스트 버튼
- **섹션 3 (CTA)**: "루틴으로 이동" → `/app/routine` 단일 Primary CTA

### 변경 파일
- `src/app/app/home/_components/HomePageClient.tsx` — 전면 재구성
- `src/components/shared/BottomNav.tsx` — 루틴 href 및 active 로직

### 금지 파일 (변경 0)
- `src/app/api/routine-plan/**`
- `src/app/api/routine-engine/**`
- `src/lib/routine-engine.ts`
- `src/app/api/home/**`
- `src/app/api/routine/**`
- `src/app/app/routine/player/**`

---

## Acceptance Tests 결과

| 항목 | 결과 |
|------|------|
| **A1** | `git diff` — 금지 파일 0건 변경 ✓ |
| **A2** | Day1~7 UI, start-day 호출, player 링크 — 모두 제거 ✓ |
| **A3** | BottomNav 루틴 탭 → `/app/routine` 이동 ✓ |
| **A4** | Deep 결과 없을 때 CTA만 표시 ✓ |
| **A5** | `npm run build` 통과 ✓ |

### Network 체크 (수동 확인)
- `/app/home` 진입 시 `/api/routine-engine/start-day` 호출 없음
- `/app/home` 진입 시 `/app/routine/player` prefetch 없음
- 홈에서 `Link`는 `/app/routine`, `/app/deep-test`만 사용

---

## 다음 PR 제안

**UI-01** (`/app/routine` session 연결)을 우선 머지할 것을 제안합니다. Session API가 main에 들어온 뒤 UI-02(complete/recovery)가 의미를 갖기 때문입니다.
