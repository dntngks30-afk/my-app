# PR-SQUAT-SHALLOW-REOPEN-INTEGRITY-BLOCKER-GUARD-01 — Preserve Canonical Integrity Blockers Before Owner Shallow Reopen

> 이 PR은 새로운 shallow reopen 기능 PR이 아니라,  
> **owner-local shallow reopen이 canonical integrity blocker를 우회하지 못하도록 막는 정밀 수정 설계 문서**다.  
> 목표는 오직 하나다.  
> **이미 canonical shallow contract가 timing / ownership / anti-false-pass 이유로 차단한 rep는 owner reopen이 다시 살리지 못하게 하는 것**.

## 1. 문제 정의

`PR-SQUAT-SHALLOW-REOPEN-CANONICAL-CLOSURE-ALIGN-01`은 방향상으로는 맞았다.

- owner-local shallow reopen에 canonical shallow closed state를 맞추려 했다.
- reopen 후 low/ultra-low cycle이 downstream validator에서 다시 demote되지 않도록 정합성을 보강했다.

하지만 현재 구현에는 새 false-positive 리스크가 있다.

`applyCompletionOwnerShallowAdmissibilityReopen(...)`는 reopen 금지 조건으로 사실상 `completionBlockedReason === 'not_armed'`만 본 뒤, reopen이 성공하면:

- `completionSatisfied = true`
- `completionBlockedReason = null`
- canonical shallow closed 관련 state 정렬

을 수행한다.

이 구조는 다음 문제를 만든다.

- `descent_span_too_short`
- `ascent_recovery_span_too_short`
- rep-epoch contamination
- insufficient-signal / ownership contamination
- shallow-completion-contract 의 `firstBlockedReason`

같은 **canonical integrity blocker**가 남아 있어도, 다른 shallow candidate 조건이 우연히 맞으면 reopen으로 다시 살아날 수 있다.

즉 현재 리스크는 이 한 줄이다.

**owner-local shallow reopen이 canonical integrity blocker를 존중하지 않으면, alignment를 명분으로 previously rejected shallow rep를 다시 pass로 살릴 수 있다.**

이건 이번 시리즈의 최상위 목표와 정면으로 충돌한다.

---

## 2. 이번 PR의 목표

이번 PR의 유일한 목표:

**owner-local shallow reopen이 canonical integrity blocker가 없는 경우에만 동작하도록 제한하고, blocker가 남아 있는 rep는 reopen이 절대 살리지 못하게 한다.**

즉 다음을 동시에 만족해야 한다.

1. owner-local shallow reopen 경로 자체는 유지
2. canonical closure alignment는 유지
3. canonical integrity blocker 존재 시 reopen 금지
4. false positive barrier 유지

---

## 3. 최상위 원칙

### Principle A — blocker precedence first
canonical integrity blocker는 reopen보다 항상 우선한다.

즉 owner reopen은:
- canonical blocker가 **없을 때만** 고려 가능
- canonical blocker가 **있으면 즉시 fail-close**

### Principle B — reopen is not override
owner-local shallow reopen은 canonical blocked state를 덮어쓰는 override가 아니다.

이건 **명시적 admissibility fallback**이지,
**차단된 rep를 복권시키는 override**가 아니다.

### Principle C — no blocker laundering
reopen helper가 blocked reason을 `null`로 지우는 방식으로 validator를 속이면 안 된다.

즉 blocked rep를 “alignment”라는 이유로 세탁하면 안 된다.

### Principle D — candidate signals remain non-authoritative
shallow candidate / proof / bridge 신호는 여전히 owner truth가 아니다.

이번 PR은 그걸 더 강하게 지켜야 한다.

---

## 4. 잠가야 할 truth

### Locked Truth A
canonical integrity blocker가 존재하면 owner shallow reopen 금지.

### Locked Truth B
`completionBlockedReason`는 reopen helper가 임의로 무효화하는 대상이 아니다.

### Locked Truth C
reopen 허용 여부는 최소한 아래 중 하나와 정합해야 한다.

- canonical shallow contract의 blocked result 없음
- `firstBlockedReason == null`
- 또는 동등한 integrity-clear condition

### Locked Truth D
다음 예시는 계속 reopen 금지여야 한다.

- `descent_span_too_short`
- `ascent_recovery_span_too_short`
- rep contamination / wrong epoch
- insufficient-signal 계열
- ownership/timing invalid 계열

### Locked Truth E
alignment는 blocker-free state coherence 보정일 뿐, blocked rep revival mechanism이 아니다.

---

## 5. 핵심 설계 포인트

### A. Reopen precondition에 canonical blocker-clear 조건 추가
`applyCompletionOwnerShallowAdmissibilityReopen(...)` 또는 인접 helper는 현재 candidate/proof 중심 precondition만 보고 있다.

이번 PR에서는 여기에 반드시 아래 계열을 추가해야 한다.

- canonical integrity blocker 없음
- shallow contract blocked reason 없음
- completion blocker reason 없음(allowlist가 아니라 blocker-clear 원칙 우선)

즉 reopen은 **blocked state를 clear 하는 로직**이 아니라,
**처음부터 blocked가 아니었던 상태에서만 작동하는 로직**이어야 한다.

### B. Blocked reason clearing 금지 또는 제한
현재처럼 reopen 성공 시 `completionBlockedReason = null`을 일괄로 덮는 방식은 위험하다.

이번 PR은 아래 중 하나로 정리해야 한다.

1. blocker가 있으면 reopen 진입 자체 금지
2. reopen 성공 시에도 canonical integrity blocker를 세탁하지 않음

핵심은 “blocked rep cannot be reopened”이다.

### C. Smoke must cover blocked-rep denial
새 smoke는 happy path만 보면 안 된다.
반드시 아래를 포함해야 한다.

- `descent_span_too_short` 상태 -> reopen 금지
- `ascent_recovery_span_too_short` 상태 -> reopen 금지
- candidate flags full true 여도 blocker 있으면 reopen 금지
- canonical closure alignment는 blocker-free shallow rep에서만 survive

### D. No expansion of reopen scope
이번 PR은 reopen 범위를 넓히면 안 된다.
오히려 **이미 열어둔 reopen을 blocker-safe subset으로 다시 좁히는 보정 PR**이어야 한다.

---

## 6. Scope

이번 PR 범위:

- owner-local shallow reopen precondition에 canonical integrity blocker guard 추가
- blocker-clearing 위험 제거 또는 제한
- blocked-rep denial smoke 추가

---

## 7. Non-goals

이번 PR에서 하지 말 것:

- threshold 전반 완화
- readiness/setup 변경
- pass-core 권한 확대
- ui-gate 의미 변경
- page navigation 변경
- 새로운 reopen 조건 추가
- reopen 범위 확대
- standingRecovered late reopen 허용
- debug/trace 개편

이 PR은 **integrity blocker guard only**다.

---

## 8. 예상 변경 파일

우선순위:

- `src/lib/camera/squat-completion-state.ts`

필요 시 최소 추가:

- `scripts/camera-squat-shallow-reopen-integrity-blocker-guard-01-smoke.mjs`
- 기존 `camera-squat-shallow-reopen-canonical-closure-align-01-smoke.mjs` 보강

원칙적으로 건드리지 말 것:

- `src/lib/camera/auto-progression.ts`
- `src/lib/camera/squat/squat-progression-contract.ts` (정말 필요한 타입 보강 외 금지)
- `src/app/movement-test/camera/squat/page.tsx`
- readiness/setup/live-readiness 관련 파일
- TraceDebugPanel / camera-trace 계열
- overhead reach 파일들

---

## 9. Acceptance Tests

### A. Blocker-guard smoke
아래는 반드시 reopen 금지:

1. `completionBlockedReason = descent_span_too_short`
2. `completionBlockedReason = ascent_recovery_span_too_short`
3. canonical `firstBlockedReason != null`
4. candidate flags all true but blocked state exists

### B. Alignment survival smoke
아래는 계속 허용:

1. blocker-free low_rom reopen survives canonical validator
2. blocker-free ultra_low reopen survives canonical validator
3. owner read -> final gate survival 유지

### C. False-positive regression smoke
계속 금지:

1. standing pass
2. descent pass
3. bottom pass
4. delayed shallow reopen
5. candidate-only flags 단독 pass
6. `not_confirmed` 상태 pass

### D. Existing contract smoke
계속 통과:

1. hotfix smoke
2. owner realign smoke
3. shallow reopen smoke
4. canonical closure align smoke

---

## 10. 리스크

가장 큰 리스크는 두 가지다.

### Risk A — too narrow reopen
blocker guard를 너무 엄격히 넣으면 legit ultra-low-ROM reopen도 다시 다 막힐 수 있다.

### Risk B — hidden blocker path miss
canonical blocker 경로를 하나라도 놓치면 false positive 구멍이 남는다.

따라서 이 PR은 reopen 범위를 늘리지 말고,
**known blocker paths를 정확히 존중하는 최소 수정**으로 가야 한다.

---

## 11. 다음 후속

이 PR이 끝나면 그 다음에야 아래를 볼 수 있다.

1. 실기기 ultra-low-ROM 검증
2. shallow-complete precision tuning

하지만 지금은 먼저 **blocked rep revival 금지**를 다시 잠가야 한다.

---

## 12. 최종 결론

다음 단계의 본질은 이거다.

**owner-local shallow reopen은 유지하되, canonical integrity blocker가 있는 rep는 절대 reopen으로 살리지 못하게 하라.**

즉 이번 PR은 “더 넓게 열기”가 아니라,

**“alignment로 인해 새로 생긴 blocked-rep revival 구멍을 닫는 정밀 보정”** 설계다.