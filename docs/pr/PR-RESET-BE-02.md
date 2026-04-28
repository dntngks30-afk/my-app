# PR-RESET-BE-02 — Reset Recommendation Engine + API

## 목적

PR-RESET-BE-01 카탈로그를 소비해 리셋 탭용 **추천 ViewModel**과 **`GET /api/reset/recommendations`** 를 제공한다. 순수 추천 로직은 **`src/lib/reset/recommend-reset.ts`** 에 두고, 라우트에서만 인증·readiness 조회를 한다.

## 구현 요약 (CURRENT_IMPLEMENTED 대상)

| 구분 | 내용 |
|------|------|
| 엔진 | `pickDefaultFeaturedIssueKey`, `findFirstIssueMatchingAxis`, `pickFeaturedIssueKey`; `priority_vector[0]`은 **기본 featured 이슈의 `priority_axes`에 없을 때만** 카탈로그 순으로 보정 |
| 라우트 | `getCurrentUserId` → 없으거나 `result_summary` 없으면 폴백 **200**; 예외만 `INTERNAL_ERROR` |
| 클라이언트 | `fetchResetRecommendations()` — 선택적 `Authorization: Bearer`(supabase 세션); 토큰 없으 서버는 userId를 모르므로 폴백 가능(문서 및 client 주석) |
| `meta.unmapped_template_count` | **고유 stretch_key** 기준 `template_id === null` 개수 occurrence 아님. BE-01 전부 null이므로 현재 **10** |
| wrapper | 라우트는 **`return ok(payload)` 단 한 번** — `data` 중첩 금지 |

## 생성·수정 파일

| 파일 | 역할 |
|------|------|
| [src/lib/reset/types.ts](src/lib/reset/types.ts) | ViewModel·`ResetRecommendationPatternInput`·`ResetApiResult` 추가(BE-01 카탈로그 타입 변경 없음) |
| [src/lib/reset/recommend-reset.ts](src/lib/reset/recommend-reset.ts) | 순수 추천·VM 빌드·`meta.unmapped_template_count` |
| [src/app/api/reset/recommendations/route.ts](src/app/api/reset/recommendations/route.ts) | GET, `dynamic`/`runtime` |
| [src/lib/reset/client.ts](src/lib/reset/client.ts) | 브라우저 fetch + `ResetApiResult` |
| [scripts/reset-recommendation-contract-smoke.mjs](scripts/reset-recommendation-contract-smoke.mjs) | 엔진·JSON 계약 스모크 |
| 본 문서 | 검증·수락 조건 |

## `user_pattern.source_stage`

- `result_summary.source_mode === 'baseline'` → `'baseline'`
- `'refined'` → `'refined'`
- 미인증 / `result_summary` 없음 / 폴백 → **`'fallback'`**
- 타입에 `legacy`를 남겨도 **이번 PR에서 값 채우지 않음**(readiness 내부 truth 직해석 안 함).

## 검증 명령

```bash
npx tsx scripts/reset-recommendation-contract-smoke.mjs
```

`package.json` 스크립트 추가 없음.

## 수락 조건 (리뷰)

1. 라우트는 **`ok(recommendationPayload)` 호출 단 한 번** — 이중 `ok`/`data` 래핑 없음.
2. 스모크는 **엔진 중심**이며 HTTP 라우트 전 경로 증명은 필수 아님(1항은 코드 리뷰로 보완 가능).
3. 비포함은 [RESET TAB SSOT](docs/ssot/RESET_TAB_2026_04.md)·기존 PR-BE 보완 PLAN의 Non-goals 준수(미디어 route·UI 연결·migration 금지 등).

## Non-goals

- `POST /api/reset/media`, 재생,Mux `ResetStretchModal`, `ResetTabViewV2` 연결  
- 실제 `template_id`/미디어 매핑、migration、`package.json` 변경  
- `src/lib/reset/index.ts` 배럴비조성  
- BE-01 `reset-*-catalog.ts` 데이터 변경  
- readiness 판정·타입 수정  
- PLAN에 명시된 보호 영역 수정  

## 다음 후보 PR

- PR-RESET-BE-03/`POST /api/reset/media`, 데이터 매핑 PR 등(SSOT 순서 참고).
