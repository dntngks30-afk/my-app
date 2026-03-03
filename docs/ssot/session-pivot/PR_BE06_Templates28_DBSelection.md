# BE-06: exercise_templates(28) 기반 세션 플랜 생성

## 목적

`/api/session/create`가 stub 대신 `public.exercise_templates` (28개)를 조회해
실제 템플릿 기반 plan_json을 생성합니다.

---

## 데이터 소스

| 항목 | 값 |
|------|-----|
| 테이블 | `public.exercise_templates` |
| 마이그레이션 | `supabase/migrations/202602281200_exercise_templates.sql` |
| 조회 | `getTemplatesForSessionPlan()` (limit 60, scoring_version='deep_v2') |

---

## 필터 / 스코어링 / 반복방지 / 안전게이트

### Safety Gate

- `meta.avoid` + `pain_flags` → `buildExcludeSet()` → Set
- `contraindications` 중 하나라도 Set에 있으면 **제외** (-100)

### Repetition Penalty

- 직전 세션 `plan_json.meta.used_template_ids` 또는 `items[].templateId` 플랫튼
- `used_template_ids`에 포함된 template → **-100**

### 스코어링

| 항목 | 점수 |
|------|------|
| primary focus 포함 | +3 |
| secondary focus 포함 | +2 |
| short + duration_sec ≤ 420 | +1 |
| level 목표 일치 | +1 |
| 직전 사용 | -100 |
| contraindication 겹침 | -100 |

### Phase별 focus

- Phase 1: primary = focus[0]
- Phase 2: secondary = focus[1] or focus[0]
- Phase 3/4: 동일 스코어링, focus 우선순위만 반영

### 선택 개수

- short: Prep 1, Main 1~2, Release 1 (총 3~4)
- normal: Prep 1, Main 2~3, Release 1 (총 4)
- mood=bad: 회복형(level 1, 낮은 contraindications) 우선

---

## 예시 출력 (item에 template_id 포함)

```json
{
  "version": "session_plan_v1",
  "meta": {
    "session_number": 1,
    "phase": 1,
    "used_template_ids": ["M01", "M03", "M12", "M18"]
  },
  "flags": { "recovery": false, "short": true },
  "segments": [
    {
      "title": "Prep",
      "duration_sec": 120,
      "items": [
        { "order": 1, "templateId": "M01", "name": "90/90 벽 호흡", "sets": 2, "reps": 12, "focus_tag": "full_body_reset" }
      ]
    },
    {
      "title": "Main",
      "duration_sec": 240,
      "items": [
        { "order": 1, "templateId": "M03", "name": "턱 당기기", "sets": 2, "reps": 12 },
        { "order": 2, "templateId": "M12", "name": "글루트 브릿지", "sets": 2, "reps": 12 }
      ]
    },
    {
      "title": "Release",
      "duration_sec": 60,
      "items": [
        { "order": 1, "templateId": "M18", "name": "숏풋 / 트라이포드 풋", "sets": 1, "hold_seconds": 30 }
      ]
    }
  ]
}
```

---

## 변경 파일

| 파일 | 변경 |
|------|------|
| `src/app/api/session/create/route.ts` | plan-generator 호출, used_template_ids 로드 |
| `src/lib/session/plan-generator.ts` | 신규 |
| `src/lib/session/phase.ts` | 신규 |
| `src/lib/session/safety.ts` | 신규 |
| `src/lib/workout-routine/exercise-templates-db.ts` | getTemplatesForSessionPlan 추가 |

---

## media_ref

- 이번 PR: `items[].media_ref`를 그대로 포함하거나 null
- sign 미호출. 다음 PR에서 accordion 펼칠 때 `/api/exercise-template/media`로 sign
