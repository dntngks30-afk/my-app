역할: 현재 repo에서 식별된 구조적 리스크 Top 10에 대해, 각 리팩토링 PR 설계방의 공통 기준이 되는 **부모 SSOT** 문서.

# REFACTORING SSOT — Structural Top 10

Last updated: 2026-04-09  
Status: Parent SSOT for structural-risk refactoring design only

---

## 0. 목적

이 문서는 구현 문서가 아니라, **구조적 위험이 큰 리팩토링 대상 10개를 분리 설계하기 위한 상위 SSOT**다.

핵심 목표는 다음 두 가지다.

1. 동일 책임을 여러 레이어가 중복 소유하는 구조를 줄인다.  
2. 회귀를 반복 생산하는 경계 붕괴를 작은 PR 단위로 분해한다.

---

## 1. 절대 원칙

모든 하위 PR 설계방은 아래 원칙을 공통으로 따른다.

### 1-1. 한 PR에 한 layer만
- readiness PR에서 session generator를 같이 만지지 않는다.
- bootstrap PR에서 public result UI를 같이 만지지 않는다.
- funnel PR에서 /app execution core를 같이 만지지 않는다.

### 1-2. behavior-preserving first
1차 목표는 구조 경계 정리다.  
threshold, scoring semantics, pass/fail meaning, next_action meaning, payment meaning, claim meaning을 설계 명분으로 바꾸지 않는다.

### 1-3. single writer 원칙 유지
같은 truth를 여러 곳에서 다시 결정하게 만들지 않는다.

예시:
- readiness 판정 owner는 1곳
- session analysis input source 결정 owner는 1곳
- shallow completion close writer는 1곳

### 1-4. protected area 분리
다음 영역은 1차 structural PR과 묶지 않는다.
- `/app/home`, `/app/checkin`, `/app/profile`
- `AppShell`, persistent tab shell
- `SessionPanelV2`, `ExercisePlayerModal`
- execution / auth / completion / adaptive core 전면 개편

### 1-5. analysis-first, implementation-second
각 방에서는 먼저 설계 문서만 만들고, 그 문서가 scope를 잠근 뒤 구현방으로 넘어간다.

---

## 2. 현재 공통 진단

이 repo의 가장 큰 구조적 병목은 다음 한 문장으로 요약된다.

**동일한 사용자 진행 판정과 세션 입력 truth를 여러 모듈과 엔드포인트가 중복 소유하고 있다.**

이 때문에 다음 문제가 반복된다.
- create와 bootstrap이 서로 다른 truth를 읽음
- readiness 계산과 라우팅 의미가 분산됨
- canonical funnel과 legacy funnel이 병렬로 살아 있음
- localStorage가 임시 캐시가 아니라 사실상 owner처럼 쓰임
- 이름이 비슷한 API들이 서로 다른 책임을 가짐

---

## 3. Top 10 refactor tracks

1. Readiness contract single-owner
2. Session source alignment (create/bootstrap/read)
3. Public funnel legacy route isolation
4. Bootstrap endpoint boundary cleanup
5. Session-preparing orchestration split
6. `/api/session/create` god-route split
7. movement-test state ownership cleanup
8. free-survey / upload legacy pipeline isolation
9. squat completion engine modular split
10. readiness legacy type/export surface cleanup

---

## 4. 추천 순서

반드시 아래 순서 그대로일 필요는 없지만, 회귀 최소화 기준 기본 순서는 다음이다.

### Phase A — truth owner 고정
1. Readiness contract single-owner  
2. Session source alignment  
3. Bootstrap endpoint boundary cleanup

### Phase B — funnel / continuity 정리
4. Public funnel legacy route isolation  
5. movement-test state ownership cleanup  
6. free-survey / upload legacy pipeline isolation

### Phase C — orchestration / god-file 분리
7. Session-preparing orchestration split  
8. `/api/session/create` god-route split

### Phase D — deep technical debt
9. readiness legacy type/export cleanup  
10. squat completion engine modular split

이 순서의 핵심 이유는, **먼저 owner truth를 잠가야 나머지 페이지/플로우 정리가 소비자 정리로 바뀌기 때문**이다.

---

## 5. 각 하위 PR 문서 필수 항목

각 방의 짧은 설계문에는 최소 아래 항목이 있어야 한다.

1. Scope  
2. Non-goals  
3. Locked truth  
4. Why now  
5. Files / modules in scope  
6. Out of scope  
7. PR boundary  
8. Regression checklist

---

## 6. 금지 사항

하위 PR 설계에서 아래는 금지한다.

- public-first 제품 방향 되돌리기
- 결제를 analysis unlock처럼 다시 정의하기
- camera를 별도 canonical public entry로 되돌리기
- claimed public result 우선 원칙 폐기하기
- readiness를 클라이언트 임의 판단으로 되돌리기
- legacy compat 레이어를 새 정본처럼 확장하기
- /app execution core와 public funnel 정리를 한 PR에 섞기

---

## 7. 완료 기준

각 방의 설계문이 완료되었다고 볼 수 있는 기준:

- 왜 이 PR이 필요한지 3문장 안에 설명 가능
- 무엇을 절대 안 건드리는지 명확함
- 어떤 파일/모듈이 owner인지 드러남
- 다음 구현방에서 범위가 흔들리지 않음

---

## 8. 최종 운영 원칙

이 Top 10 리팩토링의 목적은 “예쁘게 정리”가 아니다.  
목적은 **회귀를 덜 만들고, 다음 기능 작업의 발목을 잡는 구조를 먼저 잠그는 것**이다.

문서상 가장 중요한 질문은 항상 이것이다.

**이 PR이 truth owner를 줄이는가, 아니면 또 하나의 우회 경로를 추가하는가?**
