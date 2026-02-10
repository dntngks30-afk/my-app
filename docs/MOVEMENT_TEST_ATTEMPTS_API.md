# Movement Test Attempts API (PR2)

attempt 기반 저장/조회. 정본 테이블: `movement_test_attempts`.

## SQL 스키마

- 파일: `supabase-setup/create-movement-test-attempts-table.sql`
- 테이블: `movement_test_attempts` (id, user_id, scoring_version, share_id, main_type, sub_type, confidence, type_scores, imbalance_*, completed_at, view_count, created_at, updated_at)

---

## 1. POST /api/movement-test/save-result

항상 새 attempt insert. user_id는 Authorization Bearer 있으면 설정, 없으면 null.

**요청 예시**
```json
POST /api/movement-test/save-result
Authorization: Bearer <supabase_jwt>   // 선택, 있으면 user_id 저장

{
  "mainType": "담직",
  "subType": "담직-상체고착형",
  "confidence": 72,
  "typeScores": { "담직": 28, "날림": 12, "버팀": 8, "흘림": 6 },
  "imbalanceYesCount": 2,
  "imbalanceSeverity": "none",
  "biasMainType": null,
  "completedAt": "2026-02-10T12:00:00.000Z",
  "durationSeconds": 180
}
```

**응답 예시**
```json
{
  "success": true,
  "id": "uuid-of-attempt",
  "shareId": "ABC12XYZ",
  "shareUrl": "https://example.com/movement-test/shared/ABC12XYZ",
  "scoringVersion": "1.0"
}
```

---

## 2. GET /api/movement-test/get-latest-by-user

user_id 기준 최신 attempt 1개 반환. 인증 필수.

**요청 예시**
```
GET /api/movement-test/get-latest-by-user
Authorization: Bearer <supabase_jwt>
```

**응답 예시 (있을 때)**
```json
{
  "success": true,
  "result": {
    "id": "uuid",
    "shareId": "ABC12XYZ",
    "scoringVersion": "1.0",
    "mainType": "담직",
    "subType": "담직-상체고착형",
    "confidence": 72,
    "typeScores": { "담직": 28, "날림": 12, "버팀": 8, "흘림": 6 },
    "imbalanceSeverity": "none",
    "completedAt": "2026-02-10T12:00:00.000Z"
  }
}
```

**응답 예시 (없을 때)**
```json
{ "success": true, "result": null }
```

---

## 3. GET /api/movement-test/get-result/[shareId]

share_id로 attempt 조회. 공유용 최소 필드만 반환. 조회수 +1.

**요청 예시**
```
GET /api/movement-test/get-result/ABC12XYZ
```

**응답 예시**
```json
{
  "success": true,
  "result": {
    "shareId": "ABC12XYZ",
    "mainType": "담직",
    "subType": "담직-상체고착형",
    "confidence": 72,
    "typeScores": { "담직": 28, "날림": 12, "버팀": 8, "흘림": 6 },
    "imbalanceYesCount": 2,
    "imbalanceSeverity": "none",
    "biasMainType": null,
    "completedAt": "2026-02-10T12:00:00.000Z",
    "viewCount": 3
  }
}
```

---

## 4. GET/POST /api/movement-test/retest

재검사 가능 여부/시작. 마지막 attempt 기준으로 7일 경과 여부 확인.

- GET: `canRetest`, `lastTestId`, `lastTestDate` 등 반환
- POST: 재검사 시작 가능 시 `originalTestId`, `originalTestDate` 반환

테이블: `movement_test_attempts` (user_id, completed_at 기준 최신 1건 사용).

---

## 검증

1. Supabase SQL Editor에서 `create-movement-test-attempts-table.sql` 실행
2. `pnpm run build` 통과
3. save-result 호출 후 get-latest-by-user로 동일 user_id의 최신 attempt 확인 (Authorization 동일 시)
