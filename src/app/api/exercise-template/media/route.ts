/**
 * GET /api/exercise-template/media?templateId=M01
 *
 * media_payload 반환 (plan_status='active' 유저만)
 * Cache-Control: no-store
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireActivePlan } from '@/lib/auth/requireActivePlan';
import { buildMediaPayload } from '@/lib/media/media-payload';
import { getServerSupabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireActivePlan(req);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const templateId = searchParams.get('templateId');
    if (!templateId) {
      return NextResponse.json(
        { error: 'templateId가 필요합니다.' },
        { status: 400 }
      );
    }

    const supabase = getServerSupabaseAdmin();
    const { data: template, error } = await supabase
      .from('exercise_templates')
      .select('id, name, media_ref, duration_sec')
      .eq('id', templateId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('[exercise-template/media]', error);
      return NextResponse.json(
        { error: '템플릿 조회에 실패했습니다.' },
        { status: 500 }
      );
    }

    if (!template) {
      return NextResponse.json(
        { error: '템플릿을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const payload = await buildMediaPayload(template.media_ref, template.duration_sec ?? 300);

    const res = NextResponse.json({
      success: true,
      templateId: template.id,
      templateName: template.name,
      media: payload,
    });
    res.headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
    return res;
  } catch (err) {
    console.error('[exercise-template/media]', err);
    return NextResponse.json(
      {
        error: '미디어 조회에 실패했습니다.',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
