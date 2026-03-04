# P3_MEDIA_02: 미디어 계약·캐시·중복요청 방지

## 개요

MOVE RE 미디어 로딩(mux/legacy + buildMediaPayload + /api/exercise-template/media + /api/media/sign) 구조를 유지하면서, 계약·검증·캐시를 강화한다.

## 단건 API: GET /api/exercise-template/media

### 요청

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| templateId | string | O | exercise_templates.id |

### 응답

**200 OK**
```json
{
  "templateId": "M01",
  "payload": {
    "kind": "hls" | "embed" | "placeholder",
    "streamUrl": "string?",
    "embedUrl": "string?",
    "posterUrl": "string?",
    "durationSec": 300,
    "autoplayAllowed": false,
    "notes": ["string?"]
  },
  "cache_ttl_sec": 60
}
```

**404 Not Found**
```json
{ "error": "템플릿을 찾을 수 없습니다.", "code": "TEMPLATE_NOT_FOUND" }
```

**422 Unprocessable Entity**
```json
{ "error": "reason...", "code": "MEDIA_REF_INVALID" }
```

### 헤더

- `Cache-Control: no-store` (내부 메모리 캐시는 별도)

---

## 배치 API: POST /api/media/sign

### 요청

| 필드 | 타입 | 필수 | 제한 | 설명 |
|------|------|------|------|------|
| templateIds | string[] | O | 최대 50, 중복 제거 | exercise_templates.id 목록 |

### 응답

**200 OK**
```json
{
  "results": [
    {
      "templateId": "M01",
      "payload": { "kind": "hls" | "embed" | "placeholder", ... },
      "cache_ttl_sec": 60
    }
  ]
}
```

- `results`는 **입력 templateIds 순서**를 유지한다.
- 중복 templateIds는 자동 제거 후 처리된다.

**400 Bad Request**
- `MISSING_TEMPLATE_IDS`: templateIds 누락
- `TOO_MANY_IDS`: 50개 초과

**422 Unprocessable Entity**
```json
{ "error": "reason...", "code": "MEDIA_REF_INVALID" }
```

### 내부 동작

- **templateId당 60초 메모리 캐시**: 동일 templateId 재요청 시 DB hit 감소
- **동일 templateIds 조합 3~5초 dedupe**: 동일 조합 연속 호출 시 이전 응답 재사용

---

## media_ref 검증 (서버)

`validateMediaRefForApi(media_ref)` 반환:

- `{ ok: true }` — 유효
- `{ ok: false, code: 'MEDIA_REF_INVALID', reason: string }` — 무효

### 스키마 규칙

| provider | 필수 | 허용 |
|----------|------|------|
| mux | playback_id | start, end는 number면 허용 |
| legacy | url | https:// 만 허용 |

잘못된 media_ref는 422로 즉시 반환한다.

---

## FE: 온디맨드 sign 요청 최소화

- placeholder일 때만 sign 요청 유지
- **payload 메모이즈**: 이미 받은 templateId payload는 Map으로 재사용
- **인플라이트 promise 캐시**: 동일 프레임에서 중복 sign 호출 시 동일 promise 공유

---

## 에러 코드 요약

| 코드 | HTTP | 의미 |
|------|------|------|
| TEMPLATE_NOT_FOUND | 404 | 템플릿 없음 |
| MEDIA_REF_INVALID | 422 | media_ref 스키마 위반 |
| MISSING_TEMPLATE_ID | 400 | templateId 누락 (단건) |
| MISSING_TEMPLATE_IDS | 400 | templateIds 누락 (배치) |
| TOO_MANY_IDS | 400 | templateIds 50개 초과 |
