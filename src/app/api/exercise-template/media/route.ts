/**
 * GET /api/exercise-template/media?templateId=M01
 *
 * 계약(SSOT): 200 { templateId, payload, cache_ttl_sec }
 * 404: TEMPLATE_NOT_FOUND
 * 422: MEDIA_REF_INVALID
 * Cache-Control: no-store
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireActivePlan } from '@/lib/auth/requireActivePlan';
import { validateMediaRefForApi } from '@/lib/admin/media-ref-schema';
import { buildMediaPayload } from '@/lib/media/media-payload';
import { getServerSupabaseAdmin } from '@/lib/supabase';

const CACHE_TTL_SEC = 60;

export async function GET(req: NextRequest) {
  try {
    const auth = await requireActivePlan(req);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const templateId = searchParams.get('templateId');
    if (!templateId) {
      return NextResponse.json(
        { error: 'templateId가 필요합니다.', code: 'MISSING_TEMPLATE_ID' },
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
        { error: '템플릿을 찾을 수 없습니다.', code: 'TEMPLATE_NOT_FOUND' },
        { status: 404 }
      );
    }

    const validation = validateMediaRefForApi(template.media_ref);
    if (!validation.ok) {
      return NextResponse.json(
        { error: validation.reason, code: validation.code },
        { status: 422 }
      );
    }

    const payload = await buildMediaPayload(
      template.media_ref,
      template.duration_sec ?? 300
    );

    const res = NextResponse.json({
      templateId: template.id,
      payload,
      cache_ttl_sec: CACHE_TTL_SEC,
    });
    res.headers.set('Cache-Control', 'no-store');
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
