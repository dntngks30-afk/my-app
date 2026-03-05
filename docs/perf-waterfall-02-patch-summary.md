# PHASE 3 — Patch Summary

## 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/lib/session/active-cache.ts` | **신규** — session/active 5초 TTL 캐시 + inflight dedupe |
| `src/app/app/home/_components/HomePageClient.tsx` | dashboard 제거, getCachedActiveSession 사용, activeFetchedRef, perf mark |
| `src/app/app/home/_components/reset-map-v2/media-cache.ts` | **신규** — 공용 미디어 캐시 + prefetchMediaSign |
| `src/app/app/home/_components/reset-map-v2/ResetMapV2.tsx` | prefetch media on exercises load |
| `src/app/app/home/_components/reset-map-v2/ExercisePlayerModal.tsx` | 공용 media-cache 사용, perf mark |
| `src/app/app/home/_components/reset-map-v2/SessionPanelV2.tsx` | panel_opened perf mark |
| `src/app/app/home/_components/reset-map-v2/JourneyMapV2.tsx` | React.memo 적용 |
| `docs/perf-waterfall-02-findings.md` | **신규** — ASK findings |
| `docs/perf-waterfall-02-plan.md` | **신규** — Plan |

## Metrics (예상)

| 지점 | Before | After |
|------|--------|-------|
| Home 진입 API 호출 수 | 2 (dashboard + session/active) | 1 (session/active만) |
| 탭 왕복 시 active 재요청 | 매번 | 5초 TTL 캐시 hit |
| 패널 open 시 media/sign | 0 (모달 open 시) | 1회 배치 prefetch |
| 모달 open 시 media/sign | 1회/운동 (N개) | 0 (prefetch cache hit) |

## Acceptance Tests

1. **Home 진입**: `home_active_loaded` ms 출력 — console.info 확인
2. **탭 왕복**: active 재요청 없음 — Network 탭에서 /api/session/active 1회만
3. **세션 클릭 → 패널**: `panel_opened` 출력
4. **▶ 모달**: `modal_media_ready` 출력, media/sign 호출 1회(배치) 또는 0(캐시)
5. **기능 회귀**: complete 저장 정상
