/**
 * Admin: User journey snapshot for dogfooding / launch ops
 * GET /api/admin/dogfooding/user-snapshot?userId=... | ?email=...
 * Authorization: Bearer <access_token> (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { isAdmin } from '@/lib/auth/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type TriageFlag =
  | 'NO_DEEP_TEST'
  | 'DEEP_TEST_NO_SESSION'
  | 'SESSION_DRAFT_STUCK'
  | 'COMPLETED_NO_FEEDBACK'
  | 'FEEDBACK_NO_ADAPTIVE_SUMMARY'
  | 'RECENT_MANUAL_OVERRIDE';

export type UserSnapshotResponse = {
  ok: true;
  user: {
    id: string;
    email: string | null;
    plan_status: string | null;
    plan_tier: string | null;
    role: string | null;
    created_at: string | null;
    updated_at: string | null;
  } | null;
  deepTest: {
    id: string;
    status: string;
    result_type: string | null;
    scoring_version: string;
    finalized_at: string | null;
    scores: unknown;
  } | null;
  sessions: Array<{
    session_number: number;
    status: string;
    theme: string;
    created_at: string;
    completed_at: string | null;
    has_generation_trace: boolean;
    adaptation_summary?: string | null;
  }>;
  feedback: {
    session_number: number;
    overall_rpe: number | null;
    difficulty_feedback: string | null;
    completion_ratio: number | null;
    body_state_change: string | null;
    discomfort_area: string | null;
    created_at: string;
  } | null;
  adaptiveSummary: {
    session_number: number;
    completion_ratio: number;
    avg_rpe: number | null;
    avg_discomfort: number | null;
    dropout_risk_score: number;
    discomfort_burden_score: number;
    flags: string[];
    created_at: string;
  } | null;
  adminActions: Array<{
    action: string;
    reason: string;
    before: unknown;
    after: unknown;
    created_at: string;
  }>;
  triageFlags: TriageFlag[];
};

function deriveTriageFlags(snapshot: {
  deepTest: UserSnapshotResponse['deepTest'];
  sessions: UserSnapshotResponse['sessions'];
  feedback: UserSnapshotResponse['feedback'];
  adaptiveSummary: UserSnapshotResponse['adaptiveSummary'];
  adminActions: UserSnapshotResponse['adminActions'];
}): TriageFlag[] {
  const flags: TriageFlag[] = [];
  const { deepTest, sessions, feedback, adaptiveSummary, adminActions } = snapshot;

  if (!deepTest || deepTest.status !== 'final') {
    flags.push('NO_DEEP_TEST');
  }

  if (deepTest && deepTest.status === 'final' && sessions.length === 0) {
    flags.push('DEEP_TEST_NO_SESSION');
  }

  const hasDraftStuck = sessions.some(
    (s) => s.status === 'draft' || s.status === 'started'
  );
  const completedSessions = sessions.filter((s) => s.status === 'completed');
  if (hasDraftStuck && completedSessions.length === 0) {
    flags.push('SESSION_DRAFT_STUCK');
  }

  const latestCompleted = completedSessions[0];
  if (latestCompleted && !feedback) {
    flags.push('COMPLETED_NO_FEEDBACK');
  }
  if (feedback && !adaptiveSummary) {
    flags.push('FEEDBACK_NO_ADAPTIVE_SUMMARY');
  }

  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  const recentOverride = adminActions.some(
    (a) => new Date(a.created_at) > oneDayAgo
  );
  if (recentOverride) {
    flags.push('RECENT_MANUAL_OVERRIDE');
  }

  return flags;
}

export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization') ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const supabase = getServerSupabaseAdmin();
    const {
      data: { user: actor },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !actor) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const adminOk = await isAdmin(actor.email, actor.id, supabase);
    if (!adminOk) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const email = searchParams.get('email');

    if (!userId && !email) {
      return NextResponse.json(
        { error: 'userId or email is required' },
        { status: 400 }
      );
    }

    let targetUserId: string | null = null;

    if (userId && typeof userId === 'string') {
      targetUserId = userId.trim();
    } else if (email && typeof email === 'string') {
      const { data: u } = await supabase
        .from('users')
        .select('id')
        .eq('email', email.trim())
        .maybeSingle();
      if (!u?.id) {
        return NextResponse.json(
          { ok: false, error: 'USER_NOT_FOUND', message: 'User not found by email' },
          { status: 404 }
        );
      }
      targetUserId = u.id;
    }

    if (!targetUserId) {
      return NextResponse.json({ error: 'userId or email is required' }, { status: 400 });
    }

    const [userRes, deepRes, sessionsRes, feedbackRes, adaptiveRes, adminRes] =
      await Promise.all([
        supabase
          .from('users')
          .select('id, email, plan_status, plan_tier, role, created_at, updated_at')
          .eq('id', targetUserId)
          .maybeSingle(),
        supabase
          .from('deep_test_attempts')
          .select('id, status, result_type, scoring_version, finalized_at, scores')
          .eq('user_id', targetUserId)
          .eq('status', 'final')
          .order('finalized_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('session_plans')
          .select('session_number, status, theme, created_at, completed_at, generation_trace_json')
          .eq('user_id', targetUserId)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('session_feedback')
          .select('session_number, overall_rpe, difficulty_feedback, completion_ratio, body_state_change, discomfort_area, created_at')
          .eq('user_id', targetUserId)
          .order('session_number', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('session_adaptive_summaries')
          .select('session_number, completion_ratio, avg_rpe, avg_discomfort, dropout_risk_score, discomfort_burden_score, flags, created_at')
          .eq('user_id', targetUserId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('admin_actions')
          .select('action, reason, before, after, created_at')
          .eq('target_user_id', targetUserId)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

    const user = userRes.data;
    const deepTest = deepRes.data;
    const sessions = (sessionsRes.data ?? []).map((s) => {
      const trace = s.generation_trace_json as { adaptation?: { reason_summary?: string } } | null;
      return {
        session_number: s.session_number,
        status: s.status,
        theme: s.theme ?? '',
        created_at: s.created_at ?? '',
        completed_at: s.completed_at ?? null,
        has_generation_trace: !!s.generation_trace_json,
        adaptation_summary: trace?.adaptation?.reason_summary ?? null,
      };
    });
    const feedback = feedbackRes.data;
    const adaptiveSummary = adaptiveRes.data;
    const adminActions = (adminRes.data ?? []).map((a) => ({
      action: a.action,
      reason: a.reason,
      before: a.before,
      after: a.after,
      created_at: a.created_at ?? '',
    }));

    const triageFlags = deriveTriageFlags({
      deepTest: deepTest
        ? {
            id: deepTest.id,
            status: deepTest.status,
            result_type: deepTest.result_type,
            scoring_version: deepTest.scoring_version ?? '',
            finalized_at: deepTest.finalized_at ?? null,
            scores: deepTest.scores,
          }
        : null,
      sessions,
      feedback: feedback
        ? {
            session_number: feedback.session_number,
            overall_rpe: feedback.overall_rpe,
            difficulty_feedback: feedback.difficulty_feedback,
            completion_ratio: feedback.completion_ratio,
            body_state_change: feedback.body_state_change,
            discomfort_area: feedback.discomfort_area,
            created_at: feedback.created_at ?? '',
          }
        : null,
      adaptiveSummary: adaptiveSummary
        ? {
            session_number: adaptiveSummary.session_number,
            completion_ratio: adaptiveSummary.completion_ratio ?? 0,
            avg_rpe: adaptiveSummary.avg_rpe,
            avg_discomfort: adaptiveSummary.avg_discomfort,
            dropout_risk_score: adaptiveSummary.dropout_risk_score ?? 0,
            discomfort_burden_score: adaptiveSummary.discomfort_burden_score ?? 0,
            flags: Array.isArray(adaptiveSummary.flags) ? adaptiveSummary.flags : [],
            created_at: adaptiveSummary.created_at ?? '',
          }
        : null,
      adminActions,
    });

    const response: UserSnapshotResponse = {
      ok: true,
      user: user
        ? {
            id: user.id,
            email: user.email ?? null,
            plan_status: user.plan_status ?? null,
            plan_tier: user.plan_tier ?? null,
            role: user.role ?? null,
            created_at: user.created_at ?? null,
            updated_at: user.updated_at ?? null,
          }
        : null,
      deepTest: deepTest
        ? {
            id: deepTest.id,
            status: deepTest.status,
            result_type: deepTest.result_type ?? null,
            scoring_version: deepTest.scoring_version ?? '',
            finalized_at: deepTest.finalized_at ?? null,
            scores: deepTest.scores,
          }
        : null,
      sessions,
      feedback: feedback
        ? {
            session_number: feedback.session_number,
            overall_rpe: feedback.overall_rpe,
            difficulty_feedback: feedback.difficulty_feedback,
            completion_ratio: feedback.completion_ratio,
            body_state_change: feedback.body_state_change,
            discomfort_area: feedback.discomfort_area,
            created_at: feedback.created_at ?? '',
          }
        : null,
      adaptiveSummary: adaptiveSummary
        ? {
            session_number: adaptiveSummary.session_number,
            completion_ratio: adaptiveSummary.completion_ratio ?? 0,
            avg_rpe: adaptiveSummary.avg_rpe,
            avg_discomfort: adaptiveSummary.avg_discomfort,
            dropout_risk_score: adaptiveSummary.dropout_risk_score ?? 0,
            discomfort_burden_score: adaptiveSummary.discomfort_burden_score ?? 0,
            flags: Array.isArray(adaptiveSummary.flags) ? adaptiveSummary.flags : [],
            created_at: adaptiveSummary.created_at ?? '',
          }
        : null,
      adminActions,
      triageFlags,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error('[admin/dogfooding/user-snapshot]', err);
    return NextResponse.json(
      {
        error: 'SERVER_ERROR',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
