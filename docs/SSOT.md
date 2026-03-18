MOVE RE 최신 SSOT

기준 시점: 2026-03-18 현재 대화 기준 최신

0. 한 줄 정의

MOVE RE는 운동 콘텐츠 앱이 아니라, 사용자의 현재 상태를 해석해 세션을 생성하고 실행 데이터를 축적하며 다음 세션을 조정하는 상태 기반 운동 실행 시스템이다.

그리고 public 카메라 퍼널은
정밀 진단 도구가 아니라, self-serve usable signal capture를 통해 personalized execution으로 연결하는 입력 채널이다.

1. SSOT의 정확한 의미

앞으로 MOVE RE에서 진짜 기준선(SSOT) 은 아래다.

SSOT = origin/main + 현재 배포된 Vercel 기준 + 운영 Supabase DB 반영 상태

즉:

로컬 작업본 = 참고 가능하지만 SSOT 아님

feature branch = 실험 공간

커밋 = 변경 기록

PR = 검증 단위

main에 반영되고 실제 운영 기준과 맞는 상태만 진실

이 원칙이 중요하다.
앞으로 “현재 뭐가 진짜 최신이냐”를 말할 때는
브랜치가 아니라 main/배포/운영 DB 를 기준으로 판단한다.

2. 제품 최상위 정의
2-1. MOVE RE의 정체성

MOVE RE는 아래가 아니다.

운동 영상 콘텐츠 서비스

일반 헬스 앱

의료 진단 서비스

체형 정밀 판정 AI

MOVE RE는 아래다.

사용자 상태 해석

현재 가능한 조건 반영

세션 생성

실제 수행

수행 데이터 축적

다음 세션 조정

즉 핵심은:

Analysis → Generation → Execution → Logging → Adaptive → Next Session

이다.

2-2. public / app 분리 원칙

이건 매우 중요하다.

public

역할:

브랜드 스토리

진입 퍼널

설문/카메라 기반 입력

결과 브리지

결제/로그인 전환

personalized execution 진입 유도

/app

역할:

실제 실행 시스템

지도/리셋/여정 구조

세션 선택

운동 실행

기록 저장

적응 조정

다음 세션 연결

즉:

public은 acquisition + interpretation + action bridge
/app은 execution core

이다.

둘을 섞으면 안 된다.

3. 절대 비수정 영역 / 수정 허용 영역
3-1. public 작업 시 절대 비수정 영역

public, camera, funnel 작업을 할 때 건드리면 안 되는 영역:

/app/home

/app/checkin

/app/profile

AppShell

persistent tab shell

SessionPanelV2

ExercisePlayerModal

session/completion/adaptive/auth execution core

즉 public 개선한다고 /app 실행 코어를 만지지 않는다.

3-2. /app 작업 시 유지해야 할 기준

/app에서는 아래 정체성을 흔들면 안 된다.

모바일 우선 PWA

상태 기반 실행 시스템

지도(Map) = 실행 진입

리셋(Reset) = 가벼운 일일 액션

여정(Journey) = 상태/진행/다음 행동 요약

세션 실행과 기록이 중심

flashy 콘텐츠 UI보다 “다음 행동”이 중요

4. 현재 /app 기준 제품 구조
4-1. 핵심 실행 루프

/app의 기준 루프는 다음이다.

Deep Test / Result
→ Session Composer
→ Workout Execution
→ Exercise Logs / Reflection
→ Completion Evaluation
→ Adaptive Adjustment
→ Next Session Preview / Trigger

이게 MOVE RE의 진짜 엔진이다.

4-2. 현재 /app 제품 법칙

앞으로 /app 관련 작업은 아래 법칙을 따른다.

MOVE RE는 콘텐츠 소비 앱이 아니다.
실행과 지속이 핵심이다.

지도/리셋/여정 3탭은 기능 탭이 아니라 실행 루프의 진입점이다.

세션은 단순 리스트가 아니라
현재 상태에 맞는 실행 단위 여야 한다.

완료 판정은 “봤다”가 아니라
실행 근거가 남았는가 가 중요하다.

적응은 장식이 아니라
다음 세션 품질을 바꾸는 엔진 이어야 한다.

모바일-first가 기본이다.
데스크탑은 지원 가능하지만 우선순위가 아니다.

5. public 카메라 퍼널 최신 SSOT
5-1. 카메라 퍼널의 제품 정의

현재 카메라 퍼널은 이렇게 정의한다.

MOVE RE camera는 medical diagnosis tool이 아니다.
또한 정밀 posture AI를 전면에 내세우는 도구도 아니다.

현재 잠긴 정의:

camera input → usable signal capture → movement interpretation → personalized execution entry

즉 카메라는
“정밀하게 맞다/틀리다를 판정하는 시험”이 아니라
혼자서도 짧은 시간 안에 usable signal을 확보하고 다음 행동으로 넘어가게 만드는 전환 장치다.

5-2. 카메라 퍼널 기본 흐름

기본 public camera funnel은 고정이다.

Setup → Squat → Overhead Reach → Result

기본 필수 동작 2개:

Squat

Overhead Reach

기본 경로에서 제외:

Wall Angel

Single-Leg Balance

사유는 이미 정리되었다.

Wall Angel: 셀프 촬영/벽 의존/정렬 판단 불리

Single-Leg Balance: 변동성 높고 첫 퍼널 완주율 저하 가능

즉 현재 기본 전략은
simple + repeatable + self-servable 이다.

5-3. 카메라 파이프라인 정의

현재 개념 파이프라인은 아래다.

camera
→ PoseLandmarker
→ landmarks
→ pose features
→ motion evaluator
→ guardrail
→ pass gate
→ quality scoring
→ normalize
→ result

기술 스택:

MediaPipe PoseLandmarker Lite

핵심 철학:

pass = progression gate

quality = interpretation signal

즉 quality가 낮아도 usable signal이면 진행 가능하되,
invalid는 진행 불가다.

다만 이 usable signal은
“아무 움직임”이 아니라
유효한 attempt 여야 한다.

6. 카메라 퍼널 제품 법칙

이건 앞으로 절대 흔들리지 않아야 한다.

6-1. 전체 철학

completion-first

execution-first

perfect-form detection이 목표 아님

결과는 diagnosis report가 아니라 action bridge

6-2. 단계 역할

setup = 읽는 단계

capture = 듣는 단계

즉 setup에서는 텍스트 가능,
capture에서는 텍스트를 거의 제거한다.

6-3. capture 화면 법칙

capture는 거의 무문자여야 한다.

남겨야 하는 것:

카메라 프리뷰

실루엣

색 상태

brief success

자동 전환

제거 대상:

긴 문장

설명 카드

디버그 텍스트

technical strings

읽어야 하는 지시문

정리하면:

one camera, one silhouette, one action

7. readiness / silhouette 의미의 SSOT

이 부분은 매우 중요하다.

실루엣 색은
quality 결과 표시가 아니라 live readiness / success의 시각 언어다.

의미는 아래로 고정이다.

red = true not-ready / framing blocker

white = minimum analyzable readiness

green = final success

중요:
white는 좋은 자세가 아니라, 지금 분석 가능한 상태다.

또한 기본 규칙:

fallback/default는 red

true blocker가 풀리면 white 가능

success만 green

현재 가장 큰 리스크 중 하나는
분석 엔진보다 readiness presentation layer의 신뢰성이다.

8. voice / playback의 SSOT
8-1. 음성의 역할

capture 단계가 듣는 단계이므로,
voice는 부가기능이 아니라 핵심 UX다.

따라서 음성은 frame-reactive면 안 되고
state-transition / latch-driven 이어야 한다.

8-2. 음성/재생 제품 법칙

앞으로 음성 관련 작업은 아래를 고정 기준으로 한다.

user-facing spoken output은 Korean-first

internal/debug/English string은 절대 speak 금지

하나의 controlled audio channel 사용

intro/countdown이 오디오 채널 ownership 가짐

intro/countdown 동안 live corrective cue suppress

corrective cue는 state transition 기반

같은 cue를 프레임마다 반복 금지

success 발생 시 corrective cue 즉시 무효화

현재 한국어 음성팩은 이미 준비되어 있다.

경로: public/audio/cues/ko

즉 이제 문제는 “음원이 있느냐”가 아니라
playback control이 제대로 작동하느냐다.

8-3. 시작 시퀀스 기준

준비됐어요 이후의 기준 시퀀스는 이렇게 잠근다.

준비됐어요 클릭
→ “촬영을 시작합니다” 1회
→ 약 3초 대기
→ 3, 2, 1 countdown
→ 그 이후 live cue enable

즉 countdown 전에 live cue가 섞이면 안 된다.

9. motion별 progression contract SSOT

이제 중요한 구조 규칙이다.

모든 motion은 detection 세부는 달라도
최종 progression contract는 공통이어야 한다.

공통 계약:

start pose
→ action event
→ completionSatisfied
→ passConfirmed
→ passLatched
→ auto progression / next

차이는 오직
각 motion이 어떤 action event를 보느냐에만 있다.

즉:

스쿼트는 스쿼트 방식대로 감지

오버헤드 리치는 리치 방식대로 감지

하지만
최종 latch semantics는 공통이어야 한다.

현재 카메라 퍼널의 구조적 리스크는
motion별 contract 불일치다.

10. 스쿼트 관련 최신 SSOT

스쿼트는 이제 아래로 잠근다.

10-1. 스쿼트의 목적

이 테스트는
스쿼트를 잘하는지 평가하는 시험 이 아니다.

하지만
조금만 움직여도 통과되면 안 된다.

10-2. completion 기준

completion은 반드시
하강 후 상승해서 원위치로 복귀한 full cycle 이어야 한다.

즉 요구 순서:

top/start pose

descend

bottom/depth event

ascend

recovery/top return

아래는 completion 불가:

설치 자세로 쪼그려 앉기

하강만 하고 끝남

중간만 앉고 회복 없음

10-3. quality 분리

깊이는 completion이 아니라 quality 쪽이다.

즉:

full cycle은 해야 completion 가능

depth는 shallow / moderate / deep 등으로 별도 해석 가능

결론:
completion과 quality는 분리한다.

11. 오버헤드 리치 관련 최신 SSOT

오버헤드 리치의 핵심 문제는 raw detection 부족이 아니다.

현재 본질은:

passConfirmed는 되었는데 passLatched / final progression으로 이어지지 않는 정렬 문제

즉 앞으로 오버헤드 리치 관련 작업은
“더 잘 검출하게 만들기”보다 먼저
progression contract alignment 를 봐야 한다.

핵심 질문은 이거다.

completionSatisfied가 true인가

passConfirmed가 true인가

그런데 왜 passLatched가 false인가

autoNext가 왜 안 열리는가

즉 오버헤드 리치는
검출 자체보다 final latch semantics 정렬이 핵심이다.

12. 현재 가장 큰 리스크

앞으로 우선순위 판단은 이 6개를 중심으로 한다.

12-1. readiness visual truth

white가 안 뜸

white가 fallback처럼 떠버림

red/white 의미 붕괴

12-2. voice cue state control

같은 문구 반복

시각 상태와 음성 상태 불일치

cue policy 일관성 부족

12-3. playback serialization

오디오 겹침

countdown/live cue 충돌

debug/internal string leak

12-4. motion progression inconsistency

squat false positive

overhead reach latch failure

motion별 semantics 불균형

12-5. completion vs quality confusion

completion을 품질과 섞어버리는 위험

entry funnel 완주율과 신뢰도 사이 균형 붕괴

12-6. environment/infra instability

getUserMedia unavailable 환경

secure context 필요

폰 실기기 테스트 의존

13. 실기기 테스트 기준

카메라 관련 검증의 최우선 수단은
실기기 도그푸딩 이다.

현재 운영 기준:

PC dev server

Cloudflare Tunnel 기반 HTTPS

폰 브라우저 실기기 검증

의미:
시뮬레이터/데스크탑 카메라만으로는 부족하다.

특히 아래는 실기기 기준으로 봐야 한다.

readiness 진실성

cue cadence

countdown ownership

permission/stream lifecycle

squat false positive

overhead reach pass-to-latch

completion 체감

14. 현재 개발 우선순위 SSOT

지금 기준으로 카메라 퍼널의 우선순위는 아래 순서가 맞다.

P0

readiness visual truth 안정화

voice cue state control / anti-spam

playback serialization / Korean-only safety

intro/countdown sequencing deterministic fix

motion progression contract alignment

squat completion full-cycle hardening 유지

overhead reach passConfirmed → passLatched 정렬

P1

white transition one-shot 완성도 점검

permission / stream reuse 일관화

setup-to-capture single-surface phase flow 정리

minimal capture UX polish

result bridge 표현 정리

P2

follow-up motion 조건부 확장

richer interpretation 레이어

결과 설명 강화

public funnel conversion polish

즉 지금은
새 분석 욕심보다 제품화 레이어 잠금 이 먼저다.

15. 앞으로 작업 지시 시 반드시 따를 운영 원칙

앞으로 네가 나에게 작업을 시킬 때, 나는 아래 원칙으로 답하겠다.

15-1. 먼저 확인할 것

이 작업이 public인가 /app인가

execution core를 건드리는가

SSOT 기준 main/배포/운영 DB와 충돌하는가

제품 법칙을 깨는가

이게 분석 문제인가, 제품화 문제인가

15-2. public/camera 작업이면

반드시 아래를 먼저 체크한다.

진단처럼 보이게 만드는가

capture를 텍스트-heavy하게 만드는가

readiness 의미를 흐리는가

voice가 frame-reactive로 가는가

completion과 quality를 섞는가

motion별 contract를 다르게 만드는가

15-3. /app 작업이면

반드시 아래를 먼저 체크한다.

콘텐츠 앱처럼 흐르는가

실행/기록/적응 루프를 약하게 만드는가

모바일-first 원칙을 깨는가

persistent shell을 망가뜨리는가

public 개선을 이유로 실행 코어를 침범하는가

16. 앞으로의 기준 문장

앞으로 MOVE RE 관련 모든 대화에서 아래 문장을 기준선으로 삼으면 된다.

제품 기준

MOVE RE는 상태 기반 운동 실행 시스템이다.

public camera는 self-serve usable-signal capture input channel이다.

결과는 diagnosis report가 아니라 execution bridge다.

카메라 기준

Setup → Squat → Overhead Reach → Result

pass = progression gate

quality = interpretation signal

setup = 읽는 단계

capture = 듣는 단계

capture = 거의 무문자

red = not-ready

white = analyzable now

green = success

voice = state-transition driven

Korean-first only

squat = full cycle required

overhead reach = latch alignment first

운영 기준

SSOT = origin/main + Vercel + 운영 Supabase

public와 /app은 섞지 않는다

실기기 도그푸딩이 최우선 검증이다

17. 최종 결론

현재 MOVE RE는
“무엇을 만들어야 할지 모르는 단계”는 이미 지났다.

지금의 진짜 과제는
새 AI를 더 붙이는 것 이 아니라,

readiness

voice

playback

sequencing

motion progression

completion semantics