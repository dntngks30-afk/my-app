# PR03: Deep Result Summary → Session Create (가벼운 연결)

## 목적

`/api/session/create` 호출 시 Deep v2 "최종 결과 요약"을 조회해  
`plan_json.meta`에 `result_type / confidence / focus / avoid`를 포함시킨다.  
**heavy work 일절 없음**: 템플릿 fetch, media sign, 알고리즘 재계산 없음.

---

## 변경 파일 (신규/수정, 기존 7일 파일 변경 0개)

| 분류 | 경로 | 변경 |
|------|------|------|
| lib (NEW) | `src/lib/deep-result/session-deep-summary.ts` | read-only helper |
| API (수정) | `src/app/api/session/create/route.ts` | Deep 연결 + meta 포함 |
| 문서 (NEW) | `docs/ssot/session-pivot/PR03_DeepSummary_Integration.md` | 이 문서 |

---

## Deep 결과를 어디서 읽는가 (근거)

### 테이블
`public.deep_test_attempts`

### 쿼리 조건
```sql
SELECT result_type, confidence, scores, scoring_version, updated_at
FROM deep_test_attempts
WHERE user_id = $userId
  AND scoring_version = 'deep_v2'
  AND status = 'final'
ORDER BY updated_at DESC
LIMIT 1;
```

- `status = 'final'`: `/api/deep-test/finalize` 호출 시 확정된 row만 사용
- `scoring_version = 'deep_v2'`: 현재 사용 버전 고정 (v1 legacy 제외)
- `LIMIT 1 + ORDER BY updated_at DESC`: 가장 최신 결과 1건만

### 추출 필드
| DB/JSON 경로 | 의미 | 사용처 |
|---|---|---|
| `result_type` (컬럼) | 'LOWER-LIMB' 등 6타입 | meta.result_type |
| `confidence` (컬럼) | 0~1 float | meta.confidence(라벨 변환) |
| `scores.derived.focus_tags` | ['glute_activation', ...] | meta.focus, 테마 결정 |
| `scores.derived.avoid_tags` | ['knee_load', ...] | meta.avoid |
| `scoring_version` (컬럼) | 'deep_v2' | meta.scoring_version |

### confidence 라벨 변환
```
raw >= 0.75 → 'high'
raw >= 0.50 → 'mid'
raw <  0.50 → 'low'
```

### 코드 근거
- `src/lib/deep-result/session-deep-summary.ts` — `loadSessionDeepSummary(supabase, userId)`
- 기존 `get-latest/route.ts`와 동일 쿼리 패턴 재사용

---

## create 응답 스키마 변화

### 신규 plan_json 구조 (version: session_stub_v2)

```json
{
  "version": "session_stub_v2",
  "meta": {
    "session_number": 3,
    "phase": 1,
    "result_type": "LOWER-LIMB",
    "confidence": "mid",
    "focus": ["glute_activation", "lower_chain_stability"],
    "avoid": ["knee_load", "deep_squat"],
    "scoring_version": "deep_v2"
  },
  "flags": {
    "recovery": false,
    "short": true
  },
  "segments": [
    {
      "title": "Prep",
      "duration_sec": 120,
      "items": [
        { "order": 1, "templateId": "stub_prep_1", "name": "준비 1", "sets": 1, "reps": 10 },
        { "order": 2, "templateId": "stub_prep_2", "name": "준비 2", "sets": 1, "reps": 10 }
      ]
    },
    {
      "title": "Main",
      "duration_sec": 240,
      "items": [
        { "order": 1, "templateId": "stub_main_p1_1", "name": "Phase 1 · glute_activation 안정화 1",
          "sets": 2, "reps": 12, "focus_tag": "glute_activation" },
        { "order": 2, "templateId": "stub_main_p1_2", "name": "Phase 1 · glute_activation 안정화 2",
          "sets": 2, "reps": 12, "focus_tag": "lower_chain_stability" }
      ]
    },
    {
      "title": "Release",
      "duration_sec": 60,
      "items": [
        { "order": 1, "templateId": "stub_release_1", "name": "이완 1", "sets": 1, "hold_seconds": 30 }
      ]
    }
  ]
}
```

### 테마 결정 규칙
| session_number | phase | theme 예시 |
|---|---|---|
| 1~4 | 1 | `Phase 1 · glute_activation 안정화` |
| 5~8 | 2 | `Phase 2 · lower_chain_stability 심화` |
| 9~12 | 3 | `Phase 3 · 통합` |
| 13~16 | 4 | `Phase 4 · 릴렉스` |

---

## 에러 정책

| 상황 | HTTP 코드 | error.code |
|------|-----------|------------|
| 미인증 | 401 | `UNAUTHENTICATED` |
| Deep 결과 없음 | 404 | `DEEP_RESULT_MISSING` |
| DB 오류 | 500 | `DB_ERROR` |
| active session 이미 있음 (멱등) | 200 | — (idempotent: true) |
| 프로그램 전체 완료 | 200 | — (done: true) |

### DEEP_RESULT_MISSING 응답 예시
```json
{
  "error": {
    "code": "DEEP_RESULT_MISSING",
    "message": "심화 테스트 결과가 없습니다. Deep Test를 먼저 완료해 주세요."
  }
}
```

---

## 성능 가드 (A4 검증)

`src/app/api/session/create/route.ts` 코드 상 확인:

1. **템플릿 대량 fetch 없음**: `exercise_templates` 테이블 접근 코드 없음
2. **media sign 없음**: `/api/media/sign` 호출 코드 없음
3. **재계산 없음**: `calculateDeepV2`, `extendDeepV2` 호출 없음
4. **Deep 조회 LIMIT 1**: `loadSessionDeepSummary` → `LIMIT 1` 단건 쿼리
5. **멱등 경로에서 Deep 조회 없음**: `active_session_number` 존재 시 즉시 반환

---

## 멱등 동작 (A3)

```
최초 create 호출 (active=null):
  1. progress 조회
  2. deep summary 로드 (DB 1회 조회)
  3. plan 생성 + progress.active = nextSessionNumber
  → { idempotent: false, active: { session_number: N, plan_json: { meta: {...} } } }

재호출 (active=N):
  1. progress 조회
  2. active_session_number 있음 → 기존 plan 그대로 반환 (deep 재조회 없음)
  → { idempotent: true, active: { ... 동일 id, session_number } }
```

---

## curl 시나리오 (A5 로컬 테스트)

```bash
TOKEN="YOUR_ACCESS_TOKEN"
BASE="http://localhost:3000"

# (1) Deep 결과 존재 계정 — create → meta 확인
curl -s -X POST "$BASE/api/session/create" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"condition_mood":"ok","time_budget":"short"}' | jq '.active.plan_json.meta'

# 예상:
# { "session_number": 1, "phase": 1, "result_type": "LOWER-LIMB",
#   "confidence": "mid", "focus": [...], "avoid": [...] }

# (2) GET /api/session/active → 동일 meta 확인
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/session/active" \
  | jq '.active.plan_json.meta'

# (3) create 재호출 → idempotent: true 확인
curl -s -X POST "$BASE/api/session/create" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"condition_mood":"ok","time_budget":"short"}' | jq '{idempotent: .idempotent, session_number: .active.session_number}'

# 예상: { "idempotent": true, "session_number": 1 }

# (4) Deep 없는 계정 → 404
curl -s -X POST "$BASE/api/session/create" \
  -H "Authorization: Bearer $TOKEN_NO_DEEP" \
  -H "Content-Type: application/json" \
  -d '{"condition_mood":"ok","time_budget":"short"}' | jq .

# 예상: { "error": { "code": "DEEP_RESULT_MISSING", ... } }
```

---

## Rollback

- `git revert <이 커밋 SHA>`
- DB 마이그레이션 없음 → DB rollback 불필요
- 기존 7일 레일 영향 없음

---

## 위험/제한

- **아직 템플릿 추천/영상 연결 없음** (의도된 제한): `plan_json.segments[].items[].templateId`는 모두 `stub_*` placeholder
- `focus_tags`/`avoid_tags`가 비어있는 Deep 결과의 경우 `resultType`으로 fallback
- 다음 PR(PR-04)에서 실제 exercise_templates 연결 예정
