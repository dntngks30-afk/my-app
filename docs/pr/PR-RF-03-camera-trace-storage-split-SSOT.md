# PR-RF-03 — `camera-trace.ts` storage split only

> This PR follows `docs/REFACTORING_SSOT_2026_04.md` and is limited to behavior-preserving extraction unless explicitly stated otherwise.

## Scope

이 PR의 범위는 `src/lib/camera/camera-trace.ts` 내부에 섞여 있는 **storage responsibility만 분리**하는 것이다.

정확히는 아래 책임만 별도 storage 파일로 이동하는 것을 목표로 한다.

- storage key constants
- `localStorage` read/write accessor
- push/get/clear 계열의 저장 책임
- bounded append / ring buffer 유지 로직
- storage read failure / write failure를 삼키고 안전한 fallback을 반환하는 low-level persistence 책임

권장 물리 경계는 아래와 같다.

- 유지 파일: `src/lib/camera/camera-trace.ts`
- 신규 파일: `src/lib/camera/trace/camera-trace-storage.ts`

`camera-trace.ts`에는 아래 책임을 남긴다.

- trace types
- attempt snapshot builders
- squat / overhead observation shaping
- diagnosis summary 의미 조립
- success snapshot continuity 의미 조립
- export payload meaning / quick stats meaning을 만드는 상위 surface

즉, RF-03는 **저장 책임만 떼어내는 PR**이며, trace 의미를 새로 나누거나 재설계하는 PR이 아니다.

## Non-goals

이번 PR의 비목표는 아래와 같이 잠근다.

- trace payload field명 변경 금지
- trace schema 변경 금지
- observation summary 의미 변경 금지
- diagnosis summary 의미 변경 금지
- success snapshot continuity 의미 변경 금지
- export semantics 변경 금지
- `localStorage` key 의미 변경 금지
- trace를 runtime gate 입력으로 재사용하는 새 경로 추가 금지
- `TraceDebugPanel.tsx` 수정 금지
- observation builder split 동시 진행 금지
- diagnosis summary split 동시 진행 금지
- quick stats / export helper split 동시 진행 금지
- naming cleanup 명목의 branching / fallback / count semantics 변경 금지

## Locked truth outputs

이번 PR에서 아래 truth는 리팩토링 전후 완전히 동일해야 한다.

1. trace payload shape 유지
2. `localStorage` key 의미 유지
3. latest attempt semantics 유지
4. observation count semantics 유지
   - squat observation count
   - overhead observation count
5. success snapshot continuity 의미 유지
6. export 결과 의미 유지
7. `localStorage` write failure 시 카메라 플로우가 깨지지 않는 의미 유지
8. trace가 runtime 판정 truth에 영향을 주지 않는 sink-only 성격 유지

이 잠금은 상위 문서의 camera observability invariants와 camera-trace target rules를 그대로 따른다. 상위 SSOT는 trace를 판정 레이어가 아닌 sink-only observability layer로 유지해야 하며, `camera-trace.ts`는 storage split이 먼저 와야 한다고 잠그고 있다 fileciteturn1file3 fileciteturn2file0.

## Current code findings

현재 코드 상태에 대한 본 문서의 판단은 RF-03 메모와 부모 SSOT에 근거한다.

상위 SSOT 기준으로 `src/lib/camera/camera-trace.ts`에는 현재 아래 책임이 함께 섞여 있다.

- attempt snapshot types/builders
- squat observation builders
- overhead observation builders
- `localStorage` storage / cache
- quick stats
- diagnosis summary builder
- success snapshot bridge
- export/clear surface helpers fileciteturn2file0

이 구조에서 RF-03가 건드릴 수 있는 최소 안전 경계는 **storage concern뿐**이다.

구체적으로는 다음 구분이 현재 가장 중요하다.

### storage responsibility로 볼 수 있는 것

- storage key constant 선언
- raw persisted collection 읽기
- raw persisted collection 쓰기
- push 시 bounded ring buffer 유지
- clear 시 raw store 제거 또는 초기화
- storage read/write failure를 try/catch로 흡수하고 안전한 fallback 제공
- latest / list retrieval 중에서도 **raw persisted collection을 읽어오는 책임 자체**

### 아직 storage responsibility로 넘기면 안 되는 것

- observation payload를 만드는 builder
- diagnosis summary를 만드는 builder
- export용 payload를 조립하는 상위 meaning layer
- quick stats의 의미 계산
- success snapshot continuity를 판단/조립하는 의미 layer
- trace types / schema 선언

즉, RF-03의 핵심은 “무엇을 저장하느냐”가 아니라 “**어떻게 안전하게 저장하고 꺼내느냐**”만 분리하는 것이다.

## Files changed

이번 PR에서 수정 허용 파일은 아래로 잠근다.

- `src/lib/camera/camera-trace.ts`
- `src/lib/camera/trace/camera-trace-storage.ts` (new)

가급적 이번 PR에서는 아래를 건드리지 않는다.

- `src/components/camera/TraceDebugPanel.tsx`
- squat / overhead evaluator files
- `auto-progression.ts`
- any route / readiness / session files

선택적으로 barrel export가 이미 존재하고 정말 필요할 때만 아래 수준의 최소 수정은 허용 가능하다.

- `src/lib/camera/trace/index.ts` 또는 동등한 export surface

단, barrel 추가는 필수 범위가 아니다. import churn을 최소화하는 것이 우선이다.

## Proposed extraction boundary

권장 신규 파일명:

- `src/lib/camera/trace/camera-trace-storage.ts`

이 파일로 이동 가능한 최소 후보는 아래다.

### 1. storage key constants

예:

- attempt snapshot key
- squat observation key
- overhead observation key
- success snapshot key
- 기타 현재 `camera-trace.ts` 내부에서 persisted trace 영역을 구분하는 raw key constants

단, **문자열 값은 절대 바꾸지 않는다.** 이름만 옮기고 실제 key literal은 유지한다.

### 2. low-level localStorage accessor

예:

- `window.localStorage` availability check
- JSON parse / stringify wrapper
- read failure fallback (`[]`, `null`, 또는 현재 구현의 기존 fallback)
- write failure swallow semantics

이 계층은 오직 raw persisted value를 읽고 쓰는 책임만 가진다.

### 3. push/get/clear helpers

상위 SSOT에서 이미 분리 후보로 잠긴 항목들이다.

- `getObservationStorage`
- push 계열 helper
- get 계열 helper
- clear 계열 helper fileciteturn2file0

단, 여기서 중요한 것은 “get helper”를 전부 옮기는 것이 아니라, **raw persistence를 다루는 get helper까지만** 옮기는 것이다.

예를 들어 아래 두 종류가 섞여 있다면 구분해야 한다.

- storage get: raw array / raw record를 localStorage에서 안전하게 로드
- semantic get: latest attempt를 선택하거나 export payload를 조립

RF-03에서 이동 가능한 것은 첫 번째뿐이다. 두 번째는 `camera-trace.ts`에 남겨야 한다.

### 4. bounded append / ring buffer logic

bounded append는 저장소의 물리 정책이다. 이는 observation meaning이 아니라 persistence policy이므로 storage layer로 이동 가능하다.

다만 아래는 유지해야 한다.

- 최대 길이 값 그대로 유지
- prepend / append ordering 유지
- trim direction 유지
- latest-first / oldest-first semantics 유지
- success snapshot continuity에 간접 영향을 주는 저장 순서 유지

### 5. raw clear helpers

clear 계열은 storage concern으로 이동 가능하다. 단, clear가 반환값을 통해 상위 export/debug flow와 맞물린다면 기존 반환 semantics를 그대로 유지해야 한다.

## What must stay in `camera-trace.ts`

RF-04와 섞이지 않도록 아래는 그대로 남긴다.

- attempt snapshot type definitions
- observation payload shaping/builders
- diagnosis summary builder
- success snapshot continuity builder / bridge
- export payload shaping
- quick stats meaning layer
- semantic latest attempt selection logic
- semantic observation count presentation logic

특히 아래 두 가지는 RF-03에서 건드리면 안 된다.

### A. observation builder split

squat / overhead observation builder는 RF-04 영역이다. RF-03에서 storage split과 함께 건드리면 storage PR이 아니라 builder PR이 된다.

### B. export meaning split

export가 내부적으로 storage read를 사용하더라도, export payload의 field ordering / composition / shaping은 `camera-trace.ts`에 남겨야 한다. 이번 PR은 export helper를 분리하는 PR이 아니다.

## Why this is behavior-preserving

이번 추출이 behavior-preserving인 이유는 아래와 같다.

1. storage literal key를 바꾸지 않는다.
2. push/get/clear의 raw persistence semantics를 그대로 유지한다.
3. bounded buffer ordering / trim policy를 그대로 유지한다.
4. trace payload builders를 건드리지 않는다.
5. diagnosis / export / quick stats meaning layer를 건드리지 않는다.
6. `TraceDebugPanel.tsx`를 건드리지 않아 dev surface contract churn을 피한다.
7. storage failure swallow semantics를 유지해 camera flow non-blocking 성질을 보존한다.

즉, 변경되는 것은 “코드 위치”뿐이고, 변경되면 안 되는 것은 “저장 결과와 읽은 뒤의 의미”다.

## Regression proof

최소 회귀 검증 기준은 아래로 잠근다.

### 1. trace export payload pre/post identical

동일한 trace seed 또는 동일한 실기기 시나리오에서 export 결과를 pre/post diff 한다.

비교 대상:

- top-level field 존재 여부
- field명
- 배열 길이
- latest attempt payload
- squat / overhead observation payload
- success snapshot payload

### 2. localStorage write failure non-breaking

`localStorage.setItem` failure 또는 quota/security failure를 강제로 유도했을 때 아래를 확인한다.

- camera flow가 throw로 깨지지 않음
- trace write만 실패하고 실행은 계속됨
- 기존 fallback semantics 유지

### 3. latest attempt semantics identical

동일한 snapshot sequence 입력에서 pre/post 모두 같은 latest attempt가 선택되어야 한다.

### 4. observation count identical

동일한 sequence 입력에서 아래 값이 동일해야 한다.

- squat observation count
- overhead observation count
- total relevant trace count가 있다면 그 의미도 동일

### 5. success snapshot continuity identical

success snapshot이 끊기지 않고 이전과 같은 순서/의미로 이어져야 한다.

### 6. clear semantics identical

clear 실행 후:

- 동일 key들이 비워짐
- 동일한 후속 export 결과가 나옴
- 이후 push 동작이 이전과 같은 초기 상태에서 다시 시작됨

## Residual risks

이번 PR 이후에도 남는 리스크는 있다.

1. `camera-trace.ts`는 여전히 builder / summary / export / quick stats 책임이 크다.
2. semantic get helper와 raw storage get helper의 경계가 흐리면 RF-03에 RF-04 내용이 섞일 수 있다.
3. storage helper가 과도하게 generic해지면 오히려 trace meaning layer가 storage layer로 새어 들어갈 수 있다.
4. success snapshot continuity가 raw ordering에 의존한다면, append/trim 방향의 사소한 실수도 회귀를 만들 수 있다.
5. dev-only panel은 건드리지 않더라도, import surface 재배치로 간접 회귀가 날 수 있다.

따라서 이번 PR은 “적게 옮길수록 안전하다”를 원칙으로 한다.

## Follow-up PRs

### RF-04 — observation builder split

다음 PR에서 squat / overhead observation builder를 분리한다. RF-03에서는 건드리지 않는다.

### RF-05 후보가 아니라, camera-trace 내부 후속 분리

camera-trace 라인에서는 실제 후속이 아래 순서로 이어지는 것이 더 안전하다.

1. RF-04 — observation builder split
2. 별도 후속 — diagnosis summary split
3. 별도 후속 — quick stats / export helper split

상위 SSOT도 `camera-trace.ts`에 대해 storage split → observation builder split → diagnosis summary split → quick stats/export split 순서를 잠그고 있다 fileciteturn2file0.

## One-line definition

RF-03는 `camera-trace`의 저장 책임만 떼어내는 PR이다.

trace 의미 변경 PR이 아니다.
