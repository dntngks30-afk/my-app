# PR-RESET-DATA-02 — DB template rows + media_ref attach

## 전제 (LOCKED_DIRECTION)

- PR-01B Mux ledger가 **ready 행으로 검수 완료**된 뒤에만 attach 실행.

## 구현 (CURRENT_IMPLEMENTED)

1. **마이그레이션:** `supabase/migrations/20260429140100_exercise_templates_reset_tab_r01_r10.sql`  
   - `exercise_templates.id` = R01…R10 (TEXT PK), `scoring_version = 'reset_v1'`, `media_ref`는 초기 `NULL`.
2. **카탈로그:** `src/lib/reset/reset-stretch-catalog.ts`의 각 행 `template_id`를 위 id와 1:1 연결.
3. **Attach 스크립트:** `scripts/reset-media/apply-reset-media-refresh.mjs`  
   - 기본 dry-run: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 필요.  
   - `--apply`로 `media_ref` JSONB `{ "provider": "mux", "playback_id": "…" }` 업데이트.  
   - 검증 리포트: 기본 `ops/reset-media/reset-stretches-2026-04.attach-verify.json`.

## 세션 풀 분리 (수락 근거)

- `getTemplatesForSessionPlan` 등은 `scoring_version = 'deep_v2'`만 조회하므로 **reset_v1 템플릿은 일반 세션 풀에 포함되지 않음**.

## 수락 조건

- [ ] 마이그레이션 적용 후 reset 스트레치 10개가 `exercise_templates`에 존재.
- [ ] Ledger 검수 완료본으로 `--apply` 시 `media_ref`가 Mux public `playback_id`와 일치.
- [ ] Reset 흐름에서 `getTemplatesForMediaByIds`가 HLS까지 연결 가능(운영에서 업로드·attach 완료 시).

## 비목표

- 기존 `template-refresh` / M01–M48 ledger 덮어쓰기.
- 카탈로그에 `media_ref`를 직접 넣어 API 우회.
