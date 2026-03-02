# PR02: Path B — Session Rail (DB + API), 7-day Unchanged

## 목적

기존 7일 루틴 레일과 **완전히 분리된 병행 세션 레일(Path B)** 을 추가한다.  
이번 PR은 DB 스키마 + API 3개 추가만 포함. 기존 파일 변경 0.

---

## 변경 파일 목록

| 분류 | 경로 | 역할 |
|------|------|------|
| DB 마이그레이션 (NEW) | `supabase/migrations/20260303_session_pathB.sql` | 3개 테이블 + RLS + 인덱스 |
| API (NEW) | `src/app/api/session/active/route.ts` | 진행 중 세션 조회 |
| API (NEW) | `src/app/api/session/create/route.ts` | 세션 멱등 생성 |
| API (NEW) | `src/app/api/session/complete/route.ts` | 세션 완료 처리 |
| 문서 (NEW) | `docs/ssot/session-pivot/PR02_PathB_SessionRail.md` | 이 문서 |

**7일 레일 변경: 0개** (`src/app/api/routine-*`, `src/lib/routine-engine.ts` 등 미변경)

---

## DB 스키마 요약

### `session_user_profile`
- 유저의 세션 프로그램 설정 (target_frequency, lifestyle_tag)
- PK: `user_id`

### `session_program_progress`
- 유저별 프로그램 진행 상태
- `total_sessions` (기본 8), `completed_sessions`, `active_session_number`
- PK: `user_id`

### `session_plans`
- 세션별 플랜 row
- 멱등 키: `UNIQUE(user_id, session_number)`
- `status`: `draft` → `started` → `completed`
- `plan_json`: 이번 PR은 stub (다음 PR에서 Deep Result 연결)

### RLS 정책
- 3개 테이블 모두 `RLS ON`
- SELECT: `auth.uid() = user_id` 본인만 조회 가능
- INSERT/UPDATE: **service role only** (클라이언트 direct write 차단)

---

## API Contract

### GET /api/session/active

```
Response 200 (active 없음):
{ active: null, progress: { ... } }

Response 200 (active 있음):
{ active: { id, user_id, session_number, status, theme, plan_json, ... }, progress: { ... } }
```

- progress가 없으면 자동 초기화 (total_sessions=8, completed=0)
- heavy compute 없음 (DB 조회만)

### POST /api/session/create

```
Request:
{ condition_mood: 'good'|'ok'|'bad', time_budget: 'short'|'normal', pain_flags?: string[], equipment?: string[] }

Response 200 (생성):
{ session: { ... }, progress: { ..., active_session_number: N }, idempotent: false }

Response 200 (멱등 — 이미 active):
{ session: { ... }, progress: { ... }, idempotent: true }

Response 200 (프로그램 완료):
{ done: true, completed_sessions: N, total_sessions: M }
```

멱등 보장:
- `active_session_number` 있으면 기존 세션 그대로 반환
- DB UPSERT: `UNIQUE(user_id, session_number)` ON CONFLICT

### POST /api/session/complete

```
Request:
{ session_number: number, duration_seconds: number, completion_mode: 'all_done'|'partial_done'|'stop_early' }

Response 200:
{
  success: true,
  idempotent: false,          // 이미 완료면 true
  session: { ..., status: 'completed', completed_at },
  progress: { completed_sessions: N, active_session_number: null },
  next_theme: 'core_stability'  // 다음 세션 테마만 (운동 리스트 예고 금지)
}
```

멱등 보장:
- `status='completed'`면 중복 처리 없이 동일 응답 반환 (idempotent: true)
- `completed_sessions = GREATEST(기존, session_number)`

---

## curl 예시 (Bearer 토큰 교체 후 사용)

```bash
TOKEN="YOUR_BEARER_TOKEN"
BASE="http://localhost:3000"

# 1) GET /api/session/active — active null
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/session/active" | jq .

# 2) POST /api/session/create (ok/short)
curl -s -X POST "$BASE/api/session/create" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"condition_mood":"ok","time_budget":"short"}' | jq .

# 3) GET /api/session/active — active session 반환 확인
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/session/active" | jq .

# 4) POST /api/session/create 재호출 — idempotent:true
curl -s -X POST "$BASE/api/session/create" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"condition_mood":"ok","time_budget":"short"}' | jq .

# 5) POST /api/session/complete
curl -s -X POST "$BASE/api/session/complete" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"session_number":1,"duration_seconds":600,"completion_mode":"all_done"}' | jq .
```

---

## Acceptance Tests

### A1) git diff 확인
기존 7일 경로 파일 변경 0개.
```
git diff main --name-only
```
예상 결과: `docs/`, `src/app/api/session/`, `supabase/migrations/20260303_session_pathB.sql` 만 표시.

### A2) 마이그레이션 새 파일만 추가
`supabase/migrations/` 기존 파일 수정 없음.

### A3) 시나리오 결과 (로컬 dev 환경 + 실제 DB 적용 후)
```
시나리오 1: GET /active → { active: null, progress: { total_sessions: 8, completed_sessions: 0 } }
시나리오 2: POST /create → { session: { session_number: 1, status: 'draft' }, progress: { active_session_number: 1 }, idempotent: false }
시나리오 3: GET /active → { active: { session_number: 1, status: 'draft', ... }, ... }
시나리오 4: POST /create (재호출) → { ..., idempotent: true }
시나리오 5: POST /complete → { completed_sessions: 1, active_session_number: null, next_theme: 'thoracic_mobility' }
```
※ 실제 실행 결과는 마이그레이션 적용(supabase db push) 후 확인 필요.

### A4) RLS 검증
service role로 다른 user_id row SELECT 시도:
```sql
-- 다른 user의 row를 auth.uid()가 다른 상태에서 SELECT → 0 rows
SELECT * FROM session_plans WHERE user_id = 'other-user-uuid';
-- → RLS에 의해 자기 row만 반환 (다른 uid의 row = 0)
```

### A5) 빌드 결과
`npm run build` 성공 (신규 API 3개 route 포함 정상 빌드 확인).

---

## Rollback 방법

1. `git revert` 이 PR 커밋
2. DB: 마이그레이션 미적용 환경에서는 `DROP TABLE IF EXISTS session_plans, session_program_progress, session_user_profile CASCADE;`
3. 기존 7일 레일은 이 PR과 독립이므로 rollback 시 영향 없음.

---

## 다음 PR 옵션 (3줄)

**Option A**: Deep Result 연결 — `session/create` stub plan generator를 실제 Deep V2 scoring 기반으로 교체  
**Option B**: Player UI 연결 — `/app/session/player` 페이지 신설 + `/api/session/active` 연결  
**Option C**: progress onboarding — 사용자 `total_sessions` 설정 화면 + `session_user_profile` 저장 흐름  

추천 순서: **A → C → B** (plan이 있어야 player가 의미 있음)
