# PR04: BE-04 — condition×time matrix (plan_json only)

## 목적

`/api/session/create`의 `plan_json` 내용을 `condition_mood` × `time_budget` 매트릭스에 따라 조정.
**plan_json만 변경**. DB 마이그레이션 없음. 템플릿 대량 fetch 없음. media sign 없음.

---

## 매트릭스 4케이스 요약

| condition_mood | time_budget | Prep | Main | Release | flags |
|----------------|-------------|------|------|---------|-------|
| ok | normal | 2 items, 1 set | 3 items, 3 sets, 12 reps | 1 item, 30s | short:false, recovery:false |
| ok | short | 1 item, 1 set | 2 items, 2 sets, 10 reps | 1 item, 30s | short:true, recovery:false |
| good | normal | 2 items | 3 items, **4 sets, 14 reps** | 1 item | short:false, recovery:false |
| good | short | 1 item | 2 items, 2 sets | 1 item | short:true, recovery:false |
| bad | normal | 2 items (mobility/breath) | 2 items (mobility/core), 1 set, 6 reps | 1 item, 20s | recovery:true |
| bad | short | 1 item | 1 item (core), 1 set | 1 item, 20s | short:true, recovery:true |

---

## 예시 plan_json (ok/short)

```json
{
  "version": "session_stub_v3",
  "meta": {
    "session_number": 1,
    "phase": 1,
    "result_type": "LOWER-LIMB",
    "confidence": 0.72,
    "focus": ["glute_activation", "lower_chain_stability"],
    "avoid": ["knee_load"],
    "scoring_version": "deep_v2"
  },
  "flags": { "short": true, "recovery": false },
  "segments": [
    {
      "title": "Prep",
      "duration_sec": 90,
      "items": [
        { "key": "prep_1", "order": 1, "templateId": "stub_prep_1", "name": "준비 1", "kind": "warmup", "sets": 1, "reps": 10 }
      ]
    },
    {
      "title": "Main",
      "duration_sec": 180,
      "items": [
        { "key": "main_1", "order": 1, "templateId": "stub_main_p1_1", "name": "Phase 1 · glute_activation 안정화 1", "kind": "strength", "sets": 2, "reps": 10, "focus_tag": "glute_activation" },
        { "key": "main_2", "order": 2, "templateId": "stub_main_p1_2", "name": "Phase 1 · glute_activation 안정화 2", "kind": "strength", "sets": 2, "reps": 10, "focus_tag": "lower_chain_stability" }
      ]
    },
    {
      "title": "Release",
      "duration_sec": 45,
      "items": [
        { "key": "release_1", "order": 1, "templateId": "stub_release_1", "name": "이완 1", "kind": "release", "sets": 1, "hold_seconds": 30 }
      ]
    }
  ]
}
```

---

## 예시 plan_json (bad/short, recovery)

```json
{
  "version": "session_stub_v3",
  "meta": { "session_number": 1, "phase": 1, "result_type": "LOWER-LIMB", "confidence": 0.72, "focus": [], "avoid": [], "scoring_version": "deep_v2" },
  "flags": { "short": true, "recovery": true },
  "segments": [
    {
      "title": "Prep",
      "duration_sec": 90,
      "items": [
        { "key": "prep_1", "order": 1, "templateId": "stub_prep_1", "name": "호흡·이완 1", "kind": "mobility", "sets": 1, "reps": 6, "notes": "회복 모드" }
      ]
    },
    {
      "title": "Main",
      "duration_sec": 180,
      "items": [
        { "key": "main_1", "order": 1, "templateId": "stub_main_p1_1", "name": "회복 운동 1", "kind": "core", "sets": 1, "reps": 6, "notes": "회복 모드" }
      ]
    },
    {
      "title": "Release",
      "duration_sec": 45,
      "items": [
        { "key": "release_1", "order": 1, "templateId": "stub_release_1", "name": "이완 1", "kind": "release", "sets": 1, "hold_seconds": 20, "notes": "회복 모드" }
      ]
    }
  ]
}
```

---

## 멱등성 (Idempotency)

`progress.active_session_number`가 이미 있으면 **기존 plan을 그대로 반환**.  
매트릭스 재계산 없음. 동일한 `session_number`, 동일한 `plan_json`.

```bash
# 1) create (ok/short) → active 생성
curl -s -X POST "$BASE/api/session/create" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"condition_mood":"ok","time_budget":"short"}' | jq '.active.session_number, .idempotent'

# 2) create 재호출 → 동일 plan 반환
curl -s -X POST "$BASE/api/session/create" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"condition_mood":"good","time_budget":"normal"}' | jq '.idempotent, .active.plan_json.flags'
# 예상: idempotent: true, plan_json은 1)과 동일
```

---

## 금지 사항 (No heavy work)

- DB 마이그레이션 없음
- `exercise_templates` 테이블 접근 없음
- `/api/media/sign` 호출 없음
- `calculateDeepV2` / `extendDeepV2` 재호출 없음 (Deep 요약은 PR03에서 로드)
- plan_json만 변경

---

## 변경 파일

| 파일 | 변경 |
|------|------|
| `src/app/api/session/create/route.ts` | `buildStubPlanJsonV2` → condition×time matrix 적용, version=`session_stub_v3` |
| `docs/ssot/session-pivot/PR04_ConditionTime_Matrix.md` | 이 문서 |

7일/UI 파일: 변경 0개.
