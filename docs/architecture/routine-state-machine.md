# Routine State Machine

## 상태 값

| status   | 설명               | started_at |
|----------|--------------------|------------|
| draft    | 생성됨, 미시작     | null       |
| active   | 진행 중            | SET        |
| completed| 7일 모두 완료      | SET        |
| paused   | 일시 중단          | SET        |
| cancelled| 취소됨             | SET        |

## 전이

```
create  → draft
start   → draft → active (Start 버튼 시점에만 started_at 세팅)
complete-day (7/7) → active → completed
```

## Start API (멱등)

- `POST /api/workout-routine/start`
- 중복 클릭/새로고침/재시도 시 안전
- 이미 active가 있으면 해당 루틴 반환 (changed=false)
- started_at이 이미 있으면 그대로 반환 (changed=false)

## 동시 active 방지

- start 시 actor에게 이미 active가 있으면 draft를 active로 바꾸지 않음
- 코드로 보장 (DB 제약은 미적용)
- **향후**: `partial unique (user_id) WHERE status='active'` 고려
