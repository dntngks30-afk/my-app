# PR-RESET-BE-03 — Reset Media Wrapper API

## 목적

리셋 탭에서 재생에 사용할 **`POST /api/reset/media`** — `issue_key` 또는 `stretch_key`로 스트레치를 해석하고, `template_id`/DB·`buildMediaPayload` 또는 **placeholder 200** 응답을 반환한다. **UI·카탈로그 데이터·`/api/media/sign`·`buildMediaPayload.ts` 수정 없음.**

## 구현 파일

| 경로 | 역할 |
|------|------|
| [src/lib/reset/types.ts](src/lib/reset/types.ts) | ResetMedia 타입 추가만 (BE-01 카탈로그 타입 변경 없음) |
| [reset-stretch-guide.ts](src/lib/reset/reset-stretch-guide.ts) | 10 스트레치 모달 가이드(금지 표현 회피) |
| [reset-media-core.ts](src/lib/reset/reset-media-core.ts) | 검증·해석·플레이스홀더 **순수**(오프라인 스모크 import 대상) |
| [reset-media-fetch.ts](src/lib/reset/reset-media-fetch.ts) | DB `getTemplatesForMediaByIds` + `buildMediaPayload` (서버/route 전용) |
| [reset-media.ts](src/lib/reset/reset-media.ts) | 위 모듈 re-export 번들 |
| [api/reset/media/route.ts](src/app/api/reset/media/route.ts) | `requireActivePlan` · `safeJsonBody` 전부 **`VALIDATION_FAILED` 400** |
| [client.ts](src/lib/reset/client.ts) | `fetchResetMedia` · 레거시 `{ error: string }` + 계약 형태 모두 정규화 |

## 인증 및 recommendations와의 차이

- **`/api/reset/recommendations`**: Bearer 선택, 미인증 **폴백 200 가능**.
- **`/api/reset/media`**: **`requireActivePlan`(유료 활성)** — Bearer 없거나 플랜 비활성 시 **401/403** 레거시 응답 가능. 재생 레이어라 동일 규격을 따르지 않는다.

## 수락 조건

1. POST는 **`requireActivePlan`** 으로 보호된다(recommendations와 달리 미인증 fallback 없음).
2. `template_id`가 카탈로그에서 **null이면 항상 200**, `meta.source === 'placeholder_unmapped'`(에러 금지).
3. 라우트는 **`return ok(payload)` 단 한 번** — 이중 `data` 래핑 없음.
4. JSON 파서 실패·null·비객체·XOR 위반·unknown 키 → **`VALIDATION_FAILED` 400** (스모크 명세와 동일하게 **500 금지**).
5. 기대 가능한 미디어/템플릿 결손 분기는 **`placeholder_*` / `mapped_template`** — **예상 업무 경로에서는 500이 아니다**(예외 catch만 INTERNAL_ERROR).
6. 스모크(`npx tsx scripts/reset-media-contract-smoke.mjs`)는 **`reset-media-core` + 가이드**만 검증하고 **route / Supabase / Mux 직호출 없음**.

## 검증 명령

```bash
npx tsx scripts/reset-media-contract-smoke.mjs
```

(`package.json` 스크립트 추가 없음.)

## Non-goals

기존 PLAN과 동일: 홈/UI·카탈로그 두 파일 수정·`/api/media/sign`·`media-payload`·템플릿 모듈 본편 수정·migration·바렐 `index.ts`·`ResetStretchModal` 연결 금지.
