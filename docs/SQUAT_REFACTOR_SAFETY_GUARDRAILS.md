# SQUAT_REFACTOR_SAFETY_GUARDRAILS.md

## 목적
이 문서는 스쿼트 리팩토링 중 회귀와 병목 재유입을 막기 위한 절대 금지 규칙이다.

## 절대 금지 1: 증상별 핫픽스 금지
다음은 금지한다.
- 특정 JSON 하나만 통과시키는 threshold 추가
- 특정 영상 하나만 막는 예외 분기
- 같은 의미의 조건을 여러 파일에 중복 추가
- no_reversal / no_ascend / not_standing_recovered를 임시로 우회하는 누더기 코드
- “이번 케이스만” 통과시키는 special-case patch

## 절대 금지 2: 새로운 성공 writer 추가 금지
다음 금지.
- evaluator에서 completionSatisfied / completionPassReason 직접 수정
- auto-progression에서 completion truth 재생성
- observability helper가 success를 여는 행위
- quality layer가 pass를 바꾸는 행위
- policy layer가 success writer처럼 동작하는 행위

## 절대 금지 3: shallow 전용 임시 권위 경로 추가 금지
다음 금지.
- trajectory-only success owner
- event-only success owner
- tail-only success owner
- shallow ticket가 직접 success를 여는 구조
- canonical / official / ticket / proof가 각각 따로 pass writer처럼 행동

shallow는 반드시 same completion contract의 ROM band여야 한다.

## 절대 금지 4: 책임 혼합 PR 금지
한 PR에 아래 둘 이상을 섞지 않는다.
- completion core 변경
- evaluator boundary 변경
- auto-progression UI gate 변경
- policy layer 변경
- regression harness 변경

## 절대 금지 5: 디버그 필드가 truth를 바꾸는 구조 금지
debug / trace / proof / ticket / canonical / legacy 필드는 설명용이어야 하며 truth writer가 되어서는 안 된다.

금지:
- debug field를 gate 입력으로 직접 연결
- trace 존재 여부로 success 결정
- proof field를 직접 pass trigger로 사용
- legacy compat field가 canonical truth를 덮어씀

## 절대 금지 6: standard path 회귀 금지
얕은 스쿼트 문제를 고치면서 아래를 깨뜨리면 안 된다.
- deep standard_cycle pass 성공률 저하
- 기존 valid deep squat가 low_rom으로 잘못 분류
- standing hold / recovery finalize 구조 파손
- HMM assist가 owner처럼 커짐

## 절대 금지 7: setup suppression과 completion truth 혼합 금지
setup / readiness / framing 문제는 가능하면 UI suppression 레이어에서 다룬다.

금지:
- setup 문제 때문에 completion core가 움직임 truth 자체를 잃는 구조
- live readiness RED가 cycle truth를 overwrite하는 구조
- setup false pass 방어를 위해 core completion contract를 오염시키는 구조

## PR 전 필수 자가 점검 질문
모든 PR 전에 아래 질문에 전부 YES여야 한다.
1. 이 변경은 success writer를 늘리지 않는가?
2. 이 변경은 completion core와 UI gate를 섞지 않는가?
3. 이 변경은 shallow를 예외 패치가 아니라 ROM band로 유지하는가?
4. 이 변경은 standard deep cycle 회귀를 만들지 않는가?
5. 이 변경은 debug/trace/ticket을 truth writer로 만들지 않는가?
6. 이 변경은 다른 파일에 동일 의미 조건을 중복시키지 않는가?
7. 이 변경은 setup suppression과 motion truth를 구분하는가?

하나라도 NO면 PR 진행 금지.

## 코드 리뷰 시 반드시 찾을 것
- completionSatisfied를 어디서 쓰고 어디서 수정하는가
- completionPassReason를 누가 쓰고 누가 덮는가
- owner truth와 UI gate가 섞였는가
- shallow 관련 필드가 새로 늘어났는가
- 새 threshold가 들어갔는가
- 기존과 같은 의미의 분기가 다른 파일에 또 생겼는가

## 머지 금지 조건
다음 중 하나라도 있으면 머지 금지.
- regression matrix 미통과
- standard deep cycle 회귀
- standing false pass 재발
- bottom stall pass 가능 상태
- evaluator가 truth writer 역할 수행
- auto-progression이 completion truth를 재정의
- PR 범위가 2개 책임 이상 혼합
