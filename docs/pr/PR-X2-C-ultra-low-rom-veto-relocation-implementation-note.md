# PR-X2-C — Ultra-Low-ROM Late Veto Relocation (Implementation Note)

Parent SSOT: `docs/pr/PR-X2-shallow-squat-truth-map-parent-ssot.md`
Prompt: `docs/pr/PR-X2-C-implementation-prompt.md`

Sibling notes:
- PR-X2-A (acquisition repair): `PR-X2-A-shallow-epoch-acquisition-implementation-note.md`
- PR-X2-B (close-proof repair): `PR-X2-B-shallow-close-proof-implementation-note.md`

## 1. 한 줄 요약

`ultra_low_rom_not_allowed` 를 **late close veto** 에서 떼어내고,
**static ultra-low reject** 와 **dynamic cycle-proven ultra-shallow allow**
를 policy 이름 / 관측성 / 런타임 경로로 분리했다.

- 동적 shallow cycle 이 §5.A 불변식을 모두 만족하는 rep 에서는
  `ultra_low_rom_not_allowed` 가 final close blocked reason 으로 더 이상 남지 않는다.
- static / noise / seated-hold / standing-only / jitter / fake-recovery /
  setup-blocked / trajectory-rescue / event-cycle-only 패밀리는
  여전히 **early reject** 라벨로 `ultra_low_rom_not_allowed` 를 생성해 막는다.
- `completion` 이 final pass owner 라는 계약은 유지된다.

## 2. 문제 진단

현재 trace 기준 dynamic cycle-proven ultra-shallow 에서 다음 조합이 관측된다.

- `relativeDepthPeak ≈ 0.06`
- `attemptStarted = true`, `descendConfirmed = true`
- `reversalConfirmedAfterDescend = true`, `recoveryConfirmedAfterReversal = true`
- `officialShallowPathAdmitted = true`
- `officialShallowStreamBridgeApplied = true`
- `officialShallowAscentEquivalentSatisfied = true`
- `officialShallowReversalSatisfied = true`
- `setupMotionBlocked = false`, `readinessStableDwellSatisfied = true`

그런데도 최종적으로
`completionBlockedReason = "ultra_low_rom_not_allowed"` /
`officialShallowPathBlockedReason = "ultra_low_rom_not_allowed"` /
`completionPassReason = "not_confirmed"` 로 죽는다.

### 원인 — ownership chain

`ultra_low_rom_not_allowed` 의 runtime 생성 단일 지점은 하나뿐이다.

- `src/lib/camera/evaluators/squat-meaningful-shallow.ts` 의 `getShallowMeaningfulCycleBlockReason`
  → `completionPassReason === 'ultra_low_rom_cycle'` 분기에서,
  policy layer (`ultraLowPolicyBlocked !== false`) 와
  provisional shallow terminal authority
  (`resolveProvisionalShallowTerminalAuthority(...).satisfied`)
  가 모두 legitimate 판정을 못 내리면 `'ultra_low_rom_not_allowed'` 를 반환한다.

이 반환값은 `demoteMeaninglessShallowPass` 에서
`completionBlockedReason` / `officialShallowPathBlockedReason` /
`postAssistCompletionBlockedReason` / `completionOwnerBlockedReason` /
`uiProgressionBlockedReason` 으로 동일 문자열이 fan-out 된다.

정적 reject 와 동적 cycle 허용이 같은 policy 이름 아래 섞여서,
**late close 단계** 에서 동일한 blocker 로 처리되고 있었다.

기타 참조:
- `squat-completion-state.ts:1317` `ULTRA_LOW_ROM_POLICY_BLOCK_REASON` 상수 —
  선언만 되어 있고 실제로 어느 writer 도 이 상수로 `completionBlockedReason` 에
  쓰지 않는다. `applyUltraLowPolicyLock` 은 annotation-only 이다.
- `squat-completion-core.ts:4307` `SHALLOW_CONTRACT_BLOCKER_POLICY` —
  evaluator 가 쓴 reason 을 consume 하는 분류 테이블. 생성자가 아니다.
- `auto-progression.ts:2368` — 주석에서 레거시 경로를 언급할 뿐 현재 읽지 않는다.

즉 **생성자는 오직 하나** 였고, 그 한 지점에서 static / dynamic 이 분기 없이
같은 late 경로로 흘러 들어가는 것이 문제였다.

## 3. 해결 방향

`static ultra-low reject early` / `dynamic cycle-proven ultra-shallow allow late`
규칙을 코드와 trace 양쪽에서 성립시킨다.

### 설계 원칙

1. Late 경로에서 `ultra_low_rom_not_allowed` 문자열 자체를 없애지 않는다.
   → static / noise / setup-blocked 패밀리는 여전히 이 문자열로 막혀야 한다.
2. 대신 dynamic cycle-proven 조건 (§5.A) 이 모두 참일 때 **late veto 생성을 건너뛴다**.
   → 이는 권장안 2 ("generate 자체를 skip") 를 따른다.
3. X2-B 의 close proof helper 를 재사용하지 않는다.
   → X2-B 는 `reversalConfirmedByRuleOrHmm === true` +
   `canonicalTemporalEpochOrderSatisfied === true` 등 더 엄격한 가드를 갖는다.
   → X2-C 는 §5.A verbatim 만 사용해야 한다 (X2-D temporal alignment 문제를
   겸하지 않기 위함, prompt §11 "두 우회를 한 덩어리 예외처리로 합치지 마라").

### 구현 요약

- 신규 helper: `src/lib/camera/squat/squat-ultra-low-rom-veto-relocation.ts`
  - `computeUltraLowRomVetoRelocationDecision(state)` — 순수 함수.
  - 반환값 3분류: `not_scoped` / `early_reject` / `cycle_proven_allow`.
  - `cycle_proven_allow` 기준은 prompt §5.A 그대로 + `eventCyclePromoted !== true`
    (§6 "no pass-core authority return" 불변식).
- 소비 지점: `squat-meaningful-shallow.ts` `getShallowMeaningfulCycleBlockReason`
  의 `ultra_low_rom_cycle` 분기.
  - 기존 2 개 legitimacy 경로 (`ultraLowPolicyBlocked === false` /
    `provisionalShallowTerminalAuthority === true`) 에
    **세 번째** disjunct (`ultraLowVetoDecision.lateVetoBypass === true`) 를 추가.
  - 세 경로 모두 downstream gold-path gate (phase, reversal-source,
    reversal-to-standing bound, current-rep ownership, shallow-close-proof
    descent bypass) 를 **동일하게** 통과해야 한다.
- Trace 표면: `evaluateSquat` 에서 `attachUltraLowRomVetoRelocationTrace` 를 호출해
  `highlightedMetrics` 에 다음 필드를 기록한다.
  - `ultraLowRomPolicyMode` — `not_scoped` / `early_reject` / `cycle_proven_allow`
  - `ultraLowRomPolicyRejectedEarly` — 0 / 1
  - `ultraLowRomPolicyRejectReason` — early reject 원인
  - `ultraLowRomLateVetoBypassed` — 0 / 1 (실제로 bypass 가 적용된 프레임만 1)
  - `ultraLowRomPolicyInScope` — 0 / 1

## 4. 변경 파일

- `src/lib/camera/squat/squat-ultra-low-rom-veto-relocation.ts` — 신규.
- `src/lib/camera/evaluators/squat-meaningful-shallow.ts` —
  import 추가, `ultra_low_rom_cycle` legitimacy 분기에 X2-C 우회 추가,
  `attachUltraLowRomVetoRelocationTrace` 추가, `evaluateSquat` 에 연결.
- `scripts/camera-pr-x2-c-ultra-low-rom-veto-relocation-smoke.mjs` — 신규 smoke.

## 5. 불변식 보존

| 불변식 | 보존 근거 |
| --- | --- |
| no descent, no pass | §5.A `descendConfirmed` false → `early_reject(descend_not_confirmed)`, late 경로 진입 불가 |
| no reversal after descend | `reversalConfirmedAfterDescend` false → `early_reject(reversal_not_confirmed)` |
| no recovery after reversal | `recoveryConfirmedAfterReversal` false → `early_reject(recovery_not_confirmed)` |
| setup blocked | `setupMotionBlocked === true` → `early_reject(setup_motion_blocked)` |
| static seated/standing hold | descent / reversal / recovery 가 하나라도 false → early_reject |
| jitter / fake peak / 1-frame reversal | `officialShallowReversalSatisfied` + `reversalConfirmedAfterDescend` 로 upstream 에서 필터됨 |
| trajectory rescue only | `trajectoryReversalRescueApplied === true` → `early_reject(trajectory_rescue_applied)` |
| event-cycle-only pass | `eventCyclePromoted === true` → `early_reject(event_cycle_short_circuit)` |
| completion = final owner | evaluator 는 여전히 `reason` 을 반환하거나 null 을 반환할 뿐, final pass 는 completion 이 소유 |
| X2-D 영역 건드리지 않음 | X2-C 는 `reversalConfirmedByRuleOrHmm` 및 `canonicalTemporalEpochOrderSatisfied` 를 요구하지 않으므로 temporal alignment 문제와 독립 |

## 6. 검증

### A. allow lane

PR-X2-C smoke 의 allow 섹션 (3 케이스):

- cycle-proven base (`ultraLowPolicyBlocked = true`, provisional 실패) →
  `reason !== 'ultra_low_rom_not_allowed'`
- Parent-SSOT Case B trace pattern (`relativeDepthPeak = 0.06`) →
  `reason !== 'ultra_low_rom_not_allowed'`
- cycle-proven + short descent (X2-B + X2-C 합성) → 둘 다 우회되어 `reason == null`

### B. must stay blocked

8 개 static / noise / rescue / event-cycle / setup / admission 패밀리가
여전히 `reason === 'ultra_low_rom_not_allowed'` 로 막히는 것을 확인.

### C. regressions & downstream

- standard_cycle 은 이 gate 가 touch 하지 않음 (`null`).
- policy-legitimate ultra-low 는 X2-C 없이도 통과 (pre-X2-C 동작 보존).
- cycle-proven + 잘못된 phase / trajectory-only reversal provenance /
  short reversal-to-standing / aggregation span 은 모두 **기존 더 구체적인**
  blocker 로 떨어진다 (`standing_recovered_required` /
  `rule_based_reversal_required` / `shallow_reversal_to_standing_too_short` /
  `current_rep_ownership_blocked`).

### 실행 결과

```
scripts/camera-pr-x2-c-ultra-low-rom-veto-relocation-smoke.mjs
RESULT: 33 passed, 0 failed

scripts/camera-pr-x2-b-shallow-close-proof-smoke.mjs
RESULT: 25 passed, 0 failed   (regress 없음)

scripts/camera-pr-x2-a-shallow-epoch-acquisition-smoke.mjs
RESULT: 16 passed, 0 failed   (regress 없음)

scripts/camera-pr-squat-meaningful-shallow-gate-01-smoke.mjs
Done: 8 passed, 0 failed      (regress 없음)

scripts/camera-pr-x-single-completion-authority-squat-smoke.mjs
summary: 23 passed, 0 failed  (regress 없음)
```

TypeScript:
- `npx tsc --noEmit` → baseline 189 errors (X2-C 적용 전) vs 189 errors (X2-C 적용 후).
- 신규 에러 0, 라인 시프트만 발생.

## 7. 금지 조항 준수

| 항목 | 준수 여부 |
| --- | --- |
| threshold 숫자 변경 | 변경 없음 — 어떤 상수도 건드리지 않음 |
| ultra-low broadening | policy 의미를 넓힌 것이 아니라 static vs dynamic 을 구조적으로 분리 |
| setup suppress 완화 | `setupMotionBlocked === true` 시 즉시 early_reject |
| pass-core / eventCycle final owner 복귀 | `eventCyclePromoted === true` 는 early_reject |
| X2-D 함께 해결 시도 | X2-C 는 `canonicalTemporalEpochOrderSatisfied` / `reversalConfirmedByRuleOrHmm` 를 요구하지 않음으로써 X2-D 영역에 침범하지 않음 |
| X2-B 우회와 X2-C 우회를 한 덩어리 예외처리로 합치기 | 별도 helper (`squat-ultra-low-rom-veto-relocation.ts`) 로 분리, 별도 predicate |

## 8. 요약 — policy / ownership chain (변경 후)

```
ultra-low candidate
  -> early policy split
     - static/noise ultra-low  : early_reject (ultra_low_rom_not_allowed)
     - dynamic cycle-capable   : continue
  -> shallow admitted
  -> reversal/recovery/ascent-equivalent satisfied
  -> late close 진입
     - policy legitimate        -> allow (기존 경로)
     - provisional authority    -> allow (기존 경로)
     - cycle_proven_allow (X2-C) -> allow (신규)
     - 그 외                    -> 기존 gold-path gate 또는 early_reject 에서 이미 차단됨
  -> completion = final pass owner
```

## 9. 남아있는 후속 작업

X2-C 범위가 아니지만 trace 상 남을 수 있는 잔여 이슈:

- **X2-D (temporal epoch alignment)** — `completionSatisfied=true` 인데
  `finalPassEligible=false` 가 `temporal_epoch_order:missing_reversal_epoch`
  로 남는 케이스. X2-C 의 allow lane 에서는 더 이상 `ultra_low_rom_not_allowed`
  로 죽지 않지만, 동일 rep 에서 X2-D 가 여전히 final surface 를 막을 수 있다.
  이 경로는 prompt §6 에 따라 이번 PR 에서 건드리지 않았다.
