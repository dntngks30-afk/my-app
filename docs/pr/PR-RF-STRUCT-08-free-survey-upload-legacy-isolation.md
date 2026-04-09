# PR-RF-STRUCT-08 — free-survey / upload legacy isolation

## Scope
- free-survey + upload + requests 테이블 경로를 canonical public-result flow와 명확히 분리
- legacy pipeline의 역할을 compat / ops-only / sunset 후보로 정리

## Non-goals
- storage 버킷 정책 변경
- public result canonical flow 변경
- movement-test 설문 변경

## Locked truth
- canonical public analysis 흐름은 movement-test baseline/refine 경로다
- free-survey legacy 흐름을 정본으로 되살리지 않는다

## Why now
- free-survey는 별도 localStorage user_id, 사진 업로드, requests upsert로 완전히 다른 데이터 모델을 유지하고 있다.

## Files / modules in scope
- `src/app/free-survey/page.tsx`
- `src/app/api/upload/route.ts`
- 관련 결과 페이지 및 requests 사용 지점

## Out of scope
- storage infra 개편
- canonical result persistence
- auth / claim

## PR boundary
- 경계 문서화 및 isolation 설계만
- 운영 삭제 결정은 별도 PR

## Regression checklist
- legacy free-survey direct access 동작 확인
- upload 성공/실패 처리 유지
- requests write path 영향 범위 식별
