/**
 * PR1-B: claimedAt / createdAt deterministic timing law regression.
 *
 * Run:
 *   npx tsx scripts/claimed-public-result-selection-timing-law-regression.mjs
 */

const {
  compareByDeterministicSelectionTimingLaw,
  rankClaimedRowsForExecution,
} = await import('../src/lib/public-results/claimed-result-selection-policy.ts');

let passed = 0;
let failed = 0;

function ok(name, cond) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

function row({ id, stage = 'baseline', claimedAt, createdAt }) {
  return {
    id,
    user_id: 'u1',
    result_stage: stage,
    result_v2_json: {},
    claimed_at: claimedAt,
    created_at: createdAt,
  };
}

console.log('\n--- PR1-B Timing Law Regression ---');

// 1) same-stage, claimedAt different
{
  const olderClaimed = row({
    id: 'a',
    stage: 'baseline',
    claimedAt: '2026-04-10T00:00:00.000Z',
    createdAt: '2026-04-09T00:00:00.000Z',
  });
  const newerClaimed = row({
    id: 'b',
    stage: 'baseline',
    claimedAt: '2026-04-11T00:00:00.000Z',
    createdAt: '2026-04-01T00:00:00.000Z',
  });

  const sorted = [olderClaimed, newerClaimed].sort(compareByDeterministicSelectionTimingLaw);
  ok('1. same-stage: newer claimedAt wins', sorted[0].id === 'b');
}

// 2) same-stage, claimedAt equal, createdAt different
{
  const olderCreated = row({
    id: 'a',
    stage: 'baseline',
    claimedAt: '2026-04-11T00:00:00.000Z',
    createdAt: '2026-04-01T00:00:00.000Z',
  });
  const newerCreated = row({
    id: 'b',
    stage: 'baseline',
    claimedAt: '2026-04-11T00:00:00.000Z',
    createdAt: '2026-04-03T00:00:00.000Z',
  });

  const sorted = [olderCreated, newerCreated].sort(compareByDeterministicSelectionTimingLaw);
  ok('2. same-stage: tied claimedAt -> newer createdAt wins', sorted[0].id === 'b');
}

// 3) same-stage, claimedAt equal, createdAt equal
{
  const alpha = row({
    id: 'a',
    stage: 'baseline',
    claimedAt: '2026-04-11T00:00:00.000Z',
    createdAt: '2026-04-03T00:00:00.000Z',
  });
  const beta = row({
    id: 'b',
    stage: 'baseline',
    claimedAt: '2026-04-11T00:00:00.000Z',
    createdAt: '2026-04-03T00:00:00.000Z',
  });

  const sorted = [alpha, beta].sort(compareByDeterministicSelectionTimingLaw);
  ok('3. same-stage: tied claimedAt/createdAt -> stable final id key wins', sorted[0].id === 'b');
}

// 4) after PR1-A currentness bucket resolves, timing tie still applies
{
  const refinedOld = row({
    id: 'r-old',
    stage: 'refined',
    claimedAt: '2026-04-10T00:00:00.000Z',
    createdAt: '2026-04-09T00:00:00.000Z',
  });
  const refinedNew = row({
    id: 'r-new',
    stage: 'refined',
    claimedAt: '2026-04-11T00:00:00.000Z',
    createdAt: '2026-04-01T00:00:00.000Z',
  });
  // baseline only 1 day newer than refined best => within PR1-A window, refined bucket stays first
  const baselineFreshButWithinWindow = row({
    id: 'b-fresh',
    stage: 'baseline',
    claimedAt: '2026-04-12T00:00:00.000Z',
    createdAt: '2026-04-12T00:00:00.000Z',
  });

  const { ranked, policy } = rankClaimedRowsForExecution([
    refinedOld,
    refinedNew,
    baselineFreshButWithinWindow,
  ]);

  ok('4-a. PR1-A window kept: refined_within_window', policy.appliedStagePriority === 'refined_within_window');
  ok('4-b. timing tie-break works inside winning refined bucket', ranked[0].id === 'r-new');
}

// 5) late-claimed older analysis remains explainable (claimedAt priority over createdAt)
{
  const olderAnalysisButLateClaimed = row({
    id: 'late-claimed',
    stage: 'baseline',
    claimedAt: '2026-04-12T00:00:00.000Z',
    createdAt: '2026-03-01T00:00:00.000Z',
  });
  const newerAnalysisButEarlierClaimed = row({
    id: 'new-analysis-early-claim',
    stage: 'baseline',
    claimedAt: '2026-04-10T00:00:00.000Z',
    createdAt: '2026-04-09T00:00:00.000Z',
  });

  const sorted = [olderAnalysisButLateClaimed, newerAnalysisButEarlierClaimed].sort(
    compareByDeterministicSelectionTimingLaw
  );

  ok('5. late-claimed older analysis can win by claimedAt (execution recency preserved)', sorted[0].id === 'late-claimed');
}

// 6) no valid candidate surface: ranker remains empty (loader keeps null/fallback behavior)
{
  const { ranked, policy } = rankClaimedRowsForExecution([]);
  ok('6-a. empty candidates remain empty', ranked.length === 0);
  ok('6-b. empty candidates keep single_stage_only policy snapshot', policy.appliedStagePriority === 'single_stage_only');
}

console.log('\n--- Summary ---');
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
