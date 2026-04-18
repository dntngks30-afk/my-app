# PR-TEMPLATE-MANIFEST-NAME-SYNC-01

## 목적

운동 템플릿 영상 전면 교체 작업의 첫 단계로, **M01~M48의 최종 이름 truth를 manifest 기준으로 고정**하고, `exercise_templates` 및 남아 있는 정적 compat 이름 drift를 일치시킨다.

이번 PR의 본질은 영상 업로드가 아니라 **이름 source-of-truth 정렬**이다. 이후 PR-B(Mux batch upload), PR-C(media_ref bulk attach), PR-D(verify + legacy asset delete)가 이 PR의 truth를 기준으로 동작한다.

## 상위 truth

- 사용자 제공 최종 템플릿 정리본(M01~M48)을 canonical input으로 사용한다.
- 단, **M44의 최종 이름은 `딥 스쿼트`로 override** 한다.
- 이번 PR부터 템플릿 이름 truth는 과거 seed 문구가 아니라 **final manifest** 기준이다.

## 왜 이 PR이 먼저 필요한가

현재 리포에는 다음 리스크가 공존한다.

1. `public.exercise_templates`의 이름과 정적 compat 파일 이름이 일부 드리프트되어 있다.
2. 이후 Mux 업로드/attach 단계에서 이름이 불안정하면 검수 기준이 흔들린다.
3. 관리 콘솔은 개별 PATCH 중심이라, 이름 truth를 먼저 고정하지 않으면 운영자가 수동으로 보정하다 다시 꼬일 가능성이 높다.

따라서 PR-A는 **manifest truth 확정 + DB/compat name sync only** 로 제한한다.

## 변경 파일 (예정 범위 고정)

- `docs/pr/PR-TEMPLATE-MANIFEST-NAME-SYNC-01.md` (본 문서)
- `ops/template-media/template-refresh-2026-04.json`
- `ops/template-media/template-refresh-2026-04.csv`
- `supabase/migrations/20260419xxxx_template_name_refresh_from_manifest.sql`
- `src/lib/workout-routine/exercise-templates.ts` (정적 compat 이름 sync가 실제로 필요한 항목만)

## 이번 PR에서 고정할 것

### 1) final manifest 생성

Manifest는 반드시 `template_id` 기준으로 작성한다.

권장 최소 필드:

- `template_id`
- `final_name_ko`
- `local_video_filename`
- `local_video_path`
- `notes`

이번 PR에서는 **영상 업로드 결과(`mux_asset_id`, `playback_id`)를 채우지 않는다.**
해당 필드는 다음 PR에서 append/update 한다.

### 2) DB 이름 patch

- 과거 migration 수정 금지.
- 새로운 forward migration으로 `public.exercise_templates.name`을 M01~M48 전부 final manifest 기준으로 update 한다.
- 겉으로는 M44가 유일한 확정 수정처럼 보여도, hidden drift 방지를 위해 **M01~M48 전체 sync update** 를 허용한다.

### 3) compat 이름 sync

- `src/lib/workout-routine/exercise-templates.ts`는 장기적으로 runtime truth가 아니지만, 아직 일부 참조/문서/테스트/아티팩트에서 이름 노출이 남아 있을 수 있다.
- 따라서 DB와 다른 이름이 남아 있는 항목만 최소 수정으로 sync 한다.
- 단, 이 PR에서 static pool 구조 자체를 제거하거나 DB-first contract를 바꾸지는 않는다.

## 비목표

다음은 **절대 이번 PR에 포함하지 않는다.**

- Mux 업로드 로직
- `media_ref` 수정
- admin bulk attach UI / API
- old AI asset 삭제
- session plan selection semantics 변경
- template metadata(`focus_tags`, `contraindications`, `phase`, `target_vector`, `difficulty`) 재설계
- 템플릿 신규 추가/삭제/ID 변경

## 구현 원칙

1. **ID가 진실이다.** 이름 기준 매칭 금지.
2. **M44는 `딥 스쿼트`가 최종 이름이다.**
3. 기존 row를 재사용한다. 신규 insert 금지.
4. seed 파일 직접 수정 대신 forward migration으로 patch 한다.
5. 정적 compat 수정은 최소 diff only.

## 검증

### 필수 검증

- manifest에 M01~M48이 모두 존재한다.
- manifest 내 `template_id` 중복이 없다.
- migration 결과로 `exercise_templates`의 M01~M48 `name`이 manifest와 일치한다.
- `src/lib/workout-routine/exercise-templates.ts` 내 남아 있는 이름이 DB truth와 충돌하지 않는다.
- 특히 **M44의 최종 이름이 `딥 스쿼트`로 반영**된다.

### 의도적 비검증

- 이번 PR에서는 실제 영상 재생 검증을 하지 않는다.
- `media_ref` 존재 여부를 성공 조건으로 요구하지 않는다.

## 후속 PR 연결

### PR-B

Mux batch upload. 이 PR의 manifest를 읽어 `mux_asset_id`, `playback_id` ledger를 생성한다.

### PR-C

`media_ref = { provider: 'mux', playback_id }` bulk attach. PR-B 결과를 사용한다.

### PR-D

verify report 생성 후 old AI asset delete candidate 확정 및 삭제.

## 모델 추천

- **PR-A:** Composer 2.0 단독 가능
- **PR-B:** Ask -> Composer 2.0 -> Sonnet 4.6 권장
- **PR-C:** Composer 2.0 단독 가능
- **PR-D:** Ask -> Composer 2.0 -> Sonnet 4.6 권장

## 구현 시작 순서

1. 사용자 최종 정리본을 JSON/CSV manifest로 정규화
2. M44 이름을 `딥 스쿼트`로 고정
3. forward migration 작성
4. 정적 compat 이름 drift 최소 sync
5. manifest/DB/compat 일치 여부 검토
