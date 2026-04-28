# PR-RESET-BE-01 — Reset 탭 코드 SSOT (스트레치·이슈 카탈로그)

## 목적 (CURRENT_IMPLEMENTED 범위)

- 리셋 탭에 쓸 **10 스트레칭 + 10 이슈**를 **코드 SSOT**로 추가한다.
- 타입(`ResetStretchDefinition`, `ResetIssueDefinition`, `ResetMediaStatus` 등), 불변 카탈로그, **오프라인 스모크**만 포함한다.

## 비포함 (Non-goals)

- API·라우트·DB·마이그레이션·`package.json` 변경 없음.
- UI(`ResetTabViewV2`, `home`, 체크인, 세션 패널, 플레이어 등) 및 미디어 서명·실행 코어 수정 없음.
- `ResetMediaStatus`는 **타입만** (`types.ts`). `RESET_STRETCH_CATALOG` 행에는 `media_status`를 **저장하지 않음** — 후속 **PR-RESET-BE-02** 또는 미디어 ViewModel에서 `template_id` 기준으로 파생.
- **`src/lib/reset/index.ts` 바렐 미생성** (이 PR에서 생성 파일 5개로 제한).

## 생성·수정 파일 (이 PR 한정)

| 파일 | 역할 |
|------|------|
| `src/lib/reset/types.ts` | 영역 타입, 스트레치/이슈 정의. `issue_key`는 PR-RESET-00 / RESET_TAB의 `reset_key`와 동일 식별자 집합(주석 명시). |
| `src/lib/reset/reset-stretch-catalog.ts` | `RESET_STRETCH_CATALOG` (10건), `template_id` 미매핑 시 `null`. |
| `src/lib/reset/reset-issue-catalog.ts` | `RESET_ISSUE_CATALOG` (10건), `alternative_stretch_keys`는 튜플로 **정확히 2개**. |
| `scripts/reset-catalog-contract-smoke.mjs` | 카탈로그 길이·키 유일·참조 무결성·`alternative_stretch_keys.length === 2` **엄격** 검증. |
| `docs/pr/PR-RESET-BE-01.md` | 본 문서. |

## 검증 명령

프로젝트 루트에서:

```bash
npx tsx scripts/reset-catalog-contract-smoke.mjs
```

`node` 단독 실행이 아니라 **`npx tsx`** 로 실행한다 (`package.json` 스크립트 추가 없음).

## 스모크 계약 요약

- 스트레치 10건·이슈 10건, 각각 키 유일.
- 이슈의 `primary_stretch_key` 및 `alternative_stretch_keys` 두 개가 모두 스트레치 카탈로그에 존재하고, 서로 중복 없음.
- 각 이슈에 대해 **`alternative_stretch_keys.length === 2`** 만 허용 (`>= 2` 금지).
- 스트레치 행에 `media_status` 키 없음.

## 다음 단계 (별 PR)

- **PR-RESET-BE-02**: `template_id` 매핑, 미디어 ViewModel/상태 파생 등.
