/**
 * PR1-C: execution suitability selection gate regression.
 *
 * Run:
 *   npx tsx scripts/claimed-public-result-selection-suitability-regression.mjs
 */

const { rankClaimedRowsForExecution } = await import(
  '../src/lib/public-results/claimed-result-selection-policy.ts'
);

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

function resultPayload({ evidenceLevel = 'partial', missingSignals = [] } = {}) {
  return {
    primary_type: 'STABLE',
    secondary_type: null,
    priority_vector: null,
    pain_mode: null,
    confidence: 0.7,
    evidence_level: evidenceLevel,
    source_mode: 'free_survey',
    missing_signals: missingSignals,
    reason_codes: ['stub'],
    summary_copy: 'stub',
  };
}

function row({ id, stage = 'baseline', claimedAt, createdAt, evidenceLevel, missingSignals }) {
  return {
    id,
    user_id: 'u1',
    result_stage: stage,
    result_v2_json: resultPayload({ evidenceLevel, missingSignals }),
    claimed_at: claimedAt,
    created_at: createdAt,
  };
}

console.log('\n--- PR1-C Suitability Gate Regression ---');

// 1) two valid candidates, timing-close, one more execution-suitable -> suitable wins
{
  const liteWinnerByTiming = row({
    id: 'lite-new',
    stage: 'refined',
    claimedAt: '2026-04-11T10:00:00.000Z',
    createdAt: '2026-04-11T10:00:00.000Z',
    evidenceLevel: 'lite',
    missingSignals: ['s1', 's2'],
  });
  const partialSlightlyOlder = row({
    id: 'partial-old',
    stage: 'refined',
    claimedAt: '2026-04-11T09:00:00.000Z',
    createdAt: '2026-04-11T09:00:00.000Z',
    evidenceLevel: 'partial',
    missingSignals: [],
  });

  const { ranked, policy } = rankClaimedRowsForExecution([liteWinnerByTiming, partialSlightlyOlder]);
  ok('1-a. timing-close suitability winner selected', ranked[0]?.id === 'partial-old');
  ok('1-b. suitability trace says applied', policy.suitabilityPolicy.applied === true);
}

// 2) clearly fresher current truth exists -> suitability must not override PR1-A freshness
{
  const staleRefinedFull = row({
    id: 'stale-refined',
    stage: 'refined',
    claimedAt: '2026-04-01T00:00:00.000Z',
    createdAt: '2026-04-01T00:00:00.000Z',
    evidenceLevel: 'full',
    missingSignals: [],
  });
  const freshBaselineLite = row({
    id: 'fresh-baseline',
    stage: 'baseline',
    claimedAt: '2026-04-10T00:00:00.000Z',
    createdAt: '2026-04-10T00:00:00.000Z',
    evidenceLevel: 'lite',
    missingSignals: ['s1'],
  });

  const { ranked, policy } = rankClaimedRowsForExecution([staleRefinedFull, freshBaselineLite]);
  ok('2-a. PR1-A freshness override still wins', ranked[0]?.id === 'fresh-baseline');
  ok('2-b. stage priority indicates baseline override', policy.appliedStagePriority === 'baseline_overrides_stale_refined');
}

// 3) parseable but less suitable candidate is deterministically demoted
{
  const lessSuitable = row({
    id: 'less-suitable',
    stage: 'baseline',
    claimedAt: '2026-04-12T10:00:00.000Z',
    createdAt: '2026-04-12T10:00:00.000Z',
    evidenceLevel: 'lite',
    missingSignals: ['a', 'b', 'c'],
  });
  const moreSuitable = row({
    id: 'more-suitable',
    stage: 'baseline',
    claimedAt: '2026-04-12T08:30:00.000Z',
    createdAt: '2026-04-12T08:30:00.000Z',
    evidenceLevel: 'partial',
    missingSignals: [],
  });

  const { ranked } = rankClaimedRowsForExecution([lessSuitable, moreSuitable]);
  ok('3. less suitable parseable candidate is demoted', ranked[0]?.id === 'more-suitable');
}

// 4) suitability tie -> deterministic PR1-B timing law decides
{
  const a = row({
    id: 'a',
    stage: 'baseline',
    claimedAt: '2026-04-13T10:00:00.000Z',
    createdAt: '2026-04-13T09:00:00.000Z',
    evidenceLevel: 'partial',
    missingSignals: ['x'],
  });
  const b = row({
    id: 'b',
    stage: 'baseline',
    claimedAt: '2026-04-13T11:00:00.000Z',
    createdAt: '2026-04-13T08:00:00.000Z',
    evidenceLevel: 'partial',
    missingSignals: ['x'],
  });

  const { ranked, policy } = rankClaimedRowsForExecution([a, b]);
  ok('4-a. timing law winner remains top when suitability tie', ranked[0]?.id === 'b');
  ok('4-b. suitability not applied when no improvement exists', policy.suitabilityPolicy.applied === false);
}

// 5) no additional suitable candidate beyond valid set refinement -> still one winner or null contract
{
  const single = row({
    id: 'only-one',
    stage: 'baseline',
    claimedAt: '2026-04-14T00:00:00.000Z',
    createdAt: '2026-04-14T00:00:00.000Z',
    evidenceLevel: 'lite',
    missingSignals: ['m'],
  });
  const one = rankClaimedRowsForExecution([single]);
  const none = rankClaimedRowsForExecution([]);
  ok('5-a. one candidate -> one winner', one.ranked.length === 1 && one.ranked[0]?.id === 'only-one');
  ok('5-b. no candidate -> empty ranked set (loader null/fallback path intact)', none.ranked.length === 0);
}

// 6) PR1-A/PR1-B preserved (fresh baseline override + deterministic claimedAt tie-break)
{
  const staleRefined = row({
    id: 'refined-old',
    stage: 'refined',
    claimedAt: '2026-04-01T00:00:00.000Z',
    createdAt: '2026-04-01T00:00:00.000Z',
    evidenceLevel: 'full',
    missingSignals: [],
  });
  const freshBaseline = row({
    id: 'baseline-fresh',
    stage: 'baseline',
    claimedAt: '2026-04-08T00:00:00.000Z',
    createdAt: '2026-04-08T00:00:00.000Z',
    evidenceLevel: 'lite',
    missingSignals: ['m'],
  });
  const baselineTieA = row({
    id: 'baseline-a',
    stage: 'baseline',
    claimedAt: '2026-04-08T01:00:00.000Z',
    createdAt: '2026-04-08T01:00:00.000Z',
    evidenceLevel: 'partial',
    missingSignals: [],
  });

  const { ranked } = rankClaimedRowsForExecution([staleRefined, freshBaseline, baselineTieA]);
  ok('6-a. stale refined vs fresh baseline correction preserved', ranked[0]?.id === 'baseline-a');
  ok('6-b. claimedAt tie-break order remains deterministic in winning bucket', ranked[1]?.id === 'baseline-fresh');
}

console.log('\n--- Summary ---');
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
