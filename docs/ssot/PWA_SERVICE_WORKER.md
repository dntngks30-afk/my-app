# PWA Service Worker — SSOT

**목적**: SW 생성·등록·업데이트 흐름의 단일 기준(Single Source of Truth) 문서.

---

## 1. SW는 어디서 생성되는가

- **경로**: `next.config.ts`의 `withPWA` 플러그인
- **플러그인**: `@ducanh2912/next-pwa`
- **빌드 시점**: `npm run build` (production) 실행 시
- **출력 파일**:
  - `public/sw.js` — 메인 서비스 워커
  - `public/workbox-*.js` — Workbox 런타임
  - `public/worker-*.js` — 커스텀 worker 코드 (SKIP_WAITING 수신용)
- **dev 환경**: `disable: process.env.NODE_ENV === "development"`로 비활성화 → dev에서 SW 미생성/미등록

---

## 2. 등록은 어디서 하는가

- **자동 등록**: `next-pwa`에 `register: true` 설정 시, 빌드 시 주입되는 스크립트가 `/sw.js`를 등록
- **수동 등록**: `src/lib/push-notifications/client.ts`의 `registerServiceWorker()`로 `/sw.js` 등록 (푸시 구독 시 필요)
- **등록 경로**: `/sw.js` — 단일 경로, 이중 등록 없음

---

## 3. update는 어떻게 감지되는가

- **컴포넌트**: `src/components/shared/PwaUpdateHandler.tsx`
- **위치**: `src/app/layout.tsx`에 마운트됨
- **흐름**:
  1. `navigator.serviceWorker.getRegistration('/')`로 등록된 SW 조회
  2. `registration.waiting` 또는 `updatefound` 이벤트 감지
  3. `registration.waiting.postMessage({ type: 'SKIP_WAITING' })` 전송
  4. `worker/index.ts`에서 `self.skipWaiting()` 호출
  5. `controllerchange` 이벤트 감지
  6. `window.location.reload()`로 새 버전 적용

---

## 4. 수동 수정 금지 파일

- `public/sw.js` — 빌드 산물
- `public/workbox-*.js` — 빌드 산물
- `public/worker-*.js` — 빌드 산물 (worker/index.ts에서 컴파일)

위 파일들은 `.gitignore`에 포함되어 있으며, 소스 수정은 `next.config.ts` 및 `worker/index.ts`에서만 수행.

---

## 5. 관련 파일

| 파일 | 역할 |
|------|------|
| `next.config.ts` | withPWA 설정 (dest, sw, disable, register, workboxOptions) |
| `worker/index.ts` | SKIP_WAITING 메시지 수신 및 skipWaiting 처리 |
| `src/lib/push-notifications/client.ts` | registerServiceWorker (푸시용) |
| `src/components/shared/PwaUpdateHandler.tsx` | 업데이트 감지 및 새로고침 |
