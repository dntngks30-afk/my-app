# P3_MEDIA_03: Admin 저장 시 media_ref 검증

## 개요

Admin 저장 시점에 `exercise_templates.media_ref`(JSONB) 스키마 검증을 강제하여, 잘못된 데이터 유입을 차단한다.

## 요청 형식

PATCH `/api/admin/templates/[id]` body에 다음 중 하나가 들어올 수 있음:

- `media_ref`: object (직접 파싱된 값)
- `media_ref_raw`: string (JSON 문자열, 서버에서 `JSON.parse`)

`media_ref_raw`가 있으면 `media_ref`보다 우선하여 파싱 후 검증한다.

## 허용/금지 예시

### 허용 예시 1: mux (최소)

```json
{"provider":"mux","playback_id":"xxx"}
```

### 허용 예시 2: mux (start/end 포함)

```json
{"provider":"mux","playback_id":"xxx","start":0,"end":60}
```

### 허용 예시 3: legacy

```json
{"provider":"legacy","url":"https://example.com/video"}
```

### 허용 예시 4: null

```json
null
```

### 금지 예시 1: mux에서 playback_id 누락

```json
{"provider":"mux"}
```

→ 422

### 금지 예시 2: legacy에서 http

```json
{"provider":"legacy","url":"http://example.com/video"}
```

→ 422

### 금지 예시 3: provider unknown

```json
{"provider":"vimeo","url":"https://..."}
```

→ 422

### 금지 예시 4: JSON 파싱 실패

```
{invalid json
```

→ 400

## 에러 코드 / HTTP status

| 상황 | HTTP | 응답 |
|------|------|------|
| JSON 파싱 실패 (media_ref_raw) | 400 | `{ ok: false, error: { code: 'VALIDATION_FAILED', message: 'media_ref_raw JSON 파싱 실패' } }` |
| 스키마 불일치 | 422 | `{ ok: false, error: { code: 'MEDIA_REF_INVALID', message: 'media_ref 형식이 올바르지 않습니다', details: { reason } } }` |
| 성공 | 200 | `{ ok: true, template, auditId }` |

## 스키마 규칙

| provider | 필수 | 허용 |
|----------|------|------|
| mux | playback_id (non-empty string) | start, end (number) |
| legacy | url (non-empty string) | https:// 만 허용 |
