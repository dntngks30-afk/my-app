/**
 * GET /api/exercise-templates/filter
 *
 * 루틴 엔진용 필터링 API (서버/내부 사용).
 * full data (contraindications 포함) 반환.
 *
 * Query: scoring_version, max_level, focus_tags, avoid_tags (comma-separated)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFilteredExerciseTemplates } from '@/lib/workout-routine/exercise-templates-db';

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
    const maxLevel = searchParams.get('max_level');
    const focusTags = searchParams.get('focus_tags')?.split(',').filter(Boolean);
    const avoidTags = searchParams.get('avoid_tags')?.split(',').filter(Boolean);

    const templates = await getFilteredExerciseTemplates({
      scoringVersion,
      maxLevel: maxLevel ? parseInt(maxLevel, 10) : undefined,
      focusTags,
      avoidTags,
    });

    return NextResponse.json({
      templates: templates.map((t) => ({
        id: t.id,
        name: t.name,
        level: t.level,
        focus_tags: t.focus_tags,
        avoid_tags: t.avoid_tags,
        videoUrl: t.videoUrl,
      })),
    });
  } catch (error) {
    console.error('exercise-templates filter error:', error);
    return NextResponse.json(
      { error: '템플릿 필터 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}
