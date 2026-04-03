# SQUAT_REFACTOR_PR_CHECKLIST.md

## 목적
이 문서는 모든 스쿼트 리팩토링 PR에 상단 강제 읽기 블록으로 붙이는 템플릿이다.

## 모든 PR 시작 전 강제 읽기
이 PR을 시작하기 전에 반드시 아래 문서를 먼저 읽고, 그 제약을 모두 따른다.

1. `SQUAT_REFACTOR_SSOT.md`
2. `SQUAT_REFACTOR_SAFETY_GUARDRAILS.md`
3. `SQUAT_REFACTOR_REGRESSION_MATRIX.md`
4. 현재 PR 범위 문서

이 문서들을 읽지 않았거나, 그 제약을 지키지 못하면 작업을 시작하지 않는다.

## PR 공통 선언문
이 PR은 스쿼트 리팩토링의 일부이며, 증상별 핫픽스가 아니라 completion truth 단일화와 책임 분리를 목표로 한다.

이 PR은 다음을 절대 하지 않는다.
- 특정 케이스만 통과시키는 threshold patch
- evaluator/auto-progression의 success writer화
- shallow 전용 임시 owner 추가
- quality/debug/trace가 pass를 바꾸는 구조
- unrelated 파일 대량 수정
- 여러 책임 혼합

## PR 본문 필수 섹션

### 1. Role
당신은 MOVE RE 카메라 스쿼트 시스템 리팩토링 엔지니어다.
목표는 코드 품질 향상, 단일 completion truth 정렬, 회귀 방지다.

### 2. Must Read
반드시 다음 문서를 먼저 읽는다.
- `SQUAT_REFACTOR_SSOT.md`
- `SQUAT_REFACTOR_SAFETY_GUARDRAILS.md`
- `SQUAT_REFACTOR_REGRESSION_MATRIX.md`

### 3. Scope Lock
이번 PR의 범위는 정확히 하나만 허용한다.
- Completion State Slimming
- Shallow Contract Normalization
- Evaluator Boundary Cleanup
- Auto Progression Gate Freeze
- Regression Lock

범위를 넘는 수정 금지.

### 4. Absolute Do-Not
- pass writer 추가 금지
- duplicate condition 추가 금지
- unrelated threshold 수정 금지
- evaluator에서 completion truth 수정 금지
- auto-progression에서 motion truth 재정의 금지
- debug/trace/ticket이 truth writer로 동작 금지

### 5. Required Output
반드시 아래 순서로 출력한다.
1. Assumptions
2. Findings
3. Exact files to modify
4. Why this is safe
5. Code changes
6. Acceptance tests
7. Git commands

### 6. Safety Proof
반드시 아래를 명시적으로 검토한다.
- standard deep cycle 회귀 없음
- standing false pass 재발 없음
- descent only / bottom stall pass 없음
- shallow full cycle 유지
- truth와 UI gate 분리 유지
- setup suppression과 completion truth 혼동 없음

### 7. Acceptance Tests
최소한 아래를 포함한다.
- standing still no pass
- descent only no pass
- bottom stall no pass
- deep standard pass
- shallow full cycle pass
- setup suppression reason 분리
- quality warning decouple 유지

### 8. Stop Conditions
아래 상황이면 즉시 중단하고 수정 방향을 재설계한다.
- 다른 파일에도 같은 의미 조건을 추가하려 할 때
- success writer가 2개 이상 되려 할 때
- regression matrix를 만족시킬 근거가 없을 때
- scope 밖 파일을 많이 건드려야 할 때

## PR 상단에 붙일 짧은 강제 문구

### 한국어 버전
이 PR을 시작하기 전에 `SQUAT_REFACTOR_SSOT.md`, `SQUAT_REFACTOR_SAFETY_GUARDRAILS.md`, `SQUAT_REFACTOR_REGRESSION_MATRIX.md`를 반드시 먼저 읽어라.
이 PR은 증상별 핫픽스가 아니라 completion truth 단일화와 책임 분리를 위한 작업이다.
새로운 pass writer 추가, shallow 전용 임시 owner 추가, evaluator/auto-progression의 truth 재정의, debug/trace/ticket의 truth writer화는 절대 금지다.
회귀 없이 범위 내 수정만 하라.

### English version
Before starting this PR, you must read `SQUAT_REFACTOR_SSOT.md`, `SQUAT_REFACTOR_SAFETY_GUARDRAILS.md`, and `SQUAT_REFACTOR_REGRESSION_MATRIX.md`.
This PR is not a symptom-level hotfix. It is a controlled refactor to unify completion truth and separate responsibilities.
Do not add any new pass writer, shallow-only temporary owner, evaluator/auto-progression truth rewrite, or debug/trace/ticket-based truth mutation.
Stay strictly in scope and preserve all regression guarantees.
