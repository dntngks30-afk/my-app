# PR-SQUAT-SHALLOW-REOPEN-CANONICAL-CLOSURE-ALIGN-01 — Canonical Shallow Closure Alignment for Owner Reopen

> 이 PR은 새로운 shallow reopen 기능 PR이 아니라,  
> **이미 추가된 owner-local shallow reopen이 실제 evaluator/runtime 흐름 끝까지 살아남도록 canonical shallow closure state를 정합하게 맞추는 보정 설계 문서**다.  
> 목표는 오직 하나다.  
> **completion owner 내부 reopen이 canonical shallow closure validation과 모순되지 않도록 상태 정합성을 맞추는 것**.

## 1. 문제 정의

`PR-SQUAT-SHALLOW-ADMISSIBILITY-REOPEN-01`은 방향 자체는 맞다.

- reopen은 completion owner 내부 helper에서만 일어난다.
- pass-core / ui-gate / page 권한은 건드리지 않는다.
- explicit owner-level shallow reason(`shallow_complete_rule`, `ultra_low_rom_complete_rule`)를 추가한다.

하지만 현재 구현에는 치명적인 정합성 리스크가 있다.

`applyCompletionOwnerShallowAdmissibilityReopen(...)`가 reopen 시 아래를 올린다.

- `completionSatisfied = true`
- `completionPassReason = low_rom_cycle | ultra_low_rom_cycle`
- `completionOwnerReason = shallow_complete_rule | ultra_low_rom_complete_rule`
- `cycleComplete = true`

그런데 canonical shallow closure 쪽 state인

- `officialShallowPathClosed`
- 관련 closure proof / canonical close metadata

를 reopen과 함께 정합하게 올리지 않으면, 이후 evaluator/runtime 흐름의 `getShallowMeaningfulCycleBlockReason(...)` 또는 동등 validator가 다시 이를 invalid로 보고 `not_confirmed`로 demote할 수 있다.

즉 현재 리스크는 이 한 줄이다.

**owner-local shallow reopen이 코드상 존재해도, canonical shallow closure state와 모순되면 실제 런타임 pass ownership까지 살아남지 못한다.**

이건 reopen 설계 자체의 방향 문제는 아니고, **reopen state와 canonical closure state alignment 부재** 문제다.

---

## 2. 이번 PR의 목표

이번 PR의 유일한 목표:

**owner-local shallow reopen이 canonical shallow closure validation을 끝까지 통과할 수 있도록, reopen 시 필요한 canonical shallow closed state와 관련 metadata를 정합하게 맞춘다.**

즉 이번 PR은 다음을 동시에 만족해야 한다.

1. shallow reopen은 여전히 completion owner 내부에서만 발생
2. reopen 후 state가 canonical shallow closure validator와 모순되지 않음
3. false positive 방어(hotfix/authority realignment)는 그대로 유지

---

## 3. 최상위 원칙

### Principle A — reopen 방향 유지
이번 PR은 reopen의 위치를 바꾸는 PR이 아니다.

- reopen은 계속 completion owner 내부 helper에서만 발생해야 한다.
- pass-core로 옮기면 안 된다.
- ui-gate로 옮기면 안 된다.
- page/navigation 쪽으로 옮기면 안 된다.

### Principle B — canonical alignment only
이번 PR의 본질은 “더 많이 열기”가 아니다.

**이미 owner가 reopen한 shallow completion state가 canonical shallow closure state와 모순되지 않게 맞추는 것**

이다.

### Principle C — no fake closure
alignment는 단순 flag 덧칠이 아니라, reopen helper가 실제로 만족한 proof에 맞는 canonical shallow closed state를 반영해야 한다.

즉 근거 없이 `officialShallowPathClosed=true`만 강제로 찍는 식이면 안 된다.

### Principle D — false positive barrier 유지
다음은 계속 금지다.

- standing pass
- descent pass
- bottom pass
- shallow 후 delayed standingRecovered reopen
- `not_confirmed` 상태 pass
- candidate-only shallow flags 단독 pass

---

## 4. 잠가야 할 truth

### Locked Truth A
owner-local shallow reopen이 발생하면, canonical shallow closure state도 **동일 의미 체계에서 정합**해야 한다.

### Locked Truth B
`completionPassReason = low_rom_cycle | ultra_low_rom_cycle` 가 유효하려면, downstream canonical validator가 이를 다시 `not_confirmed`로 내리지 않을 상태여야 한다.

### Locked Truth C
`officialShallowPathClosed` 및 관련 canonical close metadata는 reopen과 무관한 decorational flag가 아니다.

즉 reopen survival에 필요한 state라면 helper가 함께 책임지고 맞춰야 한다.

### Locked Truth D
candidate / proof 입력은 여전히 owner truth가 아니다.

다만 owner가 reopen을 결정했다면, 그 reopen은 **canonical validator를 통과할 수 있는 coherent state**를 만들어야 한다.

### Locked Truth E
`not_confirmed`는 여전히 금지다.

alignment PR이 `not_confirmed`를 우회 가능하게 만들어서는 안 된다.

---

## 5. 핵심 설계 포인트

### A. Reopen state bundle 정합화
현재 reopen helper가 올리는 state는 completion owner 쪽 필드 중심이다.

이번 PR에서는 reopen 시 함께 맞춰야 하는 canonical shallow closure state bundle을 정의해야 한다.

예시 대상:

- `officialShallowPathClosed`
- shallow close proof summary
- canonical shallow closure derived flags
- downstream validator가 low/ultra-low cycle을 유효로 보게 만드는 최소 state

중요:
- 이건 새로운 권한이 아니라 **state coherence**다.

### B. Reopen helper가 책임지는 범위 명시
`applyCompletionOwnerShallowAdmissibilityReopen(...)` 또는 인접 helper는
reopen 성공 시 아래 두 축을 함께 만들어야 한다.

1. owner-level completion state
2. canonical shallow closure aligned state

즉 “owner truth만 올리고 canonical state는 과거 blocked 상태에 남는” 모순을 금지한다.

### C. Downstream demotion 방지
다음은 acceptance 기준으로 직접 검증해야 한다.

- reopen helper 적용
- 이후 shallow meaningful cycle validator / canonical closure validator / owner read / final pass chain
- 끝까지 지나도 다시 `not_confirmed`로 demote되지 않음

즉 이 PR의 진짜 성공 기준은 단순 helper unit pass가 아니라,

**reopen survival through the real evaluator/runtime chain**

이다.

### D. Alignment는 canonical contract 안에서만
기존 canonical shallow contract와 충돌하면 안 된다.

따라서 reopen alignment는:
- canonical close semantics를 재정의하지 않고
- canonical close가 요구하는 state를 합법적으로 만족시키는 방향

이어야 한다.

### E. New reopen smoke must be end-to-end-ish
현재 합성 state smoke만으로는 부족하다.

이번 PR에서는 최소한 문자열/함수 조합 수준이라도,

- reopen helper 적용 후
- canonical shallow closure validator가 low/ultra-low cycle을 다시 invalid 처리하지 않는지
- owner read / final pass chain까지 survive 하는지

를 보는 smoke가 필요하다.

---

## 6. Scope

이번 PR 범위:

- owner-local shallow reopen state와 canonical shallow closure state 정합화
- reopen helper / canonical close helper 인접 영역 보정
- reopen survival smoke 추가

---

## 7. Non-goals

이번 PR에서 하지 말 것:

- threshold 전반 완화
- readiness/setup 변경
- page navigation 변경
- pass-core 권한 확대
- ui-gate 의미 변경
- 새로운 shallow reopen 경로 추가
- candidate-only reopen 허용
- standingRecovered late reopen 허용
- observability/debug 개편

이 PR은 **canonical closure alignment only**다.

---

## 8. 예상 변경 파일

우선순위:

- `src/lib/camera/squat-completion-state.ts`
- 필요 시 `src/lib/camera/squat/squat-progression-contract.ts`

필요 시 최소 추가:

- `scripts/camera-squat-shallow-reopen-canonical-closure-align-01-smoke.mjs`
- 기존 `camera-squat-shallow-admissibility-reopen-01-smoke.mjs` 보강

원칙적으로 건드리지 말 것:

- `src/lib/camera/auto-progression.ts`
- `src/app/movement-test/camera/squat/page.tsx`
- readiness/setup/live-readiness 관련 파일
- TraceDebugPanel / camera-trace 계열
- overhead reach 파일들

---

## 9. Acceptance Tests

### A. Alignment smoke
아래를 반드시 검증:

1. explicit shallow reopen 발생 후 canonical shallow closed state가 정합하게 맞춰짐
2. `low_rom_cycle` / `ultra_low_rom_cycle`가 downstream validator에서 다시 `not_confirmed`로 demote되지 않음
3. owner read -> final pass chain까지 reopen이 survive 함

### B. False-positive regression smoke
계속 금지:

1. standing pass
2. descent pass
3. bottom pass
4. shallow 후 delayed standingRecovered reopen
5. candidate-only flags 단독 pass
6. `not_confirmed` 상태 pass

### C. Existing authority contract smoke
계속 통과:

1. hotfix smoke
2. owner realign smoke
3. STRUCT-11 smoke

---

## 10. 리스크

가장 큰 리스크는 두 가지다.

### Risk A — flag 덧칠식 alignment
canonical state를 근거 없이 찍어버리면, false positive가 다시 열린다.

### Risk B — reopen 생존은 되지만 범위가 과하게 넓어짐
alignment 과정에서 low/ultra-low reopen 범위가 의도보다 크게 넓어질 수 있다.

따라서 이 PR은 reopen을 “더 많이 열기”가 아니라,
**이미 열기로 한 좁은 reopen이 evaluator/runtime 체인에서 일관되게 살아남도록 만드는 것**에 집중해야 한다.

---

## 11. 다음 후속

이 PR 이후에야 비로소 아래를 볼 수 있다.

1. 실기기 ultra-low-ROM 체감 검증
2. reopen precision tuning
3. 필요시 rule 조정

하지만 이 PR 전에는 shallow reopen이 실제로 runtime에서 살아남는지부터 먼저 잠가야 한다.

---

## 12. 최종 결론

다음 단계의 본질은 이거다.

**completion owner 내부에서 이미 설계한 shallow reopen을 유지하되, 그 reopen이 canonical shallow closure validator와 모순되지 않도록 state를 정합하게 맞춰 실제 런타임 pass ownership까지 끝까지 살아남게 하라.**

즉 이번 PR은 “더 넓게 열기”가 아니라,

**“이미 열기로 한 좁은 shallow reopen을 canonical evaluator 흐름 안에서 실제로 유효하게 만드는 정합성 보정”** 설계다.