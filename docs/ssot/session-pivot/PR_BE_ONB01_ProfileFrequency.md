# BE-ONB-01: 주당 목표횟수 저장 + total_sessions 세팅

## 목적

온보딩에서 "주 몇 회 가능?" 선택값을 DB에 저장하고,
`total_sessions`(8/12/16/20)를 확정하는 API를 제공합니다.

---

## API

| 항목 | 값 |
|------|-----|
| 엔드포인트 | `POST /api/session/profile` |
| 인증 | Bearer token (session APIs와 동일) |
| Write | service role (RLS bypass) |

---

## 입력

```json
{
  "target_frequency": 2 | 3 | 4 | 5,
  "lifestyle_tag": "string (optional)"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| target_frequency | 2 \| 3 \| 4 \| 5 | O | 주당 목표 운동 횟수 |
| lifestyle_tag | string | X | 라이프스타일 태그 (예: "바쁜 직장인") |

---

## total_sessions 매핑

| target_frequency | total_sessions |
|-----------------|----------------|
| 2 | 8 |
| 3 | 12 |
| 4 | 16 |
| 5 | 20 |

---

## 응답

```json
{
  "profile": { "user_id": "...", "target_frequency": 3, "lifestyle_tag": "..." },
  "progress": { "user_id": "...", "total_sessions": 12, "completed_sessions": 0, ... },
  "warning": "이미 완료된 세션이 있습니다. total_sessions 변경 시 진행률 해석에 주의하세요."
}
```

- `warning`: `completed_sessions > 0`일 때만 포함 (값은 변경하되 리스크 안내)

---

## curl 예시

```bash
# 1) 로그인 후 access_token 획득 (클라이언트: getSessionSafe().then(s => s.session?.access_token))
# 2) target_frequency=3 → total_sessions=12

curl -X POST "http://localhost:3000/api/session/profile" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{"target_frequency": 3}'
```

```bash
# lifestyle_tag 포함

curl -X POST "http://localhost:3000/api/session/profile" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{"target_frequency": 5, "lifestyle_tag": "바쁜 직장인"}'
```

```bash
# target_frequency=5 → total_sessions=20 (정책 허용: 기존 값 변경 가능)

curl -X POST "http://localhost:3000/api/session/profile" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{"target_frequency": 5}'
```

---

## 유효성 검사

- `target_frequency`가 2/3/4/5가 아니면 **400** `VALIDATION_ERROR`

---

## 멱등성

- 같은 값 재전송 시 안전하게 같은 상태로 저장 (upsert)

---

## 리스크 (completed_sessions > 0 시 total_sessions 변경)

- 이미 완료된 세션이 있는 상태에서 `total_sessions`를 줄이면:
  - `completed_sessions <= total_sessions` 제약으로 인해 더 작은 값으로는 변경 불가 (DB CHECK)
- 늘리는 것은 가능. 응답에 `warning` 포함.
