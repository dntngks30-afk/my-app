# PR-11 — Meaningful Shallow Gold-Path-Only SSOT

## 문서 상태
이 문서는 현재 스쿼트 카메라 시스템의 최상위 구현 기준 문서다.

우선순위:
1. `docs/PR-11-MEANINGFUL-SHALLOW-GOLD-PATH-ONLY-SSOT.md`
2. `docs/PR-10C-MEANINGFUL-SHALLOW-CURRENT-REP-ONLY-SSOT.md`
3. `docs/PR-10B-MEANINGFUL-SHALLOW-TERMINAL-OWNERSHIP-SSOT.md`
4. `docs/PR-10-REP-SEGMENTATION-OWNERSHIP-SSOT.md`
5. `docs/PR-9-MEANINGFUL-SHALLOW-DEFAULT-PASS-SSOT.md`
6. `docs/PR-8-OFFICIAL-SHALLOW-TIMING-EPOCH-INTEGRITY-SSOT.md`

즉 이번 구현은 반드시 이 문서를 최우선으로 따른다.

---

## 제품 법칙 (절대 불변)
이번 PR의 목표는 아래 5가지를 동시에 만족시키는 것이다.

### 법칙 1 — 유의미한 하강 -> 상승이 current rep 안에서 잡히면 통과는 쉬워야 한다
- meaningful descent -> ascent shallow rep가 current rep 내부에서 포착되면 pass는 쉬워야 한다.
- quality 해석과 pass authorization은 분리한다.
- quality가 낮아도 meaningful rep면 pass는 열릴 수 있어야 한다.
- 같은 품질 shallow rep를 10번 하면 10번 가깝게 반복 통과해야 한다.
- “운 좋게 한 번 통과”는 실패다.

### 법칙 2 — pass는 너무 이르면 안 된다
다음은 절대 금지다.
- 하강 중 pass
- 아직 ascent/reversal이 current rep 안에서 충분히 성립하기 전에 pass
- 아직 recovery/finalize 이전인데 pass
- 즉 meaningful rep가 완성되기 전에 early open 금지

### 법칙 3 — pass는 너무 늦어도 안 된다
다음은 절대 금지다.
- 이미 current rep completion을 넘어선 뒤 늦게 pass
- terminal/finalization-adjacent standing hold가 새 pass를 만듦
- 여러 실패한 시도 뒤 마지막 late motion으로 누적 rep가 닫힘
- 즉 meaningful rep completion과 무관한 delayed/washed pass 금지

### 법칙 4 — terminal은 finalize-only다
- terminal / capture_session_terminal / finalization-adjacent 단계는 새 pass ownership을 만들 수 없다.
- terminal은 오직 current rep 안에서 이미 close-eligible였던 pass를 마감만 할 수 있다.
- terminal standing hold, terminal jitter, terminal late motion으로 새 pass 생성 금지.

### 법칙 5 — standing / jitter / 일반 움직임은 절대 pass 금지다
다음은 어떤 경우에도 pass authorization이 되면 안 된다.
- standing still
- standing micro-motion
- tiny dip / posture drift
- frame jitter / spike
- general non-squat movement
- descent -> ascent가 아닌 일반적인 움직임
- proof-only / bridge-only / jitter-only
- repeated stale evidence aggregation

---

## 목적
이번 PR은 단순히 오탐 1개를 더 막는 것이 아니다.
목표는 **의미 있는 shallow current-rep 하강->상승만 단일 gold path로 통과시키고, 그 외 direct ultra-low / stale fallback / terminal laundering / early-open / late-open 경로를 전부 제거하는 것**이다.

한 줄 요약:
**유의미한 current-rep 하강->상승은 쉽게 통과, 그 외 모든 경로는 pass authorization 금지.**

---

## 현재 관측이 보여주는 진실
최근 실기기 관측은 세 가지를 동시에 보여준다.

### 1. 좋은 shallow pass는 가능하다
- 첫 시도 실패 후 두 번째 시도에서 의미 있는 통과가 있다.
- 이 케이스는 `standing_recovered`, 충분한 `cycleDurationMs`, 의미 있는 `downwardCommitmentDelta`, `reversal/recovery=true`를 가진다.
- 즉 meaningful shallow gold path 자체는 존재한다.

### 2. direct ultra-low core path가 아직 살아 있다
- 반복 실패 후 마지막에 빠르게 앉았다 일어나 `ultra_low_rom_cycle`로 통과하는 사례가 있다.
- `eventCycleDetected=false`, `descentFrames=0`인데 pass되는 경우는 gold path가 아니다.
- 즉 direct ultra-low core path는 제거 또는 gold-path subordinate path로 재정렬되어야 한다.

### 3. stale fallback / delayed pass가 아직 살아 있다
- 10회 이상 실패 후 마지막 시도 하강 중 pass
- repeated shallow 후 마지막 late motion으로 pass
- 이는 current meaningful rep inside pass가 아니라 stale fallback / delayed pass다.

즉 현재 시스템에는 아직 competing path가 남아 있다.
- meaningful current-rep gold path
- direct ultra-low path
- stale official shallow fallback
- terminal/delayed laundering path

PR-11은 이 competing path 구조를 끝내야 한다.

---

## 핵심 진단
지금의 핵심 병목은 한 줄이다.

**pass authorization이 단일 gold path로 수렴하지 못하고, early-open / late-open / stale fallback / direct ultra-low path가 계속 경쟁하고 있다.**

따라서 이번 PR은 두 방향을 동시에 가져가야 한다.
1. meaningful current-rep descent -> ascent path를 단일 기본 통과 경로로 승격한다.
2. 그 외 경로가 pass authorization을 만들 수 없게 한다.

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

### 3. gold path only 원칙
PR-11 이후 shallow 통과는 사실상 하나의 gold path에 수렴해야 한다.
- meaningful current-rep descent truth
- meaningful current-rep ascent/reversal truth
- meaningful current-rep recovery/finalize truth
- non-degenerate commitment truth
- timing integrity
- correct open window
- current-rep ownership

direct ultra-low, stale fallback, terminal laundering은 독립 pass 경로가 되면 안 된다.

---

## Gold Path — Meaningful Shallow Current-Rep Contract
PR 이후 meaningful shallow pass의 단일 기본 계약은 아래다.

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

### G. correct open window integrity
가장 중요:
- pass는 하강 중 열리면 안 된다.
- pass는 ascent/reversal 이전에 열리면 안 된다.
- pass는 recovery/finalize 훨씬 뒤에 늦게 열리면 안 된다.
- pass는 **current meaningful rep completion 직후의 자연스러운 open window**에서만 열려야 한다.

즉 금지:
- early-open pass
- delayed/washed pass

### H. terminal independence
- terminal phase는 A~G가 current rep 내부에서 이미 성립한 경우만 finalize 가능
- terminal phase에서 A~G를 새로 만들면 안 된다
- terminal-adjacent finalization도 동일하게 금지

---

## 전면 차단해야 할 병목군
### 병목군 1 — early-open pass
- 하강 중 pass 금지
- 아직 다 일어나지도 않았는데 너무 빠르게 pass 금지
- reversal/recovery/finalize 이전 pass 금지

### 병목군 2 — late-open / washed pass
- current rep completion과 무관하게 너무 늦게 pass 금지
- standing hold / terminal / last motion으로 delayed pass 금지

### 병목군 3 — terminal finalization laundering
- terminal에서 새 pass 생성 금지
- terminal standing hold / terminal late motion / terminal jitter로 later pass 금지

### 병목군 4 — standing micro-motion / jitter / generic movement
- standing micro-motion pass 금지
- frame jitter / sensor spike pass 금지
- general non-descent->ascent motion pass 금지
- tiny dip / posture drift pass 금지

### 병목군 5 — repeated shallow aggregation
- 여러 번의 실패한 shallow 시도를 하나의 rep처럼 later pass로 닫기 금지
- earliest failed attempts의 evidence를 마지막 신호로 세탁 금지

### 병목군 6 — stale ownership reuse
- stale peak reuse 금지
- stale commitment reuse 금지
- stale reversal/recovery reuse 금지
- stale proof/bridge maturity reuse 금지

### 병목군 7 — direct ultra-low competing path
- `ultra_low_rom_cycle` direct path가 eventless / weak / non-gold-path 상태에서 pass authorization을 만들면 안 된다.
- shallow 통과는 gold-path-only에 수렴해야 한다.

---

## 지금 미리 잠가야 할 다음 의심 병목
### 의심 병목 1 — early-open을 막았더니 late-open만 남는 cosmetic fix
이건 실패다. open window는 "너무 이르지 않고, 너무 늦지 않은" 적절한 구간이어야 한다.

### 의심 병목 2 — good shallow fixture가 너무 좁아 repeatability가 낮음
한 가지 얕은 패턴만 pass하고 변형된 동등 품질 shallow는 실패하면 안 된다.

### 의심 병목 3 — direct ultra-low path만 막고 stale fallback은 남는 경우
PR-11은 direct ultra-low와 stale official shallow fallback 둘 다 동시에 잠가야 한다.

### 의심 병목 4 — fallback path를 막기 위해 good shallow pass를 어렵게 만듦
절대 금지. meaningful shallow의 easy pass는 유지되어야 한다.

---

## 권장 구현 방향
### 축 A — gold-path-only contract 명시
별도 helper/contract로 다음을 강제한다.
- meaningful current-rep descent truth
- meaningful current-rep ascent/reversal truth
- meaningful current-rep recovery truth
- non-degenerate movement truth
- timing integrity
- current-rep ownership
- correct open window integrity

### 축 B — direct ultra-low / stale fallback demotion
- `ultra_low_rom_cycle` direct core path가 gold path 바깥에서 pass를 만들지 못하게 한다.
- `official_shallow_cycle` fallback도 stale bridge/proof 누적으로 닫히지 못하게 한다.
- 둘 다 gold-path subordinate path로 재정렬하거나, gold path 만족 시에만 열리게 정렬한다.

### 축 C — terminal finalize-only guard 명시
terminal/finalization-adjacent 단계는
"이미 current rep 내부에서 close-eligible였는가"만 확인할 수 있어야 한다.
새 authorization 생성 금지.

### 축 D — repeatability + anti-early/late regression 잠금
반드시 둘 다 필요:
1. repeated good shallow success
2. early-open / late-open / terminal / standing / jitter / aggregation / direct-ultra-low blocked

구현 우선순위:
1. gold-path-only contract 명시
2. correct open window 규칙 명시
3. direct ultra-low / stale fallback demotion
4. terminal finalize-only 규칙 명시
5. anti-early/late + repeatability regression 추가

---

## 변경 범위
### 포함
- meaningful shallow current-rep gold-path contract 강화
- correct open window 규칙 도입
- terminal finalize-only 계약 도입/강화
- standing/jitter/general motion pass 차단
- repeated aggregation / stale ownership reuse 차단
- direct ultra-low competing path demotion 또는 gating
- regression/smoke에 repeated good shallow success 추가
- regression/smoke에 early-open / late-open / terminal / standing / jitter / aggregation false-pass 묶음 추가

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
6. 하강 중 pass 금지
7. 아직 다 일어나지도 않았는데 너무 빠른 pass 금지
8. current rep completion과 무관하게 너무 늦은 pass 금지
9. terminal phase에서 새 pass ownership 생성 금지
10. terminal-adjacent finalization에서 새 pass ownership 생성 금지
11. standing micro-motion pass 금지
12. frame jitter / spike pass 금지
13. general movement / non-descent->ascent pass 금지
14. repeated shallow aggregation later pass 금지
15. stale ownership reuse later pass 금지
16. direct `ultra_low_rom_cycle` eventless pass 금지
17. one-off lucky pass를 success로 간주 금지
18. repeated good shallow success를 검증하지 않은 채 완료 주장 금지
19. false positive를 막기 위해 good shallow repeatability를 희생 금지
20. deep standard success 회귀 금지
21. helper가 logical second writer처럼 동작 금지
22. threshold 숫자만 만지는 땜빵 금지

---

## 완료 정의
### A. good shallow default pass
1. 유의미한 하강 -> 상승 shallow rep는 반복적으로 통과한다.
2. 같은 품질 shallow rep를 10번 하면 거의 10번 통과한다.
3. quality interpretation은 남겨도 pass 자체는 쉬워야 한다.

### B. correct open window
4. 하강 중 pass가 더 이상 열리지 않는다.
5. 아직 다 일어나기도 전에 너무 빠른 pass가 더 이상 열리지 않는다.
6. current rep completion과 무관하게 너무 늦은 delayed pass가 더 이상 열리지 않는다.
7. pass는 current meaningful rep completion 직후의 자연스러운 open window에서만 열린다.

### C. anti-terminal / anti-standing / anti-jitter / anti-aggregation
8. terminal finalization에서 새 pass 생성 금지
9. terminal-adjacent finalization에서 새 pass 생성 금지
10. standing micro-motion pass 금지
11. frame jitter / spike pass 금지
12. general movement / non-descent->ascent pass 금지
13. repeated shallow aggregation later pass 금지
14. stale ownership reuse later pass 금지
15. slow-rise laundering later pass 금지
16. proof-only / bridge-only / jitter-only later pass 금지
17. direct ultra-low eventless later pass 금지

### D. regression safety
18. deep standard squat은 여전히 안정적으로 통과한다.
19. canonical closer 단일 writer 체계가 유지된다.
20. meaningful shallow gold path가 명시적으로 분리되어 system default가 된다.
21. terminal은 finalize-only이고 authorization을 만들지 않는다.
22. pass authorization은 current meaningful rep inside에서만 생성된다.

---

## 최종 원칙 한 줄
**이번 PR은 “유의미한 current-rep 하강->상승 shallow rep는 쉽게 반복 통과”를 단일 gold path로 만들고, 하강 중 조기 pass도, 늦게 세탁된 pass도, direct ultra-low / terminal / standing / jitter / 누적 stale evidence pass도 전부 금지하는 PR이다.**
