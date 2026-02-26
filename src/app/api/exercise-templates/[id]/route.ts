/**
 * GET /api/exercise-templates/:id
 *
 * 단일 운동 템플릿 조회 (클라이언트용).
 * contraindications 미노출.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getExerciseTemplateById } from '@/lib/workout-routine/exercise-templates-db';

async function getCurrentUserId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.substring(7);
  const { getServerSupabaseAdmin } = await import('@/lib/supabase');
  const supabase = getServerSupabaseAdmin();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  return error || !user ? null : user.id;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });
    }

    const template = await getExerciseTemplateById(id);
    if (!template) {
      return NextResponse.json({ error: '템플릿을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({
      id: template.id,
      name: template.name,
      level: template.level,
      focus_tags: template.focus_tags,
      videoUrl: template.videoUrl,
    });
  } catch (error) {
    console.error('exercise-templates getById error:', error);
    return NextResponse.json(
      { error: '템플릿 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}
