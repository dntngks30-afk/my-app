# PR-TEMPLATE-MEDIA-ATTACH-01

## 목적

PR-B에서 생성한 Mux upload ledger를 입력으로 사용해, `public.exercise_templates`의 M01~M48에 대해 `media_ref = { provider: 'mux', playback_id }` 를 **template_id 기준으로 일괄 attach** 한다.

이번 PR의 본질은 업로드가 아니라 **DB media_ref cutover** 다. 업로드 자체는 이미 끝났고, 이번 단계에서 비로소 앱 템플릿이 새 Mux 영상과 연결된다.

## 상위 truth

- PR-A manifest: `ops/template-media/template-refresh-2026-04.json`
- PR-B ledger: `ops/template-media/template-refresh-2026-04.mux-upload-result.json`
- `media_ref` schema contract: `provider='mux'` + `playback_id` 필수
- template name truth는 PR-A manifest 기준이며, 이번 PR에서 이름 truth는 변경하지 않는다.

## 왜 PR-C를 별도 분리하는가

1. PR-B upload와 DB attach를 분리해야 partial failure 복구가 쉽다.
2. 업로드 성공 검수 후 attach 해야 현재 사용자 앱의 cutover 시점을 통제할 수 있다.
3. attach는 DB write를 포함하므로, upload 단계보다 더 보수적으로 dry-run / apply / verify 를 나눠야 한다.

따라서 PR-C는 **ledger read -> validate -> DB media_ref attach -> verify report only** 로 제한한다.

## 변경 파일 (예정 범위 고정)

- `docs/pr/PR-TEMPLATE-MEDIA-ATTACH-01.md` (본 문서)
- `scripts/template-media/apply-template-media-refresh.mjs`
- `package.json` (실행 스크립트 1개 추가가 실제로 필요할 때만)

## 런타임 생성 산출물 (커밋 대상 아님)

- 기본 verify 출력 경로: `ops/template-media/template-refresh-2026-04.attach-verify.json`

이 파일은 attach 실행/검증 결과물이며, 구현 PR에서 정적 fixture처럼 커밋하지 않는다.

## 입력 계약

기본 입력 파일:

- manifest: `ops/template-media/template-refresh-2026-04.json`
- upload ledger: `ops/template-media/template-refresh-2026-04.mux-upload-result.json`

### 입력 검증

스크립트는 attach 전에 반드시 다음을 검증해야 한다.

- manifest에 M01~M48 전체 존재
- ledger에 M01~M48 전체 존재
- ledger에 `failed` row 없음
- 각 row에 `mux_playback_id` 존재
- 중복 `template_id` 없음
- 중복 `mux_playback_id` 없음
- manifest의 `template_id` / `final_name_ko` 와 ledger의 `template_id` / `manifest_name_snapshot` 이 충돌하지 않음

입력 검증 실패 시 DB write 전에 중단해야 한다.

## attach 대상 / 값

대상 테이블:

- `public.exercise_templates`

attach 값:

```json
{ "provider": "mux", "playback_id": "<mux_playback_id>" }
```

중요:

- 이번 PR에서는 `media_ref`만 수정한다.
- `name`, `level`, `focus_tags`, `contraindications`, `equipment`, `duration_sec`, `template_version`, `scoring_version`, `is_fallback`, `is_active` 등은 수정하지 않는다.
- `thumb`, `start`, `end` 는 이번 PR에서 쓰지 않는다.

## 구현 원칙

1. **ID가 진실이다.** 이름 기준 attach 금지.
2. dry-run 과 apply 를 분리한다.
3. DB write 전 검증 실패 시 절대 attach 하지 않는다.
4. rerun 가능해야 한다. 이미 원하는 `media_ref`가 붙어 있으면 no-op/unchanged 로 처리할 수 있어야 한다.
5. attach 후 verify report 를 남겨 PR-D 전까지의 cutover truth 로 사용한다.

## 권장 CLI 인터페이스

예시:

```bash
node scripts/template-media/apply-template-media-refresh.mjs \
  --manifest ops/template-media/template-refresh-2026-04.json \
  --ledger ops/template-media/template-refresh-2026-04.mux-upload-result.json \
  --verify-output ops/template-media/template-refresh-2026-04.attach-verify.json \
  --dry-run
```

권장 옵션:

- `--manifest <path>`
- `--ledger <path>`
- `--verify-output <path>`
- `--ids M01,M02,...` (부분 attach / 샘플 검증)
- `--limit <n>`
- `--dry-run`
- `--apply`
- `--force` (기존 media_ref가 있어도 overwrite 허용이 꼭 필요할 때만)

기본 정책:

- 기본값은 `--dry-run`
- 실제 DB write 는 `--apply` 일 때만 수행

## DB 접근 전제

- 서버용 Supabase admin/service-role 환경을 사용한다.
- Next admin API를 경유하지 않고, script에서 직접 DB update 해도 된다.
- 단, 가능하면 repo의 기존 Supabase 환경변수 체계를 따른다.

## verify 출력 계약

verify JSON 최소 필드:

- `template_id`
- `expected_playback_id`
- `before_media_ref`
- `after_media_ref`
- `status` (`updated` | `unchanged` | `failed` | `skipped`)
- `error_message`
- `verified_at`

권장 추가 필드:

- `expected_name`
- `db_name`
- `manifest_name_snapshot`

핵심:

- attach 후 M01~M48 각각이 어떤 playback_id로 붙었는지 추적 가능해야 한다.
- PR-D legacy delete 전 최종 cutover truth 로 쓸 수 있어야 한다.

## 실패 처리

다음 상황은 attach 전에 전체 중단 또는 개별 실패로 명확히 나뉘어야 한다.

### 전체 중단

- manifest/ledger 구조 깨짐
- `failed` row 존재
- `mux_playback_id` 누락
- duplicate playback id 발견
- DB 인증/연결 불가

### 개별 row 실패

- 특정 template_id row를 찾지 못함
- update 실패
- update 후 재조회 시 `media_ref` 불일치

개별 row 실패가 있더라도 verify report 는 남겨야 한다.

## 검증

### 필수 검증

- dry-run 에서 48개 attach plan 생성
- subset attach(`--ids M01,M02` 또는 `--limit 2`) 1회 성공
- 전체 apply 후 M01~M48의 `media_ref.provider='mux'`
- 전체 apply 후 M01~M48의 `media_ref.playback_id` 가 ledger와 일치
- rerun 시 unchanged/no-op 동작 가능

### 의도적 비검증

- 이번 PR에서는 old AI asset delete를 하지 않는다.
- Mux asset 자체의 유효성 재검증은 PR-B 완료를 전제로 하고, 여기서는 DB attach correctness만 본다.

## 비목표

다음은 이번 PR에 포함하지 않는다.

- Mux 업로드
- old AI asset 삭제
- admin bulk attach UI/API
- manifest 이름 truth 변경
- 템플릿 메타 재설계
- 앱 재생기 로직 수정

## 후속 PR 연결

### PR-D

PR-C verify report + PR-B ledger 를 사용해 old/new 자산 추적, legacy delete candidate 확정, old AI asset 삭제를 수행한다.

## 모델 추천

- **PR-C:** Composer 2.0 단독 가능

단, DB write / dry-run / verify contract 를 더 강하게 잠그고 싶으면 Sonnet 4.6도 허용 가능.

## 구현 시작 순서

1. manifest + ledger reader/validator 작성
2. subset dry-run 경로 구현
3. DB attach(apply) 구현
4. attach 후 verify re-read 구현
5. verify JSON 출력 및 rerun/unchanged 처리
