# PR-HOTFIX-SQUAT-COMPLETION-LOCK-01 — Completion False Pass Reopen Emergency Lock

> 이 PR은 구조 리팩토링이 아니라 **실기기 재발 차단용 긴급 hotfix 설계 문서**다.  
> 목표는 오직 하나다.  
> **`completion truth`가 false인데 `final pass`가 열리는 모순을 즉시 차단**하는 것.

## 1. 문제 정의

실기기에서 아래 병목이 다시 재발했다.

1. 가만히 서 있는데 통과
2. 앉는 도중 통과
3. 얕은 스쿼트 후 2~3초 뒤 standing recovered 구간에서 늦게 통과

업로드된 실기기 로그는 이 재발이 단순 체감 문제가 아니라, **runtime truth chain 자체의 모순**임을 보여준다.

대표 로그 1에서는:

- `outcome: "ok"`
- `progressionPassed: true`
- `finalPassLatched: true`

인데 동시에:

- `cycleComplete: false`
- `minimumCycleDurationSatisfied: false`
- `completionBlockedReason: "descent_span_too_short"`
- `completionTruthPassed: false`
- `passSeverity: "failed"`
- `resultInterpretation: "movement_not_completed"`

가 함께 존재한다. 즉 **완주 실패인데 pass가 열렸다**. fileciteturn53file0

대표 로그 2에서도:

- `outcome: "ok"`
- `finalPassLatched: true`

인데 동시에:

- `depthBand: "shallow"`
- `cycleComplete: false`
- `completionPassReason: "not_confirmed"`
- `completionTruthPassed: false`
- `passSeverity: "failed"`
- `resultInterpretation: "movement_not_completed"`

다. 또 `cycleDurationMs: 3682.9`, `standingRecoveryHoldMs: 781.6`이 찍혀 있어, **얕은 ROM 흔적 후 늦게 standing_recovered에서 통과가 열린 케이스**와 정확히 맞물린다. fileciteturn53file1

이건 리팩토링 문서상 경계 문제가 아니라, **semantic contradiction 재유입**이다.

---

## 2. 핵심 원인

현재 재발의 본질은 아래 한 줄이다.

**`completion truth = false`인데 `pass core / final pass = true`가 가능해졌다.**

즉 다음 경로가 다시 열려 있다.

- shallow observation / shallow bridge / official shallow path admitted
- event-like reversal / recovery proof
- standing_recovered hold
- pass core truth
- final pass eligible

이 중 하나 이상이 **completion false 상태를 무시하고 final pass를 열고 있다.** fileciteturn53file0 fileciteturn53file1

특히 로그에서 아래 값들이 함께 찍힌다는 점이 치명적이다.

- `completionTruthPassed: false`
- `completionOwnerPassed: true`
- `completionOwnerReason: "not_confirmed"`
- `uiProgressionAllowed: true`
- `finalPassEligible: true`
- `finalPassLatched: true`

이 조합 자체가 금지되어야 한다. fileciteturn53file0 fileciteturn53file1

---

## 3. 이번 PR의 목표

이번 PR의 유일한 목표:

**squat에서 `completion truth false → final pass false`를 강제하는 emergency semantic lock**

즉,

- standing
- descent 중
- shallow 흔적만 남기고 late recovery pass
- not_confirmed owner reason
- descent span too short
- cycleComplete false

같은 상태에서는 **어떤 우회 경로도 final pass를 열 수 없게** 해야 한다.

---

## 4. Scope

이번 PR 범위:

- squat의 final pass eligibility 진입 직전 semantic guard 추가
- completion false 상태에서 final pass / final latch 차단
- owner/pass-core/final-pass 모순 상태 금지
- shallow candidate / shallow bridge / recovery proof를 pass owner가 아니라 candidate/proof-only로 강등
- regression smoke 추가

---

## 5. Non-goals

이번 PR에서 하지 말 것:

- threshold 튜닝
- readiness/setup 변경
- page navigation 변경
- voice / overlay 변경
- debug panel 변경
- trace schema 리디자인
- overhead reach 변경
- 전체 리팩토링 재개
- UI/UX 조정

이건 **semantic emergency lock only**다.

---

## 6. 잠가야 할 truth

### Locked Truth A
`squat completionTruthPassed === false` 이면  
`finalPassEligible === true`가 절대 되면 안 된다.

### Locked Truth B
`completionOwnerReason === "not_confirmed"` 상태는  
owner pass truth로 승격될 수 없다.

### Locked Truth C
아래 중 하나라도 참이면 final pass 금지:

- `cycleComplete === false`
- `completionTruthPassed === false`
- `completionBlockedReason != null`
- `completionPassReason === "not_confirmed"`

### Locked Truth D
`officialShallowPathAdmitted`, `officialShallowClosureProofSatisfied`, `officialShallowAscentEquivalentSatisfied`는  
**candidate / observability / proof 보조 정보**일 뿐, 단독 pass opening 근거가 될 수 없다. fileciteturn53file0 fileciteturn53file1

### Locked Truth E
`standingRecovered`는 pass 타이밍이 아니라 **completion confirmed 이후의 종료 상태**여야 한다.  
즉 standingRecovered 자체가 pass를 여는 열쇠가 되면 안 된다.

---

## 7. 실제 로그 기준 긴급 차단 포인트

### 케이스 1: 가만히 서 있는데 통과
차단 기준:

- `attemptStarted`가 false이거나
- meaningful descent / reversal / recovery cycle truth가 confirmed되지 않았으면
- standingRecovered / hold만으로 final pass 금지

### 케이스 2: 앉는 도중 통과
차단 기준:

- `successPhaseAtOpen`가 descend / bottom / ascent early window 계열이면 금지
- recovery confirmed 이전 pass 금지

### 케이스 3: 얕은 스쿼트 후 2~3초 뒤 통과
차단 기준:

- shallow observation만 있고 completion confirmed가 없으면
- late standingRecovered hold로 final pass 금지
- `not_confirmed` owner reason이면 무조건 final pass 금지

---

## 8. 설계 원칙

### Principle 1
이번 PR은 **“completion false면 끝”** 이라는 emergency precedence를 최상위에 둔다.

### Principle 2
지금은 “통과는 쉽게, 판정은 엄격하게”보다 더 우선되는 게 있다.

**“거짓 양성은 절대 안 된다.”**

즉 이번 hotfix는 false negative가 조금 늘더라도 false positive를 먼저 끊는 방향이어야 한다.

### Principle 3
shallow 관련 경로는 이번 PR에서 **pass assist가 아니라 observability candidate**로 다뤄야 한다.

---

## 9. 권장 구현 방향

### Option A — Final pass hard gate
`squat final pass eligibility` 계산 직전에 아래 hard guard 삽입

- if `completionTruthPassed !== true` → final pass false
- if `completionPassReason === "not_confirmed"` → final pass false
- if `completionBlockedReason != null` → final pass false
- if `cycleComplete !== true` → final pass false

가장 보수적이고, 지금 상황에선 이 방향이 맞다.

### Option B — Owner contradiction fail-close
아래 조합이 나오면 즉시 fail-close:

- `completionOwnerPassed === true` && `completionOwnerReason === "not_confirmed"`
- `completionTruthPassed === false` && `finalPassEligible === true`
- `completionTruthPassed === false` && `finalPassLatched === true`

### Option C — Shallow assist demotion
shallow candidate / bridge / closure proof는  
최대 “quality/trace/diagnostic candidate”까지만 허용하고, final pass owner chain에 직접 연결 금지

---

## 10. 변경 예상 파일

우선순위:

- squat completion / pass-core / final-pass decision이 실제로 만나는 파일
- `src/lib/camera/auto-progression.ts`
- `src/lib/camera/squat-completion-state.ts`
- `src/lib/camera/squat/pass-core.ts`

필요 시 최소 추가:

- 관련 smoke script 1개
- trace에 contradiction flag 추가 가능하지만, 이번 PR의 핵심은 아님

---

## 11. Acceptance Tests

### 필수 semantic smoke
아래 조합이 나오면 무조건 fail:

1. `completionTruthPassed=false && finalPassEligible=true`
2. `completionTruthPassed=false && finalPassLatched=true`
3. `completionOwnerReason="not_confirmed" && finalPassEligible=true`
4. `completionBlockedReason!=null && finalPassLatched=true`

### 실기기 재검증 체크
반드시 다시 확인:

1. standing에서 통과 0회
2. descent 중 통과 0회
3. shallow 후 delayed pass 0회
4. 정상 깊이 스쿼트에서만 통과
5. 스쿼트 성공 후 다음 단계 이동 1회만

---

## 12. Regression Risk

이번 PR의 가장 큰 리스크는 **false negative 증가**다.  
즉 얕지만 실제로는 허용하고 싶었던 케이스까지 막힐 수 있다.

하지만 현재는 false positive가 제품을 깨고 있으므로,  
이번 hotfix에서는 false negative를 일정 부분 감수하는 게 맞다.

---

## 13. Follow-up

이 PR 이후 다시 해야 할 것:

1. shallow admisssion 경로 재설계
2. completion owner / pass core / final pass truth 재정렬
3. “completion false면 무조건 fail-close”를 유지한 상태에서, 어떤 shallow 케이스를 다시 열 것인지 별도 설계

즉 이번 PR은 **영구 해법이 아니라 출혈 봉합**이다.

---

## 14. 최종 결론

이번 재발은 readiness, navigation, debug 문제가 아니다.  
핵심은 오직 하나다.

**completion false 상태에서 final pass가 다시 열리고 있다.**

그러므로 이번 emergency PR은 반드시 다음 한 줄을 코드로 강제해야 한다.

**squat에서 completion truth가 false면 final pass는 절대 열리지 않는다.**

근거 로그: fileciteturn53file0 fileciteturn53file1 fileciteturn53file2