import { NextRequest } from 'next/server';
import { logAnalyticsEvent } from '@/lib/analytics/logAnalyticsEvent';
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

function logSessionCreateSuccessEvent(params: {
  userId: string;
  sessionNumber: number | null;
  sourcePublicResultId?: string | null;
  analysisSourceMode?: string | null;
  idempotent: boolean;
}) {
  const { userId, sessionNumber, sourcePublicResultId, analysisSourceMode, idempotent } = params;
  void logAnalyticsEvent({
    event_name: 'session_create_success',
    user_id: userId,
    session_number: sessionNumber,
    public_result_id: sourcePublicResultId ?? undefined,
    route_path: '/api/session/create',
    route_group: 'session_create',
    dedupe_key: `session_create_success:${userId}:${sessionNumber ?? 'none'}`,
    props: {
      session_number: sessionNumber,
      source_public_result_id: sourcePublicResultId ?? null,
      analysis_source_mode: analysisSourceMode ?? null,
      idempotent,
    },
  });
}

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
      if (progressGate.kind === 'active_idempotent') {
        logSessionCreateSuccessEvent({
          userId: requestGate.userId,
          sessionNumber: progressGate.existingPlan?.session_number ?? progressGate.progress.active_session_number ?? null,
          idempotent: true,
        });
      }
      return assembleProgressGateResponse(progressGate);
    }

    const generationInput = await runGenerationInputResolve(progressGate);
    if (generationInput.kind !== 'continue') {
      return assembleAnalysisUnavailableResponse();
    }

    const materialized = await runPlanMaterialize(generationInput);
    const persistence = await runPersistenceCommit(materialized);

    if (persistence.kind !== 'success') {
      if (persistence.kind === 'completed_conflict') {
        logSessionCreateSuccessEvent({
          userId: generationInput.userId,
          sessionNumber: persistence.existingPlan.session_number ?? generationInput.nextSessionNumber,
          sourcePublicResultId: generationInput.sourcePublicResultId,
          analysisSourceMode: generationInput.analysisSourceMode,
          idempotent: true,
        });
      }
      if (persistence.kind === 'race_conflict') {
        logSessionCreateSuccessEvent({
          userId: generationInput.userId,
          sessionNumber: persistence.racedPlan.session_number ?? generationInput.nextSessionNumber,
          sourcePublicResultId: generationInput.sourcePublicResultId,
          analysisSourceMode: generationInput.analysisSourceMode,
          idempotent: true,
        });
      }
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
    logSessionCreateSuccessEvent({
      userId: generationInput.userId,
      sessionNumber: generationInput.nextSessionNumber,
      sourcePublicResultId: generationInput.sourcePublicResultId,
      analysisSourceMode: generationInput.analysisSourceMode,
      idempotent: false,
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
