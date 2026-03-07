목적 (Purpose)

이 문서는 MOVE RE 시스템의 전체 구조와 핵심 흐름을 설명하는 문서이다.

목표

개발자가 프로젝트 구조를 빠르게 이해

AI 코딩 에이전트가 잘못된 수정으로 시스템을 깨뜨리는 것을 방지

핵심 로직의 Single Source of Truth 유지

1. 시스템 개요

MOVE RE는 사용자의 움직임 테스트 데이터를 기반으로 맞춤 운동 세션을 생성하는 PWA 서비스다.

핵심 기능

움직임 테스트 수행

움직임 패턴 분석

맞춤 운동 세션 생성

세션 기반 운동 진행

진행 기록 저장 및 통계 제공

2. 기술 스택
Frontend

Next.js (App Router)

React

PWA

Backend

Next.js API routes

Supabase

Database

Supabase PostgreSQL

Authentication

Supabase Auth

Payment

Stripe

3. 핵심 UX 구조

MOVE RE는 지도 기반 운동 진행 UX를 사용한다.

탭 구조

/app/home
/app/stats
/app/me

설명

/app/home

메인 화면
"Reset Map" 또는 "Session Map"

기능

세션 목록 표시

세션 시작

운동 진행

/app/stats

사용자의 운동 기록 및 통계

기능

세션 완료 기록

운동 수행 데이터

진행 통계

/app/me

사용자 정보

기능

계정 정보

구독 상태

설정

4. 핵심 시스템 흐름

MOVE RE의 주요 데이터 흐름

User
 ↓
Movement Test
 ↓
Scoring Algorithm
 ↓
Pattern Classification
 ↓
Routine Generation
 ↓
Session Map 생성
 ↓
Session 실행
 ↓
Exercise Logs 저장
5. 세션 시스템 (Session Rail)

MOVE RE는 세션 기반 운동 구조를 사용한다.

예

주 3회 설정

월 세션 = 12

사용자는

지도 형태로 세션 확인

세션 선택

운동 수행

완료 기록 저장

6. 데이터 구조 개요

핵심 테이블

users

사용자 계정

주요 필드

id

email

plan_status

movement_tests

사용자 움직임 테스트 결과

session_plans

사용자 세션 계획

exercise_templates

운동 템플릿

exercise_logs

사용자 운동 수행 기록

7. API 구조

Next.js API routes 사용

예

/api/media/sign
/api/routine/list
/api/session/complete

설명

/api/media/sign

영상 재생을 위한 signed URL 생성

/api/session/complete

세션 완료 기록 저장

8. PWA 구조

MOVE RE는 PWA 앱으로 동작한다.

특징

홈화면 설치 가능

빠른 로딩

캐시 기반 동작

주의

PWA 캐시 관련 코드 수정 시 전체 UX에 영향 가능

9. 핵심 리스크 영역

다음 영역은 수정 시 매우 주의해야 한다.

media signing

session generation logic

exercise logging

authentication middleware

Stripe payment flow

PWA cache system

이 영역 수정 시 서비스 핵심 기능이 깨질 수 있음

10. 개발 원칙

MOVE RE 개발 원칙

작은 수정

최소 변경

검증 가능한 코드

구조 유지

11. SSOT 규칙

MOVE RE의 실제 상태는 다음 기준으로 판단한다.

origin/main
Vercel production
Supabase production DB

로컬 환경은 SSOT가 아니다.

12. 향후 확장 구조

향후 시스템 확장 방향

알고리즘 고도화

운동 추천 엔진 개선

AI 기반 움직임 분석

세션 자동 난이도 조절

데이터 기반 맞춤 프로그램