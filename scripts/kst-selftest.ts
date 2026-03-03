/**
 * KST 유틸 수동 검증. 실행: npx tsx scripts/kst-selftest.ts
 * CI 강제 없음.
 */

import { getKstDayKeyUTC, getNextKstMidnightUtcIso, isSameKstDay, toKstDayKeyFromTimestamp } from '../src/lib/time/kst';

const d1 = new Date('2026-03-04T14:59:59.000Z');
const d2 = new Date('2026-03-04T15:00:00.000Z');

console.assert(getKstDayKeyUTC(d1) === '2026-03-04', 'd1 day_key');
console.assert(getKstDayKeyUTC(d2) === '2026-03-05', 'd2 day_key');

const next1 = getNextKstMidnightUtcIso(d1);
console.assert(next1 === '2026-03-04T15:00:00.000Z', 'd1 next_unlock_at', next1);

const next2 = getNextKstMidnightUtcIso(d2);
console.assert(next2 === '2026-03-05T15:00:00.000Z', 'd2 next_unlock_at', next2);

console.assert(isSameKstDay('2026-03-04', d1), 'isSameKstDay true');
console.assert(!isSameKstDay('2026-03-05', d1), 'isSameKstDay false');

console.assert(toKstDayKeyFromTimestamp('2026-03-04T10:00:00Z') === '2026-03-04', 'toKstDayKeyFromTimestamp');

console.log('KST selftest PASS');
