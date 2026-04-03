# PR-10 — Rep Segmentation & Current-Rep Ownership SSOT

## 문서 상태
이 문서는 현재 스쿼트 카메라 시스템의 최상위 구현 기준 문서다.

우선순위:
1. `docs/PR-10-REP-SEGMENTATION-OWNERSHIP-SSOT.md`
2. `docs/PR-9-MEANINGFUL-SHALLOW-DEFAULT-PASS-SSOT.md`
3. `docs/PR-8-OFFICIAL-SHALLOW-TIMING-EPOCH-INTEGRITY-SSOT.md`
4. `docs/PR-7-ULTRA-LOW-CORE-CLOSURE-INTEGRITY-SSOT.md`
5. `docs/PR-7-OFFICIAL-SHALLOW-CLOSER-INTEGRITY-SSOT.md`

즉 PR-10 구현은 반드시 이 문서를 최우선으로 따른다.

---

## 목적
이번 PR-10의 목표는 단순히 오탐 1개를 막는 것이 아니다.
목표는 **현재 rep가 아닌 과거 shallow 흔적이 later pass를 여는 구조를 끊고, pass ownership을 반드시 current meaningful rep에만 귀속시키는 것**이다.

이번 PR은 아래 둘을 동시에 만족해야 한다.
1. 의미 있는 얕은 스쿼트는 여전히 자연스럽고 반복 가능하게 통과해야 한다.
2. 반복 시도 누적, 느린 일어남, standing micro-motion, stale reversal/recovery 흔적이 later official pass를 열면 안 된다.

한 줄로 요약하면:
**이번 PR은 meaningful shallow default-pass를 유지하되, 그 성공이 반드시 current rep 소유로만 열리게 만드는 rep segmentation / ownership re-lock PR이다.**

---

## 현재 관측이 보여주는 진실
### 1. good shallow success는 이미 존재한다
실기기에서 의미 있는 얕은 스쿼트가 자연스러운 타이밍으로 pass된 로그가 있다.
그 패턴의 핵심:
- `completionPassReason = official_shallow_cycle`
- `standing_recovered`에서 open
- `minimumCycleDurationSatisfied = true`
- `downwardCommitmentDelta`가 의미 있게 존재
- `reversalConfirmedAfterDescend = true`
- `recoveryConfirmedAfterReversal = true`
- `eventCycleDetected = true`
- `descentFrames > 0`

즉 meaningful shallow success 경로 자체는 살아 있다.

### 2. 남은 병목은 “current rep ownership”이다
최근 실기기 증상:
- 얕은 스쿼트 3~4회 반복 후 아주 천천히 일어나 통과
- 얕은 스쿼트 엄청 많이 반복 후 천천히 일어나 통과
- 끝까지 통과 안 되다가 서 있는 상태에서 잠깐 움직였더니 통과

이 증상은 공통적으로 다음을 시사한다.
- 시스템이 여러 shallow 시도를 하나의 긴 rep처럼 합칠 수 있다
- 이전 rep의 peak/commit/reversal/recovery 흔적이 later pass authorization에 재사용된다
- `standing_recovered` / standing hold가 현재 rep 증명보다 강한 정당화 신호처럼 쓰인다
- bridge/proof/recovery maturity가 current rep ownership보다 앞선다

즉 현재 남은 핵심 병목은:
**pass를 여는 신호가 “이번 rep에서 새로 생긴 것”인지, 아니면 “이전 시도들의 누적 흔적”인지 구조적으로 완전히 분리되지 않았다는 것**이다.

---

## PR-10의 핵심 진단
PR-9는 meaningful shallow success 자체를 살렸지만, 아직 다음을 완전히 잠그지 못했다.
- repeated shallow aggregation
- stale repeated trace laundering
- late standing hold laundering
- current rep가 아닌 reversal/recovery provenance의 later reuse

즉 시스템은 아직 “good shallow can pass” 단계고,
이번 PR-10은 이를 **only the current meaningful rep may pass** 단계로 끌어올려야 한다.

---

## 반드시 유지해야 할 절대 진실
### 1. single-writer truth 유지
허용:
- completion truth flow
- canonical official shallow closer

금지:
- evaluator success write
- auto-progression success write
- policy success write
- helper / debug / proof / bridge가 logical second writer처럼 동작

### 2. meaningful shallow default-pass 유지
금지:
- shallow 전체 rollback
- blanket ultra-low rollback
- good shallow repeatability 희생

허용:
- meaningful shallow는 자연스럽고 반복 가능하게 계속 pass

### 3. current-rep ownership 절대화
이제 official shallow pass는 반드시 **current rep 소유**여야 한다.
즉 다음은 금지:
- 이전 rep의 peak reuse
- 이전 rep의 reversal/recovery reuse
- repeated shallow 흔적을 누적한 later close
- standing hold가 past weak rep를 정당화

---

## PR-10의 최상위 목표
### 목표 1 — rep segmentation truth를 명시
시스템이 반복 shallow 시도를 하나의 긴 rep로 합치지 못하게 해야 한다.
반드시 current rep epoch / segment 경계가 있어야 한다.

### 목표 2 — pass ownership을 current rep로만 제한
다음 close 자격은 반드시 current rep 내부에서만 형성되어야 한다.
- peak
- commitment
- reversal
- recovery
- standing finalize

즉 “이전 rep에서 쌓인 shallow evidence + 지금 잠깐 움직임”으로 pass 금지.

### 목표 3 — standing hold는 finalize-only
standing_recovered / standing hold는 finalize를 도울 수는 있어도,
**current rep descent/reversal/recovery를 대신 증명하는 authorization**가 되면 안 된다.

---

## Current-Rep Ownership Contract
PR-10 이후 official_shallow_cycle가 열리려면 아래가 모두 current rep 기준이어야 한다.

### A. current rep admission
- current rep에서 `attemptStarted === true`
- current rep에서 `descendConfirmed === true`
- current rep에서 `downwardCommitmentReached === true`
- current rep가 실제로 시작된 뒤의 신호만 사용

### B. current rep peak/commit ownership
- current pass에 쓰는 peak는 current rep에서 latched된 peak여야 한다
- current pass에 쓰는 commitment는 current rep에서 생성된 commitment여야 한다
- 과거 rep의 peak/commit를 later rep close에 재사용 금지

### C. current rep reversal/recovery ownership
- `reversalConfirmedAfterDescend`는 current rep 기준이어야 한다
- `recoveryConfirmedAfterReversal`는 current rep 기준이어야 한다
- repeated shallow 후 stale reversal/recovery 흔적을 later pass authorization으로 쓰면 안 된다
- bridge/proof는 current rep ownership이 먼저 성립한 뒤에만 assist 가능

### D. current rep finalize timing
- open은 current rep의 reversal/recovery 이후에만 가능
- `standing_recovered`는 current rep finalize일 때만 의미가 있다
- past weak attempts를 late standing hold로 세탁 금지

### E. current rep anti-laundering
다음은 전부 금지:
- repeated shallow aggregation
- stale repeated trace laundering
- late standing hold laundering
- standing micro-motion laundering
- previous attempt history laundering

---

## PR-10에서 전면 차단해야 할 병목군
### 병목군 1 — repeated shallow aggregation
여러 얕은 시도를 하나의 긴 rep처럼 합쳐 later pass를 여는 경우 금지.

### 병목군 2 — slow-rise laundering
여러 번의 실패/부분 시도 후 아주 천천히 일어나면서 pass 금지.
이 경우 slow rise는 current meaningful rep finalize가 아니라 stale evidence 정당화가 되기 쉽다.

### 병목군 3 — standing micro-motion laundering
서 있는 상태에서 살짝 움직였을 뿐인데 이전 rep 흔적으로 pass 금지.

### 병목군 4 — stale reversal/recovery reuse
현재 rep가 아니라 이전 rep에서 성립한 reversal/recovery 성격이 later pass authorization처럼 작동 금지.

### 병목군 5 — bridge/proof maturity laundering
bridge/proof가 여러 시도에 걸쳐 성숙해지면서 later rep close 자격처럼 쓰이면 금지.

### 병목군 6 — open timing cosmetic pass
겉으로는 `standing_recovered`라 자연스러워 보여도, 실제로는 current rep ownership이 약한 pass 금지.

---

## 지금 미리 잠가야 할 다음 의심 병목
### 의심 병목 1 — rep segmentation은 들어갔지만 good shallow repeatability가 떨어짐
rep 경계를 너무 공격적으로 끊어 good shallow 반복 통과율이 떨어지면 실패다.

### 의심 병목 2 — segmentation helper가 사실상 second writer처럼 행동
segmentation helper가 “이제 close 가능”을 너무 느슨하게 정하면 logical second writer가 된다.

### 의심 병목 3 — current rep 기준이 peak만 current이고 reversal/recovery는 stale인 혼합 소유권
부분적으로만 current ownership을 요구하면 다시 구멍이 난다.
반드시 peak / commitment / reversal / recovery / finalize가 같은 rep 소유여야 한다.

### 의심 병목 4 — slow-rise를 지나치게 막아 legitimate shallow finalize까지 죽임
느리게 일어나는 legitimate shallow도 있을 수 있다.
따라서 slow rise 자체를 막는 게 아니라, **slow rise가 current rep ownership 없이 pass authorization이 되는 것만** 막아야 한다.

---

## 권장 구현 방향
### 축 A — Rep segmentation truth 명시화
`current rep segment` 또는 동등 개념을 명시하는 helper/contract를 만든다.
이 contract는 최소한 다음을 보장해야 한다.
- current rep 시작
- current rep peak/commit ownership
- current rep reversal/recovery ownership
- current rep finalize ownership

### 축 B — ownership-aware closer eligibility
official_shallow_cycle closer eligibility는 아래를 모두 봐야 한다.
- timing integrity
- epoch integrity
- non-degenerate commitment integrity
- weak-event exclusion
- 그리고 마지막으로 **current-rep ownership integrity**

### 축 C — repeatability + anti-laundering regression
새 regression/smoke에는 반드시 두 종류를 같이 넣는다.
1. repeated good shallow success
2. repeated shallow aggregation / slow-rise laundering / standing micro-motion laundering blocked

구현 우선순위:
1. current-rep ownership contract/input 강화
2. closer eligibility 정렬
3. repeatability + anti-laundering smoke 잠금

---

## 변경 범위
### 포함
- rep segmentation truth 명시화
- current-rep ownership integrity 도입
- stale repeated trace laundering 차단
- slow-rise laundering 차단
- standing micro-motion laundering 차단
- regression/smoke에 repeated good shallow success + anti-laundering 묶음 추가

### 비포함
- blanket ultra-low rollback
- evaluator 전체 재설계
- auto-progression 전체 재설계
- deep standard 재설계
- 타 운동 수정
- 숫자 threshold 땜빵

---

## 절대 금지
1. blanket `ultra_low_rom_not_allowed` 부활 금지
2. shallow 전체 rollback 금지
3. 새로운 success writer 추가 금지
4. evaluator truth rewrite 금지
5. auto-progression truth rewrite 금지
6. repeated shallow aggregation 허용 금지
7. slow-rise laundering 허용 금지
8. standing micro-motion laundering 허용 금지
9. stale reversal/recovery reuse 허용 금지
10. current rep가 아닌 peak/commit ownership reuse 허용 금지
11. late standing hold가 past weak rep를 정당화하는 구조 금지
12. one-off lucky pass를 success로 간주 금지
13. repeatable good shallow success를 검증하지 않은 채 완료 주장 금지
14. deep standard success 회귀 금지
15. helper가 logical second writer처럼 동작 금지
16. 숫자 threshold만 만지는 땜빵 금지

---

## 완료 정의
### A. good shallow repeatability
1. meaningful shallow success fixture가 반복해서 통과한다.
2. 동등 품질 shallow rep는 재시도마다 일관되게 통과한다.
3. one-off lucky pass가 아니다.

### B. anti-laundering
4. 얕은 스쿼트 3~4회 반복 후 slow rise로 later pass 금지
5. 얕은 스쿼트 많이 반복 후 slow rise로 later pass 금지
6. standing micro-motion으로 later pass 금지
7. repeated shallow aggregation으로 한 긴 rep처럼 later pass 금지
8. stale reversal/recovery reuse로 later pass 금지
9. current rep가 아닌 peak/commit ownership reuse 금지
10. standing hold는 finalize-only이고 authorization이 아님

### C. regression safety
11. deep standard squat은 여전히 안정적으로 통과한다.
12. canonical closer 단일 writer 체계가 유지된다.
13. meaningful shallow default-pass가 유지된다.
14. pass ownership이 명시적으로 current rep 소유로 제한된다.

---

## 최종 원칙 한 줄
**이번 PR-10은 good shallow default-pass를 유지하면서, pass를 여는 모든 핵심 증거를 반드시 current meaningful rep 소유로 제한하고 repeated/slow-rise/standing-micro-motion laundering을 구조적으로 끊는 PR이다.**
