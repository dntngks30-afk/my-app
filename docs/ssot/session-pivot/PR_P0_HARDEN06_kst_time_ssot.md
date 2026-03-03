# P0: KST Time SSOT

## 원칙

- **서버 TZ와 무관**: `process.env.TZ`/로컬 타임존에 의존하지 않음.
- **순수 UTC+9 오프셋**: `nowUtcMs + 9h` 기반 계산. Intl 사용 금지.
- **단일 유틸**: `src/lib/time/kst.ts` — 라우트에서 직접 계산 금지.

## 함수 시그니처

| 함수 | 반환 | 용도 |
|------|------|------|
| `getKstDayKeyUTC(nowUtc?: Date)` | `string` 'YYYY-MM-DD' | KST 기준 day |
| `getNextKstMidnightUtcIso(nowUtc?: Date)` | `string` ISO | next_unlock_at |
| `isSameKstDay(dayKey, nowUtc?)` | `boolean` | day 비교 |
| `toKstDayKeyFromTimestamp(ts)` | `string` | completed_at → day_key |
| `getTodayCompletedAndNextUnlock(progress)` | `{ todayCompleted, nextUnlockAt }` | 라우트용 |

## 샘플 입력/출력

| nowUtc | day_key | next_unlock_at (다음 KST 자정 UTC) |
|--------|---------|-----------------------------------|
| 2026-03-04T14:59:59Z | 2026-03-04 | 2026-03-04T15:00:00.000Z |
| 2026-03-04T15:00:00Z | 2026-03-05 | 2026-03-05T15:00:00.000Z |

## 라우트 사용 규칙

- `todayCompleted`: `getTodayCompletedAndNextUnlock(progress)` 사용.
- `next_unlock_at`: `todayCompleted ? getNextKstMidnightUtcIso() : null`
- `day_key` (에러 meta): `getKstDayKeyUTC()`
- **직접 계산 금지**: `Intl`, `new Date().toLocaleString()`, 로컬 TZ 의존 금지.

## DB 정합성

- `last_completed_day_key`: DB trigger `(completed_at AT TIME ZONE 'Asia/Seoul')::date` → 'YYYY-MM-DD' 포맷.
- 코드 `getKstDayKeyUTC` / `toKstDayKeyFromTimestamp`와 비교 시 `String()` 변환으로 일치.

## Selftest 실행 (선택)

```bash
npx tsx scripts/kst-selftest.ts
```
