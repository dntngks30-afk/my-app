# PR-TEMPLATE-MUX-BATCH-UPLOAD-01

## 목적

PR-A에서 고정한 final manifest를 입력으로 사용해, 새 운동 영상 48개를 **Mux에 배치 업로드**하고, 후속 PR-C가 읽을 수 있는 **upload ledger**를 생성한다.

이번 PR의 본질은 DB attach가 아니라 **Mux 업로드 결과를 template_id 기준으로 안전하게 수집/기록**하는 것이다.

## 상위 truth

- PR-A 산출물 `ops/template-media/template-refresh-2026-04.json` / `.csv`가 canonical input이다.
- 업로드 대상의 이름 truth는 PR-A manifest 기준이며, M44는 이미 `딥 스쿼트`로 고정된 상태를 전제로 한다.
- runtime playback contract는 여전히 `media_ref = { provider: 'mux', playback_id }` 이며, 이번 PR은 그 입력이 되는 `playback_id`를 확보하는 단계다.

## 왜 PR-B를 별도 분리하는가

1. Mux 업로드는 외부 API/파일 I/O/상태 대기가 포함되어 실패면적이 크다.
2. 업로드 결과(`asset_id`, `playback_id`)는 이후 PR-C attach와 PR-D legacy delete의 기준 ledger가 된다.
3. DB attach와 upload를 한 PR에 섞으면 partial failure 시 복구가 어려워진다.

따라서 PR-B는 **manifest read -> upload -> wait -> ledger write only** 로 제한한다.

## 변경 파일 (예정 범위 고정)

- `docs/pr/PR-TEMPLATE-MUX-BATCH-UPLOAD-01.md` (본 문서)
- `scripts/template-media/mux-batch-upload.mjs`
- `package.json` (실행 스크립트 1개 추가가 실제로 필요할 때만)

## 런타임 생성 산출물 (커밋 대상 아님)

- 기본 출력 경로: `ops/template-media/template-refresh-2026-04.mux-upload-result.json`

이 파일은 스크립트 실행 결과물이며, 구현 PR에서 정적 fixture처럼 커밋하지 않는다. 운영 실행 시 생성/갱신한다.

## 입력 계약

기본 입력 파일:

- `ops/template-media/template-refresh-2026-04.json`

입력 row 최소 필드:

- `template_id`
- `final_name_ko`
- `local_video_filename`
- `local_video_path`
- `notes`

### 입력 검증

스크립트는 업로드 전에 반드시 다음을 검증해야 한다.

- M01~M48 전체 row 존재 여부
- `template_id` 중복 없음
- `final_name_ko` 비어 있지 않음
- `local_video_path` 비어 있지 않음
- 로컬 파일 존재 여부

입력 검증 실패 시 Mux 호출 전에 중단해야 한다.

## 출력 ledger 계약

출력 JSON은 `template_id` 기준의 배열 또는 map 기반 ledger여야 하며, 최소한 아래 필드를 포함한다.

- `template_id`
- `final_name_ko`
- `local_video_filename`
- `local_video_path`
- `status` (`ready` | `uploaded` | `failed` | `skipped`)
- `mux_asset_id` (성공 시)
- `mux_playback_id` (성공 시)
- `error_message` (실패 시)
- `uploaded_at`

권장 추가 필드:

- `file_size_bytes`
- `mux_upload_id` 또는 upload trace 식별값
- `manifest_name_snapshot`

핵심 규칙:

- PR-C는 이 ledger의 `template_id -> mux_playback_id`를 읽어 `media_ref` attach를 수행한다.
- 따라서 `mux_playback_id` 필드는 반드시 명시적이고 stable 해야 한다.
- asset_id는 runtime용이 아니라 이후 운영/삭제 추적용이다.

## 구현 원칙

1. **ID가 진실이다.** 이름 기준 업로드/매칭 금지.
2. Mux 업로드는 각 row를 독립 처리하되, 결과는 하나의 ledger로 모은다.
3. partial failure 허용. 일부 실패해도 성공분 ledger는 남겨야 한다.
4. rerun 가능해야 한다. 이미 성공한 row를 재업로드하지 않도록 skip/force 전략을 제공한다.
5. DB write 금지. `exercise_templates.media_ref`는 이번 PR에서 절대 수정하지 않는다.

## 권장 CLI 인터페이스

예시:

```bash
node scripts/template-media/mux-batch-upload.mjs \
  --manifest ops/template-media/template-refresh-2026-04.json \
  --output ops/template-media/template-refresh-2026-04.mux-upload-result.json
```

권장 옵션:

- `--manifest <path>`
- `--output <path>`
- `--ids M01,M02,...` (부분 업로드)
- `--limit <n>` (스모크/부분 검증)
- `--force` (기존 성공 ledger 무시 후 재업로드)
- `--poll-ms <ms>`
- `--timeout-ms <ms>`

## Mux/API 전제

- 업로드 API 인증은 `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`를 사용한다.
- runtime signing key(`MUX_SIGNING_KEY`, `MUX_PRIVATE_KEY`)는 이번 PR의 필수 의존성이 아니다.
- 업로드 성공 후 **public playback 기준의 `playback_id` 확보**가 가능해야 한다.
- 최종 runtime은 기존 contract대로 `https://stream.mux.com/<playback_id>.m3u8` 를 사용하므로, 이번 PR 결과는 반드시 playback_id를 포함해야 한다.

## 실패 처리

다음 상황은 개별 row 실패로 기록한다.

- 로컬 파일 없음
- Mux 업로드 실패
- asset ready 대기 timeout
- playback_id 생성/조회 실패

실패 시에도 전체 프로세스를 즉시 중단하지 말고, 가능한 한 다음 row를 계속 처리한 뒤 최종 요약을 반환한다.

단, manifest 자체가 깨졌다면 전체 중단 가능.

## 검증

### 필수 검증

- 부분 업로드(`--ids` 또는 `--limit`) 1회 성공
- 전체 48개 실행 시 결과 ledger 생성
- 성공 row마다 `mux_asset_id`, `mux_playback_id` 존재
- 같은 `template_id`가 ledger에 중복 기록되지 않음
- rerun 시 기존 성공 row를 재사용/skip 할 수 있음

### 의도적 비검증

- 이번 PR에서는 DB attach를 하지 않는다.
- 실제 앱 재생 검증을 성공 조건으로 요구하지 않는다.
- legacy asset delete를 하지 않는다.

## 비목표

다음은 이번 PR에 포함하지 않는다.

- `exercise_templates.media_ref` 갱신
- admin bulk attach UI/API
- old AI asset 삭제
- manifest 이름 truth 변경
- template metadata 재설계
- 앱 재생기 로직 수정

## 후속 PR 연결

### PR-C

PR-B ledger의 `template_id -> mux_playback_id`를 읽어 `media_ref = { provider: 'mux', playback_id }` bulk attach를 수행한다.

### PR-D

PR-B ledger의 `mux_asset_id`를 사용해 old/new 자산 추적 및 legacy delete candidate 확정을 수행한다.

## 모델 추천

- **PR-B:** Ask -> Composer 2.0 -> Sonnet 4.6 권장

이유:
- 외부 API 호출, 업로드 상태 대기, partial failure, rerun/idempotency 설계가 포함된다.
- 단순 UI/카피 PR보다 실패 비용이 높다.

## 구현 시작 순서

1. PR-A manifest reader/validator 작성
2. subset upload(`--ids`/`--limit`) 경로 먼저 구현
3. Mux upload + ready polling + playback_id 수집 구현
4. result ledger atomic write 구현
5. rerun skip/force 정책 추가
6. 최종 실행 요약 및 실패 목록 출력
