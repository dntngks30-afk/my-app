import { NextRequest } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/getCurrentUserId';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { logSessionEvent } from '@/lib/session-events';
import { runRequestGate } from './_lib/request-gate';
import { runProgressGate } from './_lib/progress-gate';
import { runGenerationInputResolve } from './_lib/generation-input';
import { runPlanMaterialize } from './_lib/plan-materialize';
import { runPersistenceCommit } from './_lib/persistence-commit';
import {
  assembleAnalysisUnavailableResponse,
  assembleInternalErrorResponse,
  assemblePersistenceResponse,
  assembleProgressGateResponse,
  assembleRequestGateResponse,
  assembleSuccessResponse,
} from './_lib/response-assembly';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const t0 = performance.now();
  const timings: Record<string, number> = {};

  try {
    const requestGate = await runRequestGate(req, t0, timings);
    if (requestGate.kind !== 'continue') {
      return assembleRequestGateResponse(requestGate);
    }

    const progressGate = await runProgressGate(requestGate);
    if (progressGate.kind !== 'continue') {
      return assembleProgressGateResponse(progressGate);
    }

    const generationInput = await runGenerationInputResolve(progressGate);
    if (generationInput.kind !== 'continue') {
      return assembleAnalysisUnavailableResponse();
    }

    const materialized = await runPlanMaterialize(generationInput);
    const persistence = await runPersistenceCommit(materialized);

    if (persistence.kind !== 'success') {
      return assemblePersistenceResponse(persistence);
    }

    void logSessionEvent(generationInput.supabase, {
      userId: generationInput.userId,
      eventType: 'session_create',
      status: 'ok',
      sessionNumber: generationInput.nextSessionNumber,
      meta: {
        total_sessions: persistence.finalProgress.total_sessions,
        completed_sessions_before: persistence.progress.completed_sessions,
        analysis_source_mode: generationInput.analysisSourceMode,
        ...(generationInput.sourcePublicResultId && {
          source_public_result_id: generationInput.sourcePublicResultId,
        }),
      },
    });

    timings.total_ms = Math.round(performance.now() - t0);
    if (generationInput.requestBody.isDebug && process.env.NODE_ENV !== 'production') {
      console.info('[session/create] perf', timings);
    }

    return assembleSuccessResponse(
      {
        ...materialized,
        timings,
      },
      persistence
    );
  } catch (err) {
    console.error('[session/create]', err);
    try {
      const userId = await getCurrentUserId(req);
      if (userId) {
        const supabase = getServerSupabaseAdmin();
        void logSessionEvent(supabase, {
          userId,
          eventType: 'session_create_blocked',
          status: 'error',
          code: 'INTERNAL',
          meta: { message_short: err instanceof Error ? err.message : '서버 오류' },
        });
      }
    } catch (_) {
      // noop
    }
    return assembleInternalErrorResponse();
  }
}
