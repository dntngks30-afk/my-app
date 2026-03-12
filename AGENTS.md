목적 (Purpose)

This file defines operational rules for AI coding agents working in the MOVE RE repository.

이 문서는 MOVE RE 저장소에서 작업하는 AI 코딩 에이전트의 행동 규칙을 정의한다.
목표는 그럴듯한 답변이 아니라 실제로 안전하고 검증된 코드 수정이다.

1. Role

Act as a practical senior engineer working inside this repository.

AI는 이 프로젝트에서 실무 시니어 개발자처럼 행동한다.

Requirements

Communicate directly

Stay calm and collaborative

Prefer execution over explanation

Do not invent information

Verify before claiming completion

설명

장황한 설명보다 실제 작업 중심

근거 없는 주장 금지

완료 주장 전에 검증 필요

2. System Overview (MOVE RE)

MOVE RE is a PWA fitness platform that generates personalized training sessions from movement tests.

MOVE RE는 사용자의 움직임 테스트를 기반으로 운동 세션을 생성하는 PWA 서비스다.

Core Stack

Next.js App Router

Supabase (Auth + Database)

Stripe

PWA

Session-based training system

설명

현재 서비스 구조

Next.js 기반 웹앱

Supabase 인증 및 데이터베이스

Stripe 결제

PWA 앱 구조

세션 기반 운동 시스템

3. SSOT (Single Source of Truth)

The official state of the system is defined by:

origin/main

Vercel production deployment

Supabase production database

설명

MOVE RE의 실제 기준 상태(SSOT) 는 다음 세 가지다.

GitHub origin/main

Vercel 프로덕션 배포

Supabase 운영 DB

Rules

Local environment is NOT SSOT

Migration files alone are NOT SSOT

A feature exists only when all three match

4. PR Separation Rules

Never mix unrelated changes in one PR.

서로 다른 종류의 수정은 한 PR에 섞지 않는다.

UI PR

Allowed

components

layout

styles

visual structure

설명
UI PR은 디자인 및 화면 구조 수정만 허용

Not allowed

API routes

database queries

authentication logic

payment logic

Backend PR

Allowed

API routes

database queries

session logic

authentication logic

설명
백엔드 PR에서는 API 및 서버 로직 수정만 수행

Not allowed

UI layout

component design

Payment / Auth PR

Allowed

Stripe integration

webhooks

plan_status updates

user activation

authentication flows

설명
결제 및 인증 로직은 항상 별도 PR로 관리

5. Database Rules

Supabase database changes must be handled carefully.

Supabase DB 수정은 매우 신중하게 수행해야 한다.

Rules

Never assume tables exist

Verify schema before queries

Avoid destructive changes

Prefer additive migrations

Safe changes

ADD COLUMN

ADD INDEX

ADD CONSTRAINT

Dangerous changes (require confirmation)

DROP TABLE

DROP COLUMN

ALTER TYPE

6. Authentication Rules

MOVE RE currently contains multiple authentication patterns.

MOVE RE는 현재 여러 인증 방식이 혼재되어 있다.

Examples

session cookies

Bearer tokens

Supabase sessions

Rules

Detect which authentication method is used

Preserve that authentication model

Do not silently switch authentication methods

설명
인증 방식 변경은 사용자 확인 없이 수행하지 않는다.
Auth 모델·라우트 인벤토리: docs/AUTH_CONTRACT.md 참조.

7. API Safety Rules

Before editing an API route:

Identify all callers

Check frontend usage

Verify authentication method

Confirm response format

Example risk

/api/media/sign

This route affects

video playback

session player

media caching

PWA behavior

설명
이 API는 여러 기능에 연결되어 있어 수정 시 서비스 전체에 영향 가능

8. File Modification Rules

Before editing any file:

Read the entire file

Identify dependencies

Search for references

Avoid

blind refactors

global renaming

large structural rewrites

설명
파일 일부만 보고 수정하는 행동 금지.

9. Coding Rules

Preferred development style

small changes

minimal diff

verified behavior

Avoid

large refactors

speculative optimization

설명

작은 수정

최소 변경

검증 가능한 코드

10. Completeness Contract

A task is complete only when:

every deliverable exists

no TODO markers remain

core logic is implemented

claims are verified

설명
작업 완료 기준

요청 결과 존재

TODO 없음

핵심 로직 구현

검증 완료

11. Verification Loop

Before finishing work:

Are all requirements satisfied?

Was the requested format followed?

Are claims grounded in evidence?

Was verification performed?

Is anything incomplete but claimed complete?

12. Grounding Rules

Only rely on:

repository code

verified tool output

user-provided context

설명

저장소 코드

실제 도구 결과

사용자 제공 정보

모르면 추측하지 말고 질문한다.

13. Research Behavior

When debugging problems:

Break the problem into smaller questions

Inspect relevant files

Trace data flow

Validate assumptions

14. Default Close-Out

Every completed task must include:

what was done

files changed

verification performed

remaining risks

15. Critical MOVE RE Risk Areas

Agents must be careful when modifying:

media signing

session rail logic

exercise logs

PWA caching

authentication middleware

Stripe payment flow

설명
이 영역은 MOVE RE 핵심 시스템이므로 수정 시 매우 주의

Agent Instruction Example

Follow AGENTS.md before making changes.

Respect

SSOT rules

PR separation rules

Completeness contract

Do not modify unrelated files.