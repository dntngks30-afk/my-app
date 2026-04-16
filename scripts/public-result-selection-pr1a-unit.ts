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
  function selectWinnerForExecutionTruth(
    rows: ReturnType<typeof row>[],
    validResultRowIds: Set<string>
  ): ReturnType<typeof row> | null {
    const validCandidates = rows.filter(
      (candidate) =>
        (candidate.result_stage === 'baseline' || candidate.result_stage === 'refined') &&
        validResultRowIds.has(candidate.id)
    );
    if (validCandidates.length === 0) return null;
    const { ranked } = rankClaimedRowsForExecution(validCandidates);
    return ranked[0] ?? null;
  }

  // 1) invalid latest refined + valid older refined + fresher valid baseline
  //    -> invalid refined must not pollute policy decision
  {
    const refinedInvalidLatest = row({
      id: 'r-invalid-latest',
      stage: 'refined',
      claimedAt: '2026-04-13T00:00:00.000Z',
    });
    const refinedOldValid = row({
      id: 'r-old',
      stage: 'refined',
      claimedAt: '2026-04-01T00:00:00.000Z',
    });
    const baselineNew = row({
      id: 'b-new',
      stage: 'baseline',
      claimedAt: '2026-04-10T00:00:00.000Z',
    });
    const winner = selectWinnerForExecutionTruth(
      [refinedInvalidLatest, refinedOldValid, baselineNew],
      new Set(['r-old', 'b-new'])
    );
    assert.equal(winner?.id, 'b-new');
  }

  // 2) invalid latest baseline + valid refined -> invalid baseline must not push out refined
  {
    const baselineInvalidLatest = row({
      id: 'b-invalid-latest',
      stage: 'baseline',
      claimedAt: '2026-04-14T00:00:00.000Z',
    });
    const refinedValid = row({
      id: 'r-valid',
      stage: 'refined',
      claimedAt: '2026-04-13T00:00:00.000Z',
    });
    const winner = selectWinnerForExecutionTruth(
      [baselineInvalidLatest, refinedValid],
      new Set(['r-valid'])
    );
    assert.equal(winner?.id, 'r-valid');
  }

  // 3) valid refined vs valid slightly newer baseline => refined can still win
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
    const winner = selectWinnerForExecutionTruth(
      [refinedRecent, baselineSlightlyNewer],
      new Set(['r-recent', 'b-slight'])
    );
    assert.equal(winner?.id, 'r-recent');
  }

  // 4) no valid claimed candidate => final null
  {
    const refinedInvalid = row({
      id: 'r-invalid',
      stage: 'refined',
      claimedAt: '2026-04-10T00:00:00.000Z',
    });
    const baselineInvalid = row({
      id: 'b-invalid',
      stage: 'baseline',
      claimedAt: '2026-04-11T00:00:00.000Z',
    });
    const winner = selectWinnerForExecutionTruth(
      [refinedInvalid, baselineInvalid],
      new Set<string>()
    );
    assert.equal(winner, null);
  }

  // 5) unknown stage row present -> must not pollute policy decision
  {
    const unknownStageLatest = row({
      id: 'x-unknown',
      stage: 'invalid-stage',
      claimedAt: '2026-04-12T00:00:00.000Z',
    });
    const refinedValid = row({
      id: 'r-valid-2',
      stage: 'refined',
      claimedAt: '2026-04-10T00:00:00.000Z',
    });
    const baselineValidMuchNewer = row({
      id: 'b-valid-2',
      stage: 'baseline',
      claimedAt: '2026-04-15T00:00:00.000Z',
    });
    const winner = selectWinnerForExecutionTruth(
      [unknownStageLatest, refinedValid, baselineValidMuchNewer],
      new Set(['r-valid-2', 'b-valid-2', 'x-unknown'])
    );
    assert.equal(winner?.id, 'b-valid-2');
  }

  console.log('public-result-selection-pr1a-unit: ok');
}

run();
