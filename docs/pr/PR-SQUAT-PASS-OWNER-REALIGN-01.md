# PR-SQUAT-PASS-OWNER-REALIGN-01 — Shallow Admission Demotion & Final Pass Authority Realignment

> 이 PR은 리팩토링 연장이 아니라, hotfix 이후 남은 **pass authority 구조 재정렬** 설계 문서다.  
> 목표는 오직 하나다.  
> **squat final pass authority를 completion owner 중심으로 다시 잠그고, shallow admission 계열을 owner chain에서 강등하는 것**.

## 1. 문제 정의

방금 hotfix는 `completion false -> final pass false`를 강제로 막는 응급 봉합이었다.  
하지만 그건 출혈을 멈춘 것이지, 권한 구조를 바로잡은 것은 아니다.

현재 남은 구조 병목은 다음 네 축의 권한 혼선이다.

1. `completion owner`
2. `pass core`
3. `ui gate`
4. `official shallow path / shallow bridge / closure proof`

실기기 로그에서는 아래 값들이 동시에 찍혔다.

- `completionTruthPassed: false`
- `completionOwnerPassed: true`
- `completionOwnerReason: "not_confirmed"`
- `uiProgressionAllowed: true`
- `finalPassEligible: true`
- `finalPassLatched: true`

즉 completion truth가 false인데도, shallow/bridge/gate/pass-core 계열이 final pass를 사실상 다시 열 수 있는 구조가 존재했다. fileciteturn53file0 fileciteturn53file1

hotfix는 이걸 직전 단계에서 fail-close 했지만, 지금 필요한 다음 PR은 **누가 final pass를 열 수 있는지의 authority를 다시 잠그는 것**이다.

---

## 2. 이번 PR의 목표

이번 PR의 유일한 목표:

**squat final pass authority를 completion owner 중심으로 재정렬하고, shallow admission 계열을 owner chain에서 강등한다.**

즉 hotfix가 “거짓 양성 차단” PR이었다면, 이번 PR은  
**completion owner / pass core / ui gate / shallow candidate의 권한 구조를 다시 잠그는 PR**이다.

---

## 3. 최종으로 잠가야 할 권한 구조

최종 구조는 아래처럼 고정해야 한다.

**completion owner → pass core confirmation → ui gate exposure → final latch**

그리고 아래 규칙을 함께 잠근다.

- `completion owner`만이 **movement completed** truth를 가진다.
- `pass core`는 completion owner를 대체할 수 없다.
- `ui gate`는 veto / exposure만 가능하다.
- `official shallow path / shallow bridge / closure proof`는 candidate / assist / observability만 가능하다.
- `standingRecovered`는 종료 phase일 뿐 owner가 아니다.

---

## 4. 잠가야 할 truth

### Locked Truth A
`completion owner`만이 `movement completed`를 말할 수 있다.

### Locked Truth B
`pass core`는 아래만 할 수 있다.

- readiness/setup/standing still/phase timing 보조
- completion owner가 true일 때만 final pass를 이어받음

즉 `pass core` 단독 pass 금지.

### Locked Truth C
아래 값들은 **owner truth가 아니다**.

- `officialShallowPathAdmitted`
- `officialShallowClosureProofSatisfied`
- `officialShallowAscentEquivalentSatisfied`
- `officialShallowStreamBridgeApplied`
- `eventBasedDescentPath`

이 값들은 오직 아래 용도만 허용한다.

- assist
- candidate
- trace
- quality explanation

### Locked Truth D
`completionOwnerReason: "not_confirmed"`는 논리적으로 owner pass와 동시에 존재할 수 없다.

즉 이 조합 자체를 금지해야 한다.

### Locked Truth E
`completionOwnerPassed`, `completionTruthPassed`, `completionPassReason`, `completionBlockedReason`, `cycleComplete` 사이에  
서로 모순되는 조합이 있으면 **owner contradiction**로 취급하고 fail-close 해야 한다.

---

## 5. 핵심 설계 포인트

### A. Owner contradiction invariant 도입
런타임 invariant를 하나 도입한다.

예시:

- owner passed면 blocked reason이 없어야 한다.
- owner passed면 `not_confirmed`일 수 없다.
- `cycleComplete === false`인데 owner passed일 수 없다.

즉 completion owner 내부에서 **모순 state 생성 자체를 금지**한다.

### B. Shallow admission demotion
현재 shallow 계열은 너무 많은 힌트를 들고 있다.  
이번 PR에서 이를 명시적으로 두 층으로 나눈다.

- `shallow_candidate_signals`
- `completion_owner_truth`

shallow candidate는 owner truth를 만드는 주체가 아니라,  
owner가 참이 된 뒤 quality/explanation을 보강하는 자료로 내려야 한다.

### C. Final pass authority adapter 단일화
hotfix는 final pass 직전에 막았다.  
이번 PR은 그보다 한 단계 앞서,

**`squat completion owner truth -> final pass authority input`**

단일 adapter를 두어 final pass가 completion owner를 우회하지 못하게 해야 한다.

### D. Standing recovered demotion
`standingRecovered`는 completion confirmed 이후의 종료 phase일 뿐이다.  
지금처럼 late pass reopening의 트리거가 되면 안 된다.  
즉 `standingRecovered + shallow 흔적 + hold`는 owner false 상태에선 항상 non-pass여야 한다.

---

## 6. Scope

이번 PR 범위:

- squat completion owner truth 정합성 강화
- owner contradiction invariant 도입
- shallow admission / pass assist / trace 정보의 owner chain 제거
- final pass authority input adapter 정리
- 관련 smoke 추가

---

## 7. Non-goals

이번 PR에서 하지 말 것:

- threshold 재조정
- readiness/setup 변경
- page navigation 변경
- debug panel 변경
- overhead reach 변경
- UX copy 변경
- trace schema 확대
- 카메라 전반 재설계
- shallow 정상통과를 다시 여는 튜닝

이 PR은 authority realignment only 이다.

---

## 8. 예상 변경 파일

우선순위:

- `src/lib/camera/squat-completion-state.ts`
- `src/lib/camera/squat/pass-core.ts`
- `src/lib/camera/auto-progression.ts`

필요 시 최소 추가:

- owner contradiction invariant helper
- authority adapter helper
- smoke script 1~2개

---

## 9. Acceptance Tests

### Invariant smoke
아래 조합은 무조건 금지:

1. `completionOwnerPassed=true && completionOwnerReason="not_confirmed"`
2. `completionOwnerPassed=true && completionOwnerBlockedReason!=null`
3. `cycleComplete=false && completionOwnerPassed=true`
4. `completionTruthPassed=false && finalPassEligible=true`
5. `officialShallowPathAdmitted=true`만으로 final pass open

### Behavioral smoke
반드시 유지:

1. standing pass 금지
2. descent pass 금지
3. shallow delayed pass 금지
4. 정상 완주 cycle에서는 pass 유지
5. page navigation / next-step 1회만 유지

---

## 10. 리스크

가장 큰 리스크는 여전히 false negative다.  
특히 기존 ultra-low-ROM 계열 중 일부가 더 많이 막힐 수 있다.

하지만 이 PR의 목적은 얕은 케이스를 다시 살리는 것이 아니라  
**얕은 candidate와 owner truth를 분리하는 것**이다.

이걸 안 하면 같은 재발이 다시 난다.

---

## 11. 다음 후속

이 PR까지 끝나면 그 다음 순서는 아래다.

1. hotfix로 거짓 양성 차단
2. authority realignment로 owner 권한 정렬
3. 그 다음에야 ultra-low-ROM / shallow admissibility를 다시 조심스럽게 열어볼 수 있음

즉 지금은 아직 **얕은 스쿼트 구제 PR**을 하면 안 된다.

---

## 12. 최종 결론

다음 PR의 본질은 이거다.

**completion false면 pass 금지라는 일회성 hotfix를 넘어서, shallow admission / pass core / ui gate가 completion owner를 대체하지 못하도록 권한 구조를 다시 잠가라.**

이게 현재 hotfix 다음에 와야 하는 올바른 구조 PR이다.

근거:
- 실기기 재발 로그의 completion/pass contradiction fileciteturn53file0
- 동일 계열 delayed shallow recovery reopen 로그 fileciteturn53file1
- emergency hotfix 문서가 확인한 root contradiction 정리 fileciteturn54file0