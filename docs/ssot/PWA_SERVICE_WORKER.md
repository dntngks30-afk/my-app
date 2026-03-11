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
  - `public/worker-*.js` — `worker/index.ts`에서 빌드된 커스텀 코드
- **dev 환경**: `disable: process.env.NODE_ENV === "development"` → dev에서 SW 미생성/미등록

---

## 2. 등록은 어디서 하는가

- **유일한 등록 주체**: next-pwa (`register: true`) — 빌드 시 주입되는 스크립트가 `/sw.js` 등록
- **푸시 코드**: `src/lib/push-notifications/client.ts`의 `registerServiceWorker()`는 **등록하지 않음**. `navigator.serviceWorker.getRegistration('/')`로 기존 등록만 조회·재사용
- **등록 경로**: `/sw.js` — 단일 경로, 단일 소유자

---

## 3. update는 어떻게 감지되는가

- **컴포넌트**: `src/components/shared/PwaUpdateHandler.tsx`
- **위치**: `src/app/layout.tsx`에 마운트
- **흐름**:
  1. `navigator.serviceWorker.getRegistration('/')`로 등록 조회
  2. `registration.waiting` 또는 `updatefound` 감지
  3. `registration.waiting.postMessage({ type: 'SKIP_WAITING' })` 전송
  4. `sw.js` 내부의 `self.addEventListener("message", ...)`에서 `self.skipWaiting()` 호출
  5. `controllerchange` 이벤트 → `window.location.reload()` (1회만)

---

## 4. worker/index.ts는 실제 런타임 코드인가

**예.** next-pwa가 `worker/index.ts`를 빌드하여 `public/worker-*.js`로 출력하고, `sw.js`에서 `importScripts("/worker-*.js")`로 로드한다. 또한 SKIP_WAITING 메시지 핸들러가 `sw.js`에 인라인으로 포함된다. 따라서 PwaUpdateHandler가 보낸 SKIP_WAITING은 확실히 처리된다.

---

## 5. 수동 수정 금지 파일

- `public/sw.js` — 빌드 산물
- `public/workbox-*.js` — 빌드 산물
- `public/worker-*.js` — 빌드 산물

위 파일들은 `.gitignore`에 포함. 소스 수정은 `next.config.ts` 및 `worker/index.ts`에서만 수행.

---

## 6. 등록 로직 소유 금지

`src/lib/push-notifications/client.ts`는 `navigator.serviceWorker.register()`를 **호출하지 않는다**. 푸시 구독·조회 시 `getRegistration('/')`만 사용. 새로 등록 로직을 추가하지 말 것.

---

## 7. 관련 파일

| 파일 | 역할 |
|------|------|
| `next.config.ts` | withPWA 설정 (dest, sw, disable, register, workboxOptions) |
| `worker/index.ts` | SKIP_WAITING 수신용 (sw.js에 importScripts + 인라인 핸들러로 반영) |
| `src/lib/push-notifications/client.ts` | 기존 SW 등록 조회 (푸시용), **등록하지 않음** |
| `src/components/shared/PwaUpdateHandler.tsx` | 업데이트 감지 및 새로고침 |
