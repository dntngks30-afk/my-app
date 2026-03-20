# PR-PUBLIC-ENTRY-02 — 단일 public 진입 CTA (설문 baseline 기본)

## 1. Assumptions

- PR-PUBLIC-BRIDGE-01이 적용되어 있어 설문 완료 후 `/movement-test/refine-bridge`가 유지된다.
- `/movement-test/camera` → refined 파이프는 refine-bridge·결과 화면에서만 진입하는 흐름이 유지된다.

## 2. CURRENT_IMPLEMENTED (이 PR 반영 후)

- 랜딩 `/`는 **하나의 dominant CTA**「내 몸 상태 1분 체크하기」만 노출한다.
- CTA는 `entryMode: 'survey'`를 저장한 뒤 `/intro/welcome`으로 진입한다 (기존 intro 스토리 유지).
- `/intro/profile` 완료 시 **항상** `mergeIntroProfileIntoSurveySession()` 후 **`/movement-test/survey`**로 이동한다.
- **camera first-entry 분기**(`/movement-test/camera` 직행) 및 **entryMode 없을 때 precheck** 분기를 제거했다.

## 3. LOCKED_DIRECTION

- 단일 입구·설문 baseline·카메라는 결과 직전 optional refine(SSOT).
- 결제·auth·실행 계약은 변경하지 않음.

## 4. NOT_YET_IMPLEMENTED

- 랜딩 히어로/스토리 전면 리디자인.
- `EntryMode` 타입에서 `camera` 완전 삭제(스키마 마이그레이션).

## 5. Findings

| 위치 | 이전 동작 |
|------|-----------|
| `src/app/(main)/page.tsx` | **copy + layout**: 「분석 방식 선택」+ 설문형/동작형 **동등 2카드**. |
| `src/app/intro/profile/page.tsx` | **route-level 분기**: survey → 설문, camera → 카메라, 그 외 → precheck. |

## 6. Root cause

- 랜딩에서 설문과 카메라를 **동등한 첫 선택지**로 제시해 dual-entry 심리를 강화함.
- profile에서 `entryMode === 'camera'`일 때 **카메라 직행**으로 public-first·refine-bridge 순서와 어긋남.

## 7. Files changed

- `src/app/(main)/page.tsx`
- `src/app/intro/profile/page.tsx`
- `src/lib/public/intro-funnel.ts` (주석)
- `docs/pr/PR-PUBLIC-ENTRY-02.md`

## 8. Proposed flow (after)

```
/ → [단일 CTA] → /intro/welcome → … → /intro/profile → /movement-test/survey → … → /movement-test/refine-bridge
                                                                                        └ (optional) → /movement-test/camera → refined
```

## 9. SSOT 대비 안전성

- refine-bridge·카메라 refine 경로 **유지**.
- API·readiness·온보딩·`/app` **미수정**.

## 10. Acceptance tests (manual)

1. `/` 첫 화면에 **하나의 주요 CTA**만 보인다.
2. CTA 클릭 → intro → profile 제출 → **설문**으로 진입한다.
3. 랜딩 첫 화면에 **카메라와 설문의 동등 2버튼**이 없다.
4. 설문 완료 → refine-bridge 유지.
5. refine-bridge에서 결과 먼저 → baseline.
6. refine-bridge에서 카메라 → refined.
7. 결과에서 auth/pay 흐름 기존과 동일(회귀).
8. `/app` 동작 변경 없음.

## 11. Explicit non-goals

- refine-bridge 제거·결과 IA 전면 개편·카메라 플로우 내부 카피 전수 수정.

---

## Implementation type

- **Mixed**: 랜딩 **layout/copy**, intro/profile **routing**.

## Follow-up PRs

- `FunnelData.entryMode` 정리 및 구 `camera` 키 마이그레이션.
- `/movement-test/precheck` 직링 사용자를 위한 안내(필요 시).

## Manual test paths

1. 시크릿 창에서 `/` → CTA → profile → **survey** 도달.
2. 구형 `localStorage`에 `entryMode: 'camera'`만 있어도 profile 제출 후 **survey**로만 진입하는지(선택).
