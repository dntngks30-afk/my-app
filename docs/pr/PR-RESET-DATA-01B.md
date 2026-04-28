# PR-RESET-DATA-01B — Mux reset-tab 업로드 + ledger

## 범위

- **스크립트:** `scripts/reset-media/mux-reset-upload.mjs`
- **산출(운영 실행 후):** 기본 `ops/reset-media/reset-stretches-2026-04.mux-upload-result.json`  
  - `ledger_kind: "reset_tab_stretch_mux_v1"` 포함.
- **환경 변수:** `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET` (레저·Git에 **절대** 커밋하지 않음).

## 동작 요약

- PR-01A manifest의 `template_id` + `local_video_path`만 사용(파일명·제목 **이름 매칭 금지**).
- `scripts/template-media/mux-batch-upload.mjs`와 **별도 파일**로 유지해 M01–M48 배치와 회귀 분리.
- 옵션: `--manifest`, `--output`, `--ids`(쉼표 구분 **전체** `template_id`), `--limit`, `--force`, `--poll-ms`, `--timeout-ms`.

## Ledger 커밋 정책 (LOCKED_DIRECTION)

- 업로드 결과 ledger는 **비밀 없이**(`mux_asset_id`, `mux_playback_id` 등) 레포에 커밋할 수 있음.
- `MUX_*` 시크릿 문자열은 ledger에 **넣지 않음**.

## 비범위

- DB attach, `exercise_templates` 시드/수정, `reset-stretch-catalog.ts` 수정.

## 수락 조건

- [ ] 로컬 mp4 준비 후 `mux-reset-upload`가 10행 대해 ledger를 생성·갱신할 수 있음.
- [ ] ledger에 실패 행이 있으면 exit code 비 0(스크립트 기본 동작) → **사람 검수 후** DATA-02 진행.

## 다음 단계

- Ledger **사람 검수·실패 행 처리 완료** 전에는 `apply-reset-media-refresh.mjs` **--apply** 금지 (PLAN 게이트).
