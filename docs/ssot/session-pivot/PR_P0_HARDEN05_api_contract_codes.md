# P0: Session API Error Contract & Codes

## What Changed

- **공통 유틸**: `src/lib/api/contract.ts` — `ok()`, `fail()`, `ApiErrorCode` enum
- **4개 라우트**: active/create/complete/history — `ok(data, extras)` / `fail(status, code, message, details?, errorExtras?)`
- **하위호환**: 성공 시 `{ ok: true, data, ...extras }` — extras로 top-level 필드 유지

## 에러 코드 표 (HTTP Status 매핑)

| code | HTTP | 용도 |
|------|------|------|
| AUTH_REQUIRED | 401 | 로그인 필요 |
| FORBIDDEN | 403 | 권한 없음 |
| DEEP_RESULT_MISSING | 404 | create 시 Deep Test 미완료 |
| SESSION_PLAN_NOT_FOUND | 404 | complete 시 해당 세션 없음 |
| PROGRAM_PROGRESS_NOT_FOUND | 404 | progress row 없음 |
| PROGRAM_FINISHED | 409 | 모든 세션 완료 (현재 200+done 유지, 추후 409 전환) |
| DAILY_LIMIT_REACHED | 409 | 오늘 이미 완료 |
| SESSION_ALREADY_COMPLETED | 409 | complete 멱등 (200 반환 시 미사용) |
| CONCURRENT_UPDATE | 409 | 동시 업데이트 |
| VALIDATION_FAILED | 400 | session_number, duration_seconds 등 검증 실패 |
| INTERNAL_ERROR | 500 | DB/서버 오류 |

## FE 분기 규칙 (코드 기준)

```ts
if (!result.ok) {
  switch (result.error.code) {
    case 'AUTH_REQUIRED': redirect('/login'); break;
    case 'DAILY_LIMIT_REACHED': showNextUnlock(result.error.next_unlock_at); break;
    case 'DEEP_RESULT_MISSING': setPanelState('deep_missing'); break;
    case 'PROGRAM_FINISHED': setPanelState('done'); break;  // 409 전환 시
    case 'VALIDATION_FAILED': showValidation(result.error.message); break;
    default: showError(result.error.message);
  }
}
```

## 구필드 제거 후속 PR 계획

- **P1-CONTRACT-CLEANUP-01**: 성공 응답에서 top-level extras 제거, FE가 `data`만 사용하도록 마이그레이션
- **P1-CONTRACT-CLEANUP-02**: PROGRAM_FINISHED 409 전환 + FE 분기 추가
