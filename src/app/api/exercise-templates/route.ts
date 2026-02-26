/**
 * GET /api/exercise-templates
 *
 * 운동 템플릿 목록 조회 (클라이언트용).
 * contraindications 미노출 (RLS/노출 경계).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAllExerciseTemplates } from '@/lib/workout-routine/exercise-templates-db';

async function getCurrentUserId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.substring(7);
  const { getServerSupabaseAdmin } = await import('@/lib/supabase');
  const supabase = getServerSupabaseAdmin();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  return error || !user ? null : user.id;
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const scoringVersion = searchParams.get('scoring_version') ?? 'deep_v2';

    const templates = await getAllExerciseTemplates({ scoringVersion });

    // 클라이언트 노출: contraindications 제외
    const safe = templates.map((t) => ({
      id: t.id,
      name: t.name,
      level: t.level,
      focus_tags: t.focus_tags,
      videoUrl: t.videoUrl,
    }));

    return NextResponse.json({ templates: safe });
  } catch (error) {
    console.error('exercise-templates list error:', error);
    return NextResponse.json(
      { error: '템플릿 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}
