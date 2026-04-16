import assert from 'node:assert/strict';
import { rankClaimedRowsForExecution } from '../src/lib/public-results/claimed-result-selection-policy';

const VALID_RESULT = {
  schema_version: 'deep_result_v2',
  generated_at: '2026-01-01T00:00:00.000Z',
  user_input: { pain_level: 0, exercise_days_per_week: 3, session_minutes: 20 },
  summary: { body_type: 'stability', confidence: 0.8, reasons: [] },
  scores: { mobility: 0.4, stability: 0.8, symmetry: 0.7 },
  focus: {
    primary: 'stability',
    secondary: [],
    caution: [],
    strategy: 'main',
  },
  recommendations: { exercises: [], routine_goal: 'goal' },
};

function row({
  id,
  stage,
  claimedAt,
  createdAt,
  result = VALID_RESULT,
}: {
  id: string;
  stage: string;
  claimedAt: string;
  createdAt?: string;
  result?: unknown;
}) {
  return {
    id,
    user_id: 'u1',
    result_stage: stage,
    claimed_at: claimedAt,
    created_at: createdAt ?? claimedAt,
    result_v2_json: result,
  };
}

function run() {
  // 1) older refined vs much newer baseline => baseline wins
  {
    const refinedOld = row({
      id: 'r-old',
      stage: 'refined',
      claimedAt: '2026-04-01T00:00:00.000Z',
    });
    const baselineNew = row({
      id: 'b-new',
      stage: 'baseline',
      claimedAt: '2026-04-10T00:00:00.000Z',
    });
    const { ranked, policy } = rankClaimedRowsForExecution([refinedOld, baselineNew]);
    assert.equal(ranked[0]?.id, 'b-new');
    assert.equal(policy.appliedStagePriority, 'baseline_overrides_stale_refined');
  }

  // 2) recent refined vs slightly newer baseline => refined can still win
  {
    const refinedRecent = row({
      id: 'r-recent',
      stage: 'refined',
      claimedAt: '2026-04-10T00:00:00.000Z',
    });
    const baselineSlightlyNewer = row({
      id: 'b-slight',
      stage: 'baseline',
      claimedAt: '2026-04-11T00:00:00.000Z',
    });
    const { ranked, policy } = rankClaimedRowsForExecution([refinedRecent, baselineSlightlyNewer]);
    assert.equal(ranked[0]?.id, 'r-recent');
    assert.equal(policy.appliedStagePriority, 'refined_within_window');
  }

  // 3) same-stage deterministic ordering
  {
    const b1 = row({
      id: 'b1',
      stage: 'baseline',
      claimedAt: '2026-04-10T00:00:00.000Z',
      createdAt: '2026-04-10T00:00:00.000Z',
    });
    const b2 = row({
      id: 'b2',
      stage: 'baseline',
      claimedAt: '2026-04-10T00:00:00.000Z',
      createdAt: '2026-04-10T00:00:01.000Z',
    });
    const { ranked } = rankClaimedRowsForExecution([b1, b2]);
    assert.deepEqual(
      ranked.map((r) => r.id),
      ['b2', 'b1']
    );
  }

  // 4) no claimed candidate => empty ranking
  {
    const { ranked, policy } = rankClaimedRowsForExecution([]);
    assert.equal(ranked.length, 0);
    assert.equal(policy.appliedStagePriority, 'single_stage_only');
  }

  // 5) invalid row skip remains possible because unknown stage is ranked last
  {
    const unknown = row({
      id: 'x-unknown',
      stage: 'invalid-stage',
      claimedAt: '2026-04-12T00:00:00.000Z',
    });
    const baseline = row({
      id: 'b-valid',
      stage: 'baseline',
      claimedAt: '2026-04-11T00:00:00.000Z',
    });
    const { ranked } = rankClaimedRowsForExecution([unknown, baseline]);
    assert.equal(ranked[0]?.id, 'b-valid');
    assert.equal(ranked[1]?.id, 'x-unknown');
  }

  console.log('public-result-selection-pr1a-unit: ok');
}

run();
