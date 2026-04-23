# PR-X2-B 구현 노트 — Shallow Close Proof Repair

Parent SSOT: `docs/pr/PR-X2-shallow-squat-truth-map-parent-ssot.md`
Prior child: `docs/pr/PR-X2-A-shallow-epoch-acquisition-implementation-note.md`
Prompt: `docs/pr/PR-X2-B-implementation-prompt.md` (또는 `/mnt/data` 사본)

---

## 1. 목표 재진술

Trace 상 아래 조합이 모두 만족된 ultra-shallow / true shallow 케이스가
`shallow_descent_too_short` 로 꺼지던 문제를 해소한다.

- `officialShallowPathAdmitted = true`
- `attemptStarted = true`
- `descendConfirmed = true`
- `reversalConfirmedAfterDescend = true`
- `recoveryConfirmedAfterReversal = true`
- `officialShallowReversalSatisfied = true`
- `officialShallowAscentEquivalentSatisfied = true`
- `canonicalTemporalEpochOrderSatisfied = true`
- setup clean / readiness stable
- 그러나 `state.squatDescentToPeakMs < 200ms`

이 조합이 보이면 descent span 길이가 아니라 **shallow cycle order truth** 로
shallow close 가 통과되어야 한다.

PR-X2-B 는 다음은 **하지 않는다**.
- `not_armed` 패밀리를 재해결(PR-X2-A 영역).
- `no_reversal` / `no_recovery` 패밀리를 억지로 통과시킴.
- setup suppression 패밀리를 통과시킴.
- `shallow_descent_too_short` / `shallow_reversal_to_standing_too_short` 시간
  상수를 전반적으로 낮춤.
- final pass owner 를 `completion` 이 아닌 다른 레이어로 이동.

---

## 2. 원인 진단 (현재 코드 기준)

### 2.1 `shallow_descent_too_short` 가 발사되는 지점

`src/lib/camera/evaluators/squat-meaningful-shallow.ts` 의
`getShallowMeaningfulCycleBlockReason(state)` 에는 세 경로가 있다.

1. `completionPassReason === 'official_shallow_cycle'`
2. `completionPassReason === 'ultra_low_rom_cycle'` (ultra-low policy가 legitimate
   으로 판정한 뒤)
3. 기본 `low_rom_cycle` 경로

세 경로 모두 내부에서 동일하게
`state.squatDescentToPeakMs < MIN_DESCENT_TO_PEAK_MS_SHALLOW (200ms)` 이면
`shallow_descent_too_short` 을 반환한다. 이어 `evaluateSquat()` 에서
`demoteMeaninglessShallowPass()` 가 호출되어 pass 가 `not_confirmed` 로
강등된다.

### 2.2 `squatDescentToPeakMs` 정의

`src/lib/camera/squat/squat-completion-core.ts`:

```ts
const squatDescentToPeakMs =
  selectedCanonicalDescentTimingEpoch != null
    ? peakFrame.timestampMs - selectedCanonicalDescentTimingEpoch.timestampMs
    : undefined;
```

즉 descent onset 부터 peak frame 까지의 실제 시간이다. 저 fps ultra-shallow
상황에서 2~3 프레임만 사이에 있으면 이 값은 자연스럽게 200ms 미만이다.
하지만 그 rep 이 `reversal`·`recovery`·`ascent-equivalent` 까지 전부 찍는다면
descent 가 "있었음" 은 이미 cycle order 가 증명한다.

### 2.3 현재 close proof 의 truth source 오염

- 체인: `descend → reversal → recovery → ascent-equivalent → closure proof`
  (`sameRepOfficialShallowCloseOwnershipRecoveryEligible`,
  `sameRepShallowCloseRecoveryEligible`,
  `officialShallowAdmittedToClosedContractEligible` 등) 은 이미 cycle order
  가 충족돼도 **evaluator 레이어** 에서 descent span 시간으로 두 번 거른다.
- 그 결과 final blocker 가 `shallow_descent_too_short` 하나로 뭉개지는 패턴
  (Case A) 이 반복된다.

---

## 3. 수정 내용

### 3.1 신규 헬퍼 `src/lib/camera/squat/squat-shallow-close-proof.ts`

`computeShallowCycleCloseProofDecision(state)` 는 **순수 함수** 로 state 의 기존
필드만 읽어 아래 결정을 반환한다.

- `cycleCloseProofSatisfied: boolean`
- `cycleCloseProofReason: null | 'shallow_cycle_order_proved'`
- `cycleCloseProofBlockedReason`: 14개의 canonical 사유 중 하나
- `observationStage`: `pre_admission` / `admitted_without_reversal` /
  `reversal_without_recovery` / `recovery_without_ascent_equivalent` /
  `cycle_complete_but_blocked` / `shallow_cycle_close_proof_candidate` /
  `not_evaluated`
- `gates`: 14 필드 게이트 breakdown
- `notes`: trace 보조

`satisfied = true` 가 되기 위한 조건은 아래 전부:

| Gate                          | 필드                                         |
| ----------------------------- | -------------------------------------------- |
| setup clean                   | `setupMotionBlocked !== true`                |
| readiness stable              | `readinessStableDwellSatisfied !== false`    |
| admitted                      | `officialShallowPathAdmitted === true`       |
| shallow band                  | `0 < relativeDepthPeak < 0.4`                |
| attempt started               | `attemptStarted === true`                    |
| descend confirmed             | `descendConfirmed && downwardCommitmentReached` |
| reversal confirmed            | `reversalConfirmedAfterDescend === true`     |
| reversal by rule/HMM          | `reversalConfirmedByRuleOrHmm === true`      |
| recovery confirmed            | `recoveryConfirmedAfterReversal === true`    |
| official shallow reversal     | `officialShallowReversalSatisfied === true`  |
| official shallow ascent-eq    | `officialShallowAscentEquivalentSatisfied === true` |
| canonical temporal order      | `canonicalTemporalEpochOrderSatisfied === true` |
| no event-cycle short-circuit  | `eventCyclePromoted !== true`                |
| no trajectory rescue          | `trajectoryReversalRescueApplied !== true`   |

핵심 false-positive 방지 설계:

- `reversalConfirmedByRuleOrHmm === true` 가 **필수**. jitter / fake peak /
  trajectory-only reversal 은 이 필드를 켜지 못하므로 close proof 도 못 켠다.
- `trajectoryReversalRescueApplied === true` 면 즉시 블럭. canonical contract
  anti-false-pass 와 동일한 규칙.
- `setupMotionBlocked === true` 면 즉시 블럭. setup suppression 패밀리가
  새어나오지 않는다.

신규 threshold 는 0 개. 기존 numeric gate 를 낮추지 않았다.

### 3.2 `squat-meaningful-shallow.ts` 연결

`getShallowMeaningfulCycleBlockReason(state)` 의 **세 경로 모두** 에서
`shallow_descent_too_short` 반환 직전에 close proof 를 확인한다.

```ts
if (
  (state.squatDescentToPeakMs == null ||
    state.squatDescentToPeakMs < MIN_DESCENT_TO_PEAK_MS_SHALLOW) &&
  !shallowCycleCloseProof.cycleCloseProofSatisfied
) {
  return 'shallow_descent_too_short';
}
```

즉 close proof 가 성립하면 해당 게이트 **하나** 만 건너뛴다. 나머지
게이트는 전부 그대로 유지된다:

- phase gate (`standing_recovered_required`)
- `rule_based_reversal_required` (ultra/low-rom 경로)
- event-cycle 체인 (`event_cycle_*_missing`)
- `shallow_reversal_to_standing_too_short` (ascent 최소 span)
- `current_rep_ownership_blocked` (aggregation 상한)
- `primary_depth_below_low_rom_floor`
- `official_shallow_closure_not_satisfied`
- `trajectory_rescue_not_allowed`
- `event_promotion_not_allowed`
- ultra-low policy lock (`ultra_low_rom_not_allowed`)

### 3.3 진단 가시성

`evaluateSquat()` 이 close proof 결정을 **항상** 계산해
`result.debug.highlightedMetrics` 에 아래 5개 필드를 노출한다.
demotion 여부와 상관없이 trace 에 남는다.

- `shallowCycleCloseProofSatisfied` (0/1)
- `shallowCycleCloseProofReason` (`'shallow_cycle_order_proved'` | null)
- `shallowCycleCloseProofBlockedReason` (14개 canonical 사유 또는 null)
- `shallowCycleCloseProofStage` (observation stage)
- `shallowCycleCloseProofApplied` (0/1 — 실제로 descent-span 게이트를 우회한
  순간에만 1)

이로써 trace 에서

- shallow cycle 이 있었는지
- close proof 만 실패했는지 (어느 축에서)
- setup suppression 때문인지
- reversal/recovery 가 실제로 없었는지

를 분해해 볼 수 있다.

### 3.4 바꾸지 않은 것

- `src/lib/camera/squat/squat-shallow-epoch-acquisition.ts`
  (PR-X2-A, acquisition contract). 재배선 / 완화 없음.
- `src/lib/camera/squat/squat-completion-core.ts` —
  `officialShallowClosureProofSatisfied` 계산식, descent timing 계산식,
  pass reason 결정, canonical contract 에 손 안 댐.
- `src/lib/camera/squat-completion-state.ts` — `sameRepShallowCloseRecoveryEligible`,
  `officialShallowAdmittedToClosedContractEligible`,
  `sameRepOfficialShallowCloseOwnershipRecoveryEligible` 전부 그대로.
- final pass owner 체계: `finalPassSource = completion`,
  `finalSuccessOwner ∈ {completion_truth_standard, completion_truth_shallow, null}`
  유지. pass-core / event-cycle / official shallow / UI 모두 final veto/grant
  권한 없음.

---

## 4. 변경 후 shallow close truth chain

```
valid shallow attempt epoch (PR-X2-A acquisition or natural arm)
  ↓
descendConfirmed + downwardCommitmentReached (completion-core)
  ↓
reversalConfirmedAfterDescend + reversalConfirmedByRuleOrHmm (completion-core)
  ↓
recoveryConfirmedAfterReversal (completion-core)
  ↓
officialShallowReversalSatisfied + officialShallowAscentEquivalentSatisfied
  (completion-core)
  ↓
canonicalTemporalEpochOrderSatisfied (completion-core temporal ledger)
  ↓
setupMotionBlocked = false + readinessStableDwellSatisfied ≠ false
  (squat-completion-state)
  ↓
computeShallowCycleCloseProofDecision() (PR-X2-B — this change)
  ↓
getShallowMeaningfulCycleBlockReason() bypasses shallow_descent_too_short
  (PR-X2-B)
  ↓
completionPassReason ∈ {low_rom_cycle, ultra_low_rom_cycle,
                         official_shallow_cycle}
  (unchanged, written by completion-core)
  ↓
finalSuccessOwner = completion_truth_shallow
finalPassSource = completion
```

---

## 5. 검증 결과

### 5.1 PR-X2-B 전용 smoke (`scripts/camera-pr-x2-b-shallow-close-proof-smoke.mjs`)

25/25 통과.

- Unit: 10 케이스 — satisfied / blocked 사유별 단일 canonical 반환
- Evaluator MUST: 4 케이스 — 3 pass reason × cycle-order-proven + short
  descent 에서 전부 bypass, Case A 정확한 패턴 bypass 확인.
- Evaluator MUST-STAY-BLOCKED: 4 케이스 — no_reversal / trajectory-only /
  setup-blocked / temporal disorder 는 여전히 `shallow_descent_too_short`.
- 다른 게이트 invariant: 3 케이스 — phase / reversal-to-standing 하한 / 상한
  은 우회되지 않음.
- Regression: 2 케이스 — standard_cycle, 기존 gold path.
- Invariant: 2 케이스 — undefined state / PR-X2-A acquisition 필드 제거.

### 5.2 기존 smoke

| Smoke                                                                           | 결과                                          |
| ------------------------------------------------------------------------------- | --------------------------------------------- |
| `camera-pr-squat-meaningful-shallow-gate-01-smoke.mjs`                          | 8/8 pass                                      |
| `camera-pr10c-meaningful-shallow-current-rep-only-smoke.mjs`                    | 67/67 pass                                    |
| `camera-pr11-meaningful-shallow-gold-path-only-smoke.mjs`                       | 57/57 pass                                    |
| `camera-pr10b-meaningful-shallow-terminal-ownership-smoke.mjs`                  | 41/43 — 실패 2건은 baseline (canonical contract) 기존 실패, PR-X2-B 무관 |
| `camera-pr9-meaningful-shallow-default-pass-smoke.mjs`                          | 37/53 — 실패 16건 전부 baseline 기존 실패, PR-X2-B 무관 |
| `camera-pr-x2-a-shallow-epoch-acquisition-smoke.mjs`                            | 16/16 pass — PR-X2-A 보존                     |

**Baseline 검증 방법**: PR-X2-B 변경을 `git stash` 로 빼고 동일 smoke 를 돌린
뒤 실패 id 가 동일함을 확인. PR-X2-B 가 새 regression 을 만들지 않음.

특히 PR-10C Section C (`shallow_descent_too_short` jitter 가드) 는 6/6 전부
유지. 해당 fixture 들은 cycle order 필드를 세팅하지 않으므로 close proof 가
false 로 남아 descent-span 게이트가 계속 발사된다.

### 5.3 TypeScript

`npx tsc --noEmit` 에서 `squat-meaningful-shallow.ts` / `squat-shallow-close-proof.ts`
관련 에러 수: baseline 3, after-PR-X2-B 3. **새 타입 에러 0**.

### 5.4 Lint

`ReadLints` — PR-X2-B 수정/신규 3파일 모두 clean.

---

## 6. Acceptance 재확인 (프롬프트 기준)

| 항목                                                                 | 결과 |
| -------------------------------------------------------------------- | ---- |
| 1. shallow valid close family 가 실제로 열림                         | ✔ smoke Case A + 3 pass reason |
| 2. `shallow_descent_too_short` 는 진짜 close-fail 가족에서만 남음    | ✔ MUST-STAY-BLOCKED 4 케이스   |
| 3. deep / standard pass regress 없음                                 | ✔ standard_cycle regression 통과 |
| 4. `not_armed` 가족을 broad threshold 로 우회하지 않음               | ✔ PR-X2-A 보존, acquisition 건드리지 않음 |
| 5. standing / seated / setup-blocked false pass 0                    | ✔ close proof 가 setup/band/reversal 에서 차단 |
| 6. final owner remains completion only                               | ✔ 구조 변경 없음               |
| 7. pass-core / official shallow / event-cycle / UI gate 가 final veto / grant 를 하지 않음 | ✔ 구조 변경 없음 |

---

## 7. 후속 작업 (이 PR 범위 밖)

- `reversal_confirmed` 에 이르지 못하는 `not_armed` / `no_reversal` /
  `no_recovery` 패밀리: 별도 PR.
- canonical contract baseline 실패 (PR-9 / PR-10B) 복구: 별도 PR.
- shallow close proof trace 를 camera-trace bundle / diagnosis-summary
  level 로 끌어올리는 작업 (현재는 `highlightedMetrics` 에만 노출).

---

## 8. 파일 변경 목록

**신규**
- `src/lib/camera/squat/squat-shallow-close-proof.ts`
- `scripts/camera-pr-x2-b-shallow-close-proof-smoke.mjs`
- `docs/pr/PR-X2-B-shallow-close-proof-implementation-note.md`

**수정**
- `src/lib/camera/evaluators/squat-meaningful-shallow.ts`
  - import `computeShallowCycleCloseProofDecision` / `ShallowCycleCloseProofDecision`.
  - `getShallowMeaningfulCycleBlockReason`: 세 `shallow_descent_too_short`
    반환 직전에 close proof bypass 추가.
  - `evaluateSquat`: close proof 결정을 계산해
    `attachShallowCycleCloseProofTrace` 로 `highlightedMetrics` 에 5 필드
    기록.
