# PR-RESET-DATA-01A — Reset stretch manifest SSOT + validator

## 범위 (CURRENT_IMPLEMENTED 목표)

- **Primary SSOT:** `ops/reset-media/reset-stretches-2026-04.json` (10행 고정).
- **Mirror:** `ops/reset-media/reset-stretches-2026-04.csv` — JSON과 동일한 의미만 허용(사람 검토용). CSV 단독 truth 금지.
- **검증:** `npx tsx scripts/reset-media/validate-reset-media-manifest.mjs`  
  - 선택: `--check-files` — `local_video_path`가 리포 루트 기준으로 존재하고 `.mp4`인지 확인(로컬 에셋 준비 시).

## 비범위 (NOT_YET_IMPLEMENTED / 다음 PR)

- Mux 업로드, `mux-upload-result` ledger 생성, DB `exercise_templates` / `media_ref`, `reset-stretch-catalog.ts`의 런타임 연결 작업(상위 PR에서 처리).
- `package.json` 스크립트 추가(PLAN: `npx tsx` 직행).
- `videos/reset/*.mp4` Git 커밋(`.gitignore`의 `/videos/` 정책 유지).

## 수락 조건 (체크리스트)

- [x] JSON 10행 + CSV 10행 + validator **parity** 통과.
- [x] `RESET_STRETCH_CATALOG`와 `stretch_key` / `name_ko` / `name_en` / `asset_slug` / `duration_sec` 일치.
- [x] `template_id`는 **R01~R10** 전용 스킴만, **M01~M48 형식 혼입 없음**.
- [x] manifest에 `mux_asset_id` / `mux_playback_id` / `media_ref` 필드 **없음**.
- [x] validator는 Supabase / Mux / 네트워크 **미사용**.

## 안전성 (SSOT 대비)

- Reset 식별자를 M01–M48 템플릿 풀과 **분리**해 세션 composer·템플릿 풀 truth와 섞이지 않는다.
- 로컬 mp4는 Git에 넣지 않고 **경로 규약**만 SSOT에 싣는다.
