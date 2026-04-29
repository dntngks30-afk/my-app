/**
 * Journey 리셋맵 진행도 정규화 스모크 (네트워크 없음)
 */
import assert from 'node:assert/strict';

function normalizeJourneyResetMapProgress(input) {
  const totalRaw = input.total;
  const total =
    totalRaw != null && Number.isFinite(Number(totalRaw)) && Number(totalRaw) > 0
      ? Math.floor(Number(totalRaw))
      : null;

  if (total == null || total <= 0) {
    return {
      empty: true,
      totalSessions: 0,
      completedSafe: 0,
      pct: 0,
    };
  }

  const completedRaw = input.completed;
  const completed =
    completedRaw != null && Number.isFinite(Number(completedRaw))
      ? Math.max(0, Math.floor(Number(completedRaw)))
      : 0;
  const completedSafe = Math.min(completed, total);
  const pct = Math.min(100, Math.round((completedSafe / total) * 100));

  return {
    empty: false,
    totalSessions: total,
    completedSafe,
    pct,
  };
}

function main() {
  let r = normalizeJourneyResetMapProgress({ total: 8, completed: 0 });
  assert.equal(r.empty, false);
  assert.equal(r.totalSessions, 8);
  assert.equal(r.completedSafe, 0);
  assert.equal(r.pct, 0);

  r = normalizeJourneyResetMapProgress({ total: 8, completed: 2 });
  assert.equal(r.totalSessions, 8);
  assert.equal(r.completedSafe, 2);
  assert.equal(r.pct, 25);

  r = normalizeJourneyResetMapProgress({ total: 12, completed: 6 });
  assert.equal(r.pct, 50);

  r = normalizeJourneyResetMapProgress({ total: 16, completed: 20 });
  assert.equal(r.completedSafe, 16);
  assert.equal(r.pct, 100);

  r = normalizeJourneyResetMapProgress({ total: null, completed: 0 });
  assert.equal(r.empty, true);
  assert.equal(r.totalSessions, 0);

  r = normalizeJourneyResetMapProgress({ total: undefined, completed: 0 });
  assert.equal(r.empty, true);

  r = normalizeJourneyResetMapProgress({ total: 0, completed: 0 });
  assert.equal(r.empty, true);

  console.log('journey-reset-map-total-smoke: PASS');
}

main();
