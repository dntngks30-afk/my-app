# PR-D-CANONICAL-DEBUG-SURFACE-CLEANUP-04

**Base:** main  
**Type:** debug surface / observability cleanup  
**Priority:** P1  
**Date:** 2026-04-02

---

## Why PR-C was still not enough

PR-A/B/C까지 **writer**, **policy 경계**, **drift prefix scan**은 정리되었지만, `SquatCompletionState` / `SquatCycleDebug`에는 여전히 다음이 병렬로 남아 있었다.

- **PRIMARY:** `canonicalShallowContract*` (derive + closer 스탬프)
- **LEGACY:** PR-ALIGN-01 / PR-2 축 (`shallowAuthoritativeStage`, `truthMismatch_*`, `shallowContractAuthorityTrace`, …)
- **SECONDARY:** `ownerTruth*`, `ultraLowPolicy*`, trajectory·proof evidence

필드 이름만으로는 “무엇을 1차로 읽을지”가 코드/리뷰어에게 즉시 드러나지 않았다.

---

## Primary canonical vs legacy debug surface

| 계층 | 역할 | 대표 필드 |
|------|------|-----------|
| **PRIMARY_CANONICAL** | shallow 관련 디버그 1차 SSOT | `canonicalShallowContract*`, `canonicalShallowContractClosureApplied` / `ClosureSource` |
| **SECONDARY_DEBUG** | owner 요약, 정책 투영, evaluator 연결 evidence | `ownerTruth*`, `ultraLowPolicy*`, `shallowTrajectoryBridge*`, `guardedShallowTrajectoryClosureProof*`, `guardedShallowLocalPeak*` |
| **LEGACY_COMPAT** | PR-2 / ALIGN-01 — compat·deprecated 주석 | `shallowAuthoritativeStage`, `truthMismatch_*`, `shallowNormalizedBlockerFamily`, `shallowAuthoritativeContractStatus`, `shallowContractAuthoritativeClosure`, `shallowContractAuthorityTrace`, `shallowAuthoritativeClosureReason` / `BlockedReason` |

---

## What was cleaned up in PR-D

- `squat-completion-state.ts`: `SquatCompletionState` 필드를 위 묶음 순서로 **재배치**(이름·타입 불변). 섹션 주석 `(1)~(5)` 추가.
- 동일 파일: legacy 후보 필드에 **`@deprecated` JSDoc**(삭제 아님). `mapCompletionBlockedReasonToShallowNormalizedBlockerFamily`에 legacy 안내 주석.
- `attachShallowTruthObservabilityAlign01` 주석을 PR-D 기준으로 정리(pure observability, canonical primary, legacy 명시). **함수명 rename 없음.**
- `shallow-completion-contract.ts`: 헤더에 PR-D·primary debug SSOT 문구 보강.
- `auto-progression.ts`: `SquatCycleDebug` 인터페이스를 PRIMARY / SECONDARY / LEGACY 블록 순으로 재정렬. `getSquatProgressionCompletionSatisfied` 내 초기 `squatCycleDebug` 객체에 동일 분류로 필드를 모아 넣고, 중복 pass-through 할당 제거(값은 초기 객체에서 이미 `cs` 기준으로 설정).

---

## What remains compatibility-only

- PR-2 / ALIGN-01 필드 전부 — **필드 유지**, `@deprecated` 로만 “새 코드는 canonical 우선”을 표시.
- `attachShallowTruthObservabilityAlign01` — 이름 유지(PR 태그 잔존).

---

## What this PR intentionally does NOT change

- `applyCanonicalShallowClosureFromContract` 본문
- `applyUltraLowPolicyLock` 의미·덮어쓰기 집합
- `evaluators/squat.ts` **로직**
- `squat-progression-contract.ts`, event-cycle, reversal 모듈
- threshold / timing / finalize / gate / retry / confidence
- 필드 **삭제**

---

## Historical note (PR-A 문서와의 관계)

`PR-CAM-CANONICAL-SHALLOW-CONTRACT-01.md`는 PR-A 시점에 “contract가 completion owner를 대체하지 않는다”, “completion 필드 덮어쓰기 없음” 등을 적었다. **PR-B 이후**에는 downstream canonical closer가 `official_shallow_cycle` 을 연다. 본 PR-D 문서를 **현재 구조의 기준**으로 삼고, PR-A 원문은 Git·히스토리 맥락으로만 읽는 것이 안전하다.

---

## Files changed

| 파일 | 내용 |
|------|------|
| `src/lib/camera/squat-completion-state.ts` | 인터페이스 그룹화, `@deprecated`, attach/map 주석 |
| `src/lib/camera/squat/shallow-completion-contract.ts` | 헤더 정리 |
| `src/lib/camera/auto-progression.ts` | `SquatCycleDebug` 정렬, 초기 debug 객체 PR-D 그룹 |
| `docs/pr/PR-D-CANONICAL-DEBUG-SURFACE-CLEANUP-04.md` | 본 문서 |

---

## Verification

1. **로직 무변:** `applyCanonicalShallowClosureFromContract`, `applyUltraLowPolicyLock` 본문 diff 없음(주석만 해당 파일 내 다른 위치 변경 가능).
2. **필드 보존:** `canonicalShallowContract*`, `truthMismatch_*`, `shallowTrajectoryBridge*`, `guardedShallowTrajectoryClosureProof*` 등 요구 필드 모두 유지.
3. **표면:** `SquatCompletionState` / `SquatCycleDebug`에서 PRIMARY → SECONDARY → LEGACY 순서가 주석·타입 정의에서 보인다.
4. **deprecated:** 지정된 legacy 필드에 `@deprecated` JSDoc 존재.
5. **Lint:** 변경 파일 기준 진단 없음.

---

## Known follow-up

- `attachShallowTruthObservabilityAlign01` **rename** 은 별도 PR(전역 참조·문서 일괄).
- 외부 스냅샷이 `SquatCycleDebug` 키 순서에 의존하는지 운영 확인 후, 필요 시 문서화만 추가.
- PR-A 마크다운 **직접 수정**은 하지 않았음 — 원하면 “Post PR-B” 각주 PR을 따로 열 수 있음.

---

## One-line conclusion

PR-D는 shallow **판정 로직을 바꾸지 않고**, `canonicalShallowContract*` 를 debug surface 의 **primary truth**로 선언하고 legacy 축을 **compat / deprecated 주석**으로 정렬한 cleanup PR이다.
