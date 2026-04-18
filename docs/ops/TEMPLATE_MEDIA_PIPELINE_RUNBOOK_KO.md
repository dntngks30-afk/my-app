# 운동 템플릿 영상 교체 운영 매뉴얼 (한글 가이드)

## 목적

이 문서는 MOVE RE 운동 템플릿 영상 교체 작업을 **반복 가능하고 안전하게** 수행하기 위한 1장짜리 운영 매뉴얼이다.

대상 범위:
- 운동 템플릿 이름 truth 고정
- 새 mp4 영상 48개 Mux 업로드
- `exercise_templates.media_ref` 일괄 연결
-旧 AI / legacy Mux 자산 안전 삭제

이 문서는 아래 4개 PR 흐름을 한 번에 묶어 설명한다.

- PR-A: 템플릿 이름 truth / manifest 정렬
- PR-B: Mux batch upload
- PR-C: `media_ref` bulk attach
- PR-D: old legacy asset delete

---

## 핵심 원칙

1. **ID가 진실이다.**
   - 모든 기준은 `M01 ~ M48` 템플릿 ID다.
   - 이름 기준 매칭 금지.

2. **이름 truth는 manifest가 가진다.**
   - 기준 파일:
     - `ops/template-media/template-refresh-2026-04.json`
     - `ops/template-media/template-refresh-2026-04.csv`

3. **업로드와 DB 연결을 섞지 않는다.**
   - 먼저 Mux 업로드
   - 그 다음 `media_ref` attach
   - 마지막에 old asset delete

4. **삭제는 항상 마지막이다.**
   - 새 48개 업로드 및 앱 검수 완료 전 old asset 삭제 금지.

5. **dry-run 우선.**
   - attach, delete 모두 dry-run / 부분 실행 / 전체 실행 순서로 간다.

---

## 관련 파일

### Truth / 입력 파일
- `ops/template-media/template-refresh-2026-04.json`
- `ops/template-media/template-refresh-2026-04.csv`

### 스크립트
- `scripts/template-media/mux-batch-upload.mjs`
- `scripts/template-media/apply-template-media-refresh.mjs`
- `scripts/template-media/delete-legacy-template-assets.mjs`

### 결과 파일 (런타임 생성)
- `ops/template-media/template-refresh-2026-04.mux-upload-result.json`
- `ops/template-media/template-refresh-2026-04.attach-verify.json`
- `ops/template-media/template-refresh-2026-04.legacy-delete-plan.json`
- `ops/template-media/template-refresh-2026-04.legacy-delete-result.json`
- 선택적: `ops/template-media/template-refresh-2026-04.legacy-delete-allowlist.json`

### package.json 실행 스크립트
- `npm run ops:template-media:mux-upload`
- `npm run ops:template-media:attach`
- `npm run ops:template-media:legacy-delete`

---

## 사전 준비

### 1) 영상 파일 위치 / 이름
리포 루트 기준:

```text
videos/templates/M01.mp4
videos/templates/M02.mp4
...
videos/templates/M48.mp4
```

규칙:
- 파일명은 반드시 `Mxx.mp4`
- manifest의 `local_video_path` 와 실제 파일 경로가 일치해야 함

### 2) Mux Access Token
Mux 대시보드의 **Access Tokens** 에서 발급한 값 사용.

필수 환경변수:
- `MUX_TOKEN_ID`
- `MUX_TOKEN_SECRET`

주의:
- `Environment ID / Key` 아님
- `Signing Key / Private Key` 아님
- 반드시 **Access Token ID / Secret** 사용

### 3) Supabase 서비스 키
`media_ref` attach 단계에서 필요.

필수 환경변수:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

---

## 단계별 실행 절차

# STEP 0. 이름 truth 확인 (PR-A 이후)

확인할 것:
- manifest에 M01~M48 전체 존재
- M44 이름이 `딥 스쿼트`
- 이름 drift 없는지 확인

기준 파일:
- `ops/template-media/template-refresh-2026-04.json`

이 단계에서는 영상 업로드 / DB attach / delete를 하지 않는다.

---

# STEP 1. Mux 업로드 (PR-B)

## 환경변수 설정 (CMD)

```bat
set "MUX_TOKEN_ID=여기에_토큰_ID"
set "MUX_TOKEN_SECRET=여기에_토큰_SECRET"
```

## 1-1. 소량 테스트 업로드

```bat
npm run ops:template-media:mux-upload -- --ids M01,M02
```

또는

```bat
npm run ops:template-media:mux-upload -- --limit 2
```

## 1-2. 전체 업로드

```bat
npm run ops:template-media:mux-upload
```

## 1-3. 업로드 검수

결과 파일:
- `ops/template-media/template-refresh-2026-04.mux-upload-result.json`

합격 기준:
- `rows = 48`
- `failed = 0`
- 모든 row에 `mux_asset_id`, `mux_playback_id` 존재
- 중복 `mux_playback_id` 없음

샘플 검수 추천:
- M01
- M02
- M20
- M44
- M48

확인 항목:
- 썸네일 생성 여부
- playback_id 정상 생성 여부
- 영상/템플릿 매칭 이상 없음

### 주의
- PR-B는 **업로드 only**
- 아직 앱 DB는 안 바뀜
- 이 단계에서 old asset 삭제 금지

---

# STEP 2. media_ref attach (PR-C)

## 환경변수 설정 (CMD)

```bat
set "NEXT_PUBLIC_SUPABASE_URL=여기에_URL"
set "SUPABASE_SERVICE_ROLE_KEY=여기에_SERVICE_ROLE_KEY"
```

Mux 환경변수는 이미 있어도 무방하나, attach 핵심은 Supabase 키다.

## 2-1. 전체 dry-run

```bat
npm run ops:template-media:attach
```

기본은 dry-run이다.

## 2-2. subset apply

```bat
npm run ops:template-media:attach -- --ids M01,M02 --apply
```

## 2-3. 전체 apply

```bat
npm run ops:template-media:attach -- --apply
```

## 2-4. attach 검수

결과 파일:
- `ops/template-media/template-refresh-2026-04.attach-verify.json`

합격 기준:
- `failed = 0`
- 각 row의 `status` 가 `updated` 또는 `unchanged`
- `after_media_ref.provider = 'mux'`
- `after_media_ref.playback_id = expected_playback_id`

실앱 검수:
- 최소 M01 / M20 / M30 / M44 / M48 확인
- 템플릿과 영상이 맞는지 확인

### 주의
- attach는 `media_ref`만 수정
- name / level / focus_tags / 기타 메타 수정 금지

---

# STEP 3. old legacy asset 삭제 (PR-D)

## 3-1. dry-run plan 생성

```bat
set "MUX_TOKEN_ID=여기에_토큰_ID"
set "MUX_TOKEN_SECRET=여기에_토큰_SECRET"
npm run ops:template-media:legacy-delete
```

기본은 dry-run이다.

결과 파일:
- `ops/template-media/template-refresh-2026-04.legacy-delete-plan.json`

의미:
- `kept` = 절대 삭제 금지 (현재 live 48개)
- `candidate` = 삭제 가능 후보
- `excluded` = 이번 삭제 범위 밖

## 3-2. allowlist가 필요한 경우

old asset이 `excluded` 로 남으면, 아래 파일을 만들어 명시적으로 후보로 승격시킨다.

선택 파일:
- `ops/template-media/template-refresh-2026-04.legacy-delete-allowlist.json`

형식:

```json
{
  "asset_ids": [
    "ast_old_1",
    "ast_old_2"
  ]
}
```

규칙:
- 진짜 old AI / legacy asset만 넣는다
- keep-set과 겹치면 삭제되지 않음

## 3-3. 소량 삭제

```bat
npm run ops:template-media:legacy-delete -- --apply --limit 2
```

또는 특정 asset만:

```bat
npm run ops:template-media:legacy-delete -- --apply --asset-ids ast_xxx,ast_yyy
```

## 3-4. 전체 삭제

```bat
npm run ops:template-media:legacy-delete -- --apply
```

## 3-5. 삭제 검수

결과 파일:
- `ops/template-media/template-refresh-2026-04.legacy-delete-result.json`

합격 기준:
- `failed = 0`
- `deleted > 0` (old asset이 있었던 경우)
- 앱에서 현재 48개 영상 재생 이상 없음

### 주의
- plan 없이 바로 apply 금지
- old asset delete 후 앱 재생 반드시 재검수

---

## 추천 실행 순서 요약

### 1회차 운영 시
1. manifest truth 확인
2. Mux subset 업로드
3. Mux 전체 업로드
4. upload ledger 검수
5. attach dry-run
6. attach subset apply
7. attach 전체 apply
8. 앱 실재생 검수
9. legacy delete dry-run
10. legacy delete subset apply
11. legacy delete 전체 apply
12. 최종 앱 검수

### 반복 교체 시
1. manifest 갱신
2. 새 mp4 교체
3. Mux 업로드
4. attach
5. 검수
6. old asset delete

---

## 실패 시 대응

### A. Mux 업로드 401 Unauthorized
원인:
- `MUX_TOKEN_ID` / `MUX_TOKEN_SECRET` 잘못됨
- Environment Key를 넣음
- 다른 CMD 창에서 값이 사라짐

대응:
1. Access Tokens 에서 새 토큰 발급
2. CMD에서 다시 설정
3. subset 업로드부터 재시도

### B. attach dry-run 실패
원인:
- ledger에 `failed` row 존재
- `mux_playback_id` 누락
- manifest / ledger 이름 snapshot 충돌

대응:
1. PR-B ledger 다시 확인
2. 필요한 row만 재업로드
3. attach 재시도

### C. legacy delete에서 candidate = 0
원인:
- old asset이 `excluded` 로 분류됨
- passthrough 없음
- allowlist 없음

대응:
1. `legacy-delete-plan.json` 확인
2. old asset id만 allowlist에 추가
3. dry-run 재실행
4. candidate 생기면 subset apply

---

## 운영 체크리스트

### 업로드 전
- [ ] manifest 이름 truth 확인
- [ ] mp4 파일 48개 경로 확인
- [ ] Mux 토큰 확인

### 업로드 후
- [ ] upload ledger 48행 확인
- [ ] failed 0 확인
- [ ] 샘플 재생/썸네일 확인

### attach 전
- [ ] Supabase service role key 확인
- [ ] dry-run 성공 확인

### attach 후
- [ ] verify failed 0 확인
- [ ] 앱 실재생 샘플 확인

### delete 전
- [ ] 앱에서 새 48개 영상 정상 재생 확인
- [ ] delete dry-run 확인
- [ ] candidate가 실제 old asset인지 확인

### delete 후
- [ ] result failed 0 확인
- [ ] 앱 재생 최종 확인

---

## 절대 금지

- 이름 기준으로 수동 매칭
- 업로드와 attach를 한 번에 수동 처리
- attach 전 old asset 삭제
- keep-set 확인 없이 Mux 대시보드에서 무작위 수동 삭제
- `media_ref` 외 컬럼을 이번 파이프라인에서 임의 수정

---

## 최종 결론

이 파이프라인의 정석은 아래 한 줄이다.

**manifest truth 고정 → Mux 업로드 → upload ledger 검수 → media_ref attach → 앱 검수 → old asset delete**

이 순서를 깨지 않으면, 다음 템플릿 영상 교체도 반복 가능하고 안전하게 운영할 수 있다.
