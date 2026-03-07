목적 (Purpose)

이 문서는 MOVE RE 프로젝트에서 개발 시 반드시 지켜야 할 규칙을 정의한다.

목표

시스템 구조 보호

위험한 코드 변경 방지

AI 개발 에이전트의 안전한 작업 보장

1. 기본 원칙

MOVE RE 개발은 다음 원칙을 따른다.

작은 수정

최소 변경

구조 유지

검증 가능한 코드

설명

가능한 한 기존 구조를 유지하면서 필요한 부분만 수정한다.

2. SSOT 규칙

MOVE RE의 실제 상태는 다음 기준으로 판단한다.

GitHub origin/main

Vercel production deployment

Supabase production database

설명

로컬 코드나 테스트 환경은 SSOT가 아니다.

3. UI 수정 규칙

UI 변경 시 다음 규칙을 따른다.

허용

컴포넌트 수정

스타일 수정

레이아웃 수정

금지

API 로직 변경

인증 로직 변경

DB 로직 변경

설명

UI 수정은 UI에만 영향을 주도록 제한한다.

4. API 수정 규칙

API 수정 전 반드시 확인해야 할 것

호출 위치

프론트 사용 코드

인증 방식

응답 구조

설명

API 응답 구조 변경 시 프론트 코드가 깨질 수 있다.

5. DB 수정 규칙

Supabase DB 수정은 매우 신중하게 수행한다.

허용

ADD COLUMN

ADD INDEX

ADD CONSTRAINT

주의

ALTER TABLE

ALTER TYPE

금지 (확인 없이)

DROP TABLE

DROP COLUMN

6. 인증(Auth) 규칙

현재 MOVE RE는 다음 인증 방식이 혼재되어 있다.

Supabase session

Bearer token

cookie session

규칙

기존 인증 방식 유지

인증 방식 변경 금지 (사용자 확인 필요)

7. 결제(Stripe) 규칙

Stripe 관련 코드는 다음 원칙을 따른다.

수정 시 반드시 확인

webhook

checkout session

plan_status 업데이트

설명

결제 로직 수정 시 사용자 결제 상태가 깨질 위험이 있다.

8. PWA 규칙

PWA 관련 코드 수정 시 주의

영향 가능 영역

캐시

로딩 속도

오프라인 동작

설명

PWA 캐시 로직은 앱 전체 UX에 영향을 줄 수 있다.

9. 세션 시스템 규칙

MOVE RE는 세션 기반 운동 구조를 사용한다.

세션 로직 수정 시 확인

세션 생성

세션 완료 기록

운동 로그 저장

설명

이 로직이 깨지면 운동 진행 시스템 전체가 영향을 받는다.

10. 영상(Media) 시스템 규칙

영상 시스템 구조

media storage

signed url

video playback

수정 시 위험

영상 재생 불가

캐시 오류

세션 플레이어 오류

11. 로그 기록 규칙

운동 수행 기록은 다음 구조로 저장된다.

exercise_logs

내용

수행 세트

반복 횟수

RPE

시간

설명

로그 구조 변경 시 통계 시스템이 깨질 수 있다.

12. 리팩토링 규칙

다음 리팩토링은 금지

대규모 구조 변경

전체 파일 이동

전체 함수 이름 변경

허용

작은 코드 개선

버그 수정

13. 디버깅 원칙

문제 해결 절차

문제 재현

로그 확인

관련 파일 분석

수정

검증

14. 작업 완료 기준

작업 완료로 간주하려면 다음 조건 필요

요청된 기능 구현

오류 없음

TODO 없음

검증 완료

15. 핵심 위험 영역

다음 영역 수정 시 매우 주의

media signing

session generation

exercise logs

authentication middleware

Stripe payment flow

PWA cache system