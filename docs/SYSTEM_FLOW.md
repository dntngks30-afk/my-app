목적 (Purpose)

이 문서는 MOVE RE 서비스의 전체 사용자 흐름과 시스템 동작 구조를 설명한다.

목표

서비스 동작 구조를 한눈에 이해

개발 시 흐름 기반 디버깅 가능

AI 개발 에이전트가 전체 구조를 이해하도록 지원

1. 서비스 개요

MOVE RE는 사용자의 움직임 테스트를 기반으로 개인 맞춤 운동 세션을 생성하는 PWA 서비스다.

핵심 구조

사용자 가입

움직임 테스트 수행

움직임 분석

맞춤 운동 세션 생성

세션 기반 운동 진행

운동 기록 저장

통계 제공

2. 전체 사용자 흐름

전체 서비스 흐름

User
 ↓
회원가입 / 로그인
 ↓
Deep Test 수행
 ↓
Movement Scoring
 ↓
Pattern Classification
 ↓
Routine Generation
 ↓
Session Map 생성
 ↓
Session 선택
 ↓
Exercise Player
 ↓
Exercise Logs 저장
 ↓
Statistics 업데이트

설명

사용자는 테스트를 수행하면
그 결과를 기반으로 맞춤 세션이 생성되고 지도 형태로 표시된다.

3. 결제 흐름

MOVE RE는 구독 기반 서비스다.

결제 흐름

사용자
 ↓
Stripe Checkout
 ↓
결제 성공
 ↓
Webhook 호출
 ↓
plan_status 업데이트
 ↓
유료 기능 활성화

설명

Stripe 결제 성공 시

webhook 실행

사용자 plan_status 업데이트

유료 기능 활성화

4. 테스트 흐름 (Deep Test)

Deep Test는 사용자 움직임 상태를 분석한다.

흐름

Deep Test 시작
 ↓
사용자 응답 입력
 ↓
Scoring Algorithm 실행
 ↓
Mobility / Stability / Pain Risk 계산
 ↓
Movement Pattern 분류

결과

사용자는 움직임 타입 분류 결과를 받는다.

5. 루틴 생성 흐름

테스트 결과를 기반으로 루틴 생성

Pattern Classification
 ↓
운동 템플릿 조회
 ↓
필터링
 ↓
세션 구성
 ↓
Session Plan 생성

사용자는 세션 기반 운동 프로그램을 받는다.

6. 세션 시스템

MOVE RE는 세션 기반 운동 구조를 사용한다.

예

사용자 설정

주 3회 운동

시스템 생성

월 세션 = 12

지도 UI에서

세션 선택

운동 시작

완료 기록

7. 운동 실행 흐름

운동 실행 시

Session 선택
 ↓
Exercise Player 실행
 ↓
영상 가이드 표시
 ↓
운동 수행
 ↓
수행 데이터 입력

입력 데이터

세트

반복

RPE

수행 시간

8. 운동 기록 저장

운동 수행 기록은 다음 구조로 저장

exercise_logs

저장 데이터

exercise_id

session_id

sets

reps

rpe

timestamp

9. 통계 생성 흐름

운동 로그 기반 통계 생성

exercise_logs
 ↓
aggregation
 ↓
user statistics

사용자 화면

/app/stats

표시 내용

세션 완료 수

운동 수행량

진행률

10. 영상 시스템 흐름

운동 영상은 signed URL 방식으로 제공된다.

흐름

Exercise Player
 ↓
/api/media/sign
 ↓
Signed URL 생성
 ↓
Video Streaming

주의

이 시스템 수정 시

영상 재생

캐시

PWA 동작

모두 영향을 받을 수 있다.

11. PWA 흐름

MOVE RE는 PWA 앱으로 동작한다.

구조

웹 접속
 ↓
PWA 설치
 ↓
홈 화면 실행
 ↓
캐시 기반 빠른 로딩

특징

모바일 앱처럼 동작

빠른 로딩

오프라인 대응

12. 핵심 시스템 연결

Auth: 클라이언트 Session → API Bearer. 상세: docs/AUTH_CONTRACT.md

MOVE RE 주요 시스템 연결 구조

Deep Test
 ↓
Scoring Engine
 ↓
Routine Generator
 ↓
Session System
 ↓
Exercise Player
 ↓
Exercise Logs
 ↓
Statistics
13. 핵심 리스크 영역

다음 영역 수정 시 매우 주의

media signing

session generation

exercise logs

authentication middleware

Stripe payment flow

PWA cache system

이 영역이 깨지면 서비스 핵심 기능이 중단될 수 있다.