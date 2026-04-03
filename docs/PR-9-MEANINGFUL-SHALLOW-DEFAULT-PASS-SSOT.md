# PR-9 — Meaningful Shallow Default-Pass SSOT

## 문서 상태
이 문서는 현재 스쿼트 카메라 시스템의 최상위 구현 기준 문서다.

우선순위:
1. `docs/PR-9-MEANINGFUL-SHALLOW-DEFAULT-PASS-SSOT.md`
2. `docs/PR-8-OFFICIAL-SHALLOW-TIMING-EPOCH-INTEGRITY-SSOT.md`
3. `docs/PR-7-ULTRA-LOW-CORE-CLOSURE-INTEGRITY-SSOT.md`
4. `docs/PR-7-OFFICIAL-SHALLOW-CLOSER-INTEGRITY-SSOT.md`

즉 PR-9 구현은 반드시 이 문서를 우선한다.

---

## 목적
이번 PR-9의 목표는 오탐 한두 개를 막는 것이 아니다.
목표는 **의미 있는 얕은 스쿼트 통과를 시스템의 기본값으로 만드는 것**이다.

정확히는 아래 둘을 동시에 만족해야 한다.
1. 의미 있는 얕은 스쿼트는 10번 시도하면 10번 가깝게 일관되게 통과해야 한다.
2. 하강 중 조기 통과, standing micro-motion 통과, stale repeated trace 통과는 다시 열리면 안 된다.

이번 PR은 therefore:
- meaningful shallow success를 **gold path**로 승격
- weak/stale/proof-only shallow paths를 **assist-only 또는 blocked**로 재정렬

---

## 현재 관측이 보여주는 진실
### 1. good shallow success는 이미 존재한다
실기기 로그 중 적어도 1개는 의미 있는 얕은 스쿼트가 정확한 타이밍으로 통과했다.
이 성공 패턴의 핵심:
- `completionPassReason = official_shallow_cycle`
- `standing_recovered`에서 open
- `cycleDurationMs` 충분
- `downwardCommitmentDelta` 의미 있게 존재
- `reversalConfirmedAfterDescend = true`
- `recoveryConfirmedAfterReversal = true`
- `attemptStarted = true`
- `downwardCommitmentReached = true`

이것이 앞으로의 gold path다.

### 2. 남아 있는 오탐은 하나가 아니다
다른 로그들에서는 다음이 남아 있다.
- 첫 시도 하강 중 통과
- 첫 시도 후 두 번째 하강 중 통과
- 하강 없이 약간 움직였는데 통과
- 반복 시도 후 stale-like 흔적으로 통과

반복 오탐의 공통 성향:
- `completionPassReason = official_shallow_cycle`
- `eventCycleDetected = false`
- `eventCycle.notes`에 `descent_weak`
- `descentFrames = 0`
- `officialShallowStreamBridgeApplied = true`
- `officialShallowAscentEquivalentSatisfied = true`
- `officialShallowClosureProofSatisfied = true`
- 초반에 `attemptStarted = false`, `not_armed`, `baselineFrozen = false`, `peakLatched = false`, `freeze_or_latch_missing`
- `downwardCommitmentDelta`가 사실상 0에 가까운 경우 존재

즉 현재 문제는 하나가 아니라 다음 병목 묶음이다.
- timing integrity
- current-rep epoch integrity
- non-degenerate commitment integrity
- weak-event / proof substitution
- stale repeated shallow reuse
- late standing hold laundering
- helper의 logical writer화

---

## PR-9의 본질
현재 시스템은 meaningful shallow success contract를 system default로 다루지 않는다.
대신 여러 약한/보조/오염 신호를 이어붙인 fragile shallow close가 여전히 competing path처럼 남아 있다.

PR-9의 본질은 다음 한 줄이다.

**meaningful shallow success contract를 system-default eligibility로 승격하고, weak fallback들을 전부 assist-only 또는 blocked path로 재분류한다.**

---

## 반드시 유지해야 할 절대 진실
### 1. single-writer truth 유지
허용:
- completion truth flow
- canonical official shallow closer

금지:
- evaluator success write
- auto-progression success write
- policy layer success write
- debug / proof / bridge / provenance 필드가 logical writer처럼 동작

### 2. shallow 전체 rollback 금지
금지:
- blanket `ultra_low_rom_not_allowed`
- ultra-low 전체 봉쇄
- shallow whole rollback

허용:
- meaningful shallow ultra-low 기본 통과

### 3. proof/bridge는 기본 경로가 아니다
다음은 assist role만 가능하다.
- `officialShallowStreamBridgeApplied`
- `officialShallowAscentEquivalentSatisfied`
- `officialShallowClosureProofSatisfied`

이 값들은 gold path를 대체하면 안 된다.

---

## Meaningful Shallow Success Contract (Gold Path)
PR-9 이후 good shallow success의 기본 계약은 아래다.

### A. current rep admission integrity
- `officialShallowPathCandidate === true`
- `officialShallowPathAdmitted === true`
- `attemptStarted === true`
- `descendConfirmed === true`
- `downwardCommitmentReached === true`

### B. non-degenerate descent / commitment integrity
필수:
- meaningful current-rep descent evidence
- meaningful current-rep commitment evidence
- commitment/delta가 사실상 0인 degenerate case 금지
- 하강 중간/직후에 아직 current rep가 완성되지 않은 상태에서 close 금지

### C. timing integrity
필수:
- `minimumCycleDurationSatisfied === true`
- `descent_span_too_short` 아님
- `ascent_recovery_span_too_short` 아님

Timing은 필수지만 단독으로 충분조건은 아니다.

### D. current-rep epoch integrity
필수:
- baseline frozen 이후의 rep
- peak latched 이후의 rep
- pre-attempt `not_armed` / `freeze_or_latch_missing` history가 current rep close 증거로 세탁되지 않음
- stale prior rep 흔적이 current rep official close로 소비되지 않음

### E. reversal / recovery integrity
필수:
- `reversalConfirmedAfterDescend === true`
- `recoveryConfirmedAfterReversal === true`
- 가능하면 current-rep 기준 authoritative reversal/recovery
- borrowed/stale reversal 금지

### F. natural open timing
필수:
- official shallow pass는 하강 중이 아니라 최소 meaningful reversal 이후, ideally `standing_recovered`에서 자연스럽게 열려야 한다.
- late enough to prove the cycle
- not so late that previous weak trace is laundered

### G. anti-contamination integrity
필수:
- setup contamination 없음
- series-start contamination 없음
- trajectory-only / provenance-only split-brain 없음
- eventless weak descent가 proof/bridge로 승격되지 않음

---

## PR-9에서 한 묶음으로 잠가야 할 병목군
### 병목군 1 — timing-only success
- timing만 맞고 current rep descent 질이 약한 경우
- timing만 맞고 commitment가 사실상 0인 경우
- timing만 맞고 proof/bridge만 있는 경우

### 병목군 2 — current-rep epoch laundering
- 첫 시도의 pre-attempt 흔적이 두 번째 시도 close 자격으로 재사용
- `not_armed`, `baselineFrozen=false`, `peakLatched=false`, `freeze_or_latch_missing` history가 later close로 세탁
- stale repeated shallow trace가 later rep close를 연다

### 병목군 3 — weak-event proof substitution
- `eventCycleDetected = false`
- `descentFrames = 0`
- `descent_weak`
- 그런데 bridge/proof로 official close

### 병목군 4 — standing micro-motion laundering
- 하강하지 않고 약간 움직인 상태
- tiny dip / posture drift / standing micro-motion
- late standing hold로 success 정당화

### 병목군 5 — reversal/recovery provenance over-trust
- strict enough current-rep reversal이 아닌데도 reversal/recovery truth가 close authorization처럼 동작
- borrowed/stale reversal이 later rep close를 정당화

### 병목군 6 — logical second writer helper
writer 함수가 하나여도 helper가 사실상 close authorization처럼 동작하면 실패다.

---

## 지금 미리 잠가야 할 다음 의심 병목
### 의심 병목 1 — good shallow가 너무 드물게만 통과
오탐만 막고 good shallow의 통과 빈도가 낮으면 실패다.
PR-9 acceptance에는 반드시 repeated meaningful shallow success가 포함되어야 한다.

### 의심 병목 2 — strictness를 올리다 legitimate shallow도 막음
false positive를 막기 위해 gold path까지 죽이면 실패다.

### 의심 병목 3 — late open cosmetic fix
open timing만 늦춰 겉으로만 좋아 보이면 실패다.
current rep descent/commitment 자체가 weak하면 여전히 실패다.

### 의심 병목 4 — path competition ambiguity
`standard_cycle`, `low_rom_cycle`, `ultra_low_rom_cycle`, `official_shallow_cycle`가 서로 경쟁해 운 좋게 한 path만 열리면 실패다.
meaningful shallow의 우선 통과 경로가 한 계약에 수렴되어야 한다.

---

## 권장 구현 방향
좋은 PR-9은 아래 두 축을 같이 다룬다.

### 축 A — Gold-path-first shallow eligibility contract
`meaningful shallow success eligibility`를 별도 helper/contract로 명시한다.
이 contract는 다음을 필수로 본다.
- timing integrity
- current-rep epoch integrity
- meaningful commitment integrity
- current-rep reversal/recovery integrity
- anti-contamination integrity
- natural open timing

### 축 B — weak fallback demotion
다음은 assist-only 또는 blocked path로 강등한다.
- proof-only
- bridge-only
- ascent-equivalent-only
- late-standing-hold laundering
- stale repeated shallow reuse
- pre-attempt history laundering

구현 우선순위:
1. contract/input level 강화
2. path selection/closer eligibility 정렬
3. regression/smoke에 repeatable meaningful shallow success 추가

---

## 변경 범위
### 포함
- meaningful shallow success eligibility contract 신설 또는 명시화
- current-rep epoch integrity 강화
- non-degenerate commitment integrity 강화
- weak fallback demotion
- natural open timing 보장
- regression/smoke에 repeatable meaningful shallow success 추가
- regression/smoke에 false-positive 묶음 추가

### 비포함
- blanket ultra-low rollback
- evaluator 전체 재설계
- auto-progression 전체 재설계
- deep standard squat 재설계
- other movement 수정
- 숫자 threshold 땜빵

---

## 절대 금지
1. blanket `ultra_low_rom_not_allowed` 부활 금지
2. shallow 전체 rollback 금지
3. 새로운 success writer 추가 금지
4. evaluator truth rewrite 금지
5. auto-progression truth rewrite 금지
6. one-off lucky shallow pass를 success로 간주 금지
7. meaningful shallow repeatability를 검증하지 않은 채 완료 주장 금지
8. timing만 맞으면 official shallow close 허용 금지
9. commitment delta가 사실상 0인데 official shallow close 허용 금지
10. `eventCycleDetected = false` + `descent_weak` + `descentFrames = 0`인데 proof/bridge-only official close 허용 금지
11. `not_armed` / `freeze_or_latch_missing` history를 current rep close 자격으로 세탁 금지
12. stale repeated shallow 흔적을 later rep close 자격으로 세탁 금지
13. late open cosmetic patch만으로 해결 주장 금지
14. deep standard success 회귀 금지
15. threshold 숫자만 만지는 땜빵 금지
16. helper가 logical second writer처럼 행동하는 구조 금지

---

## 완료 정의
### A. 의미 있는 얕은 스쿼트 기본 통과
1. good shallow success fixture가 반복해서 통과한다.
2. 동일 quality의 얕은 스쿼트는 재시도마다 일관되게 통과한다.
3. one-off lucky pass가 아니다.

### B. false-positive 차단
4. 첫 얕은 스쿼트 하강 중 official_shallow_cycle pass가 더 이상 열리지 않는다.
5. 첫 시도 후 두 번째 하강 중 official_shallow_cycle pass가 더 이상 열리지 않는다.
6. standing micro-motion 상태에서 pass가 더 이상 열리지 않는다.
7. repeated shallow stale-like 흔적으로 later rep close가 더 이상 열리지 않는다.
8. `minimumCycleDurationSatisfied = false`이면 official shallow close 금지
9. `descent_span_too_short`이면 official shallow close 금지
10. `ascent_recovery_span_too_short`이면 official shallow close 금지
11. `eventCycleDetected = false` + `descent_weak` + `descentFrames = 0`이면 proof/bridge가 있어도 official close 금지
12. commitment delta가 사실상 0 수준이면 official close 금지
13. `attemptStarted = false` / `not_armed` / `freeze_or_latch_missing` history가 current rep close 자격으로 세탁되지 않는다.

### C. 회귀 방지
14. deep standard squat은 여전히 안정적으로 통과한다.
15. canonical closer 단일 writer 체계가 유지된다.
16. meaningful shallow success path가 weak fallback path보다 우선되고, 계약이 명시적으로 분리된다.

---

## 최종 원칙 한 줄
**이번 PR-9은 오탐 한두 개를 막는 PR이 아니라, “의미 있는 얕은 스쿼트 통과”를 시스템의 기본값으로 승격하고 그 외 weak/stale/proof-only shallow 경로를 전부 보조 또는 차단 경로로 재정렬하는 PR이다.**
