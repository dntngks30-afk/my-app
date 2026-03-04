# P0: Request De-dupe (폭주 방어)

## 목적

- 모바일/느린 네트워크에서 버튼 연타, 재시도, 동시 요청으로 동일 요청이 2~5번 들어오는 것 방어.
- 짧은 윈도우(10초 TTL)에서 de-dupe. 정상 1회 호출은 막지 않음.

## 적용 라우트 / 키

| 라우트 | 기본 키 | TTL |
|--------|---------|-----|
| POST /api/session/create | user_id + kst_day + 'create' | 10초 |
| POST /api/session/complete | user_id + session_number + 'complete' | 10초 |

## Idempotency-Key 헤더 (옵션)

- `Idempotency-Key: <string>` 헤더가 있으면 해당 값을 dedupe_key에 우선 사용.
- FE 수정 없이 동작. 클라이언트가 헤더를 보내면 더 강한 멱등 보장.

## 중복 감지 시

- HTTP 409
- `error.code`: `REQUEST_DEDUPED`
- `error.message`: "요청이 처리 중입니다. 잠시 후 다시 시도하세요"
- session_events에 `event_type='request_deduped'` 기록

## TTL 만료 후

- 10초 경과 시 해당 키는 만료. 동일 요청 재시도 시 정상 처리 가능.

## Rollback

```sql
DROP TABLE IF EXISTS public.request_dedupe_keys;
```

## 청소 전략

- 이번 PR에서는 주기적 삭제 작업 없음.
- TTL(10초) + 인덱스로 테이블 크기 제어. 만료된 row는 재획득 시 DELETE 후 재INSERT.
