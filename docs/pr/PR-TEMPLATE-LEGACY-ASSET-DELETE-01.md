# PR-TEMPLATE-LEGACY-ASSET-DELETE-01

## 목적

PR-C cutover가 끝난 뒤, **현재 앱에서 더 이상 사용하지 않는旧 Mux/AI 템플릿 자산**을 안전하게 식별하고 삭제한다.

이번 PR의 본질은 단순 정리가 아니라 **현재 keep-set(새 자산)과 delete-set(구 자산)을 엄격히 분리**해, live asset 오삭제 없이 legacy asset만 정리하는 것이다.

## 상위 truth

- PR-A manifest: `ops/template-media/template-refresh-2026-04.json`
- PR-B upload ledger: `ops/template-media/template-refresh-2026-04.mux-upload-result.json`
- PR-C attach verify: `ops/template-media/template-refresh-2026-04.attach-verify.json`
- 현재 runtime truth는 PR-C 이후 `exercise_templates.media_ref = { provider: 'mux', playback_id }`
- keep-set의 1차 truth는 **PR-B ledger의 `mux_asset_id` / `mux_playback_id`** 이다.
- delete는 **현재 attach 완료 및 앱 검수 완료 후에만** 허용된다.

## 왜 PR-D를 별도 분리하는가

1. 자산 삭제는 되돌리기 어렵고 실수 비용이 가장 크다.
2. PR-B/PR-C가 성공해도, delete-set 계산이 잘못되면 live asset을 지울 수 있다.
3. 따라서 식별(plan)과 실제 삭제(apply)를 분리하고, dry-run이 기본이어야 한다.

## 변경 파일 (예정 범위 고정)

- `docs/pr/PR-TEMPLATE-LEGACY-ASSET-DELETE-01.md` (본 문서)
- `scripts/template-media/delete-legacy-template-assets.mjs`
- `package.json` (실행 스크립트 1개 추가가 실제로 필요할 때만)

## 런타임 생성 산출물 (커밋 대상 아님)

- dry-run 계획 파일: `ops/template-media/template-refresh-2026-04.legacy-delete-plan.json`
- apply 결과 파일: `ops/template-media/template-refresh-2026-04.legacy-delete-result.json`

## 입력 계약

기본 입력 파일:

- manifest: `ops/template-media/template-refresh-2026-04.json`
- upload ledger: `ops/template-media/template-refresh-2026-04.mux-upload-result.json`
- attach verify: `ops/template-media/template-refresh-2026-04.attach-verify.json`

### 입력 검증

삭제 전 반드시 다음을 검증해야 한다.

- manifest에 M01~M48 전체 존재
- upload ledger에 M01~M48 전체 존재
- upload ledger에 `failed` row 없음
- upload ledger 모든 row에 `mux_asset_id`, `mux_playback_id` 존재
- attach verify에 M01~M48 전체 존재
- attach verify의 모든 row 상태가 `updated` 또는 `unchanged`
- attach verify의 `after_media_ref.playback_id` 가 ledger의 `mux_playback_id` 와 일치

위 조건을 만족하지 않으면 delete 단계로 진입하면 안 된다.

## keep-set 정의

다음은 절대 삭제하면 안 되는 keep-set 이다.

### keep asset ids

- PR-B ledger의 `mux_asset_id` 전체

### keep playback ids

- PR-B ledger의 `mux_playback_id` 전체
- PR-C attach verify의 `after_media_ref.playback_id` 전체

핵심 규칙:

- candidate asset이 keep asset ids에 포함되면 삭제 금지
- candidate asset의 playback ids 중 하나라도 keep playback ids와 겹치면 삭제 금지

## delete candidate 정의

기본 candidate는 Mux API에서 조회한 asset 중 아래를 모두 만족하는 경우만 허용한다.

1. keep asset ids에 없다
2. asset.playback_ids 가 keep playback ids와 겹치지 않는다
3. 아래 둘 중 하나를 만족한다
   - `passthrough` 가 `M01`~`M48` 중 하나다
   - 또는 명시적 override allowlist 에 포함된 asset_id 다

## 명시적 override allowlist

구 legacy AI 자산 중 `passthrough` 가 없거나 불명확한 경우를 대비해, 스크립트는 선택적으로 아래 파일을 읽을 수 있어야 한다.

- `ops/template-media/template-refresh-2026-04.legacy-delete-allowlist.json`

이 파일은 커밋 필수 아님. 운영자가 정말 지워도 되는 legacy asset_id 를 명시할 때만 사용한다.

최소 형식 예시:

```json
{
  "asset_ids": ["ast_old_1", "ast_old_2"]
}
```

원칙:

- allowlist는 delete 범위를 넓히는 보조 장치일 뿐, keep-set 규칙을 절대 덮어쓰지 못한다.
- keep-set과 충돌하는 asset은 allowlist에 있어도 삭제 금지다.

## 구현 원칙

1. **delete default 금지. dry-run default**
2. **keep-set 우선**
3. live asset 오삭제 방지가 최우선이다.
4. plan 과 apply 를 분리한다.
5. rerun 가능해야 한다. 이미 삭제된 asset은 deleted/skipped 처리 가능해야 한다.

## 권장 CLI 인터페이스

예시:

```bash
node scripts/template-media/delete-legacy-template-assets.mjs \
  --manifest ops/template-media/template-refresh-2026-04.json \
  --ledger ops/template-media/template-refresh-2026-04.mux-upload-result.json \
  --attach-verify ops/template-media/template-refresh-2026-04.attach-verify.json \
  --plan-output ops/template-media/template-refresh-2026-04.legacy-delete-plan.json \
  --result-output ops/template-media/template-refresh-2026-04.legacy-delete-result.json \
  --dry-run
```

권장 옵션:

- `--manifest <path>`
- `--ledger <path>`
- `--attach-verify <path>`
- `--allowlist <path>`
- `--plan-output <path>`
- `--result-output <path>`
- `--dry-run`
- `--apply`
- `--asset-ids ast_x,ast_y,...` (부분 삭제 / 수동 재시도)
- `--limit <n>`

기본 정책:

- 기본은 dry-run
- 실제 삭제는 `--apply` 일 때만 수행

## Mux/API 전제

- Mux 인증은 `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`
- asset 조회와 삭제는 Mux REST API를 사용한다.
- script는 assets list pagination 을 처리해야 한다.
- candidate 계산에 필요한 최소 필드는 asset id, status, playback_ids, passthrough 이다.

## plan 출력 계약

plan JSON 최소 필드:

- `asset_id`
- `status` (`candidate` | `kept` | `excluded`)
- `reason`
- `passthrough`
- `playback_ids`
- `in_keep_asset_set`
- `in_keep_playback_set`
- `matched_template_id` (있으면)
- `allowlist_matched`

핵심:

- 왜 후보가 되었는지 / 왜 제외되었는지 사후 추적 가능해야 한다.

## result 출력 계약

result JSON 최소 필드:

- `asset_id`
- `status` (`deleted` | `failed` | `skipped`)
- `reason`
- `deleted_at`
- `error_message`

## 실패 처리

### 전체 중단

- manifest / ledger / attach verify 구조 깨짐
- keep-set 계산 불가
- Mux 인증 실패
- Mux asset list 조회 실패

### 개별 asset 실패

- 특정 asset delete API 실패
- 이미 삭제되어 재조회 불가
- allowlist 형식 불량으로 특정 entry 무시

개별 실패가 있어도 result report 는 남겨야 한다.

## 검증

### 필수 검증

- dry-run 에서 candidate plan 생성
- keep-set asset 이 candidate 로 분류되지 않음
- keep-set playback 과 겹치는 asset 이 candidate 로 분류되지 않음
- subset delete(`--asset-ids` 또는 `--limit`) 1회 성공
- rerun 시 이미 삭제된 asset 을 안전하게 skipped/deleted-history 로 처리 가능

### 의도적 비검증

- 이번 PR에서는 DB attach 를 다시 하지 않는다.
- 앱 재생기 로직 수정은 하지 않는다.

## 비목표

다음은 이번 PR에 포함하지 않는다.

- media_ref attach 수정
- Mux 업로드
- admin bulk delete UI/API
- manifest 이름 truth 변경
- 템플릿 메타 재설계

## 모델 추천

- **PR-D:** Ask -> Composer 2.0 -> Sonnet 4.6 권장

이유:
- 삭제 로직은 실패 비용이 높고, keep-set / candidate-set 분리와 pagination / rerun / partial failure 처리가 필요하다.

## 구현 시작 순서

1. manifest + ledger + attach verify reader/validator 작성
2. keep-set 계산
3. Mux assets list pagination 구현
4. plan(dry-run) 생성 및 출력
5. subset apply 구현
6. full apply + result 출력
