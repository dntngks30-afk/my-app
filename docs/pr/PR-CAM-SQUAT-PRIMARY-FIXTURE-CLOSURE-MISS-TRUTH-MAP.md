# PR-CAM-SQUAT-PRIMARY-FIXTURE-CLOSURE-MISS-TRUTH-MAP

## 1. Title

Primary Shallow Fixture Closure-Miss Residual Truth Map (Post Wave A / Wave B / Wave B Follow-up).

파일명 고정: `docs/pr/PR-CAM-SQUAT-PRIMARY-FIXTURE-CLOSURE-MISS-TRUTH-MAP.md`

## 2. Parent SSOTs

이 문서는 아래 상위 문서를 상위 문맥으로 삼는다. 각 상위 문서가 이미 잠근 범위는 다시 느슨해지지 않으며, 이 문서는 그 위에 primary fixture closure miss의 정확한 잔존 병목만 덧쌓는다.

- `docs/pr/PR-CAM-SQUAT-SHALLOW-POST-PR6-RESIDUAL-TRUTH-MAP.md` — PR1~6 이후 잔존 병목 SSOT.
- `docs/pr/PR-CAM-SQUAT-SHALLOW-POST-PR6-EXECUTION-WAVE-PLAN.md` — Wave A / Wave B / Wave C 실행 wave plan.
- `docs/pr/PR-CAM-SQUAT-WAVE-A-CLOSURE-AUTHORITY-ESTABLISHMENT.md` — proof → terminal close authority 승격 law.
- `docs/pr/PR-CAM-SQUAT-WAVE-B-OPENER-UNIFICATION.md` — frozen official shallow owner와 opener/sink chain 1차 정렬.
- `docs/pr/PR-CAM-SQUAT-WAVE-B-FOLLOWUP-CANONICAL-OPENER-REPAIR.md` — canonical opener reader가 `officialShallowPathClosed=true`를 freeze authority로 소비.
- `docs/pr/PR-CAM-SQUAT-OFFICIAL-SHALLOW-OWNER-LOCK-SSOT.md` — owner freeze / admission / closure / quality split / harness 6층 설계.
- `docs/SHALLOW_SQUAT_TRUTH_SSOT_2026_04_01.md` — shallow 통과 bottleneck이 단일 threshold가 아닌 multi-layer contract fragmentation임을 잠근 parent SSOT.
- `docs/pr/PR-CAM-SQUAT-AUTHORITY-LAW-RESOLUTION.md` — pass authority 단일화 law.
- `docs/PASS_AUTHORITY_RESET_SSOT_20260404.md` — pass authority reset / single opener 잠금.

본 문서는 위 문서를 재요약하지 않는다. 본 문서는 Wave A/B/B-follow-up 착륙 이후 primary shallow fixture 10개(+conditional 11~13)가 여전히 `officialShallowPathClosed=true`까지 도달하지 못하는 이유를 재분해한다.

## 3. Why this document exists

Wave A, Wave B, Wave B follow-up이 모두 main에 반영된 뒤에도, `~/Desktop/device_shallow_fail_01~13.txt` 실기기 trace 13/13에서 다음이 동시에 관측된다.

- `officialShallowPathAdmitted=true`가 어느 tick에서든 성립.
- `officialShallowClosureProofSatisfied=true`가 어느 tick에서든 성립 (13/13).
- `officialShallowStreamBridgeApplied=true`, `officialShallowAscentEquivalentSatisfied=true`도 어느 tick에서든 성립.
- 그럼에도 `officialShallowPathClosed=true`는 어느 tick에서도 관측되지 않음 (fixture 17개 전체 스캔에서 0/17, primary 10 + conditional 3 + standing 2 + seated 2 포함).
- 동일 fixture에서 `completionOwnerPassed=true`, `finalPassEligible=true`, `finalPassLatched=true`, `uiProgressionAllowed=true` 중 어느 것도 관측되지 않음 (primary/conditional 13/13).
- 대조군 `device_deep_01/02`는 `completionOwnerPassed=true` + `finalPassLatched=true`에 도달 (2/2), `officialShallowClosureProofSatisfied=true`도 함께 관측되나 `officialShallowPathClosed=true`는 불필요 (standard_cycle passOwner).

이 관측은 Wave B follow-up이 올바르게 착륙했음에도 primary fixture는 canonical opener reader까지 도달할 **입력 자체** (closed shallow authority) 를 생성하지 못함을 의미한다.

즉 현재 병목은 다음과 같이 이동했다.

- 이전 가정: canonical opener reader가 `officialShallowClosureProofSatisfied=true`의 legacy mirror에 두 번째 hard gate로 의존 → Wave B follow-up이 `officialShallowPathClosed=true`를 freeze authority로 승격시켜 제거됨.
- 현재 남은 병목: `officialShallowPathClosed=true`가 primary fixture에서 **한 번도 set되지 않음**. 따라서 repaired canonical opener reader는 소비할 closed shallow authority를 받지 못한 채 idle 상태로 남는다.

이 문서는 "Wave C로 바로 가도 되는가?"를 결정하는 문서가 아니다. 이 문서는 primary fixture가 **closure write / pre-closure write / reversal ownership / pre-attempt arming** 층에서 정확히 어디서 죽는지를 재분해해 후속 보정 PR을 재분할하기 위한 SSOT다.

## 4. What Wave A / Wave B / Wave B follow-up actually solved

각 wave는 좁은 1층 교정이다. 실효 개선과 잔존 한계를 분리해 기록한다. 허위 미화는 금지.

### Wave A — Closure Authority Establishment

- 의도: `officialShallowClosureProofSatisfied && officialShallowAscentEquivalentSatisfied && officialShallowStreamBridgeApplied` 삼중 성립이 동일 epoch에서 `officialShallowPathClosed=true`로 전이될 수 있는 명시 경로 (terminal close authority) 를 확립.
- 실효 개선: closure authority 경로가 코드-level로 존재하게 되었고, false-pass guard는 그 경로의 AND 조건으로 유지되었다. Wave A smoke는 green.
- 잔존 한계: primary fixture 10개에서 `officialShallowPathClosed=true`는 **여전히 0 tick**이다. 즉 Wave A가 "path 승격 문 자체"를 열었으나, 그 문 앞까지 도달하는 fixture 자체가 없다. Wave A는 "proof → close 변환 규칙의 부재"는 해결했지만, "proof를 만든 같은 tick에서 close write가 여전히 standard-span veto / reversal ownership miss / arming miss에 의해 막히는 조건"은 해결하지 못했다.

### Wave B — Opener Unification (1차)

- 의도: Wave A가 `officialShallowPathClosed=true`를 세웠다는 가정 하에, `readSquatCurrentRepPassTruth()` 와 `camera-observability-squat-session` 쪽 `livePassCoreTruth.squatPassCore.passDetected`가 `officialShallowOwnerFrozen=true`를 effective opener truth로 소비하도록 배선. raw pass-core math는 `rawPassDetected`로 보존.
- 실효 개선: completion-state와 pass-core-adjacent progression observability가 동일 opener를 참조하도록 1차 정렬됨. trace/progression adapter가 frozen owner truth와 불일치하는 경로 제거.
- 잔존 한계: 이 wave는 frozen owner를 가정했다. primary fixture에서 `officialShallowOwnerFrozen=true`가 발생하지 않으므로 runtime 효과는 idle이다. 또한 canonical owner reader (`readOfficialShallowOwnerFreezeSnapshot`) 자체는 이 wave에서 손대지 않았기 때문에, 실제 opener promotion은 발생하지 않았다.

### Wave B Follow-up — Canonical Opener Repair

- 의도: `readOfficialShallowOwnerFreezeSnapshot()`이 `officialShallowPathClosed=true`를 closure authority로 직접 읽고, legacy `officialShallowClosureProofSatisfied` mirror를 두 번째 hard gate로 쓰지 않도록 수정. false-pass guard는 closure authority 직후 AND 조건으로 유지.
- 실효 개선: 만약 어떤 rep이 `officialShallowPathClosed=true`에 도달하면, canonical opener는 그것을 freeze authority로 그대로 소비해 `completionOwnerPassed=true` → `uiProgressionAllowed=true` → `finalPassEligible=true` → `finalPassLatched=true` 체인을 연다. Wave B follow-up smoke 13/13 green.
- 잔존 한계: 이 wave는 "이미 닫힌 shallow authority가 있을 때 올바르게 소비되는지"만 해결한다. primary fixture 10개에서는 `officialShallowPathClosed=true`가 **한 번도 set되지 않기 때문에** runtime 효과는 관측되지 않는다. 즉 **opener reader는 더 이상 병목이 아니다**. 병목은 그 앞단, closed shallow authority를 **생성**하는 closure write 및 그 상류 층에 있다.

### 요약

- 해결된 것: proof → close 변환 경로의 존재 (Wave A), frozen owner를 opener로 소비하는 배선 (Wave B), canonical freeze reader의 legacy mirror 이중 gate 제거 (Wave B follow-up).
- 해결되지 않은 것: primary fixture가 **closed shallow authority를 한 번도 발화시키지 못하는 전방 병목**. standard-span veto 재진입, reversal ownership miss, pre-attempt arming / peak latch miss, epoch drift 등 closure write 앞단의 4개 계층.

## 5. Current primary fixture failure families

모든 서술은 `~/Desktop/device_shallow_fail_01~13.txt`의 직접 필드 스캔에 근거한다. 추측 금지.

공통 사실 (13/13):

- `shallowCandidateObserved=true`, `attemptLikeMotionObserved=true`, `downwardCommitmentReached=true` 관측.
- 어느 tick에서든 `attemptStarted=true`, `descendConfirmed=true`, `peakLatched=true`, `baselineFrozen=true`, `officialShallowPathAdmitted=true`, `officialShallowPathCandidate=true`, `officialShallowStreamBridgeApplied=true`, `officialShallowClosureProofSatisfied=true`, `officialShallowAscentEquivalentSatisfied=true`로 플립.
- 그러나 `officialShallowPathClosed=true`는 0 tick.
- `attempts=[]` (final pass 없음), `completionOwnerPassed` never true, `finalPassLatched` never true.
- 초반 tick은 `completionBlockedReason="not_armed"`, `passBlockedReason="peak_not_latched"`, `eventCycle.notes ⊇ {freeze_or_latch_missing}` (13/13 중 12개에서 freeze_or_latch_missing 관측; fail_11만 길이가 짧아 이 태그 부재).
- 중후반 tick은 `completionBlockedReason` 및 `officialShallowPathBlockedReason`이 standard-veto family (`descent_span_too_short`, `ascent_recovery_span_too_short`, `no_reversal`, `recovery_hold_too_short`)로 수렴.

이 공통 사실 위에 3가족이 관측된다. 한 fixture는 trace 내에서 여러 가족 증상을 동시에 보이므로, 아래 bucket은 dominant blocker 기준이다.

### Family A — pre-attempt / arming miss family (transient upstream)

대표 신호:

- 초반 tick에서 `attemptStarted=false`, `descendConfirmed=false`, `baselineFrozen=false`, `peakLatched=false`.
- `completionBlockedReason="not_armed"`.
- `passBlockedReason="peak_not_latched"`.
- `eventCycle.notes ⊇ {freeze_or_latch_missing}`.
- `officialShallowPathCandidate=false`, `officialShallowPathAdmitted=false`.
- `officialShallowClosureProofSatisfied=false`, `officialShallowPathClosed=false`.

어디까지 올라가는가: 모든 primary fixture는 결국 attempt/arming/peak latch를 획득한다. 즉 Family A 자체가 최종 dominant 원인은 아니다.

어디서 막히는가: Family A는 cycle 한가운데 뒤늦게 해소된다. 그 결과 admission tick이 실제 descent epoch 시작점보다 뒤로 밀리고, 이후 span 계산이 짧아진 window 위에서 수행되어 Family B의 standard-span veto를 구조적으로 강화한다. `freeze_or_latch_missing` 흔적은 event notes에 잔존해 downstream robustness 신호를 약화시킨다.

구조적 의미: Family A는 최종 closure miss의 직접 원인은 아니지만, Family B/C로 흘러드는 shadow cost를 만든다. 현재 primary fixture 13/13 모두 Family A 구간을 통과한다.

### Family B — admitted + proof true but closure still false (dominant)

대표 신호 (중후반 tick):

- `attemptStarted=true`, `descendConfirmed=true`, `reversalConfirmedAfterDescend=true`, `recoveryConfirmedAfterReversal=true`.
- `officialShallowPathCandidate=true`, `officialShallowPathAdmitted=true`.
- `officialShallowStreamBridgeApplied=true`, `officialShallowAscentEquivalentSatisfied=true`, `officialShallowClosureProofSatisfied=true`, `officialShallowReversalSatisfied=true`.
- 그런데도 `officialShallowPathClosed=false`.
- `officialShallowPathBlockedReason ∈ {descent_span_too_short, ascent_recovery_span_too_short, recovery_hold_too_short}`.
- `completionBlockedReason`도 같은 standard-span family로 떨어짐.
- pass-core는 `passBlockedReason="no_standing_recovery"` 또는 `"no_reversal_after_peak"`로 `passDetected=false`.

어디까지 올라가는가: closure proof까지 전부 성립. Wave A가 정의한 proof triple은 완전히 만족된다.

어디서 막히는가: 그 **같은 tick**에서 closure writer가 여전히 `descent_span_too_short` 등 standard-span veto에 의해 `officialShallowPathClosed=false`로 남는다. 즉 Wave A가 연 proof → close 전이가 fixture에서는 "path는 있지만 veto가 이긴다" 형태로 실제 close write에 도달하지 못한다.

구조적 의미: Wave A/B/B-follow-up 이후 **dominant residual**. proof는 존재하는데 closed write가 없으므로 canonical opener에 공급할 closed shallow authority가 만들어지지 않고, 결과적으로 Wave B follow-up repair가 idle 상태로 남는다.

### Family C — reversal miss family

대표 신호:

- `attemptStarted=true`, `descendConfirmed=true`, `peakLatched=true`, `baselineFrozen=true`, `officialShallowPathAdmitted=true`.
- 그런데 `reversalConfirmedAfterDescend=false`, `officialShallowReversalSatisfied=false`, `officialShallowClosureProofSatisfied=false`.
- `officialShallowPathBlockedReason="no_reversal"`.
- `completionBlockedReason="no_reversal"`.
- pass-core `passBlockedReason="no_reversal_after_peak"`, `reversalAtMs=null`.

어디까지 올라가는가: admission + peak latch까지.

어디서 막히는가: reversal epoch 소유. completion-state/pass-core 어느 한쪽도 reversal을 소유하지 못해 proof 자체가 만들어지지 않는다. Family C는 Family B의 전방 병목이다 — reversal이 서면 Family B 증상으로 합류하고, 서지 않으면 proof 이전에 죽는다.

구조적 의미: "봤는데 reversal이 안 잡힌다" 또는 "top-level에서는 reversal을 봤는데 pass-core/shallow owner가 소유하지 못한다" 가족. Family C는 Family B와 같은 rep 안에서 공존할 수 있다 (초반에는 Family C, 후반에는 Family B).

### Family D — peak / anchor / epoch provenance drift (upstream of B/C)

대표 신호:

- `eventCycle.notes ⊇ {peak_anchor_at_series_start}` (실측: fail_07, fail_10, fail_13에서 안정 관측).
- `peakLatched=true`이지만 anchor index가 series 시작 근처에 고정.
- 같은 rep에서 completion-state peakAtMs와 pass-core peakAtMs가 다른 timestamp를 가리키는 tick 공존.

구조적 의미: Family D는 별도 bucket이라기보다 Family B/C의 상류 원인이다. anchor가 series start에 고정되면 post-peak ascending segment가 빈 window로 떨어져 Family C (no_reversal_after_peak) 증상으로 분출하거나, proof는 만들어도 pass-core가 reversal 기준점을 공유하지 못해 Family B 종결점에서 standard-veto가 이긴다.

### 13개 fixture의 bucket 배치 (dominant blocker 기준; Family A는 13/13 공통으로 생략)

- `device_shallow_fail_01` — Family C + Family B (`officialShallowPathBlockedReason`: `no_reversal` 7회, `descent_span_too_short` 6회).
- `device_shallow_fail_02` — Family C 우세 + Family B 보조 (`no_reversal` 5회, `descent_span_too_short` 3회).
- `device_shallow_fail_03` — Family C + Family B (`no_reversal` 5회, `ascent_recovery_span_too_short` 3회, `descent_span_too_short` 1회).
- `device_shallow_fail_04` — Family C + Family B (`no_reversal` 6회, `descent_span_too_short` 5회).
- `device_shallow_fail_05` — Family B 우세 (`descent_span_too_short` 6회, `ascent_recovery_span_too_short` 1회, `no_reversal` 2회); `officialShallowReversalSatisfied=true` tick 다수.
- `device_shallow_fail_06` — Family B + Family C (`no_reversal` 4회, `descent_span_too_short` 4회, `ascent_recovery_span_too_short` 1회).
- `device_shallow_fail_07` — Family B 우세 + Family D (`descent_span_too_short` 9회, `ascent_recovery_span_too_short` 1회, `no_reversal` 2회; `peak_anchor_at_series_start` 관측).
- `device_shallow_fail_08` — Family B 압도적 (`descent_span_too_short` 9회, `no_reversal` 1회, `ascent_recovery_span_too_short` 1회).
- `device_shallow_fail_09` — Family B 우세 (`descent_span_too_short` 6회, `ascent_recovery_span_too_short` 1회, `no_reversal` 2회).
- `device_shallow_fail_10` — Family B + Family D (`descent_span_too_short` 5회, `ascent_recovery_span_too_short` 2회, `no_reversal` 2회; `peak_anchor_at_series_start` 관측).
- `device_shallow_fail_11` — Family C 순수 (`no_reversal` 6회; `descent_span_too_short` / `ascent_recovery_span_too_short` 없음; `officialShallowClosureProofSatisfied=true`는 2회로 최소; proof 자체가 간헐).
- `device_shallow_fail_12` — Family B 우세 (`descent_span_too_short` 8회, `no_reversal` 3회).
- `device_shallow_fail_13` — Family B + Family C + Family D (`descent_span_too_short` 5회, `no_reversal` 2회; `peak_anchor_at_series_start` 관측).

## 6. Residual Truth Map

아래 9개는 각각 독립 truth layer다. 한 층의 verdict이 다른 층의 verdict를 자동으로 바꾸면 안 된다. 현재 primary fixture closure miss의 핵심은 이 층들 사이 authority 관계가 closure write 직전에서 깨져 있다는 점이다.

### 6.1 Observation truth

- 결정하는 것: `shallowCandidateObserved`, `attemptLikeMotionObserved`, `downwardCommitmentReached`, 상대 depth peak, phase hint.
- 현재 상태: primary 13/13에서 성립. observation layer는 병목이 아니다.
- primary miss 기여: 없음.

### 6.2 Arming / admission truth

- 결정하는 것: `attemptStarted`, `descendConfirmed`, `officialShallowPathCandidate`, `officialShallowPathAdmitted`.
- 현재 상태: 최종적으로는 13/13이 admission까지 도달. 그러나 초반 tick에서 `completionBlockedReason="not_armed"` 구간이 길게 이어지고, admission이 cycle 중간 이후에 붙는 timing drift가 모든 fixture에서 관측된다.
- primary miss 기여: admission tick이 뒤로 밀리면 이후 span/closure 계산이 줄어든 window에서 수행되어 Family B standard-span veto를 구조적으로 강화. `not_armed` → proof 성립 사이의 offset이 Family B의 "proof는 만들어지는데 close는 안 만들어지는" 구조의 upstream contributor.

### 6.3 Peak latch / baseline freeze truth

- 결정하는 것: `peakLatched`, `baselineFrozen`, `peakLatchedAtIndex`, `peakAtMs`.
- 현재 상태: 최종적으로는 13/13이 `peakLatched=true`를 얻는다. 그러나 초반 tick에서 `passBlockedReason="peak_not_latched"` 구간이 길고, `eventCycle.notes`에 `freeze_or_latch_missing`이 12/13 fixture에서 관측된다.
- primary miss 기여: peak가 늦게 latch되면 reversal-after-peak 탐지의 기준점이 series 시작 근처로 밀려 Family D (peak_anchor_at_series_start) 증상을 만들고, 그 결과 Family C (no_reversal_after_peak) 또는 Family B (span too short)로 분출.

### 6.4 Reversal truth

- 결정하는 것: `reversalConfirmedAfterDescend`, `officialShallowReversalSatisfied`, pass-core `reversalAtMs`.
- 현재 상태: 일부 fixture에서 `reversalConfirmedAfterDescend=true` + `officialShallowReversalSatisfied=true`가 성립하지만, 같은 tick pass-core는 여전히 `reversalAtMs=null`, `passBlockedReason="no_reversal_after_peak"`를 내리는 경우가 관측된다 (fail_05 descent_span tick: `officialShallowReversalSatisfied=true` + `passBlockedReason="peak_not_latched"/"no_standing_recovery"/"no_reversal_after_peak"`). fail_11은 reversal을 아예 소유하지 못하는 pure Family C.
- primary miss 기여: reversal ownership miss는 Family C의 직접 원인이자 Family B의 전방 병목. owner disagreement는 Wave B가 opener를 정렬한 뒤에도 pass-core의 raw reversal 계산이 shallow admission-aware하지 않아서 발생한다.

### 6.5 Closure proof truth

- 결정하는 것: `officialShallowClosureProofSatisfied`, `officialShallowAscentEquivalentSatisfied`, `officialShallowStreamBridgeApplied`.
- 현재 상태: 13/13 fixture에서 어느 tick에서든 proof triple이 동시 성립. proof 생성 자체는 실효 작동.
- primary miss 기여: proof는 있으나 다음 층(closure write)이 같은 tick에 closed=true를 작성하지 못함. Family B의 "proof ≠ close" 간극.

### 6.6 Closure write truth

- 결정하는 것: `officialShallowPathClosed`, `officialShallowPathBlockedReason`.
- 현재 상태: **fixture 17개 전체에서 `officialShallowPathClosed=true`가 0 tick.** primary 13/13에서 모든 close가 거부되고, blockedReason은 standard-span family (`descent_span_too_short`, `ascent_recovery_span_too_short`)와 `no_reversal`로 수렴한다. Wave A가 proof → close 전이 규칙을 정의했으나, 해당 규칙이 같은 tick에 적용되는 standard-span veto를 우선권 면에서 이기지 못한다.
- primary miss 기여: **현재 dominant 병목**. 이 층이 열리지 않으면 Wave B follow-up의 canonical opener repair가 소비할 closed shallow authority가 만들어지지 않는다.

### 6.7 Canonical opener truth

- 결정하는 것: `officialShallowOwnerFrozen`, `completionOwnerPassed`, `readOfficialShallowOwnerFreezeSnapshot` 출력.
- 현재 상태: Wave B follow-up이 이 층을 `officialShallowPathClosed=true`를 closure authority로 직접 소비하도록 repair. 규칙은 올바르다.
- primary miss 기여: 현재 입력 부재로 idle. primary fixture에서 `officialShallowPathClosed=true`가 한 번도 set되지 않아 opener freeze snapshot이 false에 머문다. **canonical opener는 더 이상 병목이 아니며**, 병목은 6.6의 상류에 있다.

### 6.8 Final sink truth

- 결정하는 것: `uiProgressionAllowed`, `finalPassEligible`, `finalPassLatched`, UI gate / auto-progression consumer chain.
- 현재 상태: primary 13/13에서 `uiProgressionBlockedReason="completion_owner_not_satisfied"`, `finalPassBlockedReason ∈ {"completion_truth_not_passed", "completion_not_satisfied"}` 유지. deep 2/2는 `completionOwnerPassed=true` + `finalPassLatched=true` 정상.
- primary miss 기여: sink는 sink-only이므로 직접 원인이 아니다. 6.6/6.7이 열리면 sink는 자동으로 열린다 (deep 2/2가 증거).

### 6.9 Never-pass guard truth

- 결정하는 것: false-pass guard family (`still_seated_at_pass`, `canonical_false_pass_guard_not_clear`, `cross_epoch_stitched_proof`, `setup_motion_blocked`, `no_real_descent`, `no_real_reversal`).
- 현재 상태: standing 2/2, seated 2/2 모두 never-pass 법칙 준수. 이 층은 정상 작동.
- 보존 요건: 이 문서의 후속 어떤 PR도 이 guard를 완화해서는 안 된다.

### 핵심 결론 (truth map 요약)

병목은 `6.6 closure write truth`와 그 바로 상류 `6.2 admission` / `6.3 peak latch` / `6.4 reversal`에 있다. `6.7 canonical opener` 이후 층은 입력만 주어지면 정상 작동한다. 따라서 후속 보정은 opener layer 수정이 아니라 **closure write 및 pre-closure write 층을 여는 작업**이어야 한다.

## 7. Exact statement of what is still broken

번호로만 잠근다. 각 항목은 primary fixture JSON 실측에서만 서술되었다.

1. **Closure write 층이 primary fixture에서 한 번도 `officialShallowPathClosed=true`를 발화시키지 않는다.** fixture 17개 전체 스캔에서 `officialShallowPathClosed=true`는 0 tick이며, primary 13/13은 모두 admission + proof triple까지 도달하고도 close write에서 실패한다.

2. **Standard-span veto가 Wave A가 연 proof → close 전이의 같은 tick에서 여전히 이긴다.** proof triple이 성립한 tick에서 `officialShallowPathBlockedReason`이 `descent_span_too_short` / `ascent_recovery_span_too_short`로 떨어지고 `completionBlockedReason`도 같은 standard-span family로 귀결된다. Wave A는 경로를 열었으나 우선권을 잠그지 못했다.

3. **Reversal ownership이 완료되기 전에 죽는 rep이 존재한다 (Family C).** fail_11은 `officialShallowPathBlockedReason="no_reversal"` 6회만 기록되고 `descent_span_too_short` / `ascent_recovery_span_too_short` 없이 proof 이전에 종료된다. fail_01~04, 06, 13은 cycle 전반에 no_reversal 구간을 길게 가진다.

4. **Completion-state reversal과 pass-core reversal owner 불일치가 잔존한다.** `officialShallowReversalSatisfied=true`인 tick에서 pass-core가 여전히 `passBlockedReason="no_reversal_after_peak"` 또는 `"no_standing_recovery"`, `reversalAtMs=null`을 내리는 경우가 fail_05/07/08/10/13에서 관측된다.

5. **Pre-attempt arming miss가 primary 13/13에 공통으로 존재한다.** 초반 tick에서 `completionBlockedReason="not_armed"`, `passBlockedReason="peak_not_latched"`, `eventCycle.notes ⊇ {freeze_or_latch_missing}` (12/13). admission이 cycle 중후반에 뒤늦게 붙어 이후 span/closure 계산이 shrinking window 위에서 수행된다.

6. **Peak/anchor가 series 시작 근처에 고정되는 drift가 일부 fixture에서 안정적으로 관측된다.** `peak_anchor_at_series_start`가 fail_07, fail_10, fail_13에서 관측되어 post-peak ascending segment 탐지가 빈 window로 떨어진다.

7. **Canonical opener reader는 올바르게 repair되었으나 idle이다.** Wave B follow-up의 `readOfficialShallowOwnerFreezeSnapshot()` 수정은 closed shallow authority를 소비하는 규약 자체는 옳지만, primary fixture는 그 입력을 한 번도 생성하지 않아 `completionOwnerPassed` / `uiProgressionAllowed` / `finalPassEligible` / `finalPassLatched` 모두 0 tick으로 남는다.

8. **Final sink는 병목이 아니다.** deep 2/2가 `completionOwnerPassed=true` + `finalPassLatched=true`에 정상 도달. sink-only chain은 올바르게 작동 중이며, primary miss의 원인은 sink 앞의 6.6/6.2~6.4에 있다.

9. **Never-pass guard는 정상 작동 중이다.** standing 2/2, seated 2/2가 `finalPassLatched=true`를 발화하지 않는다. 이 문서의 어떤 후속 PR도 이 perimeter를 완화해 shallow를 열어서는 안 된다.

10. **Conditional bucket (fail_11~13)의 승격 조건은 아직 분리되지 않았다.** fail_11은 pure Family C, fail_12는 Family B 우세, fail_13은 Family B+C+D 혼합으로 primary와 동일 증상 스펙트럼에 있지만, raw same-epoch provenance 재확인 경로가 정의되지 않아 primary와 disjoint로만 유지된다.

## 8. Non-goals

아래 항목은 이 문서의 후속 PR 시리즈 전 범위에서 금지된다.

- Deep pass semantics / standard_cycle path 재설계 금지. deep 2/2는 현재 정상, 본 문서는 shallow-specific miss만 다룬다.
- Broad threshold lowering 금지 (depth / ROM / peak / span 임계치 일괄 인하 금지).
- Standing / seated / seated-hold / setup-motion / cross-epoch / still-seated-at-pass / jitter 등 false-pass perimeter 완화 금지.
- Opener law 재수정 금지. Wave B follow-up의 canonical opener reader는 이미 올바르다. opener 층을 다시 건드리지 말 것.
- Quality reclassification을 primary runtime repair보다 먼저 하지 말 것. cycle-span 가족의 quality/completion 재분류는 closure write 층이 열린 뒤 후속 층에서만 허용.
- Public funnel / onboarding / auth / pay / 페이지 라우팅 / overhead reach / wall angel / single-leg balance 등 non-squat 레이어 변경 금지.
- Broad camera architecture refactor 금지. 각 PR은 좁은 1층 교정만 허용.
- `recordSquatSuccessSnapshot`, localStorage, 라우팅 side-effect 재설계 금지.
- PR-6 harness의 primary roster 10개를 runtime 증거 없이 silent 승격 금지. promotion은 harness registry의 status 플립 한 곳에서만.
- Overhead reach / 품질 wording / ML confidence head 변경 금지.

## 9. Recommended next PR split

원칙: 한 PR = 한 layer = 한 authority 교정. broad mega PR 금지. opener 층을 다시 건드리는 PR 금지. 순서는 아래대로, 각 PR은 선행 PR의 착륙을 가정한다.

### PR-X1 — Pre-attempt Arming & Baseline Freeze Early Stabilization (6.2 + 6.3 upstream)

- 무엇을 한다: 초반 tick의 `completionBlockedReason="not_armed"` / `passBlockedReason="peak_not_latched"` / `freeze_or_latch_missing` 구간이 descent epoch 시작점에 더 가깝게 해소되도록 arming trigger와 baseline freeze 타이밍을 stabilize. admission 조건 완화 금지 — 오직 같은 rep 안에서 admission tick을 descent epoch 시작에 근접시키는 층.
- 왜 이 순서: Family A가 Family B/C/D 모두의 shadow cost upstream이다. arming이 안정화되지 않으면 이후 어떤 closure write 수정도 shrinking window 위에서 veto를 다시 받게 된다.
- behavior-preserving boundary: 임계치 변경 금지, 새 admission 경로 창출 금지. never-pass guard / deep standard path 무변경.

### PR-X2 — Peak / Anchor Initialization Repair for Ultra-shallow Primary Traces (6.3 + 6.4 upstream)

- 무엇을 한다: `peak_anchor_at_series_start` drift를 내는 ultra-shallow trace (fail_07, fail_10, fail_13 등)에서 peak anchor가 post-commit peak로 rebind되도록 anchor initialization을 수정. 재복구된 peak의 timestamp가 pass-core `squatPassCore.peakAtMs`와 same-epoch에서 일치하도록 provenance를 단일화.
- 왜 이 순서: Family D는 Family C (no_reversal_after_peak)의 직접 원인이다. peak anchor가 series start에 고정된 채 reversal 계산이 수행되면 post-peak ascending segment가 빈 window로 떨어져 reversal을 잡을 수 없다.
- behavior-preserving boundary: `applyShallowAcquisitionPeakProvenanceUnification` 기존 law 유지, 새 복구 경로 창출 금지.

### PR-X3 — Reversal Ownership Repair for no_reversal Family (6.4)

- 무엇을 한다: completion-state `reversalConfirmedAfterDescend` / `officialShallowReversalSatisfied=true`인 same-epoch에서 pass-core가 여전히 `reversalAtMs=null`을 내리는 조건을 완화 없이 정합. shallow-admitted rep에서 pass-core의 reversal 기준점을 shallow-aware로 배선. fail_11 pure Family C 및 다른 fixture의 초중반 no_reversal tick에 직접 효과.
- 왜 이 순서: reversal이 완료되지 않으면 proof triple이 만들어지지 않아 Family B의 "proof 있는데 close 없음" 증상에 도달할 기회 자체가 없다. PR-X3는 Family C를 Family B 증상으로 합류시켜 PR-X4가 처리할 수 있는 형태로 만든다.
- behavior-preserving boundary: pass-core의 standard-rep reversal 계산은 무변경, 오직 shallow-admitted epoch 안에서만 정합.

### PR-X4 — Closure Write Decoupling from Residual Span Veto on Already-Proved Shallow Epochs (6.6)

- 무엇을 한다: `officialShallowClosureProofSatisfied && officialShallowAscentEquivalentSatisfied && officialShallowStreamBridgeApplied && officialShallowReversalSatisfied && (false-pass guard clear)`가 같은 epoch에서 성립한 경우, `descent_span_too_short` / `ascent_recovery_span_too_short` / `recovery_hold_too_short` / `not_standing_recovered`가 `officialShallowPathClosed=true`의 NOT-factor로 작용하지 못하도록 격리. 이 블로커들은 diagnostic/observability로 남되 same-epoch 안에서 standard-span veto가 terminal veto로 재진입할 수 없다. Wave A가 정의한 proof → close 전이를 primary fixture에서 실제로 발화시키는 핵심 PR.
- 왜 이 순서: PR-X1~X3가 admission / peak / reversal 층을 정리한 뒤에만 closure write decoupling이 안전하다. 먼저 하면 Family A/C/D 상류에서 오는 shadow cost가 처리되지 않아 잘못된 close write 가능성이 있다.
- behavior-preserving boundary: shallow closure proof가 성립한 same-epoch에서만 적용. standard-cycle path (deep 2/2) 무변경. never-pass guard는 AND 조건으로 유지.

### PR-X5 — Completion-State ↔ Pass-Core Single Opener Final Alignment (6.7 downstream consumption)

- 무엇을 한다: PR-X4가 `officialShallowPathClosed=true`를 primary fixture에서 발화시킨 이후, canonical opener reader (Wave B follow-up에서 이미 repair됨)가 이를 소비해 `completionOwnerPassed=true`, pass-core `passDetected` 효과값, `uiProgressionAllowed=true`, `finalPassEligible=true`, `finalPassLatched=true`까지 chain으로 연결되는지 end-to-end 검증 및 남은 잔여 배선 정합. opener 층 재수정 금지 — 오직 PR-X4 이후의 sink-only chain 소비 정합.
- 왜 이 순서: closure write이 열리지 않으면 opener layer는 idle이므로 이 PR은 반드시 PR-X4 다음에 와야 한다.
- behavior-preserving boundary: opener freeze snapshot reader는 Wave B follow-up 상태를 유지, new opener 경로 창출 금지.

### PR-X6 — Primary Fixture Verification & Bookkeeping Promotion

- 무엇을 한다: PR-6 regression harness (`camera-pr-cam-squat-regression-harness-lock-06-smoke.mjs`)에서 primary shallow roster 10개가 runtime 기준 `promoted` / `permanent_must_pass`로 플립 가능한지 증거 기반으로 검증하고 status를 플립. PR-X1~X5 착륙 이후에만 수행. conditional 11~13의 raw same-epoch provenance 재확인 gate는 이 PR에서 함께 도입하되 primary와 disjoint 유지. never-pass / deep 2/2 고정.
- 왜 이 순서: 승격은 runtime 증거 뒤에만 허용. 앞서 승격하면 Wave B follow-up 때처럼 `pending_upstream` 상태가 거짓으로 뒤집힐 위험.
- behavior-preserving boundary: runtime 무변경, harness registry 및 assertion 추가만.

### 왜 이 순서인가 (요약)

- Arming → peak/anchor → reversal → closure write decoupling → opener consumption alignment → verification. 즉 **closure write 층을 여는 데 필요한 모든 상류 shadow cost를 먼저 제거**한 뒤, Wave A가 정의한 proof → close 전이의 우선권을 잠그고, 마지막으로 Wave B follow-up의 opener repair가 소비할 입력을 실제 발화시킨다.
- opener 층 (6.7) 재수정은 이 시퀀스 어디에도 없다. Wave B follow-up이 이미 올바르므로 opener 재수정은 금지.
- never-pass guard 완화는 어느 PR에도 없다. 완화 없이 closure write 층만 연다.

## 10. Regression matrix

본 matrix는 PR-6 harness가 이미 인코딩한 roster를 상속하고, 본 문서 기반 후속 PR (PR-X1~X6) 이후 추가로 lock되어야 하는 assertion을 잠근다.

### 10.1 Family roster

| Family | Fixture id | 현재 상태 | 본 시리즈 이후 기대 상태 |
| --- | --- | --- | --- |
| Primary shallow Family A (arming miss 잔존) | device_shallow_fail_01~13 | 13/13 초반 `not_armed` / `peak_not_latched` / `freeze_or_latch_missing` | 초반 구간 축소 (PR-X1 효과), `officialShallowPathAdmitted=true` tick 조기화 |
| Primary shallow Family B (admitted + proof true, close false) | device_shallow_fail_01, 05, 07, 08, 09, 10, 12, 13 (dominant) + 03, 04, 06 (부분) | `officialShallowPathBlockedReason ∈ standard-span family`, `officialShallowPathClosed=false` | `officialShallowPathClosed=true` 도달 (PR-X4 효과) |
| Primary shallow Family C (reversal miss) | device_shallow_fail_11 (pure) + 01, 02, 03, 04, 06, 13 (부분) | `officialShallowPathBlockedReason="no_reversal"`, `officialShallowReversalSatisfied=false` | reversal satisfied로 전환 후 Family B 경로로 합류 → closure write 도달 (PR-X3 + PR-X4 효과) |
| Primary shallow Family D (peak anchor drift) | device_shallow_fail_07, 10, 13 | `peak_anchor_at_series_start` 관측, pass-core peakAtMs 불일치 | anchor rebound, same-epoch provenance 일치 (PR-X2 효과) |
| Conditional shallow | device_shallow_fail_11, 12, 13 | conditional / pending_upstream, disjoint invariant 유지 | raw same-epoch provenance gate 통과 후에만 승격 (PR-X6 부속) |
| Standing must-fail | device_standing_01, 02 | never-pass 준수 | 동일 유지 (본 시리즈 무영향) |
| Seated must-fail | device_seated_01, 02 | never-pass 준수 | 동일 유지 |
| Deep must-pass | device_deep_01, 02 | standard_cycle 통과, `completionOwnerPassed=true`, `finalPassLatched=true` | 동일 유지 (본 시리즈는 shallow epoch 한정) |

### 10.2 Locked assertions

아래 assertion은 후속 regression harness가 잠가야 할 invariant다. runtime 수정이 아니라 harness-level invariant다.

1. **Shallow observation only로 pass 열림 금지.** `shallowCandidateObserved=true`만 성립하고 proof triple / reversal / admission 중 하나라도 false인 rep이 `completionOwnerPassed=true` 또는 `finalPassLatched=true`에 도달하면 실패.

2. **Proof true → close true 동일 epoch 함의.** 어떤 tick에서든 `officialShallowClosureProofSatisfied=true && officialShallowAscentEquivalentSatisfied=true && officialShallowStreamBridgeApplied=true && officialShallowReversalSatisfied=true && (false-pass guard clear)`이면, 같은 epoch에서 `officialShallowPathClosed=true`가 성립해야 한다. 성립하지 않으면 Family B regression 실패.

3. **Standard-span veto의 shallow epoch terminal 재진입 금지.** shallow closure proof가 성립한 same-epoch tick에서 `officialShallowPathBlockedReason ∈ {descent_span_too_short, ascent_recovery_span_too_short, recovery_hold_too_short, not_standing_recovered}`가 `officialShallowPathClosed=false`를 유지하면 실패. 이 블로커는 shallow-proved epoch에서 diagnostic-only여야 한다.

4. **Reversal ownership 단일화.** shallow-admitted rep에서 `officialShallowReversalSatisfied=true`이면 같은 rep pass-core `squatPassCore.reversalAtMs`도 정의되어야 하고 `passBlockedReason !== "no_reversal_after_peak"`여야 한다. 불일치 시 Family C regression 실패. 반대로 closure write patch가 reversal 없이 close를 억지로 내리면 실패 (reversal miss family 억지 통과 금지).

5. **Same-epoch peak provenance.** shallow-admitted rep에서 completion-state `peakAtMs`와 pass-core `squatPassCore.peakAtMs`가 모두 정의된 경우 동일 timestamp여야 한다. 다르면 Family D regression 실패.

6. **Never-pass preservation.** device_standing_01/02, device_seated_01/02는 본 시리즈 전/후로 `finalPassLatched=true`를 단 한 번도 발화해서는 안 된다. 발화 시 즉시 실패.

7. **Deep preservation.** device_deep_01/02의 `completionPassReason=standard_cycle` + `passOwner=completion_truth_standard` + `uiProgressionAllowed=true` + `finalPassLatched=true`가 본 시리즈 전/후로 동일하게 유지되어야 한다. 깨지면 실패.

8. **Sink-only chain violation.** `completionOwnerPassed=false`인데 `uiProgressionAllowed=true` 또는 `finalPassEligible=true` 또는 `finalPassLatched=true`가 관측되면 실패. opener 없이 sink가 열리면 안 된다.

9. **Primary roster 승격 무결성.** device_shallow_fail_01~10은 PR-X4 착륙 및 runtime 증거 없이 harness registry 상 silent 승격 금지. PR-X6 status flip 한 곳에서만 승격 허용.

10. **Conditional disjoint 유지.** device_shallow_fail_11~13이 raw same-epoch provenance gate 없이 primary로 취급되어 `finalPassLatched=true`에 도달하면 실패. primary ∩ conditional 승격 공존 금지.

## 11. Final lock sentence

Wave A / Wave B / Wave B follow-up 이후 primary shallow fixture의 dominant residual bottleneck은 더 이상 canonical opener consumption이 아니다. `readOfficialShallowOwnerFreezeSnapshot()`은 `officialShallowPathClosed=true`를 freeze authority로 올바르게 소비하지만, primary fixture 13/13은 그 입력을 한 번도 생성하지 않는다 — admission / peak latch / reversal ownership이 늦게 붙고, proof triple은 성립하는데 같은 tick에서 standard-span veto가 `officialShallowPathClosed=false`를 유지해 closed shallow authority가 발화되지 않기 때문이다. 따라서 후속 PR 시리즈는 opener 재수정이 아니라 pre-attempt arming 안정화, peak/anchor provenance 단일화, reversal ownership repair, 그리고 proof → close 전이의 같은-epoch standard-span veto 격리로 분해되어야 하며, never-pass perimeter 완화 없이 closure write 층만을 연다. 이 조건이 충족될 때 Wave B follow-up의 repaired opener는 비로소 소비할 closed shallow authority를 받아 `completionOwnerPassed=true` → `finalPassLatched=true` 체인을 primary fixture에서 발화시킨다.