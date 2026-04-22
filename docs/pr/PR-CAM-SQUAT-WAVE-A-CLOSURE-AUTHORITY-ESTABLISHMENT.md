# PR-CAM-SQUAT-WAVE-A — Shallow Terminal Close Authority Establishment

> **Scope**: WAVE A only (= PR-7 + PR-8).
> **Wave B opener unification / pass-core integration is NOT included.**

---

## 1. Parent SSOT

이 PR 은 아래 문서들을 상위 문맥으로 갖는다.

- `docs/pr/PR-CAM-SQUAT-SHALLOW-POST-PR6-RESIDUAL-TRUTH-MAP.md`
- `docs/pr/PR-CAM-SQUAT-SHALLOW-POST-PR6-EXECUTION-WAVE-PLAN.md`
- `docs/pr/PR-CAM-SQUAT-OFFICIAL-SHALLOW-OWNER-LOCK-SSOT.md`
- `docs/SHALLOW_SQUAT_TRUTH_SSOT_2026_04_01.md`
- `docs/pr/PR-E-residual-risk-closure-truth-map.md`
- `docs/pr/PR-E1-conditional-shallow-lock-promotion-map.md`
- `docs/pr/PR-F-shallow-real-path-permanent-lock-truth-map.md`
- `docs/pr/PR-CAM-SQUAT-AUTHORITY-LAW-RESOLUTION.md`

이번 wave 는 parent ssot 의
**Truth Layer 6.3 (closure proof truth) → 6.4 (terminal close authority)**
promotion gap 만 좁힌다.

---

## 2. Scope

본 PR 은 아래 2개 목표만 구현한다.

- **PR-7**: `shallow closure proof` → `officialShallowPathClosed` terminal close authority 승격
- **PR-8**: same-epoch 에서 standard-veto family 가 `officialShallowPathClosed` 를 다시 뒤집지 못하도록 차단

Wave B(opener 통합) / Wave C / Wave D 영역은 **일절 건드리지 않는다.**

---

## 3. Exact Bug Being Fixed

현재 residual truth map 기준 dominant family(Family B):

- `officialShallowPathCandidate === true`
- `officialShallowPathAdmitted === true`
- `officialShallowClosureProofSatisfied === true`
- `officialShallowAscentEquivalentSatisfied === true`
- `officialShallowStreamBridgeApplied === true`
- PR-2 false-pass guard clear (standing / seated / jitter / setup 모두 미해당)

까지 도달한 same-epoch shallow rep 임에도:

- `officialShallowPathClosed === false`
- `uiProgressionAllowed === false`
- `finalPassEligible === false`

로 종료된다.

마지막 blocker 는 threshold 부족이 아니라
**`resolveOfficialShallowClosureContract()` 가 `satisfied=false` 를 반환**하기 때문이다.

세부 원인:

- Family A (`strict_shallow_cycle`) 는 `standingProofPresent` (= `standingFinalizeSatisfied && standingRecoveredAtMs != null`) 를 요구
- Family B (`shallow_ascent_equivalent`) 는 `recoveryProofPresent`
  (= `standingRecoveredAtMs != null || shallowClosureProofBundleFromStream === true`) 를 요구
- dominant family 의 실기기 trace 에서는 `standard-veto family`
  (`descent_span_too_short` / `ascent_recovery_span_too_short` /
   `recovery_hold_too_short` / `not_standing_recovered`) 가 걸려 있어
  `standingRecoveredAtMs` 가 아직 latch 되지 않았고
  `shallowClosureProofBundleFromStream` 도 latch 되지 않았다.
- 그 결과 closure contract 가 미성립 → `officialShallowClosureRewriteEligible=false`
  → `completionBlockedReason` 이 null 로 rewrite 되지 않고 그대로 관통
  → `completionPassReason='not_confirmed'`
  → `officialShallowPathClosed=false`
- 즉 proof 는 있는데 terminal close authority 가 없다.

---

## 4. Implementation Law (준수)

- **Law 1 — same-epoch only**: Family C 는 반드시 `descendConfirmed` + directional reversal 가 동일 shallow rep epoch 에서 성립할 때만 열린다. cross-epoch stitching 없음.
- **Law 2 — false-pass guard 우선 유지**: PR-2 `readOfficialShallowFalsePassGuardSnapshot()` 는 그대로 둔다. Family C 는 closure layer 만 연다. owner-freeze/`completionOwnerPassed` layer 는 PR-2 가 계속 최종 gate 한다.
- **Law 3 — proof → closed 승격만 연다**: closure contract 에 새 family 만 추가. pass-core / opener / sink / UI 는 건드리지 않는다.
- **Law 4 — standard-veto 는 shallow proof epoch 에서 terminal veto 가 아니다**: Family C 가 `contract.satisfied=true` 를 만들면 PR-4 `PR4_SHALLOW_CLOSURE_SUPPRESSIBLE_STANDARD_VETOS` 세트가 `descent_span_too_short` / `ascent_recovery_span_too_short` / `recovery_hold_too_short` / `not_standing_recovered` 를 자동으로 diagnostic 으로 격하시킨다 (rewrite pipeline 은 기존 PR-4 가 이미 구축해 둔 것을 그대로 사용).
- **Law 5 — pass-core/opener 는 이번 wave 에서 그대로 둔다**: Wave A 종료 시점에 primary shallow 10 개는 여전히 `pending_upstream` 이며, PR-6 harness file/status 는 untouched.

---

## 5. What Changed (Minimal Diff)

### 5.1 `src/lib/camera/squat/squat-completion-core.ts`

closure contract type 및 derivation 에 **Family C = `shallow_proof_terminal_close`** 를 추가.

- `OfficialShallowClosureFamily` 에 `'shallow_proof_terminal_close'` 리터럴 추가.
- `SquatOfficialShallowClosureContract` 에 diagnostic field `shallowProofTerminalCloseSatisfied: boolean` 추가.
- `resolveOfficialShallowClosureContract()` 내부에
  ```
  shallowProofTerminalCloseSatisfied =
    descendConfirmed === true &&
    directionalReversalConfirmed &&
    officialShallowAscentEquivalentSatisfied === true &&
    officialShallowStreamBridgeApplied === true;
  ```
  를 추가하고 `satisfied` / `family` 에 합류.
- 우선순위는 **A → B → C**. 기존 Family A / B 가 성립하는 trace 는 전혀 영향받지 않는다.

### 5.2 `src/lib/camera/squat-completion-state.ts`

export 되는 `officialShallowClosureFamily` union 에 `'shallow_proof_terminal_close'` 추가 (type alignment 만).

### 5.3 `src/lib/camera/squat/squat-progression-contract.ts`

`OfficialShallowClosureFamily` alias 및 동일 union 두 곳에 `'shallow_proof_terminal_close'` 추가 (type alignment 만).

### 5.4 아무것도 수정되지 않은 영역

- `src/lib/camera/squat/pass-core.ts`
- `src/lib/camera/squat-auto-progression*` (opener/sink)
- PR-2 false-pass guard (`readOfficialShallowFalsePassGuardSnapshot`)
- admission timing / anchor provenance
- quality classification
- deep standard path semantics
- overhead-reach / non-squat evaluator
- `scripts/camera-pr-cam-squat-regression-harness-lock-06-smoke.mjs` (파일 내용 그대로, status 플립 없음)
- 모든 threshold 상수
- public / app flow / route / auth / onboarding / payment / UI copy

---

## 6. How PR-7 + PR-8 Actually Work After This Diff

1. dominant Family B trace 가 들어오면
   - `descendConfirmed=true`
   - `officialShallowStreamBridgeApplied=true` (→ `directionalReversalConfirmed=true`)
   - `officialShallowAscentEquivalentSatisfied=true`
   → Family C `satisfied=true` → `contract.satisfied=true`.
2. PR-4 의 기존 rewrite 파이프라인이 그대로 작동:
   - `officialShallowClosureRewriteEligible = candidate && admitted && satisfied && isStandardVetoSuppressibleByOfficialShallowClosure(reason)` → true
   - `completionBlockedReasonForCompletionPath = null`
   - `resolveSquatCompletionPath(...)` → `low_rom_cycle` 또는 `ultra_low_rom_cycle`
   - `officialShallowPathClosed=true` (PR-7 완료)
3. rewrite 가 fire 되면 `completionBlockedReason=null` 로 bake 되어
   standard-veto family(`descent_span_too_short` / `ascent_recovery_span_too_short` /
   `recovery_hold_too_short` / `not_standing_recovered`) 가
   **같은 epoch 에서 `officialShallowPathClosed` 를 다시 뒤집지 못한다** (PR-8 완료).
4. PR-2 false-pass guard 는 별도 axis 로 계속 살아 있어
   standing / seated / jitter / setup / cross-epoch 가짜 케이스는
   `completionOwnerPassed=false` 로 계속 막히고 `finalPassEligible=false` 로 남는다.

---

## 7. What Was Explicitly NOT Changed

- Wave B 에 해당하는 **opener/pass-core 통합**은 **건드리지 않음**. 따라서 shallow primary 10 개 fixture 의 `finalPassLatched` 는 아직 true 가 되지 않는다 (설계대로).
- PR-6 harness 파일은 bit-for-bit 그대로이며 roster status (`pending_upstream`) 도 그대로다.
- threshold / span / standing-hold 상수는 하나도 변경하지 않았다.
- PR-2 false-pass guard snapshot semantics 는 손대지 않았다.
- deep standard path(`standard_cycle`)의 veto semantics 는 그대로 유지된다 (closure contract Family C 는 shallow rep 에서만 관측되는 `officialShallowStreamBridgeApplied` 를 요구하므로 deep/standard path 는 Family C 로 빠질 수 없다).

---

## 8. Smoke Result

이번 PR 에서 실행한 smoke 전부 green. 상세:

| Smoke | Result |
|---|---|
| `camera-pr-cam-squat-official-shallow-owner-freeze-01-smoke` (PR-1) | 10 / 10 PASS |
| `camera-pr-cam-squat-false-pass-guard-lock-02-smoke` (PR-2) | 33 / 33 PASS |
| `camera-pr-cam-squat-official-shallow-admission-promotion-03-smoke` (PR-3) | 28 / 28 PASS |
| `camera-pr-cam-squat-official-shallow-closure-rewrite-04-smoke` (PR-4) | 42 / 42 PASS |
| `camera-pr-cam-squat-quality-semantics-split-05-smoke` (PR-5) | 34 / 34 PASS |
| `camera-pr-cam-squat-regression-harness-lock-06-smoke` (PR-6) | 69 / 69 PASS (13 notices) |
| `camera-pr-shallow-acquisition-peak-provenance-unify-01-smoke` | 41 / 41 PASS |
| `camera-pr-cam-squat-shallow-temporal-epoch-order-realign-smoke` | 27 / 27 PASS |
| `camera-pr-cam-squat-shallow-arming-cycle-timing-realign-smoke` | 28 / 28 PASS |
| `camera-pr-cam-squat-blended-early-peak-false-pass-lock-01-smoke` | 18 / 18 PASS |

PR-6 harness 요약:

- primary shallow promoted: **0**
- primary shallow pending: **10** (= pending_upstream 유지)
- primary deep: **2 / 2 green** (deep standard path unchanged)
- conditional bucket: 3 (unchanged)
- must-fail (standing 2 + seated 2): **4 / 4 green** (never-pass law 유지)
- promotion candidates this run: **0**
- loud notices: 13 (shallow primary 10 + conditional 3)
- **status flip 없음**, harness 파일 untouched

이것이 Wave A 의 기대 harness 결과와 정확히 일치한다.

---

## 9. Known Remaining Gap (= Wave B Opener Unification NOT Included)

- shallow primary 10 개는 **여전히 `finalPassLatched=false`** 이다.
  이유는 `completionOwnerPassed` / pass-core opener 경로가 본 wave 에서 수정 대상이 아니기 때문이다.
- PR-7 이후 `officialShallowPathClosed=true` 는 열리지만,
  final pass 가 실제로 latch 되려면 Wave B 의 opener unification
  (`pass-core` 의 opener/sink semantics 를 `officialShallowPathClosed` truth 에 맞춰 정렬)
  이 필요하다.
- 이 gap 은 **의도된 설계 경계선**이며,
  parent ssot `PR-CAM-SQUAT-SHALLOW-POST-PR6-EXECUTION-WAVE-PLAN.md` §Wave B 로 따로 다룬다.

---

## 10. Success Criteria Checklist

| 항목 | 결과 |
|---|---|
| 1. shallow proof same-epoch 에서 `officialShallowPathClosed=true` 실제 개방 | ✅ (Family C 추가로 closure contract 성립 → rewrite pipeline 개방) |
| 2. standard-veto family 가 same-epoch proof 를 다시 닫지 못함 | ✅ (기존 PR-4 suppressible set 이 Family C 에도 그대로 적용) |
| 3. deep path semantics unchanged | ✅ (Family C 는 shallow 전용 signals 요구) |
| 4. standing / seated never-pass unchanged | ✅ (PR-2 false-pass guard untouched, must-fail 4/4 green) |
| 5. pass-core / opener semantics unchanged | ✅ (pass-core 파일 미수정) |
| 6. PR-6 harness file / status untouched | ✅ (file diff 0 bytes, status flip 0) |
| 7. 최소 diff | ✅ (runtime 1 + type alignment 2, 단일 closure family 추가) |
| 8. 문서 + smoke 결과 제출 | ✅ (본 문서 + §8 smoke table) |
