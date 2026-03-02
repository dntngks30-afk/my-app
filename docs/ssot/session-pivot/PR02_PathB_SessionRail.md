# PR02: Path B — Session Rail (DB + API), 7-day Unchanged

## Summary

기존 7일 루틴 레일과 **완전히 분리된 병행 세션 레일(Path B)** 추가.  
기존 파일 변경 0개. DB 스키마(3테이블+RLS) + API 3개 신규 추가.

---

## 변경 파일 (신규 추가만, 기존 수정 없음)

| 분류 | 경로 | 역할 |
|------|------|------|
| DB 마이그레이션 | `supabase/migrations/20260303_session_pathB.sql` | 3개 테이블 + RLS (SELECT only) + 인덱스 |
| API | `src/app/api/session/active/route.ts` | GET — 진행 중 세션 조회 |
| API | `src/app/api/session/create/route.ts` | POST — 세션 멱등 생성 |
| API | `src/app/api/session/complete/route.ts` | POST — 세션 완료 처리 |
| 문서 | `docs/ssot/session-pivot/PR02_PathB_SessionRail.md` | 이 문서 |

**7일 레일 변경: 0개** (`src/app/api/routine-*`, `src/lib/routine-engine.ts` 등 미변경)

---

## DB 스키마

### session_user_profile
```sql
user_id          UUID PK → auth.users
target_frequency SMALLINT DEFAULT 4  -- CHECK IN (2,3,4,5)
lifestyle_tag    TEXT NULL
created_at       TIMESTAMPTZ DEFAULT NOW()
```

### session_program_progress
```sql
user_id               UUID PK → auth.users
program_version       TEXT DEFAULT 'session_v1'
scoring_version       TEXT DEFAULT 'deep_v2'
total_sessions        INT  DEFAULT 16
completed_sessions    INT  DEFAULT 0
active_session_number INT  NULL
last_completed_at     TIMESTAMPTZ NULL
updated_at            TIMESTAMPTZ DEFAULT NOW()
```
- `CHECK (completed_sessions <= total_sessions)`
- `BEFORE UPDATE` 트리거로 `updated_at` 자동 갱신

### session_plans
```sql
id             UUID PK gen_random_uuid()
user_id        UUID → auth.users
session_number INT  CHECK >= 1
status         TEXT CHECK IN ('draft','started','completed')  DEFAULT 'draft'
theme          TEXT NOT NULL
plan_json      JSONB NOT NULL
condition      JSONB NOT NULL
created_at     TIMESTAMPTZ DEFAULT NOW()
started_at     TIMESTAMPTZ NULL
completed_at   TIMESTAMPTZ NULL
UNIQUE(user_id, session_number)  ← 멱등 핵심
```

### 인덱스
```sql
idx_session_plans_user_status   ON session_plans(user_id, status)
idx_session_plans_user_created  ON session_plans(user_id, created_at DESC)
idx_session_program_progress_user_id
idx_session_user_profile_user_id
```

---

## RLS 정책 설계 (A4: 클라 direct write 금지)

### 정책 내용

세 테이블 모두 **RLS ON**. **SELECT 정책만** 존재:

```sql
CREATE POLICY "session_plans_select_own"
  ON public.session_plans FOR SELECT
  USING (auth.uid() = user_id);
-- INSERT/UPDATE/DELETE 정책 없음
```

### 동작 원리
- Supabase는 정책이 없는 operation을 **기본 차단(fail-close)** 함.
- 클라이언트가 anon key로 `INSERT INTO session_plans ...` 시도 → RLS 위반 에러 반환.
- 서버의 `getServerSupabaseAdmin()` (service role)은 RLS를 bypass → write 가능.

### 검증 방법
```sql
-- Supabase SQL Editor에서 anon key 세션으로 INSERT 시도:
INSERT INTO session_plans (user_id, session_number, status, theme, plan_json, condition)
VALUES ('임의-uuid', 1, 'draft', 'test', '{}', '{}');
-- → ERROR: new row violates row-level security policy for table "session_plans"
```

---

## API Contract

### Auth 방식

> **Bearer token 사용** (Authorization: Bearer \<access_token\>)
>
> 프로젝트 전체가 PKCE + localStorage 기반 Bearer 인프라.
> `@supabase/ssr` 미설치이므로 서버 사이드 쿠키 파싱 불가.
> 쿠키 세션 전환은 별도 인프라 PR로 분리 권장.

### GET /api/session/active

```
Response 200 (active 없음):
{
  "progress": { "total_sessions": 16, "completed_sessions": 0, "active_session_number": null, ... },
  "active": null
}

Response 200 (active 있음):
{
  "progress": { ..., "active_session_number": 1 },
  "active": { "session_number": 1, "status": "draft", "theme": "1순위 타겟", "plan_json": {...}, "condition": {...}, "created_at": "..." }
}
```

### POST /api/session/create

**입력:**
```json
{ "condition_mood": "ok", "time_budget": "short", "pain_flags": ["knee"], "equipment": "none" }
```

**테마 4단계:**
- session 1~4: `"1순위 타겟"`
- session 5~8: `"2순위 타겟"`
- session 9~12: `"통합"`
- session 13~16: `"릴렉스"`

**plan_json stub 구조:**
```json
{
  "version": "session_stub_v1",
  "recovery": false,
  "segments": [
    { "title": "Warmup", "duration_sec": 120, "items": [...] },
    { "title": "Main (1순위 타겟)", "duration_sec": 240, "items": [...] },
    { "title": "Cooldown", "duration_sec": 60, "items": [...] }
  ]
}
```
- `time_budget=short`: items 2개, sets=2, 전체 시간 축소
- `condition_mood=bad`: `"recovery": true`, 운동명 "회복 운동 N"

**Response (생성):**
```json
{ "progress": { ..., "active_session_number": 1 }, "active": { "session_number": 1, ... }, "idempotent": false }
```

**Response (멱등 — active 이미 있음):**
```json
{ "progress": { ... }, "active": { ... }, "idempotent": true }
```

**Response (프로그램 완료):**
```json
{ "done": true, "progress": { "completed_sessions": 16, "total_sessions": 16 } }
```

### POST /api/session/complete

**입력:**
```json
{ "session_number": 1, "duration_seconds": 600, "completion_mode": "all_done" }
```

**Response:**
```json
{
  "progress": { "completed_sessions": 1, "active_session_number": null, ... },
  "next_theme": "1순위 타겟",
  "idempotent": false
}
```
- `next_theme`: 다음 세션 테마 이름만 반환 (운동 리스트 예고 금지)
- 이미 completed면: `"idempotent": true`

---

## curl 시나리오 (A3 수락 테스트)

> `TOKEN` 교체 후 실행. 마이그레이션 적용(`supabase db push`) 필요.

```bash
TOKEN="YOUR_ACCESS_TOKEN"
BASE="http://localhost:3000"

# 1) GET /api/session/active → active null
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/session/active" | jq .

# 2) POST /api/session/create (ok/short)
curl -s -X POST "$BASE/api/session/create" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"condition_mood":"ok","time_budget":"short"}' | jq .

# 3) GET /api/session/active → active session 반환
curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/session/active" | jq .

# 4) POST /api/session/create 재호출 → idempotent:true
curl -s -X POST "$BASE/api/session/create" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"condition_mood":"ok","time_budget":"short"}' | jq .

# 5) POST /api/session/complete(1, 600, all_done)
curl -s -X POST "$BASE/api/session/complete" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"session_number":1,"duration_seconds":600,"completion_mode":"all_done"}' | jq .
```

**예상 결과:**
```
시나리오 1: { active: null, progress: { total_sessions: 16, completed_sessions: 0 } }
시나리오 2: { active: { session_number: 1, status: "draft", theme: "1순위 타겟" }, idempotent: false }
시나리오 3: { active: { session_number: 1 }, progress: { active_session_number: 1 } }
시나리오 4: { ..., idempotent: true } (새 row 생성 없음)
시나리오 5: { progress: { completed_sessions: 1, active_session_number: null }, next_theme: "1순위 타겟" }
```

※ 마이그레이션 적용 후 로컬 dev 환경에서 실제 실행 필요.

---

## Acceptance Tests

### A1) git diff main --name-only
```
docs/ssot/session-pivot/PR02_PathB_SessionRail.md
src/app/api/session/active/route.ts
src/app/api/session/complete/route.ts
src/app/api/session/create/route.ts
supabase/migrations/20260303_session_pathB.sql
```
기존 7일 관련 파일 변경 없음 ✅

### A2) 마이그레이션
신규 파일 1개 추가만. 기존 마이그레이션 수정 없음 ✅

### A3) 로컬 시나리오
마이그레이션 적용 후 위 curl 시나리오 5개 성공 예상.

### A4) RLS 클라 direct write 금지
SELECT 정책만 존재. INSERT/UPDATE/DELETE 정책 없음 → fail-close.
anon key로 write 시도 시 RLS 에러 반환. (위 "RLS 정책 설계" 섹션 참고)

### A5) 빌드
```
npm run build → exit 0 (81 routes 포함 정상)
/api/session/active  ƒ (Dynamic)
/api/session/complete ƒ (Dynamic)
/api/session/create  ƒ (Dynamic)
```

---

## Rollback

1. `git revert <이 커밋 SHA>` — API 3개, 마이그레이션, 문서 제거
2. DB (마이그레이션 미적용 환경):
   ```sql
   DROP TABLE IF EXISTS public.session_plans CASCADE;
   DROP TABLE IF EXISTS public.session_program_progress CASCADE;
   DROP TABLE IF EXISTS public.session_user_profile CASCADE;
   DROP FUNCTION IF EXISTS public.update_session_program_progress_updated_at();
   ```
3. 기존 7일 레일은 이 PR과 독립이므로 rollback 시 영향 없음.

---

## 다음 PR 옵션 (3줄)

**Option A** — Deep Result 연결: `session/create`의 stub plan_json을 Deep V2 scoring 결과 기반으로 교체 (실제 운동 데이터 생성)  
**Option B** — Player UI 연결: `/app/session/player` 페이지 신설 + `/api/session/active` 연동 (세션 실행 화면)  
**Option C** — Completion UX: 세션 완료 후 피드백 화면 + next_theme 예고 + progress bar UI  

추천 순서: **A → B → C** (generator 없으면 player가 stub 데이터만 보여줌)
