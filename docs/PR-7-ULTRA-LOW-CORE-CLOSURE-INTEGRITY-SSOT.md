# PR-7 (Corrected) — Ultra-low Core Closure Integrity SSOT

## 문서 상태
이 문서는 `docs/PR-7-OFFICIAL-SHALLOW-CLOSER-INTEGRITY-SSOT.md`를 **대체하는 구현 타깃 문서**다.

이전 문서가 완전히 틀린 것은 아니다.
다만 실제 실기기 오탐 통과가 열리는 레이어를 잘못 겨냥했다.

- 이전 PR-7 문서의 타깃: `official_shallow_cycle` canonical closer
- 현재 실기기 로그가 보여주는 실제 타깃: **`ultra_low_rom_cycle` core close path**

따라서 구현은 반드시 이 문서를 우선한다.
기존 PR-7 문서는 히스토리 보존용으로 남기되, 더 이상 구현 기준 문서로 쓰지 않는다.

---

## 목적
이번 PR의 목표는 얕은 스쿼트를 다시 통째로 막는 것이 아니다.
목표는 **completion core가 `ultra_low_rom_cycle`를 너무 이르게, 너무 쉽게 열어버리는 구조를 바로잡는 것**이다.

즉 이번 PR은:
- policy rollback PR이 아님
- canonical official closer만 손보는 PR이 아님
- threshold 땜빵 PR이 아님

이번 PR은 **ultra-low shallow direct close path의 최소 무결성 계약을 다시 잠그는 PR**이다.

---

## 현재 문제의 진실
실기기 로그에서 최종 통과는 다음으로 열리고 있다.
- `completionPassReason = ultra_low_rom_cycle`
- `passOwner = completion_truth_event`
- `finalSuccessOwner = completion_truth_event`

즉 현재 오탐 통과는:
- product policy가 여는 것이 아님
- evaluator가 여는 것이 아님
- auto-progression UI gate가 여는 것이 아님
- canonical `official_shallow_cycle` closer가 여는 것이 아님

**completion core가 먼저 `ultra_low_rom_cycle`를 열고 있다.**

---

## 무엇이 잘못 열리고 있는가
현재 위험한 패턴은 다음이다.

### 반복 관측 패턴 A
- `eventCycleDetected = false`
- `officialShallowPathClosed = true`
- `officialShallowStreamBridgeApplied = true`
- `officialShallowAscentEquivalentSatisfied = true`
- `officialShallowClosureProofSatisfied = true`
- 최종 `completionPassReason = ultra_low_rom_cycle`

### 반복 관측 패턴 B
초기 구간에서 이미:
- `attemptStarted = false`
- `completionBlockedReason = not_armed`
- `baselineFrozen = false`
- `peakLatched = false`

였던 흐름이,
같은 세션 후반에 `ultra_low_rom_cycle`로 닫힌다.

### 반복 관측 패턴 C
- `eventCycleDetected = false`
- `descent_weak`
- `downwardCommitmentDelta`가 사실상 매우 약함
- 그런데도 stream bridge / ascent-equivalent / closure proof 조합으로 final close 발생

핵심은 이것이다.

**지금 false positive는 canonical official closer가 아니라, core 단계의 direct ultra-low close에서 먼저 발생한다.**

---

## 왜 이전 PR-7 SSOT가 빗나갔는가
이전 PR-7 문서는 `official_shallow_cycle` closer를 잠그는 문서였다.
하지만 현재 실제 오탐 pass는 그 레이어까지 가지 않는다.

현재 구조는 대략 다음 순서다.
1. completion core에서 `resolveSquatCompletionPath(...)`가 `standard_cycle / low_rom_cycle / ultra_low_rom_cycle / not_confirmed`를 먼저 결정
2. 그 다음 canonical shallow contract derive
3. 그 다음 `applyCanonicalShallowClosureFromContract(...)`가 필요할 때만 `official_shallow_cycle`를 연다

즉 지금 false pass는 **step 1에서 이미 열리고 step 3까지 가지 않는다.**

따라서 이번 PR의 타깃은 canonical official closer가 아니라,
**`resolveSquatCompletionPath(...)` 및 그 입력으로 흘러가는 shallow ultra-low direct close eligibility**다.

---

## 이번 PR의 본질
이번 PR은 아래를 다시 잠그는 것이다.

### 현재 잘못된 구조
- officialShallowPathCandidate
- officialShallowPathAdmitted
- shallowRomClosureProofSignals
- `resolveSquatCompletionPath(...)`
- `ultra_low_rom_cycle` direct close

### PR-7(corrected) 이후 목표 구조
- officialShallowPathCandidate
- officialShallowPathAdmitted
- **fresh attempt integrity**
- **fresh descent integrity**
- **fresh reversal/recovery integrity**
- **anti-contamination integrity**
- **then and only then** shallow ultra-low close may be selected

핵심은:
**stream bridge / ascent-equivalent / closure proof는 direct close 자격을 보강할 수는 있어도, 그것만으로 direct close를 열면 안 된다.**

---

## 반드시 유지해야 할 절대 진실
### 1. single-writer truth 체계는 유지
성공 writer가 여러 개가 되면 안 된다.

허용:
- completion core의 단일 completion truth 흐름
- canonical official shallow closer (필요 시)

금지:
- evaluator가 success를 새로 쓰기
- auto-progression이 success를 새로 쓰기
- policy layer가 success를 새로 쓰기
- debug / bridge / provenance / trace 필드가 success writer처럼 동작하기

### 2. ultra-low 전체 rollback 금지
이번 PR은 얕은 스쿼트를 다시 통째로 막는 PR이 아니다.

금지:
- blanket `ultra_low_rom_not_allowed`
- shallow 전체 봉쇄
- ultra-low 전체 direct close 금지

허용:
- legitimate ultra-low는 여전히 pass 가능

### 3. canonical official closer와 core direct close를 혼동 금지
이번 PR의 1차 타깃은 `official_shallow_cycle`가 아니다.
이번 PR의 1차 타깃은 **`ultra_low_rom_cycle` direct close path**다.

### 4. stream bridge는 direct close 면허가 아니다
`officialShallowStreamBridgeApplied === true` 자체는
- reversal/return evidence 보강
- proof 보강
의 의미일 수는 있어도,
그 자체로 `ultra_low_rom_cycle` direct close를 열면 안 된다.

### 5. ascent-equivalent는 explicit descent integrity를 대체할 수 없다
`officialShallowAscentEquivalentSatisfied === true`만으로 insufficient 하다.
이 값은 보조 신호일 뿐이며,
fresh attempt/descent/commitment integrity를 대체할 수 없다.

### 6. closure proof는 integrity를 덮는 면책권이 아니다
`officialShallowClosureProofSatisfied === true`여도,
다음이 부족하면 direct close 금지다.
- fresh attempt integrity
- fresh descent integrity
- anti-contamination integrity
- event/trajectory split-brain 회피

---

## 현재 레포 구조에서 가장 중요한 사실
현재 `resolveSquatCompletionPath(...)`는 대략 다음을 한다.

1. blocked면 `not_confirmed`
2. standard owner면 `standard_cycle`
3. 공식 shallow 입장 + shallow closure proof signals면 `low_rom_cycle / ultra_low_rom_cycle`
4. 그 외 evidence label fallback

문제는 3번이다.

현재 shallow ultra-low direct close eligibility가 너무 넓어서,
다음이 섞인 상태에서도 `ultra_low_rom_cycle`가 열릴 수 있다.
- weak descent
- no event cycle
- early `not_armed`
- freeze/latch missing history
- stream-bridge-only 성향
- 반복 shallow 시도 중 stale-like reversal/recovery 흔적

---

## 이번 PR의 핵심 목표
`ultra_low_rom_cycle`가 열리는 최소 조건을 다시 정의한다.

### 현재 잘못된 구조
- official shallow candidate/admission
- shallowRomClosureProofSignals
- direct core close

### 목표 구조
- official shallow candidate/admission
- fresh attempt integrity
- fresh descent integrity
- fresh reversal/recovery integrity
- anti-contamination integrity
- then direct core close

즉 core direct close는 다음 순서를 따라야 한다.
1. shallow admission truth
2. fresh cycle integrity
3. anti-false-pass integrity
4. proof/bridge can assist
5. only then `ultra_low_rom_cycle`

---

## `ultra_low_rom_cycle`가 절대 열리면 안 되는 케이스
다음 케이스는 어떤 보조 증거가 있어도 direct close 금지다.

### A. early pre-attempt contamination
- `attemptStarted = false`
- `completionBlockedReason = not_armed`
- `baselineFrozen = false`
- `peakLatched = false`
- `freeze_or_latch_missing`

즉 pre-attempt / pre-freeze / pre-latch 상태에서 시작한 ultra-low 흔적을
나중에 direct close로 닫으면 안 된다.

### B. weak descent only
- `eventCycleDetected = false`
- `descent_weak`
- explicit fresh descent integrity 부족
- 하강으로 보기 애매한 tiny dip / posture noise

### C. stream-bridge-only / ascent-equivalent-only
- `officialShallowStreamBridgeApplied = true`
- `officialShallowAscentEquivalentSatisfied = true`
- 하지만 fresh descent/event integrity가 약함

이 경우 bridge/proof는 있어도 direct close 금지다.

### D. stale-like repeated shallow contamination
- 2~4회 반복 shallow 후 어느 시점에서 하강 중 통과
- 현재 fresh rep가 아니라 누적 shallow 흔적/bridge가 닫아버리는 경우

즉 current close는 반드시 **fresh cycle 기준**이어야 한다.

### E. event-cycle 부재 + weak cycle
다음 조합은 direct close 금지.
- `eventCycleDetected = false`
- `minimumCycleDurationSatisfied`가 있더라도
- 실제 fresh descent/event integrity가 약함
- `eventCycle.notes`에 `descent_weak`, `freeze_or_latch_missing` 등 약한 패턴 존재

### F. direct close가 canonical-level anti-false-pass를 우회하는 경우
canonical closer가 막았어야 할 오염을 core direct close가 먼저 열어버리면 안 된다.
즉 direct close는 canonical 계약보다 더 느슨하면 안 된다.

---

## `ultra_low_rom_cycle`가 열릴 수 있는 최소 무결성 계약
새 threshold를 덧붙이는 것이 아니라,
기존 truth를 더 엄격하게 조합해야 한다.

최소한 아래 축이 모두 만족되어야 한다.

### 1. shallow admission integrity
- `officialShallowPathCandidate === true`
- `officialShallowPathAdmitted === true`
- `attemptStarted === true`
- `descendConfirmed === true`
- `downwardCommitmentReached === true`

### 2. fresh-cycle integrity
다음 중 하나가 필요하다.
- fresh explicit cycle truth
- 또는 strict enough authoritative reversal/recovery truth

하지만 금지:
- pre-attempt 시절 신호를 현재 rep의 cycle truth로 간주
- stale-like repeated shallow 흔적을 현재 rep close에 소비
- stream-only / ascent-equivalent-only / proof-only

### 3. anti-pre-attempt integrity
다음 상태를 통과한 rep만 direct close 가능:
- baseline frozen
- peak latched
- freeze/latch missing not active
- early `not_armed` history를 direct close 자격으로 덮어쓰기 금지

### 4. anti-contamination integrity
- setup contamination 없음
- series-start contamination 없음
- provenance-only / trajectory-only split-brain 없음
- eventCycle weak notes만으로 close 금지

### 5. proof/bridge assist is secondary
다음은 assist role만 가능:
- `officialShallowStreamBridgeApplied`
- `officialShallowAscentEquivalentSatisfied`
- `officialShallowClosureProofSatisfied`

이 값들은 앞선 integrity 축을 통과한 뒤에만 direct close 근거로 사용할 수 있다.

---

## 권장 구현 방향
좋은 수정은 대체로 아래 둘 중 하나다.

### 방향 A — `resolveSquatCompletionPath(...)` 자체를 좁힘
`explicitShallowRomClosure`가 열릴 때 요구하는 조건을 강화한다.
즉 candidate/admitted/proof signal 외에,
- fresh attempt integrity
- fresh descent integrity
- anti-pre-attempt integrity
- anti-contamination integrity
를 같이 요구한다.

### 방향 B — direct close eligibility helper를 분리
`resolveSquatCompletionPath(...)` 안에 직접 넣지 말고,
`ultra-low direct close eligibility`를 별도 helper로 만들고,
그 helper가 true일 때만 `ultra_low_rom_cycle`를 반환한다.

권장 우선순위는 **B > A** 이다.
이유:
- path resolver는 단순해야 한다.
- close eligibility contract를 명시적으로 문서화할 수 있다.
- regression에서 이 helper를 직접 검증하기 쉽다.

---

## 변경 범위
### 포함
- `resolveSquatCompletionPath(...)` 또는 그 직전의 ultra-low direct close eligibility tightening
- `ultra_low_rom_cycle` core close eligibility 재정의
- pre-attempt / not_armed / freeze_or_latch_missing contamination 차단
- stream-bridge-only / ascent-equivalent-only close 차단
- regression/smoke에 direct ultra-low false pass 케이스 추가

### 비포함
- PR-6 policy rollback
- canonical official closer 전체 재설계
- evaluator 전체 재설계
- auto-progression 전체 재설계
- deep standard squat 재설계
- overhead reach 등 다른 동작 수정
- 숫자 threshold 땜빵 남발

---

## 절대 금지
1. blanket `ultra_low_rom_not_allowed` 부활 금지
2. shallow 전체 롤백 금지
3. 새로운 success writer 추가 금지
4. evaluator가 completion truth 다시 쓰기 금지
5. auto-progression이 completion truth 다시 쓰기 금지
6. `officialShallowStreamBridgeApplied`만으로 `ultra_low_rom_cycle` 허용 금지
7. `officialShallowAscentEquivalentSatisfied`만으로 `ultra_low_rom_cycle` 허용 금지
8. `officialShallowClosureProofSatisfied`로 pre-attempt 오염을 덮는 구조 금지
9. stale repeated shallow 흔적으로 현재 rep direct close 금지
10. setup/series-start contamination 방어 약화 금지
11. deep standard success 회귀 금지
12. threshold 숫자만 만지는 땜빵 금지

---

## 완료 정의
이번 PR이 끝났다고 말하려면 아래가 모두 만족되어야 한다.

1. 서 있는데 `ultra_low_rom_cycle` pass가 더 이상 열리지 않는다.
2. 얕은 스쿼트 하강 도중 `ultra_low_rom_cycle` pass가 더 이상 열리지 않는다.
3. 2~4회 반복 shallow 후 stale-like 누적으로 pass가 열리지 않는다.
4. `attemptStarted=false` / `not_armed` / `freeze_or_latch_missing` history 위에서 direct close가 열리지 않는다.
5. `eventCycleDetected=false` + weak descent 패턴에서 direct close가 열리지 않는다.
6. stream-bridge-only / ascent-equivalent-only 구조는 direct close가 안 열린다.
7. legitimate shallow ultra-low cycle은 여전히 통과 가능하다.
8. canonical closer 단일 writer 체계가 유지된다.
9. deep standard squat 회귀가 없다.

---

## 최종 원칙 한 줄
**이번 수정 PR은 official_shallow_cycle를 잠그는 PR이 아니라, `ultra_low_rom_cycle` core close path가 integrity를 통과한 경우에만 열리도록 다시 잠그는 PR이다.**
