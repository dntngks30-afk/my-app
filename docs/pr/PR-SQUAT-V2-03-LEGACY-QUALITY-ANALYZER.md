# PR-SQUAT-V2-03 — Legacy Quality Analyzer Demotion

**Branch task**: PR6  
**Predecessor**: PR5-FIX-3 (PR-SQUAT-V2-02D-ATTEMPT-EPOCH-TAIL-CLOSURE-LOCK.md)  
**Status**: COMPLETE — all acceptance commands pass

---

## 1. PR 목적

PR5 계열에서 `SquatMotionEvidenceEngineV2.usableMotionEvidence`를 squat progression의 단독 runtime owner로 확립했다.

이 PR의 목적은 legacy completion / pass-core / completion-state 파이프라인 값들이 **더 이상 progression owner처럼 보이거나 작동하지 않도록 구조를 정리**하는 것이다.

삭제하지 않는다. `legacyQualityOrCompat` 블록 안에 명확히 위치시키고, 타입/주석/trace 분리를 통해 legacy 값의 역할을 debug/compat/false-positive-analysis 전용으로 고정한다.

---

## 2. PR5 residual risk — 이 PR에서 고치지 않는다

PR5-FIX-3 이후 5회 실기기 검증 중 1회 shallow squat 조기 통과 residual risk가 남아 있다 (PR-SQUAT-V2-02D §11.3).

**이 PR는 그 residual risk를 건드리지 않는다.**

다음을 변경하지 않는다:
- V2 pass semantics / pass logic
- V2 epoch / window / timing (5000ms binding, 4500ms cycle cap, 400ms tail freshness)
- V2 threshold
- auto-progression owner
- shallow pass 조건 / deep pass 조건
- final blocker 추가 없음

---

## 3. Assumptions

- PR5-FIX-3 수용 테스트가 green인 상태에서 시작
- runtime owner 분리는 이미 구조적으로 완료됨 (`progressionPassed = squatMotionEvidenceV2?.usableMotionEvidence === true`)
- PR6의 범위는 naming/type/trace 정리만

---

## 4. Findings — legacy authority candidates 조사 결과

### 4.1 V2 runtime owner 확인 (grep proof)

```
// src/lib/camera/auto-progression.ts line 3350-3352
const progressionPassed =
  stepId === 'squat'
    ? squatMotionEvidenceV2?.usableMotionEvidence === true
    : ...

// line 3392
const finalPassEligible = progressionPassed; // = finalPassBlockedReason === null

// line 3370-3371 — finalPassBlockedReason for squat
const finalPassBlockedReason =
  stepId === 'squat'
    ? getSquatMotionEvidenceV2BlockedReason(squatMotionEvidenceV2)
    : ...

// auto-progression.ts line 1235-1236 — isFinalPassLatched for squat
if (typeof gate.squatCycleDebug?.autoProgressionDecision?.progressionAllowed === 'boolean') {
  return gate.squatCycleDebug.autoProgressionDecision.progressionAllowed;
```

**결론: squat의 `progressionPassed`, `finalPassEligible`, `finalPassBlockedReason`, page latch 모두 순수 V2 기반.**

### 4.2 조사한 legacy authority candidates

| 필드 | 위치 | runtime 영향 | 판정 |
|------|------|-------------|------|
| `completionSatisfied` | `legacyQualityOrCompat` + top-level SquatCycleDebug | V2 false→true 불가 | DEBUG/COMPAT (이미 분리됨) |
| `completionBlockedReason` | `legacyQualityOrCompat` + top-level | V2 pass 차단 불가 | DEBUG/COMPAT (이미 분리됨) |
| `finalPassEligible` (legacy layer) | `legacyQualityOrCompat.finalPassEligible` | top-level `finalPassEligible`과 별개 | DEBUG/COMPAT (이미 분리됨) |
| `passCoreBlockedReason` | `legacyQualityOrCompat` | V2 pass 차단 불가 | DEBUG/COMPAT (이미 분리됨) |
| `uiProgressionAllowedLegacy` | `legacyQualityOrCompat` | V2 pass 차단 불가 | DEBUG/COMPAT (이미 분리됨) |
| `officialShallowPathBlockedReason` | `legacyQualityOrCompat` | V2 pass 차단 불가 | DEBUG/COMPAT (이미 분리됨) |
| `passOwner` | top-level SquatCycleDebug | runtime 영향 없음 | **PR6 강등 대상** |
| `finalSuccessOwner` | top-level SquatCycleDebug | runtime 영향 없음 | **PR6 강등 대상** |
| `completionTruthPassed` | top-level SquatCycleDebug | runtime 영향 없음 | **PR6 강등 대상** |
| `completionOwnerPassed` | top-level SquatCycleDebug | runtime 영향 없음 | **PR6 강등 대상** |
| `squatPostOwnerGateLayer.progressionPassed` | `legacyQualityOrCompat.finalPassEligible` 로 분리됨 | top-level에 영향 없음 | ALREADY DEMOTED |
| `squatUiGate.uiProgressionAllowed` | `legacyQualityOrCompat.uiProgressionAllowedLegacy` 로 분리됨 | top-level에 영향 없음 | ALREADY DEMOTED |

### 4.3 Safety gate 조사 결과 — PR6 중단 불필요

어떤 legacy 값도 V2 runtime owner를 뒤집지 못한다고 확인되었다.

`squatPostOwnerGateLayer`, `squatUiGate` 결과는 `legacyQualityOrCompat`에만 기록되고 `progressionPassed`(line 3350)나 `finalPassBlockedReason`(line 3370)에 영향을 주지 않는다.

`stampSquatFinalPassTimingBlockedReason` 함수 (line 2809)는 명시적으로:
> "Does NOT affect `progressionPassed`, `finalPassBlockedReason`, or any completion truth field"

---

## 5. 변경 사항 — 제거/강등한 legacy authority 목록

### 5.1 `SquatLegacyQualityOrCompatTrace` 타입 확장

```typescript
// src/lib/camera/auto-progression.ts
export type SquatLegacyQualityOrCompatTrace = {
  // 기존 (이미 분리됨)
  completionSatisfied?: boolean;
  completionBlockedReason?: string | null;
  passCoreBlockedReason?: string | null;
  finalPassEligible?: boolean;
  uiProgressionAllowedLegacy?: boolean;
  officialShallowPathBlockedReason?: string | null;
  // PR6 신규 추가 — legacyQualityOrCompat에 명시적 배치
  completionTruthPassed?: boolean;   // NOT a V2 gate
  completionOwnerPassed?: boolean;   // NOT a V2 gate
  passOwner?: SquatPassOwner;        // NOT a V2 runtime owner
  finalSuccessOwner?: SquatPassOwner | null; // NOT a V2 progression authority
};
```

### 5.2 `SquatCycleDebug` JSDoc 주석 강화

다음 필드에 `PR6-LEGACY-DEMOTION` 태그와 명시적 "NOT a V2 runtime owner/gate" 주석 추가:

- `completionTruthPassed`
- `passOwner`
- `finalSuccessOwner`
- `completionOwnerPassed`

### 5.3 `evaluateExerciseAutoProgress` — legacyQualityOrCompat 확장

```typescript
legacyQualityOrCompat: {
  ...squatCycleDebug.legacyQualityOrCompat,
  finalPassEligible: squatPostOwnerGateLayer?.progressionPassed,
  uiProgressionAllowedLegacy: squatUiGate?.uiProgressionAllowed,
  officialShallowPathBlockedReason: ...,
  // PR6 신규: top-level legacy 값들을 legacyQualityOrCompat에도 명시
  completionTruthPassed: squatCycleDebug.completionTruthPassed,
  completionOwnerPassed: squatOwnerTruth?.completionOwnerPassed,
  passOwner: lineageOwner,
  finalSuccessOwner,
},
```

---

## 6. legacyQualityOrCompat 구조

CURRENT_IMPLEMENTED:

```
legacyQualityOrCompat: {
  // 기존
  completionSatisfied        — legacy completion-state 결과
  completionBlockedReason    — legacy completion 차단 이유
  passCoreBlockedReason      — legacy pass-core 차단 이유
  finalPassEligible          — legacy post-owner gate 결과
  uiProgressionAllowedLegacy — legacy UI latch gate 결과
  officialShallowPathBlockedReason — legacy official-shallow-path 차단
  // PR6 추가
  completionTruthPassed      — legacy completion-truth predicate
  completionOwnerPassed      — legacy completion-owner 결과
  passOwner                  — legacy completion lineage 레이블
  finalSuccessOwner          — legacy passOwner 미러
}
```

**이 블록 안의 모든 값은 progression gate 입력이 아니다.** runtime owner는 `v2RuntimeOwnerDecision.usableMotionEvidence` 단독이다.

---

## 7. trace/debug 분리 구조

CURRENT_IMPLEMENTED:

```
ExerciseGateResult.squatCycleDebug:
├── v2RuntimeOwnerDecision       ← V2 runtime owner (sole progression truth)
│   └── usableMotionEvidence     ← gate input
├── autoProgressionDecision      ← V2 consumption record
│   ├── owner: 'squat_motion_evidence_v2'
│   ├── consumedField: 'usableMotionEvidence'
│   └── progressionAllowed       ← what isFinalPassLatched reads for squat
├── pageLatchDecision            ← isFinalPassLatched consumption trace
├── legacyQualityOrCompat        ← debug/compat/false-positive-analysis only
│   ├── completionSatisfied        (legacy)
│   ├── completionBlockedReason    (legacy)
│   ├── passCoreBlockedReason      (legacy)
│   ├── finalPassEligible          (legacy post-owner layer — NOT top-level)
│   ├── uiProgressionAllowedLegacy (legacy UI latch)
│   ├── officialShallowPathBlockedReason (legacy)
│   ├── completionTruthPassed      (PR6 추가 — legacy)
│   ├── completionOwnerPassed      (PR6 추가 — legacy)
│   ├── passOwner                  (PR6 추가 — legacy)
│   └── finalSuccessOwner          (PR6 추가 — legacy)
└── [top-level debug fields]     ← backward compat 유지 (gate 미사용)
    ├── passOwner                  (PR6-LEGACY-DEMOTION 주석)
    ├── finalSuccessOwner          (PR6-LEGACY-DEMOTION 주석)
    ├── completionTruthPassed      (PR6-LEGACY-DEMOTION 주석)
    ├── completionOwnerPassed      (PR6-LEGACY-DEMOTION 주석)
    └── ...
```

---

## 8. grep proof

### V2가 runtime owner임을 증명하는 grep

```
rg "progressionPassed" src/lib/camera/auto-progression.ts | grep -E "squat.*=|= stepId"
→ line 3350-3352: progressionPassed = stepId === 'squat'
    ? squatMotionEvidenceV2?.usableMotionEvidence === true

rg "finalPassEligible\s*=" src/lib/camera/auto-progression.ts
→ line 3392: const finalPassEligible = progressionPassed

rg "autoProgressionDecision" src/lib/camera/auto-progression.ts | head -6
→ owner: 'squat_motion_evidence_v2'
→ consumedField: 'usableMotionEvidence'
→ progressionAllowed: decision?.usableMotionEvidence === true
```

### legacyQualityOrCompat가 gate 입력이 아님을 증명하는 grep

```
rg "legacyQualityOrCompat" src/lib/camera/auto-progression.ts
→ 2354: legacyQualityOrCompat: { completionSatisfied, ... }  // 초기 추적 설정
→ 3186: legacyQualityOrCompat: { ...spread, PR6 추가 필드 } // 최종 추적 갱신
→ [progressionPassed 계산 경로에서 legacyQualityOrCompat 참조 없음]

rg "legacyQualityOrCompat" src/lib/camera
→ auto-progression.ts: 설정/갱신만
→ trace/camera-trace-observation-builders.ts: 관측/export만
→ trace/camera-trace-diagnosis-summary.ts: 요약 export만
→ camera-trace.ts: 타입 선언만
```

---

## 9. 변경 파일

- `src/lib/camera/auto-progression.ts`
  - `SquatLegacyQualityOrCompatTrace` 타입 확장 + JSDoc 보강
  - `SquatCycleDebug` 필드 JSDoc 주석 강화 (`passOwner`, `finalSuccessOwner`, `completionTruthPassed`, `completionOwnerPassed`)
  - `evaluateExerciseAutoProgress` — `legacyQualityOrCompat` 확장
- `docs/pr/PR-SQUAT-V2-03-LEGACY-QUALITY-ANALYZER.md` — 본 문서

**변경하지 않은 것:**
- V2 pass logic (`squat-motion-evidence-v2.ts`)
- V2 threshold / epoch / window / timing
- evaluators/squat.ts
- auto-progression owner (`squat_motion_evidence_v2`)
- overhead reach evaluator
- `/app/home`, `/app/checkin`, `/app/profile`
- AppShell, SessionPanelV2, ExercisePlayerModal
- auth, payment, onboarding, session execution
- fixtures, smoke scripts, golden harness

---

## 10. acceptance command 결과

```
npx tsx scripts/camera-squat-v2-01-motion-evidence-engine-smoke.mjs
→ 233 passed, 0 failed ✓

npx tsx scripts/camera-squat-v2-00-golden-trace-harness.mjs --strict
→ STRICT: all required contracts satisfied. ✓

npx tsx scripts/camera-squat-v2-01b-shadow-compare.mjs --strict
→ --strict: all V2 results match expected. ✓

npx tsx scripts/camera-squat-v2-02b-runtime-owner-truth-smoke.mjs
→ All PR5-FIX runtime owner truth checks passed. ✓
```

TypeScript:
- `npx tsc --noEmit` 오류 전체가 PR6 변경 파일과 무관한 기존 오류 (`SessionPanelV2.tsx`, `session/complete/route.ts`, `my-routine/page.tsx`, `providers.tsx`)
- PR6 변경 파일(`auto-progression.ts`)에서 새로운 TypeScript 오류 없음

---

## 11. PR7로 넘길 남은 작업

LOCKED_DIRECTION:

- PR7: 실제 false positive 분석 pipeline 구축 (실기기 JSON trace → legacyQualityOrCompat 읽기)
- PR7 이후에서만: residual early-pass risk의 원인 후보 중 narrow single-cause 확정 가능하면 재고
- PR7은 V2 pass semantics / timing / epoch / threshold / auto-progression owner를 건드리지 않는다

---

## 12. 최종 보고서 — 12개 질문 답변

**1. 이번 PR이 V2 pass logic을 수정했는가?**

**NO.** `squat-motion-evidence-v2.ts` 및 V2 evaluation 경로 무수정.

**2. 이번 PR이 V2 epoch/window/timing을 수정했는가?**

**NO.** 5000ms window binding, 4500ms cycle cap, 400ms tail freshness 무수정.

**3. auto-progression owner는 여전히 squat_motion_evidence_v2인가?**

**YES.** `autoProgressionDecision.owner = 'squat_motion_evidence_v2'` — runtime owner truth smoke 전체 통과.

**4. auto-progression이 소비하는 field는 여전히 usableMotionEvidence인가?**

**YES.** `consumedField: 'usableMotionEvidence'` — 변경 없음.

**5. completionSatisfied가 progression owner로 남아 있는가?**

**NO.** `legacyQualityOrCompat.completionSatisfied`로 위치하며, `progressionPassed` 계산에서 squat는 V2만 읽는다.

**6. completionBlockedReason이 V2 pass를 막을 수 있는가?**

**NO.** `legacyQualityOrCompat.completionBlockedReason` — V2 pass 차단 불가. 이미 PR5 계열에서 분리됨.

**7. finalPassEligible이 V2 pass를 막을 수 있는가?**

**NO.** top-level `finalPassEligible = progressionPassed = V2`; `legacyQualityOrCompat.finalPassEligible`는 legacy layer 결과로 별개.

**8. legacy 값이 V2 false를 true로 만들 수 있는가?**

**NO.** `progressionPassed` 계산 경로에서 legacy 값은 읽히지 않는다.

**9. legacy 값은 어디에 남겼는가?**

`legacyQualityOrCompat` 블록 및 `SquatCycleDebug` top-level (backward compat). 두 위치 모두 gate 입력이 아니라 debug/compat/false-positive-analysis 전용.

**10. grep proof는 무엇인가?**

§8 참고. 핵심:
- `progressionPassed = squatMotionEvidenceV2?.usableMotionEvidence === true` (line 3352)
- `legacyQualityOrCompat` 참조가 progressionPassed 계산 경로에 없음

**11. overhead reach나 /app execution을 건드렸는가?**

**NO.** overhead reach evaluator, /app/* 전체 무수정.

**12. PR5 residual early-pass risk를 건드렸는가?**

**NO.** V2 timing / epoch / window / threshold 무수정. residual risk는 Known residual risk로 문서화된 채 유지됨 (PR-SQUAT-V2-02D §11.3).
