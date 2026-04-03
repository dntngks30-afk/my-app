# PR-10B — Meaningful Shallow Pass Default + Terminal Finalization Ownership SSOT

## 문서 상태
이 문서는 현재 스쿼트 카메라 시스템의 최상위 구현 기준 문서다.

우선순위:
1. `docs/PR-10B-MEANINGFUL-SHALLOW-TERMINAL-OWNERSHIP-SSOT.md`
2. `docs/PR-10-REP-SEGMENTATION-OWNERSHIP-SSOT.md`
3. `docs/PR-9-MEANINGFUL-SHALLOW-DEFAULT-PASS-SSOT.md`
4. `docs/PR-8-OFFICIAL-SHALLOW-TIMING-EPOCH-INTEGRITY-SSOT.md`
5. `docs/PR-7-ULTRA-LOW-CORE-CLOSURE-INTEGRITY-SSOT.md`

즉 이번 구현은 반드시 이 문서를 최우선으로 따른다.

---

## 목적
이번 PR의 목표는 아래 둘을 동시에 강하게 만족시키는 것이다.

1. **유의미한 하강 -> 상승 움직임이 포착되면, 품질 해석과 별개로 통과는 쉬워야 한다.**
   - 같은 품질의 얕은 스쿼트를 10번 하면 10번 가깝게 통과해야 한다.
   - 의미 있는 shallow rep가 “운 좋게 한 번 되는 것”이면 실패다.

2. **서 있기, 일반적인 몸 흔들림, frame jitter, 하강->상승이 아닌 움직임으로는 절대로 통과되면 안 된다.**
   - standing micro-motion
   - repeated stale shallow aggregation
   - terminal finalization laundering
   - proof-only / bridge-only / jitter-only
   는 전부 pass 금지다.

즉 이번 PR은 단순 blocker patch가 아니라,
**meaningful descent->ascent detection을 기본 통과 경로로 승격하고, terminal/standing/jitter 기반 세탁 pass를 전면 금지하는 PR**이다.

---

## 현재 관측이 보여주는 진실
### 1. 좋은 shallow rep는 실제로 존재한다
의미 있는 얕은 스쿼트가 자연스럽게 통과한 로그는 다음 특성을 가진다.
- `completionPassReason = official_shallow_cycle`
- `standing_recovered`에서 open
- `minimumCycleDurationSatisfied = true`
- `downwardCommitmentDelta`가 의미 있게 존재
- `reversalConfirmedAfterDescend = true`
- `recoveryConfirmedAfterReversal = true`
- `eventCycleDetected = true`
- `descentFrames > 0`

이것이 앞으로의 **gold path**다.

### 2. 현재 pass의 주 경로가 잘못돼 있다
최근 로그는 두 가지 문제를 동시에 보여준다.

#### A. good shallow repeatability 부족
좋은 shallow rep가 존재해도 반복적으로 쉽게 pass되지 않는다.
즉 meaningful shallow detection이 아직 system default가 아니다.

#### B. terminal / standing / repeated aggregation pass
실패가 쌓인 뒤 마지막에
- 아주 천천히 일어나며 pass
- standing 상태에서 왔다갔다하다 pass
- 수십 회 반복 후 얻어걸려 pass
가 나온다.

이것은 곧:
- terminal finalization이 pass를 새로 만들고 있거나
- current rep가 아닌 과거 evidence를 later finalize에 재사용하고 있거나
- standing/jitter/general motion이 meaningful rep처럼 오인되고 있음을 뜻한다.

---

## 핵심 진단
현재 남은 문제를 한 줄로 요약하면:

**의미 있는 하강->상승 rep가 기본 통과 경로가 아니라, terminal/standing/누적 evidence 세탁 경로가 경쟁 경로로 남아 있다.**

즉 이번 PR은 아래를 동시에 해야 한다.
- meaningful shallow gold path를 더 쉽게, 더 반복 가능하게 만든다
- terminal finalization, standing micro-motion, repeated stale evidence는 새 pass authorization을 만들 수 없게 한다

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

### 2. quality와 pass 분리 유지
중요:
- **유의미한 하강->상승이 포착되면 pass는 쉬워야 한다.**
- 품질 부족은 warning/low_quality_pass/interpretation으로 내려야지, pass 자체를 어렵게 만들면 안 된다.

즉 quality 해석과 pass authorization은 분리해야 한다.

### 3. terminal finalize-only 원칙
가장 중요:
**terminal phase는 새 pass ownership을 절대로 만들 수 없다.**
terminal은 이미 current rep 내부에서 성립한 pass를 마감만 할 수 있다.

금지:
- capture_session_terminal에서 새 `official_shallow_cycle` open
- terminal 시점에 stale peak/commit/reversal/recovery를 모아 새 pass 생성
- terminal standing hold로 past weak attempts 정당화

### 4. standing / jitter / 일반 움직임 절대 금지
다음은 어떤 경우에도 pass authorization이 되면 안 된다.
- 서 있는 상태의 미세 움직임
- frame jitter / sensor spike
- tiny dip / posture drift
- 하강->상승이 아닌 일반 움직임
- eventless wiggle + proof/bridge

---

## PR의 최상위 목표
### 목표 1 — meaningful descent->ascent detection을 기본 통과 경로로 승격
pass authorization의 기본 경로는 오직 이것이어야 한다.
- current rep에서 실제 하강이 존재
- current rep에서 실제 상승/reversal이 존재
- current rep에서 recovery/finalize가 존재
- timing은 자연스럽고 충분함
- open은 하강 중이 아니라 cycle completion 후 자연스럽게 발생

### 목표 2 — pass는 쉬워야 한다
유의미한 shallow rep는 어렵지 않게 pass되어야 한다.
즉 다음은 필수 acceptance다.
- 동일 품질 shallow rep를 여러 번 반복하면 대부분 통과
- one-off lucky pass 금지
- “좋은 rep인데 자주 실패”도 실패로 본다

### 목표 3 — terminal/standing/jitter 세탁 pass 전면 금지
다음은 절대 pass authorization 불가다.
- terminal phase 새 pass 생성
- standing micro-motion later pass
- repeated shallow aggregation later pass
- slow-rise laundering later pass
- jitter-only / bridge-only / proof-only close

---

## Gold Path — Meaningful Shallow Pass Contract
PR 이후 meaningful shallow pass의 기본 계약은 아래다.

### A. current rep descent truth
- current rep에서 실제 descent가 포착되어야 함
- `descendConfirmed === true`
- eventless/tiny-dip/no-real-descent는 금지
- `descentFrames > 0` 또는 동등 수준의 current-rep descent truth 필요

### B. current rep ascent/reversal truth
- current rep에서 실제 상승 또는 reversal이 포착되어야 함
- `reversalConfirmedAfterDescend === true`
- bridge/proof-only로 대체 금지

### C. current rep recovery/finalize truth
- `recoveryConfirmedAfterReversal === true`
- `standing_recovered`는 finalize-only이며 current rep completion을 마감하는 역할만 가능

### D. non-degenerate movement truth
- `downwardCommitmentDelta`가 사실상 0이면 금지
- standing micro-motion / tiny dip / jitter로는 금지

### E. timing integrity
- `minimumCycleDurationSatisfied === true`
- `descent_span_too_short` 아님
- `ascent_recovery_span_too_short` 아님

### F. current-rep ownership integrity
- peak / commitment / reversal / recovery / finalize가 모두 current rep 소유여야 함
- stale repeated shallow evidence 재사용 금지

### G. terminal independence
- terminal phase는 위 A~F가 current rep 내부에서 이미 성립한 경우만 finalize 가능
- terminal phase에서 A~F를 새로 만들면 안 됨

---

## 전면 차단해야 할 병목군
### 병목군 1 — terminal finalization laundering
- `capture_session_terminal` 또는 동등한 마감 단계에서 새 pass 생성
- current rep 내부에서 close-eligible가 아니었는데 세션 마지막 standing에서 pass

### 병목군 2 — standing micro-motion laundering
- 서 있는 상태에서 왔다갔다 하다가 pass
- tiny dip / posture drift / body sway pass

### 병목군 3 — repeated shallow aggregation
- 수십 번의 shallow 실패/부분 시도를 한 rep처럼 합쳐 later pass
- 이전 시도의 peak/commit/reversal/recovery를 later pass 재료로 재사용

### 병목군 4 — proof-only / bridge-only / jitter-only
- `officialShallowStreamBridgeApplied`
- `officialShallowAscentEquivalentSatisfied`
- `officialShallowClosureProofSatisfied`
만으로 authorization 금지

### 병목군 5 — good shallow repeatability failure
- 유의미한 하강->상승이 포착됐는데도 자주 실패하면 실패다.
- false positive만 막고 good shallow가 어렵게 되면 실패다.

---

## 지금 미리 잠가야 할 다음 의심 병목
### 의심 병목 1 — terminal 새 pass 생성은 막았지만 good shallow도 늦어짐
terminal만 막고 open timing을 너무 뒤로 미루면 good shallow user experience가 망가진다.
즉 **late-open cosmetic fix 금지**.

### 의심 병목 2 — eventCycleDetected=true만 맞추는 억지 패치
가짜 event만 만들어 good pass처럼 보이게 하면 안 된다.
의미 있는 descent->ascent truth가 실제로 있어야 한다.

### 의심 병목 3 — good shallow fixture가 너무 좁음
한 가지 패턴만 통과하고 실제 변형 shallow는 실패하면 안 된다.
동등 품질의 여러 shallow reps가 반복적으로 통과해야 한다.

### 의심 병목 4 — terminal은 막았지만 pre-terminal stale authorization이 남음
terminal 직전 프레임에서만 authorization을 만들면 본질은 같다.
즉 **terminal 및 terminal-adjacent finalization** 모두 새 pass ownership 금지.

---

## 권장 구현 방향
### 축 A — Meaningful shallow gold-path contract를 명시적으로 분리
별도 helper/contract로 다음을 강제한다.
- meaningful current-rep descent truth
- meaningful current-rep ascent/reversal truth
- meaningful current-rep recovery truth
- non-degenerate commitment
- timing integrity
- current-rep ownership

### 축 B — terminal finalize-only gate 명시
terminal 또는 finalization-adjacent 단계에서
“이미 current rep 내부에서 close-eligible였는가”만 확인할 수 있어야 한다.
새 authorization 생성 금지.

### 축 C — repeatability regression + anti-laundering regression 동시 잠금
반드시 둘 다 필요:
1. repeated good shallow success
2. standing / jitter / repeated aggregation / terminal laundering blocked

구현 우선순위:
1. terminal finalize-only 계약 명시
2. meaningful shallow gold-path contract 명시
3. anti-laundering + repeatability smoke 추가

---

## 변경 범위
### 포함
- meaningful shallow gold-path contract 강화
- terminal finalize-only 계약 도입
- standing/jitter/general motion pass 차단
- repeated aggregation / slow-rise laundering 차단
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
7. standing micro-motion pass 금지
8. frame jitter / spike pass 금지
9. repeated shallow aggregation later pass 금지
10. proof-only / bridge-only / jitter-only authorization 금지
11. one-off lucky pass를 success로 간주 금지
12. repeated good shallow success를 검증하지 않은 채 완료 주장 금지
13. false positive를 막기 위해 good shallow repeatability를 희생 금지
14. deep standard success 회귀 금지
15. helper가 logical second writer처럼 동작 금지
16. threshold 숫자만 만지는 땜빵 금지

---

## 완료 정의
### A. good shallow default pass
1. 유의미한 하강 -> 상승 shallow rep는 반복적으로 통과한다.
2. 같은 품질 shallow rep를 10번 하면 거의 10번 통과한다.
3. 품질 해석은 별도로 남겨도 pass 자체는 쉬워야 한다.

### B. anti-laundering / anti-jitter
4. terminal finalization에서 새 pass 생성 금지
5. standing micro-motion pass 금지
6. frame jitter / spike pass 금지
7. repeated shallow aggregation later pass 금지
8. slow-rise laundering later pass 금지
9. proof-only / bridge-only later pass 금지
10. 하강->상승이 아닌 일반 움직임 pass 금지

### C. regression safety
11. deep standard squat은 여전히 안정적으로 통과한다.
12. canonical closer 단일 writer 체계가 유지된다.
13. meaningful shallow gold path가 명시적으로 분리되어 system default가 된다.
14. terminal은 finalize-only이고 authorization을 만들지 않는다.

---

## 최종 원칙 한 줄
**이번 PR은 “유의미한 하강->상승 shallow rep는 쉽게 반복 통과”를 기본값으로 만들고, terminal/standing/jitter/누적 evidence는 새 pass authorization을 절대로 만들 수 없게 하는 PR이다.**
