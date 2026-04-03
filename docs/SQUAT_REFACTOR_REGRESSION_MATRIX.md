# SQUAT_REFACTOR_REGRESSION_MATRIX.md

## 목적
이 문서는 스쿼트 리팩토링 중 반드시 지켜야 하는 회귀 매트릭스다.
각 PR은 최소한 아래 시나리오를 기준으로 영향도를 점검해야 한다.

## A. False Positive 방어

### A-1. Standing still
- 조건: 사용자가 거의 서 있기만 함
- 기대:
  - completionSatisfied = false
  - pass 금지
  - no meaningful cycle
- 실패 징후:
  - setup 중 pass
  - standing_recovered 조기 진입
  - trajectory/event rescue로 pass

### A-2. Descent only
- 조건: 내려가기만 하고 올라오지 않음
- 기대:
  - completionSatisfied = false
  - blocked reason은 reversal/recovery 계열
- 실패 징후:
  - bottom 근처에서 pass
  - no_ascend/no_recovery인데 pass

### A-3. Bottom stall
- 조건: 앉은 자세에 오래 머무르지만 복귀 없음
- 기대:
  - completionSatisfied = false
  - bottom hold만으로 pass 금지
- 실패 징후:
  - dwell만으로 pass
  - finalize만으로 pass

### A-4. Series-start contamination
- 조건: 시작 프레임 오염, setup 흔들림, peak anchor contamination
- 기대:
  - false pass 금지
- 실패 징후:
  - peakLatchedAtIndex 0류 오염으로 trajectory rescue pass

## B. Legitimate Pass 유지

### B-1. Deep standard full cycle
- 조건: 정상적인 깊은 스쿼트
- 기대:
  - completionSatisfied = true
  - completionPassReason = standard 계열
  - 기존 성공률 유지
- 실패 징후:
  - 이전에 되던 deep squat 실패
  - low_rom으로 잘못 강등

### B-2. Shallow full cycle
- 조건: 깊지 않지만 의미 있는 하강→상승→복귀
- 기대:
  - completionSatisfied = true
  - shallow/low_rom 계열 pass 허용
- 실패 징후:
  - 깊게 앉아야만 통과
  - no_reversal에 영구 정체

### B-3. Ultra-low but meaningful cycle
- 조건: ROM 매우 낮지만 실제 down-up-recover 존재
- 기대:
  - 정책 허용 범위라면 통과 가능
  - 최소한 truth와 UI gate 원인이 분리되어야 함
- 실패 징후:
  - ultra-low라는 이유만으로 core truth 부정
  - shallow rescue 제거 후 false negative 급증

## C. Boundary Separation

### C-1. Completion truth vs UI suppression
- 조건: cycle은 맞지만 setup/readiness 문제 존재
- 기대:
  - completion truth와 UI suppression reason이 구분됨
- 실패 징후:
  - setup 문제 때문에 completion core가 거짓이 됨
  - UI gate 문제를 motion failure로 잘못 표기

### C-2. Quality warning decouple
- 조건: low quality지만 유효 cycle 존재
- 기대:
  - pass 가능
  - warning 또는 confidence downgrade 가능
- 실패 징후:
  - quality 낮다는 이유만으로 cycle 자체 부정

## D. Assist / Rescue Integrity

### D-1. HMM assist
- 조건: HMM assist가 동작하는 경계 케이스
- 기대:
  - 보조 역할만 수행
  - owner처럼 확장되지 않음
- 실패 징후:
  - HMM만으로 success writer화

### D-2. Trajectory rescue
- 조건: trajectory rescue 관측
- 기대:
  - 통제된 범위에서만 사용
  - proof / contract를 직접 대체하지 않음
- 실패 징후:
  - trajectory-only pass
  - series-start contamination false pass

## E. PR별 최소 확인 항목
### PR-1 Completion State Slimming
- A-1, A-2, A-3, B-1, B-2

### PR-2 Shallow Contract Normalization
- A-2, A-3, B-2, B-3, D-2

### PR-3 Evaluator Boundary Cleanup
- C-1, C-2, B-1

### PR-4 Auto Progression Gate Freeze
- C-1, C-2, A-1, B-2

### PR-5 Regression Matrix Lock
- 전 항목

## 판정 원칙
회귀는 “완전히 깨졌다”일 때만이 아니라 아래도 포함한다.
- blocked reason이 더 모호해짐
- truth와 UI suppression 원인이 섞임
- standard/deep가 shallow처럼 보임
- shallow가 다시 depth 의존적으로 후퇴
- 동일 의미 조건이 여러 층에 흩어짐

이 중 하나라도 발생하면 회귀로 간주한다.
