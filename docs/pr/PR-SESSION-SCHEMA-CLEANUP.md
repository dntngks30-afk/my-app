# PR-SESSION-SCHEMA-CLEANUP

**목적:** `movementTestSession:v2`에서 제품 진실이 아닌 레거시 필드 `selfTest`, `finalType` residue 제거(설문 저장 경로). 스코어링·라우팅·UI 리디자인 아님.

---

## Changes (요약)

| 영역 | 내용 |
|------|------|
| `survey/page.tsx` | `SessionV2`에서 `selfTest`/`finalType` 타입·load/persist/완료 쓰기 제거 |
| `v2/scoring/types.ts` | 미사용 `FinalTypeV2` 타입 제거 |
| 주석·문서 | self-test·result·self-test-flow·관련 PR 노트 최소 정렬 |

---

## Final rule

- **`movementTestSession:v2.selfTest`:** 제품 코드에서 읽거나 쓰지 않음.
- **`movementTestSession:v2.finalType`:** 제품 코드에서 읽거나 쓰지 않음.
- **옛 localStorage JSON:** 키가 남아 있어도 무시(마이그레이션 없음).
- **Active truth:** `answersById` + deep 파이프라인 / `AnimalAxis` 스코어링 — 변경 없음.
