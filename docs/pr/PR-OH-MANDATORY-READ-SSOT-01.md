# PR-OH-MANDATORY-READ-SSOT-01

## 목적

이 문서는 MOVE RE 오버헤드 리치 디버깅/개선 작업에서 **회귀·오탐·층위 혼동**을 막기 위한 **필수 강제읽기 SSOT**이다.

이 문서를 읽지 않고 다음 PR을 진행하면 안 된다.
특히 아래 세 가지를 막기 위해 존재한다.

1. 오버헤드를 살리려다 **스쿼트와 다른 카메라 스텝까지 같이 풀리는 전역 회귀**
2. readiness / motion / final-pass를 섞어 건드려 **원인층이 다시 꼬이는 것**
3. 의미 있는 상승·hold 없이도 pass되거나, 실패 후 하강 중 pass되는 **오탐/우회 pass**

---

## 현재 고정 진실 (PR-OH-INPUT-01 이후)

현재 오버헤드는 더 이상 무조건 hook acceptance에서 죽는 단계는 아니다.
하지만 아직 motion 단계로 넘어갈 자격도 없다.

### 현재 확정된 상태

- **Layer 1 hook acceptance**: 부분적으로 열림
- **Layer 2 feature validity / guardrail valid**: 아직 닫혀 있음
- **Layer 3 readiness**: 아직 닫혀 있음
- **Layer 4 motion / hold / completion**: 아직 수정 금지
- **Layer 5 final pass**: 아직 수정 금지

### 현재 주병목

오버헤드의 현재 주병목은 더 이상 훅 수락 자체가 아니라,

**hook accepted -> feature valid -> guardrail valid -> readiness**

이 연속성이 열리지 않는 점이다.

즉 지금 단계에서 motion, hold, completion, final-pass를 수정하면 안 된다.

---

## 현재 관측 truth 해석 규칙

### 허용되는 해석

- `hookAcceptedFrameCount > 0` 이면 입력층 일부는 열렸다는 뜻이다.
- `featureFrameCount > 0 && guardrailValidFrameCount = 0` 이면 입력층 다음의 feature-validity / guardrail 레이어가 주병목이다.
- `readinessState = not_ready` 이고 `guardrailValidFrameCount = 0` 이면 readiness를 만지는 것이 아니라 **그 전 단계 진실**을 먼저 맞춰야 한다.

### 금지되는 해석

- hook acceptance가 열렸다는 이유로 motion 병목이라고 단정하지 말 것
- readiness가 닫혀 있다는 이유로 readiness 완화부터 하지 말 것
- feature validity 실패를 motion failure로 취급하지 말 것
- quality invalid를 pass 문제로 바로 연결하지 말 것

---

## 진실 계층 순서 (절대 고정)

오버헤드는 반드시 아래 순서를 따라야 한다.

**sampled -> hook acceptance -> feature validity -> readiness -> motion -> final pass**

이 순서를 어기면 다시 디버깅 늪으로 돌아간다.

### Layer 1 — Raw sampled truth

Owner: `use-pose-capture.ts`

이 레이어는 카메라가 샘플을 받았는지만 말한다.

핵심 truth:
- `sampledFrameCount`
- `captureDurationMs`
- `timestampDiscontinuityCount`

### Layer 2 — Hook acceptance truth

Owners:
- `src/lib/camera/use-pose-capture.ts`
- `src/lib/motion/pose-types.ts`

이 레이어는 샘플 프레임이 버퍼 적재 자격이 있었는지 말한다.

핵심 truth:
- `hookAcceptedFrameCount`
- `droppedFrameCount`
- `poseRejectionBreakdown`
- `hookThresholdEcho`
- `hookFirstRejectionSample`
- `hookFirstAdaptorFailureDiag`

### Layer 3 — Feature validity / guardrail truth

Owners:
- `src/lib/camera/guardrails.ts`
- feature-validity 관련 helper

이 레이어는 hook에 들어온 프레임이 **실제로 분석 가능한 유효 프레임**이 되었는지 말한다.

핵심 truth:
- `featureFrameCount`
- `guardrailValidFrameCount`
- `invalidFeatureFrameCount`
- `featureValidityBreakdown`

### Layer 4 — Readiness truth

Owner: `live-readiness.ts`

이 레이어는 motion을 시작해도 되는 상태였는지 말한다.

핵심 truth:
- `readinessState`
- `readinessBlocker`
- `visibleJointsRatio`
- `criticalJointsAvailability`

### Layer 5 — Motion truth

Owners:
- overhead evaluator
- overhead completion state
- rise/top/hold truth owners

이 레이어는 실제로 의미 있는 상승과 안정 top/hold가 있었는지 말한다.

핵심 truth:
- `meaningfulRiseSatisfied`
- `topDetected`
- `stableTopEntered`
- `holdStarted`
- `holdSatisfied`
- `completionBlockedReason`

### Layer 6 — Final pass truth

Owners:
- auto progression
- page orchestration
- terminal snapshot / pass latch owners

핵심 truth:
- `passConfirmed`
- `finalPassLatched`
- `progressionPassed`
- per-attempt terminal integrity

---

## 현재 단계에서 절대 금지사항

### 전역 회귀 금지

다음은 절대 금지다.

- `getPoseFrameQuality` 전역 완화로 스쿼트까지 같이 풀기
- 전역 guardrail 완화로 다른 카메라 스텝 동작 바꾸기
- 오버헤드 문제를 해결한다는 명분으로 default/global 계약을 느슨하게 만들기

### 스쿼트 절대 보호

다음 파일/영역은 이번 오버헤드 레인에서 절대 건드리지 않는다.

- 모든 squat 관련 파일
- squat evaluator
- squat completion state
- squat auto-progression semantics
- squat pose-features / thresholds

### motion/final-pass 선행 수정 금지

다음은 readiness가 열리기 전까지 절대 금지다.

- `meaningfulRiseSatisfied` 로직 수정
- `topDetected` 수정
- `stableTopEntered` 수정
- `holdStarted` / `holdSatisfied` 수정
- overhead completion 수정
- final pass latch / passConfirmed 수정
- auto-progression pass opening logic 수정

### readiness 우회 금지

- invalid framing을 억지로 ready로 만들지 말 것
- feature-validity를 건너뛰고 readiness를 열지 말 것
- hook failure와 readiness failure를 같은 원인처럼 뭉개지 말 것

---

## 현재 오버헤드 제품 법칙

오버헤드는 반드시 아래 제품 법칙을 지켜야 한다.

### Law 1

**통과는 쉽게, 판정은 엄격하게.**

뜻:
- pass는 실제 움직임이 있으면 열릴 수 있어야 한다.
- quality 평가는 따로 엄격해야 한다.
- quality가 나쁘더라도 motion completion이 진짜이면 low-quality pass는 가능할 수 있다.
- 반대로 quality나 추정치만으로 pass가 열려서는 안 된다.

### Law 2

오버헤드 pass는 반드시 아래 순서를 따라야 한다.

**meaningful rise -> top -> stable top -> short hold -> completion satisfied -> final pass**

### Law 3

다음 오탐은 절대 허용되지 않는다.

- 가만히 서 있기만 해도 pass
- 팔을 조금만 흔들어도 pass
- 팔을 올리는 도중 pass
- 팔을 올리자마자 즉시 pass
- 1프레임 튐 / 노이즈로 pass
- 한 번 실패한 뒤 팔을 내리는 과정에서 stale state로 pass

---

## PR 단계별 진입 조건

### PR-OH-INPUT-01

목표:
- 오버헤드 입력층 / hook acceptance를 부분적으로 열기
- 전역 완화 없이 overhead-specific input contract 도입

이미 완료된 범위:
- overhead 전용 hook quality mode
- adaptor failure 진단 보강
- 스쿼트 default/global 계약 보존

### PR-OH-READINESS-02

진입 조건:
- `hookAcceptedFrameCount > 0` 가 실제 시도에서 반복 관측되어야 함

목표:
- `hook accepted -> feature valid -> guardrail valid -> readiness` 연속성 맞추기
- overhead-specific feature-validity / readiness contract 필요 시 국소 도입

이번 PR에서 해도 되는 것:
- `guardrails.ts`
- feature-validity ownership 범위
- `live-readiness.ts`
- overhead 전용 readiness / feature-validity routing

이번 PR에서 하면 안 되는 것:
- motion
- hold
- completion
- final pass
- squat
- auto-progression

### PR-OH-MOTION-03

진입 조건:
- `guardrailValidFrameCount > 0`
- readiness가 최소 한 번은 실제로 열려야 함

그 전에는 절대 시작 금지.

목표:
- 의미 있는 상승
- top
- stable top
- short hold
- completion ownership

### PR-OH-FINALPASS-04

진입 조건:
- motion completion truth가 안정화된 뒤

목표:
- final pass owner 단일화
- stale-state pass 제거
- lowering pass / instant pass / alternate pass route 제거

---

## 다음 PR이 성공했다고 말할 수 있는 최소 조건

### PR-OH-READINESS-02 성공 조건

실기기 legitimate overhead attempt에서 최소 아래가 보여야 한다.

- `hookAcceptedFrameCount > 0`
- `featureFrameCount > 0`
- `guardrailValidFrameCount > 0`
- readiness가 최소 한 번은 open

그 전에는 motion PR 금지.

### PR-OH-MOTION-03 성공 조건

실기기에서 아래가 모두 지켜져야 한다.

- raising 중 pass 금지
- tiny arm movement pass 금지
- idle standing pass 금지
- lowering 중 stale pass 금지
- meaningful rise + stable top + short hold 뒤에는 pass 가능

---

## 회귀 체크리스트 (모든 오버헤드 PR 공통)

다음 질문에 모두 yes가 아니면 PR을 완료로 주장하면 안 된다.

1. 스쿼트 관련 파일을 정말 하나도 건드리지 않았는가?
2. default/global quality 또는 guardrail 계약이 비오버헤드 스텝에서 바뀌지 않았는가?
3. current PR이 자기 층위 밖(owner 밖)까지 손대지 않았는가?
4. `progressionPassed` / `finalPassLatched` / motion semantics가 바뀌지 않았는가?
5. rejection reason / blocker reason이 여전히 분리되어 있는가?
6. invalid input을 ready / valid로 위장하지 않았는가?
7. 실기기 관측과 자동 스모크가 모두 현재 SSOT와 일치하는가?

---

## 강제 운영 규칙

- Ask/Agent는 오버헤드 PR을 시작하기 전에 이 문서를 먼저 읽는다.
- 이 문서와 충돌하는 구현은 하지 않는다.
- 충돌이 발견되면 patch로 덮지 말고 즉시 중단 후 보고한다.
- 다음 층위 PR로 넘어가기 전에 반드시 최신 JSON 실기기 관측으로 전 단계 성공을 확인한다.

---

## 최종 한 줄 SSOT

**현재 오버헤드는 hook acceptance를 부분적으로 통과했지만, 아직 feature-validity / readiness가 병목이다. 그러므로 지금은 guardrail/readiness만 다뤄야 하며, 스쿼트·motion·hold·completion·final-pass를 건드리면 안 된다.**
