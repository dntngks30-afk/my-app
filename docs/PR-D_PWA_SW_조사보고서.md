# PR-D: PWA/SW 정리 조사 보고서

## 확인 결과 요약

| 항목 | 상태 |
|------|------|
| next.config.ts `withPWA` | **미적용** – 래핑 없음 |
| package.json `@ducanh2912/next-pwa` | **존재** (^10.2.9) |
| public/sw.js | **존재** (171KB, precache + workbox 번들) |
| public/workbox-f1770938.js | **존재** (workbox v7.0.0 번들) |
| SW 로드 출처 | `src/lib/push-notifications/client.ts`에서 `registerServiceWorker()`로 `/sw.js` 등록 |
| PWA 업데이트 감지 | `PwaUpdateHandler.tsx`에서 `SKIP_WAITING`/`controllerchange` 처리 |

## 상세 내용

### 1. PWA 플러그인 미연결

`next.config.ts`는 `withPWA`를 사용하지 않습니다. `@ducanh2912/next-pwa`가 설정에 연결되어 있지 않아 빌드 시 SW가 자동 생성되지 않습니다.

### 2. SW 사용 여부

- **사용 중**: `registerServiceWorker()`가 `/sw.js`를 등록하고, `PwaUpdateHandler`가 업데이트 감지 및 새로고침을 담당합니다.
- precache 항목: `_buildManifest.js`, `_ssgManifest.js` 등 포함 (build ID: `boyIuBjRhJjpWA9ArsgbJ`)
- `public/sw.js`는 과거 설정에서 생성되었거나 수동 관리되는 것으로 보입니다.

### 3. 매칭 여부

- `workbox-f1770938.js`는 `sw.js`에서 `define(["./workbox-f1770938"], ...)` 형태로 로드됩니다.
- precache의 build ID(`boyIuBjRhJjpWA9ArsgbJ`)가 현재 Next.js 빌드 ID와 일치하는지는 빌드 시점에 따라 달라집니다.

### 4. 잠재 이슈

- `withPWA` 미사용으로 인해 빌드마다 SW가 갱신되지 않음.
- 오래된 precache 매니페스트가 적용되면 캐시/버전 불일치 가능성이 있음.

---

## 옵션 (사용자 결정 필요)

| 옵션 | 설명 | 작업 |
|------|------|------|
| **A** | PWA를 유지·강화 | next.config에 `withPWA` 적용 → 빌드 시마다 SW 생성, 캐시 전략 정의 |
| **B** | PWA 비활성화 | `public/sw.js`, `workbox-f1770938.js` 제거, `registerServiceWorker()` 호출 제거 또는 조건부 로드 |
| **C** | 보류 | PWA 유지, 현재 구조로 사용 (필요 시 추후 A 또는 B 적용) |

**권장**: 푸시 알림과 업데이트 감지가 사용 중이므로 **옵션 A**를 추천합니다. `withPWA` 설정 후 빌드 산물과 precache를 정리하면 안정성이 향상됩니다.
