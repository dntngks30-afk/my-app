# PR-LEGACY-RESULT-CLEANUP

**목적:** `/movement-test/result` 레거시 동물형 풀페이지 제거, canonical public funnel로 compat redirect.

---

## 1. Findings (인벤토리)

| 항목 | 내용 |
|------|------|
| **레거시 라우트** | `src/app/movement-test/result/page.tsx` (구 ~800줄, calculateScoresV2 + RESULT_CONTENT) |
| **호출처** | `SurveyForm.tsx` 완료 → `/movement-test/result`; `RetestComparisonClient` 버튼 → 동일 |
| **active truth** | `survey` → `refine-bridge` → `baseline` / `camera` → `refined` + `PublicResultRenderer` |
| **residue** | 북마크 `/movement-test/result` 직접 접근 |

---

## 2. Changes

| 파일 | 변경 |
|------|------|
| `src/app/movement-test/result/page.tsx` | 레거시 UI 삭제 → `localStorage` 기준 `router.replace` (refine-bridge / survey / movement-test) |
| `src/components/SurveyForm.tsx` | v1 완료 시 `/movement-test` (공개 입구) |
| `RetestComparisonClient.tsx` | `/movement-test/refine-bridge` + 버튼 카피 정리 |

---

## 3. Final rule

- **Canonical result path:** `refine-bridge` → `baseline` / `refined`.
- **`/movement-test/result`:** 렌더 없음; redirect만 (호환 URL 유지).
- **데이터 없음:** → `/movement-test`.
- **v2 완료+답변:** → `/movement-test/refine-bridge`.
- **schema/finalType/RESULT_CONTENT:** 당시 라우트만 정리; 세션 필드·`RESULT_CONTENT` 맵 제거는 `PR-SESSION-SCHEMA-CLEANUP` 등 별도 PR.

---

## 4. Smoke

- 직접 `/movement-test/result` 접속 → 짧은 메시지 후 redirect.
- canonical happy path는 변경 없음.

### Known risk

- `docs/spec/`·`docs/movement-test/`의 구 스펙 문서는 수동 업데이트 권장 (별도).
