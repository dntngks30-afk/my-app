목적

이 문서는 MOVE RE 프로젝트에서 AI 개발 에이전트에게 작업을 요청할 때 사용하는 표준 프롬프트 템플릿을 제공한다.

목표

프롬프트 품질 표준화

AI 작업 범위 통제

불필요한 코드 수정 방지

디버깅 효율 향상

기본 프롬프트 구조

앞으로 모든 AI 작업 요청은 아래 구조를 따른다.

ROLE
You are a senior engineer working on the MOVE RE repository.

RULES
Follow AGENTS.md
Follow DEVELOPMENT_RULES.md
Respect ARCHITECTURE.md
Understand SYSTEM_FLOW.md

CONTEXT
문제 상황 설명

TASK
수행할 작업

FILES
관련 파일

CONSTRAINTS
수정하면 안 되는 것

EXPECTED RESULT
원하는 결과

VERIFICATION
검증 방법
템플릿 1 — 버그 수정
ROLE
You are a senior engineer working on MOVE RE.

RULES
Follow AGENTS.md and DEVELOPMENT_RULES.md.

CONTEXT
문제 설명:
[여기에 버그 설명]

현재 동작:
[현재 발생하는 문제]

TASK
Find the root cause and fix the issue.

FILES
Relevant files:
[관련 파일 경로]

CONSTRAINTS
- Do not modify unrelated files
- Preserve API response format
- Minimal code changes

EXPECTED RESULT
The bug should be fixed without breaking existing behavior.

VERIFICATION
Explain:
- root cause
- changed files
- verification steps
템플릿 2 — 성능 개선
ROLE
You are a performance engineer working on MOVE RE.

RULES
Follow AGENTS.md.

CONTEXT
현재 성능 문제:
[예: 페이지 로딩 3초]

TASK
Identify the performance bottleneck and improve loading speed.

FILES
Relevant files:
[관련 파일]

CONSTRAINTS
- Do not change system architecture
- Do not break API
- Minimal diff

EXPECTED RESULT
Page load time should be significantly reduced.

VERIFICATION
Show:
- bottleneck
- fix
- expected improvement
템플릿 3 — UX/UI 개선
ROLE
You are a product UX engineer for MOVE RE.

RULES
Follow AGENTS.md.

CONTEXT
현재 UX 문제:
[UX 문제 설명]

TASK
Improve the UX while preserving existing functionality.

FILES
Relevant components:
[컴포넌트 경로]

CONSTRAINTS
- UI only
- No backend changes
- Preserve API calls

EXPECTED RESULT
UX should feel simpler and more intuitive.
템플릿 4 — API 수정
ROLE
You are a backend engineer working on MOVE RE.

RULES
Follow AGENTS.md and DEVELOPMENT_RULES.md.

CONTEXT
API behavior:
[현재 API 설명]

TASK
Modify the API to support the required behavior.

FILES
Relevant API routes:
[API 파일 경로]

CONSTRAINTS
- Do not change authentication
- Preserve response format unless necessary

EXPECTED RESULT
API should support the new behavior without breaking existing clients.

VERIFICATION
Explain:
- logic change
- affected files
템플릿 5 — 구조 분석
ROLE
You are a system architect analyzing the MOVE RE repository.

RULES
Use ARCHITECTURE.md and SYSTEM_FLOW.md as references.

TASK
Explain the architecture of the following module.

FILES
[파일 경로]

EXPECTED RESULT
Provide:
- system role
- dependencies
- potential risks
템플릿 6 — 디버깅
ROLE
You are a debugging engineer.

RULES
Follow AGENTS.md.

CONTEXT
Observed behavior:
[문제 상황]

TASK
Identify the root cause.

FILES
Relevant files:
[파일 경로]

EXPECTED RESULT
Provide:
- root cause
- explanation
- possible fixes