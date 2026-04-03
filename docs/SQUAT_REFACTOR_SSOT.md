# SQUAT_REFACTOR_SSOT.md

## 목적
이 문서는 MOVE RE 스쿼트 리팩토링의 단일 진실 문서다.
이번 리팩토링의 목표는 증상별 핫픽스가 아니라, completion truth를 단일 코어로 수렴시키고 evaluator / auto-progression / policy / observability의 책임을 분리하는 것이다.

## 제품 수준 목표
1. 통과는 유의미한 사이클 완료로 판정한다.
2. 품질 평가는 통과 이후 별도 레이어에서 해석한다.

즉,
- pass = 하강 → 방향전환 → 상승 → 복귀의 유효 cycle 완료
- quality = 잘했는가 / 안정적인가 / 깊이가 충분한가 / 품질 경고가 필요한가

이 둘을 절대 섞지 않는다.

## 현재 구조의 핵심 문제
현재 저장소는 아래 책임이 과도하게 섞여 있다.

- completion authority
- shallow contract
- trajectory / tail / HMM assist
- setup / readiness suppression
- evaluator late patch
- policy lock
- UI progression gate
- legacy/canonical observability

이 구조에서는 한 층에서 고친 truth가 다른 층에서 다시 덮어써져, 얕은 스쿼트 실패 / 서있을 때 통과 / 하강 중 조기 통과 / setup false pass가 반복적으로 재발한다.

## 리팩토링 후 목표 구조

### 1. Completion Core
오직 아래만 담당한다.
- attempt admission
- reversal detection
- recovery detection
- completion satisfied
- completion blocked reason
- completion pass reason

이 코어는 다음을 하지 않는다.
- quality 해석
- retry 결정
- UI progression 판정
- setup suppression
- product policy lock
- debug/legacy patch

### 2. Observability Layer
completion core가 만든 결과를 설명 가능한 형태로 확장만 한다.
예:
- trace
- local peak observability
- ticket / contract debug
- proof trace
- canonical / legacy debug projection

단, observability는 completion truth를 수정하지 않는다.

### 3. Evaluator Layer
evaluator는 오직 다음만 담당한다.
- pose feature frames 준비
- completion core 호출
- internal quality 계산
- metric 조립
- debug snapshot 조립

evaluator는 completion truth를 바꾸지 않는다.

### 4. UI / Progression Gate
auto-progression은 오직 다음만 담당한다.
- readiness gate
- capture quality gate
- confidence gate
- pass confirmation latch
- final UI nextAllowed 결정

UI gate는 completion truth를 새로 만들지 않는다.

### 5. Product Policy Layer
ultra-low 제품 정책 차단이 필요하더라도, 그것은 completion core 외부에서 단 한 번 적용한다.

## 핵심 정의

### completion truth
사용자의 움직임이 유효한 스쿼트 cycle로 인정되는가.

### completion owner
completion truth를 해석한 단일 결과. capture quality / confidence / setup suppression과 분리된다.

### UI progression
completion truth 이후, 지금 UI에서 pass를 열어도 되는가.

### quality
통과 이후 경고/설명/해석용 레이어. pass와 동일 축이 아니다.

## shallow / low ROM 원칙
얕은 스쿼트는 예외 패치가 아니라 동일 contract의 ROM band다.

즉,
- standard
- low_rom
- ultra_low_rom

은 서로 다른 pass owner가 아니라, 같은 completion contract 안의 다른 admission band다.

금지:
- shallow 전용 임시 owner 추가
- trajectory-only owner
- event-only owner
- canonical/ticket/proof가 각각 따로 success writer처럼 행동

## 단일 성공 writer 원칙
성공 상태를 실제로 여는 writer는 한 군데만 허용한다.

허용:
- canonical completion closer 단일 경로

금지:
- evaluator에서 success 다시 열기
- auto-progression에서 success truth 재정의
- observability helper에서 pass reason 덮어쓰기
- policy layer에서 core truth 내부를 재구성

## 리팩토링 완료 정의
다음이 모두 만족되어야 완료다.
1. completion core가 소형화된다.
2. evaluator는 truth 소비자 역할만 한다.
3. auto-progression은 UI gate만 담당한다.
4. shallow는 ROM band contract로 정리된다.
5. success writer는 한 곳만 남는다.
6. regression matrix 전 항목이 유지된다.

## 반드시 지켜야 하는 제품 진실
다음은 절대 바꾸지 않는다.
- standing still은 절대 pass 금지
- descent only는 pass 금지
- bottom stall은 pass 금지
- shallow full cycle은 pass 가능
- deep standard cycle은 기존처럼 pass 가능
- quality 낮아도 유효 cycle이면 pass 가능, 대신 warning 가능
- setup 문제는 가능하면 UI suppression으로 처리하고 completion truth와 혼동하지 않음

## 작업 범위 원칙
이번 리팩토링은 카메라 스쿼트 pass 구조 재정렬이다.

포함:
- squat completion core
- squat evaluator boundary
- squat auto-progression UI gate
- squat observability cleanup
- regression safety

비포함:
- overhead reach 로직 수정
- 공용 camera UX 전면 개편
- unrelated public funnel UI 수정
- deep scoring / session / app execution core 수정

## PR 진행 순서
1. PR-1 Completion State Slimming
2. PR-2 Shallow Contract Normalization
3. PR-3 Evaluator Boundary Cleanup
4. PR-4 Auto Progression Gate Freeze
5. PR-5 Regression Matrix Lock

이 순서를 바꾸지 않는다.
