# PHASE 2 — Plan (최소 변경)

## 1) Home 초기 로드

- **dashboard 제거**: `/api/home/dashboard` 호출 삭제.
- **session/active 단일화**: `getActiveSession`만 사용. loading = session/active 완료 시점.
- **module-level 캐시**: session/active 응답을 5~10초 TTL로 캐시. 탭 왕복 시 즉시 렌더.

## 2) 과거 세션 plan_json

- **현행 유지**: 클릭 시 `getSessionPlan` 1회 호출 (PR3 endpoint). 변경 없음.

## 3) media/sign 배치 prefetch

- **패널 open 시**: exercises의 templateIds를 모아 `POST /api/media/sign` 1회 배치 호출.
- **공용 캐시**: ExercisePlayerModal의 mediaCache를 공유 모듈로 분리. prefetch 결과를 동일 캐시에 저장.
- **모달**: 캐시 hit 우선, miss 시에만 호출.

## 4) 캐시

- **active 캐시**: `lib/session/active-cache.ts` (또는 client.ts 내) — userId+token 기반 짧은 TTL.
- **media 캐시**: `reset-map-v2/media-cache.ts` — templateId → MediaPayload. prefetch + 모달에서 사용.

## 5) 측정 (Instrumentation)

- `performance.mark` + `console.info`:
  - `home_active_loaded`: session/active 완료 시점 (ms)
  - `panel_opened`: 패널 exercises 렌더 완료 시점
  - `modal_media_ready`: 모달 media 로드 완료 시점
