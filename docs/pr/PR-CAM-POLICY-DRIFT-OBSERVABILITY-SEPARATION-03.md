# PR-CAM-POLICY-DRIFT-OBSERVABILITY-SEPARATION-03

**Base:** main  
**Type:** structural / layering cleanup  
**Priority:** P0

---

## Why PR-B was still not enough

PR-B(PR-CAM-CANONICAL-SHALLOW-CLOSER-02)는 `official_shallow_cycle`을 여는 권한을
`applyCanonicalShallowClosureFromContract` 단일 helper로 수렴시켰다.

그러나 PR-B 이후에도 다음 4가지 구조적 debt가 남아 있었다.

1. **policy/owner 혼재**: `attachShallowTruthObservabilityAlign01` 내부 첫 줄이
   `applyUltraLowPolicyLock(state)`를 호출해, 함수 이름은 "observability"인데
   실제로 `completionSatisfied` 등 completion 필드를 덮어쓰고 있었다.
   `evaluators/squat.ts`에서도 attach 이후 policy가 또 적용될 가능성이 열려 있었다.

2. **drift prefix scan 사망**: `resolveStandardDriftAfterShallowAdmission`의 prefix loop가
   `completionPassReason === 'official_shallow_cycle'`을 탐지 조건으로 사용했으나,
   PR-B 이후 `official_shallow_cycle`은 tail canonical closer에서만 열리므로
   `evaluateSquatCompletionCore` 단독 prefix에서는 탐지 불가 상태였다.

3. **병렬 observability 축**: `shallowAuthoritativeClosureDecision`, `canonicalShallowContract*`,
   `truthMismatch_*`, `shallowAuthoritativeStage`, `shallowContractAuthorityTrace`가
   어느 것이 SSOT인지 코드/주석에 명시되지 않은 채 공존했다.

4. **`attachShallowTruthObservabilityAlign01` 이름/역할 불일치**:
   "observability"라는 이름과 달리 policy side effect를 내부에서 수행하고 있었다.

---

## What was separated in PR-C

### A. Product policy vs completion owner

| 변경 전 | 변경 후 |
|---------|---------|
| `attachShallowTruthObservabilityAlign01` 내부에서 `applyUltraLowPolicyLock` 호출 | `attachShallowTruthObservabilityAlign01`은 **pure observability** helper로만 동작 |
| policy 적용 경계가 `attach` 내부에 숨어 있음 | `evaluators/squat.ts` evaluator boundary에서 **정확히 1회** `applyUltraLowPolicyLock` 호출 |

`applyUltraLowPolicyLock`는 `export`로 노출되어 evaluator에서 명시적으로 호출한다.
덮어쓰는 필드 세트는 **완전히 동일** — behavior change 없음, layer separation만.

실행 순서 (`evaluators/squat.ts`):
```
evaluateSquatCompletionState(...)          // core + canonical closer (pure completion owner)
  → readiness/setup observability 병합
  → late setup patch
  → attachShallowTruthObservabilityAlign01  // pure observability
  → applyUltraLowPolicyLock                // product policy, 1회만
```

### B. Drift prefix scan 복구

`resolveStandardDriftAfterShallowAdmission`의 prefix loop에서
`official_shallow_cycle` 문자열 단독 의존을 제거하고,
`evaluateSquatCompletionCore` 결과 기반 canonical contract 평가로 대체했다.

```ts
// 변경 전 (PR-B 이후 dead)
sn.officialShallowPathClosed &&
  (sn.completionPassReason === 'official_shallow_cycle' || ...)

// 변경 후 (PR-C)
const legacyCoreShallowClosed =
  sn.officialShallowPathClosed === true &&
  (sn.completionPassReason === 'low_rom_cycle' || sn.completionPassReason === 'ultra_low_rom_cycle');
const prefixCanonicalContract = deriveCanonicalShallowCompletionContract(
  buildCanonicalShallowContractInputFromState(sn)
);
const canonicalShallowCloseable = prefixCanonicalContract.satisfied === true;

if (legacyCoreShallowClosed || canonicalShallowCloseable) { ... }
```

**중요**: prefix마다 `evaluateSquatCompletionState` 전체를 재호출하지 않는다.
policy/attach/late-patch 없이 `evaluateSquatCompletionCore` + `deriveCanonicalShallowCompletionContract`만 사용.

### C. Canonical vs legacy observability 라벨링

`attachShallowTruthObservabilityAlign01` 반환부에 명시적 분류 주석 추가:

- **PRIMARY**: `canonicalShallowContract*` 필드들 (PR-A/B 이후 SSOT)
- **LEGACY / COMPAT**: `shallowAuthoritativeStage`, `shallowContractAuthorityTrace`,
  `truthMismatch_*`, `shallowNormalizedBlockerFamily`, `shallowAuthoritativeContractStatus`
  → 삭제하지 않고 compat 유지; canonical 필드가 SSOT임을 인지하고 사용

### D. `shallow-completion-contract.ts` 헤더 정렬

PR-A 문구("does not own completion")를 PR-B/C 이후 실제 구조에 맞게 업데이트:
- contract 함수 자체는 pure derivation (mutation 없음)
- downstream canonical closer가 이 contract를 유일 writer input으로 사용
- product policy는 contract 내부에서 적용하지 않음

---

## What remains legacy / compatibility only

- `shallowAuthoritativeClosureDecision` 결과 필드: canonical contract의 evidence input으로만 사용
- `shallowAuthoritativeStage`, `shallowContractAuthorityTrace`, `truthMismatch_*` 등 PR-2/ALIGN-01 계열: debug/compat 목적으로 유지

---

## What this PR intentionally does NOT change

- `applyCanonicalShallowClosureFromContract` writer 권한 — 변경 없음
- `applyUltraLowPolicyLock`가 덮어쓰는 필드 세트 — 완전히 동일 (behavior unchanged)
- threshold / timing / reversal / finalize constants
- event-cycle detector (`squat-event-cycle.ts`)
- reversal detector (`squat-reversal-confirmation.ts`)
- progression contract (`squat-progression-contract.ts`)
- `auto-progression.ts` (미수정)
- final pass / retry / confidence / pass confirmation policy

---

## Files changed

| 파일 | 변경 내용 |
|------|-----------|
| `src/lib/camera/squat-completion-state.ts` | `applyUltraLowPolicyLock` export, `attach` 내부 policy 호출 제거, drift prefix scan canonical 기준 복구, legacy 필드 분류 주석 |
| `src/lib/camera/evaluators/squat.ts` | `applyUltraLowPolicyLock` import, evaluator boundary 에서 1회 호출 |
| `src/lib/camera/squat/shallow-completion-contract.ts` | 파일 헤더 PR-B/C 현실에 맞게 정렬 |
| `docs/pr/PR-CAM-POLICY-DRIFT-OBSERVABILITY-SEPARATION-03.md` | 본 문서 |

---

## Verification

### 1. Policy separation
```
grep 'applyUltraLowPolicyLock' squat-completion-state.ts
```
- `attachShallowTruthObservabilityAlign01` 내부에 호출 없음
- `export function applyUltraLowPolicyLock` 선언 1개만 남음

```
grep 'applyUltraLowPolicyLock' evaluators/squat.ts
```
- import + 호출 각 1회만

### 2. Drift
```
grep 'official_shallow_cycle' squat-completion-state.ts
```
- `resolveStandardDriftAfterShallowAdmission` 내 `official_shallow_cycle` 문자열 의존 없음
- `applyCanonicalShallowClosureFromContract` 내부 1개만 남음

```
grep 'evaluateSquatCompletionState' squat-completion-state.ts
```
- drift prefix loop 내 `evaluateSquatCompletionState` 호출 없음 (core만 사용)

### 3. Writer integrity
```
grep "'official_shallow_cycle'" squat-completion-state.ts
```
- `applyCanonicalShallowClosureFromContract` 한 곳만

### 4. No threshold / gate change
- `squat-event-cycle.ts`, `squat-reversal-confirmation.ts`, `squat-progression-contract.ts`,
  `auto-progression.ts` diff 없음

---

## Known follow-up

- `shallowAuthoritativeClosureDecision` 계열 legacy 필드는 canonical contract 와 병렬 존재 → PR-D에서 점진적 deprecated 처리 가능
- `attachShallowTruthObservabilityAlign01` 함수 이름은 여전히 "ALIGN-01" suffix를 끌고 있음 → 다음 observability cleanup PR에서 rename 가능
- `truthMismatch_*` 필드 일부는 canonical closed 이후에도 mismatch로 계산될 수 있음 — debug용으로 허용하되 product 로직에 사용 금지

---

## One-line conclusion

PR-C는 shallow success writer를 더 건드리지 않고, product policy를 attach에서 분리하고,
drift를 canonical/core-realizable truth로 복구하고, canonical vs legacy observability를 명확히 라벨링한 layering cleanup PR이다.
