# PR-RESET-POLISH-01 — Reset 탭 폴리시 (stretch 칩 · poster · duration 60)

## 목적

리셋 탭 상단 카드에서 **primary + 첫 번째 대안 스트레칭** 두 옵션만 노출하고, **재생과 썸네일 프리뷰는 `stretch_key` 단일 XOR**로 호출한다. 카탈로그·매니페스트·DB의 **duration_sec 60**을 맞추고 오프라인 스모크를 현재 SSOT와 정합시킨다.

## 상태 라벨 (SSOT 패턴)

- **CURRENT_IMPLEMENTED (이 PR 적용 후)**: `ResetTabViewV2`에서 stretch 칩, `<img>` poster 프리뷰, Play는 `fetchResetMedia({ stretch_key })`; 카탈로그/manifest/`exercise_templates` R01–R10 duration 60; 스모크 동적 `unmapped`·`duration_label` 검증.
- **LOCKED_DIRECTION**: 단일 XOR(`issue_key` ∥ `stretch_key`), public-result 연속 계약 침범 금지.
- **NOT_YET_IMPLEMENTED**: 이 PR 범위 밖 API 라우트·미디어 파이프라인 재구성 등.

## 수락 조건

- 상단 카드에 **primary + `alternative_stretches[0]`** 두 개 stretch option 칩이 보인다.
- 칩 선택 시 **`selectedStretchKey`**가 해당 `stretch_key`로 바뀐다.
- **Play는 `stretch_key`만** 전달하여 `fetchResetMedia`를 호출한다 (`issue_key` 동시 전송 금지).
- **Preview는 `posterUrl`만 사용**하고 `streamUrl`·`<video>`·autoplay는 쓰지 않는다. 외부 Mux URL은 **`next/image` 대신 일반 `<img>`** 로 표시하여 `next.config` 변경이 필요 없게 한다.
- `posterUrl` 없음·네트워크 실패 등에서 **별도 에러 카드 없이** 기존 RotateCcw/Play 플레이스홀더 유지 가능.
- **모든 reset stretch 카탈로그·manifest JSON·CSV** 의 `duration_sec` 는 60이다.
- recommendation 응답 각 issue 의 **`duration_label` 은 `1분`** 이다 (`durationLabelKo`/primary 기반).
- **Supabase 마이그레이션**은 `scoring_version = 'reset_v1'` 및 **명시 R01~R10 `id` IN 목록**만으로 `duration_sec = 60` 을 멱등 갱신한다 (`id LIKE 'R%'` 금지).
- **`/api/reset/media`** · **media-payload** · **`ResetStretchModal`** 의 재생/비디오 로직은 **수정하지 않는다** (표면 스냅샷 및 탭 레이어만 변경).

## 비목표

- 새 API 라우트, Mux 재업로드, `ResetStretchModal`/HLS 본체 변경, 패키지·글로벌 스타일·`/app/home` 등 보호 영역 변경.

## 운영·검증

- 매니페스트: `npx tsx scripts/reset-media/validate-reset-media-manifest.mjs`
- 스모크: `npx tsx scripts/reset-recommendation-contract-smoke.mjs`, `npx tsx scripts/reset-media-contract-smoke.mjs`

## 참고 파일

| 영역 | 경로 |
|------|------|
| 탭 UI | `src/app/app/_components/nav-v2/ResetTabViewV2.tsx` |
| 카탈로그 | `src/lib/reset/reset-stretch-catalog.ts` |
| 매니페스트 | `ops/reset-media/reset-stretches-2026-04.{json,csv}` |
| 마이그레이션 | `supabase/migrations/*_reset_tab_duration_sec_60.sql` |
