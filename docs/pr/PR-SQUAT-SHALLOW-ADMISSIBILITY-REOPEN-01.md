# PR-SQUAT-SHALLOW-ADMISSIBILITY-REOPEN-01 — Safe Shallow Admissibility Reopen Under Completion Owner

> 이 PR은 shallow 통과를 다시 열기 위한 기능 확장 PR이 아니라,  
> **authority realignment 이후에 shallow admissibility를 안전하게 재개방하기 위한 설계 문서**다.  
> 목표는 오직 하나다.  
> **completion owner를 우회하지 않는 조건에서만 일부 shallow / ultra-low-ROM 케이스를 다시 열 수 있는 명시적 shallow-complete rule을 설계하는 것**.

## 1. 문제 정의

최근 hotfix와 authority realignment 이후 현재 squat pass 체인은 보수적으로 잠겨 있다.

- `completion false -> final pass false`는 강제되었다.
- `completion owner`가 1차 권한으로 올라왔고, `pass core`는 completion owner를 대체하지 못한다.
- `officialShallowPathAdmitted`, `officialShallowClosureProofSatisfied`, `officialShallowAscentEquivalentSatisfied`, `officialShallowStreamBridgeApplied`, `eventBasedDescentPath` 등은 owner truth가 아니라 candidate / assist / trace 계열로 내려갔다.

이 방향은 거짓 양성 차단에는 성공적이지만, 반대편 tradeoff가 생겼다.

즉 다음이 남아 있다.

- ultra-low-ROM / shallow 사용자 중 일부 정상 시도가 전부 fail-close 된다.
- 기존 일부 shallow 기대 smoke가 `completion_truth_not_passed`로 차단된다.
- 얕지만 의도적으로 통과시켜야 할 케이스를 다시 열 수 있는 **정식 shallow-complete rule**이 아직 없다.

그래서 지금 다음 PR은 “shallow를 다시 쉽게 통과시키자”가 아니라,

**어떤 얕은 케이스를 completion owner가 진짜 completion으로 인정할 수 있는가를 명시적 규칙으로 재설계하는 것**

이어야 한다.

---

## 2. 이번 PR의 목표

이번 PR의 유일한 목표:

**completion owner 내부에서만 작동하는 narrow shallow-complete admissibility rule을 정의하여, false positive를 다시 열지 않으면서 일부 legitimate shallow/ultra-low-ROM 케이스를 재개방한다.**

즉 다음 두 조건을 동시에 만족해야 한다.

1. `completion false -> final pass false` 원칙 유지
2. completion owner가 명시적으로 shallow-complete로 인정한 케이스만 reopen

---

## 3. 최상위 원칙

### Principle A — owner 우회 금지
shallow reopen은 오직 **completion owner 내부의 completion rule**로만 가능하다.

- `pass core`가 대신 열면 안 된다.
- `ui gate`가 대신 열면 안 된다.
- `official shallow path` / `bridge` / `closure proof`가 대신 열면 안 된다.
- page/navigation/debug가 대신 열면 안 된다.

### Principle B — false positive first
이번 PR의 목적은 shallow를 넓게 살리는 것이 아니라,

**현재 authority 구조를 깨지 않는 범위 안에서, product-acceptable한 shallow 케이스만 매우 제한적으로 재개방하는 것**

이다.

### Principle C — standingRecovered late reopen 금지 유지
현재 가장 위험한 재발은 다음이었다.

- shallow 흔적만 남김
- completion not confirmed
- standingRecovered hold 이후 뒤늦게 통과

이 패턴은 이번 PR에서도 절대 허용하면 안 된다.

### Principle D — explicit shallow-complete only
shallow reopen은 “느낌상 얕지만 충분했다”가 아니라,

**명시적 shallow-complete contract**

가 있을 때만 owner true를 허용해야 한다.

---

## 4. 잠가야 할 truth

### Locked Truth A
`completion owner`만이 `movement completed`를 판단한다.

### Locked Truth B
shallow reopen은 `completion owner truth` 안에서만 발생할 수 있다.

### Locked Truth C
다음은 shallow reopen owner가 아니다.

- `pass core`
- `ui gate`
- `officialShallowPathAdmitted`
- `officialShallowClosureProofSatisfied`
- `officialShallowAscentEquivalentSatisfied`
- `officialShallowStreamBridgeApplied`
- `eventBasedDescentPath`
- `standingRecovered`

### Locked Truth D
`not_confirmed` 상태는 reopen 불가다.

즉 shallow reopen은 최소한 `completionPassReason = shallow_complete_*` 와 같은 **명시적 owner-level 완료 reason**이 있어야 한다.

### Locked Truth E
`standingRecovered`는 종료 상태이지, shallow reopen의 trigger가 아니다.

### Locked Truth F
shallow reopen은 standard cycle을 대체하는 일반 경로가 아니라,

**제한된 fallback completion mode**

여야 한다.

---

## 5. 설계 포인트

### A. 명시적 shallow-complete completion reason 도입
현재 `not_confirmed`와 `standard_cycle` 사이에 아무 owner-level shallow 완료 reason이 없다면, reopen은 영원히 불가능하거나 우회 경로를 다시 쓰게 된다.

그래서 completion owner 내부에서만 쓰는 shallow 완료 reason을 명시적으로 설계해야 한다.

예시 계열:

- `shallow_complete_rule`
- `ultra_low_rom_complete_rule`

중요:
- 이 reason은 trace decoration이 아니라 **completion owner reason**이어야 한다.
- `not_confirmed`를 재활용하면 안 된다.

### B. Shallow-complete 최소 요건 정의
아래 계열을 최소 요건 후보로 둔다.

1. 실제 attempt 시작이 있었음
2. 의미 있는 descend 신호가 있었음
3. reversal이 있었음
4. recovery가 있었음
5. standingRecovered 이전에 shallow closure proof가 명시적으로 만족됨
6. standing still false positive가 아님
7. seated/bottom/descend-open timing이 아님
8. cycle shape는 shallow지만, completion owner가 허용 가능한 종료 규칙을 만족함

즉 shallow reopen은 “깊이가 부족해도 된다”이지,
“cycle proof가 없어도 된다”는 뜻이 아니다.

### C. Candidate → owner 승격 규칙 분리
현재 shallow candidate 관련 값은 많다.

- `officialShallowPathAdmitted`
- `officialShallowClosureProofSatisfied`
- `officialShallowAscentEquivalentSatisfied`
- `officialShallowStreamBridgeApplied`
- `eventBasedDescentPath`

이번 PR의 핵심은 이 값을 그대로 owner truth로 쓰는 것이 아니라,

**candidate bundle → shallow-complete owner decision**

이라는 명시적 승격 단계로 분리하는 것이다.

즉 candidate는 입력일 뿐, owner truth 그 자체가 아니다.

### D. Final authority adapter는 그대로 유지
현재 정렬된 구조는 유지한다.

**completion owner -> pass core confirmation -> ui gate exposure -> final latch**

따라서 shallow reopen은 `completion owner` 단계에서만 바뀌고,
이후 단계는 그대로 둬야 한다.

### E. Standard cycle과 shallow-complete를 분리
이 PR은 standard cycle 완화가 아니다.

- standard cycle은 기존대로 유지
- shallow-complete는 별도 fallback completion mode로 추가

즉 standard 기준을 낮추는 방식으로 해결하면 안 된다.

---

## 6. Scope

이번 PR 범위:

- completion owner 내부 shallow-complete admissibility 설계
- shallow candidate → owner 승격 규칙 설계
- owner-level shallow completion reason 설계
- 관련 invariant / smoke 설계

---

## 7. Non-goals

이번 PR에서 하지 말 것:

- threshold 전반 완화
- readiness/setup 규칙 변경
- pass core 권한 확대
- ui gate 의미 변경
- page navigation 변경
- debug/trace schema 확대
- overhead reach 변경
- standingRecovered late reopen 허용
- shallow bridge를 owner로 복귀시키기

이 PR은 **safe shallow reopen under completion owner only** 설계다.

---

## 8. 예상 변경 파일

우선순위:

- `src/lib/camera/squat-completion-state.ts`
- `src/lib/camera/squat/squat-progression-contract.ts`
- `src/lib/camera/auto-progression.ts`

필요 시 최소 추가:

- shallow admissibility helper
- candidate bundle helper
- smoke script 1~2개

---

## 9. Acceptance Tests

### A. Invariant smoke
아래 조합은 계속 금지:

1. `completionTruthPassed=false && finalPassEligible=true`
2. `completionOwnerReason="not_confirmed" && finalPassEligible=true`
3. `cycleComplete=false && finalPassEligible=true`
4. `officialShallowPathAdmitted=true`만으로 pass open
5. `standingRecovered`만으로 late reopen

### B. Shallow reopen smoke
아래는 새로 허용 검증:

1. explicit shallow-complete rule satisfied -> completion owner true
2. ultra-low-ROM but valid shallow cycle proof -> pass open 가능
3. pass-core/ui-gate는 owner reopen 뒤에만 통과
4. standard cycle 기존 pass 유지

### C. False-positive regression smoke
아래는 계속 금지:

1. standing pass
2. descent pass
3. bottom pass
4. shallow 후 2~3초 delayed pass
5. not_confirmed owner reason 상태 pass

---

## 10. 리스크

가장 큰 리스크는 두 가지다.

### Risk A — reopen 범위 과확장
shallow admissibility를 넓게 열면 예전 재발이 돌아온다.

### Risk B — owner reason 오염
`not_confirmed`를 애매하게 살려두거나, candidate 값을 곧바로 owner truth로 쓰면 다시 authority 구조가 무너진다.

따라서 이 PR은 “많이 열기”가 아니라 **아주 좁고 명시적으로 열기**여야 한다.

---

## 11. 다음 후속

이 PR이 끝나면 그 다음에야 아래를 볼 수 있다.

1. ultra-low-ROM 실제 사용자 체감 검증
2. shallow-complete rule precision 조정
3. 필요시 quality/explanation 개선

하지만 이 PR 전에는 다시 shallow rescue를 넓게 열면 안 된다.

---

## 12. 최종 결론

다음 단계의 본질은 이거다.

**false positive를 막기 위해 닫아둔 authority 구조는 그대로 유지하고, 오직 completion owner 내부에만 명시적 shallow-complete rule을 추가하여 일부 legitimate shallow/ultra-low-ROM 케이스를 안전하게 재개방하라.**

즉 이번 PR은 “다시 쉽게 통과시키기”가 아니라,

**“누가 shallow 통과를 인정할 수 있는가”를 completion owner 내부에서만 엄격하게 정의하는 설계**다.