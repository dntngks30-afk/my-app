# PR-10C — Meaningful Shallow Current-Rep-Only SSOT

## 문서 상태
이 문서는 현재 스쿼트 카메라 시스템의 최상위 구현 기준 문서다.

우선순위:
1. `docs/PR-10C-MEANINGFUL-SHALLOW-CURRENT-REP-ONLY-SSOT.md`
2. `docs/PR-10B-MEANINGFUL-SHALLOW-TERMINAL-OWNERSHIP-SSOT.md`
3. `docs/PR-10-REP-SEGMENTATION-OWNERSHIP-SSOT.md`
4. `docs/PR-9-MEANINGFUL-SHALLOW-DEFAULT-PASS-SSOT.md`
5. `docs/PR-8-OFFICIAL-SHALLOW-TIMING-EPOCH-INTEGRITY-SSOT.md`

즉 이번 구현은 반드시 이 문서를 최우선으로 따른다.

---

## 제품 법칙 (절대 불변)
이번 PR의 목표는 아래 4가지를 **동시에** 만족시키는 것이다.

### 법칙 1 — 유의미한 하강 -> 상승이 current rep 안에서 잡히면 통과는 쉬워야 한다
- meaningful descent -> ascent shallow rep가 current rep 내부에서 포착되면 pass는 쉬워야 한다.
- 품질 해석과 pass authorization은 분리한다.
- quality가 낮아도 meaningful rep면 pass는 열릴 수 있어야 한다.
- 같은 품질 shallow rep를 10번 하면 10번 가깝게 반복 통과해야 한다.
- “운 좋게 한 번 통과”는 실패다.

### 법칙 2 — terminal은 finalize-only다
- terminal / capture_session_terminal / finalization-adjacent 단계는 새 pass ownership을 만들 수 없다.
- terminal은 오직 current rep 안에서 이미 close-eligible였던 pass를 마감만 할 수 있다.
- terminal standing hold, terminal jitter, terminal late motion으로 새 pass 생성 금지.

### 법칙 3 — standing / jitter / 일반 움직임은 절대 pass 금지다
다음은 어떤 경우에도 pass authorization이 되면 안 된다.
- standing still
- standing micro-motion
- tiny dip / posture drift
- frame jitter / spike
- general non-squat movement
- descent -> ascent가 아닌 일반적인 움직임
- proof-only / bridge-only / jitter-only

### 법칙 4 — 여러 번 실패한 시도 끝에 마지막 신호만으로 누적 rep 닫기 금지
- repeated shallow aggregation 금지
- stale peak/commit/reversal/recovery reuse 금지
- 여러 번 실패한 시도 뒤 마지막 slow rise, standing motion, tiny movement로 pass 금지
- pass ownership은 반드시 **current meaningful rep** 소유여야 한다.

---

## 목적
이번 PR은 단순히 오탐을 하나 더 막는 것이 아니다.
목표는 **meaningful shallow rep의 쉬운 반복 통과를 system default로 만들고, terminal/standing/jitter/stale aggregation 경로를 완전히 비활성화하는 것**이다.

한 줄 요약:
**유의미한 하강->상승이 current rep에서 포착되면 쉽게 pass, 그렇지 않으면 절대 pass 금지.**

---

## 현재 관측이 보여주는 진실
### 1. 좋은 shallow rep는 실제로 존재한다
성공 로그의 핵심:
- `completionPassReason = official_shallow_cycle`
- `standing_recovered`에서 open
- `minimumCycleDurationSatisfied = true`
- `downwardCommitmentDelta`가 의미 있게 존재
- `reversalConfirmedAfterDescend = true`
- `recoveryConfirmedAfterReversal = true`
- `eventCycleDetected = true`
- `descentFrames > 0`

즉 meaningful shallow gold path는 이미 존재한다.

### 2. 하지만 현재는 두 가지가 동시에 남아 있다
#### A. 너무 얕거나 일반적인 움직임도 pass될 수 있다
- 거의 안 내려갔는데 pass
- standing 상태의 왔다갔다 / tiny movement / jitter-like motion 후 later pass

#### B. 여러 번 실패한 시도 뒤 마지막 신호로 누적 rep가 닫힌다
- 수십 번 반복 후 얻어걸려 pass
- earlier failed shallow traces가 later pass authorization 재료로 남아 있음

즉 현재 시스템은 아직도
- non-meaningful motion false pass
- repeated stale evidence laundering
을 완전히 못 끊었다.

---

## 핵심 진단
지금의 핵심 병목은 한 줄이다.

**pass authorization이 “current meaningful rep inside”에서만 만들어져야 하는데, 아직 terminal/standing/stale aggregation이 경쟁 경로로 남아 있다.**

따라서 이번 PR은 두 방향을 동시에 가져가야 한다.
1. meaningful shallow current-rep gold path를 더 쉽게, 더 반복 가능하게 만든다.
2. terminal/standing/jitter/aggregation은 pass authorization을 아예 만들 수 없게 한다.

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
- helper / proof / bridge / terminal hook가 logical second writer처럼 동작

### 2. pass와 quality는 분리
- meaningful descent->ascent가 current rep에서 잡히면 quality와 무관하게 pass는 쉬워야 한다.
- quality는 warning / interpretation / severity에서 다룬다.
- pass를 quality 부족 때문에 어렵게 만들면 안 된다.

### 3. current-rep-only authorization
pass authorization에 쓰이는 모든 핵심 신호는 current rep 소유여야 한다.
- current rep descent
- current rep commitment
- current rep reversal
- current rep recovery
- current rep finalize

과거 rep의 어떤 신호도 later pass authorization에 재사용 금지.

---

## Gold Path — Meaningful Shallow Current-Rep Contract
PR 이후 meaningful shallow pass의 기본 계약은 아래다.

### A. current rep descent truth
- current rep에서 실제 descent가 포착되어야 한다.
- `descendConfirmed === true`
- `descentFrames > 0` 또는 동등 수준의 current-rep descent truth 필요
- tiny dip / eventless wiggle / generic sway는 descent로 간주 금지

### B. current rep ascent / reversal truth
- current rep에서 실제 ascent 또는 reversal이 포착되어야 한다.
- `reversalConfirmedAfterDescend === true`
- bridge/proof-only로 대체 금지
- stale reversal reuse 금지

### C. current rep recovery / finalize truth
- `recoveryConfirmedAfterReversal === true`
- `standing_recovered`는 current rep completion finalize일 때만 의미가 있다.
- standing/finalize는 authorization이 아니라 current rep completion을 마감하는 역할이다.

### D. non-degenerate movement truth
- `downwardCommitmentDelta`가 사실상 0이면 금지
- tiny dip / posture drift / standing micro-motion / jitter로는 금지
- current rep의 실제 movement magnitude가 의미 있어야 한다

### E. timing integrity
- `minimumCycleDurationSatisfied === true`
- `descent_span_too_short` 아님
- `ascent_recovery_span_too_short` 아님

### F. current-rep ownership integrity
- peak / commitment / reversal / recovery / finalize가 모두 current rep 소유여야 한다.
- stale repeated shallow evidence 재사용 금지
- repeated shallow aggregation 금지

### G. terminal independence
- terminal phase는 A~F가 current rep 내부에서 이미 성립한 경우만 finalize 가능
- terminal phase에서 A~F를 새로 만들면 안 된다
- terminal-adjacent finalization도 동일하게 금지

---

## 전면 차단해야 할 병목군
### 병목군 1 — terminal finalization laundering
- terminal에서 새 pass 생성 금지
- terminal standing hold / terminal late motion / terminal jitter로 later pass 금지

### 병목군 2 — standing micro-motion / jitter / generic movement
- standing micro-motion pass 금지
- frame jitter / sensor spike pass 금지
- general non-descent->ascent motion pass 금지
- tiny dip / posture drift pass 금지

### 병목군 3 — repeated shallow aggregation
- 여러 번의 실패한 shallow 시도를 하나의 rep처럼 later pass로 닫기 금지
- earliest failed attempts의 evidence를 마지막 신호로 세탁 금지

### 병목군 4 — stale ownership reuse
- stale peak reuse 금지
- stale commitment reuse 금지
- stale reversal/recovery reuse 금지
- stale proof/bridge maturity reuse 금지

### 병목군 5 — good shallow repeatability failure
- meaningful shallow current rep가 존재하는데도 자주 실패하면 실패다.
- false positive만 막고 good shallow success rate를 죽이면 실패다.

---

## 지금 미리 잠가야 할 다음 의심 병목
### 의심 병목 1 — terminal은 막았지만 terminal 직전 프레임에서만 authorization 생성
이건 본질적으로 terminal laundering과 같다.
terminal-adjacent finalization도 새 pass ownership 금지.

### 의심 병목 2 — eventCycleDetected=true만 맞추는 cosmetic fix
형식상 event만 세워놓고 meaningful current-rep descent->ascent가 없으면 실패다.

### 의심 병목 3 — good shallow fixture가 너무 좁아 repeatability가 낮음
한 가지 얕은 패턴만 pass하고 변형된 동등 품질 shallow는 실패하면 안 된다.

### 의심 병목 4 — anti-jitter를 올리다가 meaningful shallow까지 죽임
standing/jitter를 막는다고 meaningful shallow의 easy pass를 해치면 실패다.

---

## 권장 구현 방향
### 축 A — meaningful current-rep gold-path contract 명시
별도 helper/contract로 다음을 강제한다.
- meaningful current-rep descent truth
- meaningful current-rep ascent/reversal truth
- meaningful current-rep recovery truth
- non-degenerate movement truth
- timing integrity
- current-rep ownership

### 축 B — terminal finalize-only guard 명시
terminal/finalization-adjacent 단계는
“이미 current rep 내부에서 close-eligible였는가”만 확인할 수 있어야 한다.
새 authorization 생성 금지.

### 축 C — anti-standing / anti-jitter / anti-aggregation regression 잠금
반드시 둘 다 필요:
1. repeated good shallow success
2. terminal / standing / jitter / aggregation / stale ownership blocked

구현 우선순위:
1. meaningful current-rep gold-path contract 명시
2. terminal finalize-only 규칙 명시
3. anti-standing/jitter/aggregation regression 추가
4. repeated good shallow success regression 추가

---

## 변경 범위
### 포함
- meaningful shallow current-rep gold-path contract 강화
- terminal finalize-only 계약 도입/강화
- standing/jitter/general motion pass 차단
- repeated aggregation / stale ownership reuse 차단
- regression/smoke에 repeated good shallow success 추가
- regression/smoke에 terminal/standing/jitter/aggregation false-pass 묶음 추가

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
6. terminal phase에서 새 pass ownership 생성 금지
7. terminal-adjacent finalization에서 새 pass ownership 생성 금지
8. standing micro-motion pass 금지
9. frame jitter / spike pass 금지
10. general movement / non-descent->ascent pass 금지
11. repeated shallow aggregation later pass 금지
12. stale ownership reuse later pass 금지
13. one-off lucky pass를 success로 간주 금지
14. repeated good shallow success를 검증하지 않은 채 완료 주장 금지
15. false positive를 막기 위해 good shallow repeatability를 희생 금지
16. deep standard success 회귀 금지
17. helper가 logical second writer처럼 동작 금지
18. threshold 숫자만 만지는 땜빵 금지

---

## 완료 정의
### A. good shallow default pass
1. 유의미한 하강 -> 상승 shallow rep는 반복적으로 통과한다.
2. 같은 품질 shallow rep를 10번 하면 거의 10번 통과한다.
3. quality interpretation은 남겨도 pass 자체는 쉬워야 한다.

### B. anti-terminal / anti-standing / anti-jitter / anti-aggregation
4. terminal finalization에서 새 pass 생성 금지
5. terminal-adjacent finalization에서 새 pass 생성 금지
6. standing micro-motion pass 금지
7. frame jitter / spike pass 금지
8. general movement / non-descent->ascent pass 금지
9. repeated shallow aggregation later pass 금지
10. stale ownership reuse later pass 금지
11. slow-rise laundering later pass 금지
12. proof-only / bridge-only / jitter-only later pass 금지

### C. regression safety
13. deep standard squat은 여전히 안정적으로 통과한다.
14. canonical closer 단일 writer 체계가 유지된다.
15. meaningful shallow gold path가 명시적으로 분리되어 system default가 된다.
16. terminal은 finalize-only이고 authorization을 만들지 않는다.
17. pass authorization은 current meaningful rep inside에서만 생성된다.

---

## 최종 원칙 한 줄
**이번 PR은 “유의미한 하강->상승 shallow rep는 current rep 안에서 쉽게 반복 통과”를 기본값으로 만들고, terminal/standing/jitter/general movement/누적 stale evidence는 새 pass authorization을 절대로 만들 수 없게 하는 PR이다.**
