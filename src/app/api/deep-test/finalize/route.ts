/**
 * POST /api/deep-test/finalize
 * draft → final 전환, 스코어 계산. scoring_version 따라 계산.
 * final이면 그대로 반환.
 * 성공 시 workout_routines 멱등 생성 (source=deep, source_id=attemptId)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { requireDeepAuth } from '@/lib/deep-test/auth';
import { calculateDeepV2, extendDeepV2 } from '@/lib/deep-test/scoring/deep_v2';
import { calculateDeepV3, resolveDeepScoringByVersion } from '@/lib/deep-test/scoring/deep_v3';
import { ensureDeepWorkoutRoutine, maskId } from '@/lib/deep-test/ensure-deep-routine';
import { seedDay1PlanIfRoutine } from '@/lib/deep-test/seed-day1';
import type { DeepAnswerValue } from '@/lib/deep-test/types';

const SOURCE = 'deep';

function toAttemptPayload(row: {
  id: string;
  user_id: string;
  status: string;
  scoring_version: string;
  answers: unknown;
  scores: unknown;
  result_type: string | null;
  confidence: number | null;
  created_at: string;
  updated_at: string;
  finalized_at: string | null;
}) {
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    scoringVersion: row.scoring_version,
    answers: row.answers ?? {},
    scores: row.scores,
    resultType: row.result_type,
    confidence: row.confidence,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    finalizedAt: row.finalized_at,
  };
}

export async function POST(req: NextRequest) {
  const auth = await requireDeepAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth;

  const body = await req.json().catch(() => ({}));
  const { attemptId } = body;

  if (!attemptId) {
    return NextResponse.json(
      { error: 'attemptId媛 ?꾩슂?⑸땲??' },
      { status: 400 }
    );
  }

  const supabase = getServerSupabaseAdmin();

  const { data: attempt, error: fetchError } = await supabase
    .from('deep_test_attempts')
    .select('*')
    .eq('id', attemptId)
    .eq('user_id', userId)
    .single();

  if (fetchError || !attempt) {
    return NextResponse.json(
      { error: 'attempt瑜?李얠쓣 ???놁뒿?덈떎.' },
      { status: 404 }
    );
  }

  if (attempt.status === 'final') {
    let routineCreated = false;
    try {
      const { routineId, created } = await ensureDeepWorkoutRoutine(
        supabase,
        userId,
        attemptId
      );
      routineCreated = created;
      console.log('[DEEP_FINALIZE]', {
        user: maskId(userId),
        attemptId: maskId(attemptId),
        routine: maskId(routineId),
        created,
      });
      if (routineId) await seedDay1PlanIfRoutine(supabase, routineId, userId);
    } catch (err) {
      console.warn('[DEEP_FINALIZE_ROUTINE_FAIL]', {
        user: maskId(userId),
        attemptId: maskId(attemptId),
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return NextResponse.json({
      source: SOURCE,
      scoring_version: attempt.scoring_version,
      result: {
        scores: attempt.scores,
        result_type: attempt.result_type,
        confidence: attempt.confidence,
      },
      attempt: toAttemptPayload(attempt),
      routineCreated,
    });
  }

  const scoringVersion = attempt.scoring_version ?? 'deep_v2';
  if (scoringVersion !== 'deep_v2' && scoringVersion !== 'deep_v3') {
    return NextResponse.json(
      { error: 'deep_v1은 더 이상 지원되지 않습니다. deep_v2 또는 deep_v3를 사용해 주세요.' },
      { status: 410 }
    );
  }

  const answers = (attempt.answers ?? {}) as Record<string, DeepAnswerValue>;
  const now = new Date().toISOString();

  const { useV3, v3Result } = resolveDeepScoringByVersion(scoringVersion, answers);

  let scoresPayload: Record<string, unknown>;
  let resultType: string;
  let resultConfidence: number;
  let resultPayload: Record<string, unknown>;

  if (useV3 && v3Result) {
    const { derived } = v3Result;
    scoresPayload = {
      objectiveScores: v3Result.objectiveScores,
      finalScores: v3Result.finalScores,
      primaryFocus: v3Result.primaryFocus,
      secondaryFocus: v3Result.secondaryFocus,
      answeredCount: v3Result.answeredCount,
      totalCount: v3Result.totalCount,
      derived: {
        ...derived,
        result_type: derived.result_type,
        primaryFocus: derived.primaryFocus,
        secondaryFocus: derived.secondaryFocus,
        level: derived.level,
        focus_tags: derived.focus_tags,
        avoid_tags: derived.avoid_tags,
        algorithm_scores: derived.algorithm_scores,
        primary_type: v3Result.primary_type,
        secondary_type: v3Result.secondary_type,
        priority_vector: derived.priority_vector,
        pain_mode: derived.pain_mode,
      },
    };
    resultType = v3Result.result_type;
    resultConfidence = v3Result.confidence;
    resultPayload = {
      result_type: v3Result.result_type,
      primaryFocus: v3Result.primaryFocus,
      secondaryFocus: v3Result.secondaryFocus,
      objectiveScores: v3Result.objectiveScores,
      finalScores: v3Result.finalScores,
      confidence: v3Result.confidence,
      answeredCount: v3Result.answeredCount,
      totalCount: v3Result.totalCount,
    };
  } else {
    const v2Result = calculateDeepV2(answers);
    const extended = extendDeepV2(v2Result);
    scoresPayload = {
      objectiveScores: v2Result.objectiveScores,
      finalScores: v2Result.finalScores,
      primaryFocus: v2Result.primaryFocus,
      secondaryFocus: v2Result.secondaryFocus,
      answeredCount: v2Result.answeredCount,
      totalCount: v2Result.totalCount,
      derived: extended,
    };
    resultType = v2Result.result_type;
    resultConfidence = v2Result.confidence;
    resultPayload = {
      result_type: v2Result.result_type,
      primaryFocus: v2Result.primaryFocus,
      secondaryFocus: v2Result.secondaryFocus,
      objectiveScores: v2Result.objectiveScores,
      finalScores: v2Result.finalScores,
      confidence: v2Result.confidence,
      answeredCount: v2Result.answeredCount,
      totalCount: v2Result.totalCount,
    };
  }

  const { data: updated, error: updateError } = await supabase
    .from('deep_test_attempts')
    .update({
      status: 'final',
      scores: scoresPayload,
      result_type: resultType,
      confidence: resultConfidence,
      finalized_at: now,
      updated_at: now,
    })
    .eq('id', attemptId)
    .eq('user_id', userId)
    .eq('status', 'draft')
    .select()
    .single();

  if (updateError) {
    console.error('finalize error:', updateError);
    return NextResponse.json(
      { error: '?뺤젙 泥섎━???ㅽ뙣?덉뒿?덈떎.' },
      { status: 500 }
    );
  }

  let routineCreated = false;
  try {
    const { routineId, created } = await ensureDeepWorkoutRoutine(
      supabase,
      userId,
      attemptId
    );
    routineCreated = created;
    console.log('[DEEP_FINALIZE]', {
      user: maskId(userId),
      attemptId: maskId(attemptId),
      routine: maskId(routineId),
      created,
    });
    if (routineId) await seedDay1PlanIfRoutine(supabase, routineId, userId);
  } catch (err) {
    console.warn('[DEEP_FINALIZE_ROUTINE_FAIL]', {
      user: maskId(userId),
      attemptId: maskId(attemptId),
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return NextResponse.json({
    source: SOURCE,
    scoring_version: scoringVersion,
    result: resultPayload,
    attempt: toAttemptPayload(updated!),
    routineCreated,
  });
}
