/**
 * POST /api/media/sign
 *
 * On-demand Mux JWT 서명. templateId(단건) 또는 templateIds(배치) 지원.
 * requireActivePlan 필수. mediaPayload만 반환(내부 ref 노출 금지).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireActivePlan } from '@/lib/auth/requireActivePlan';
import { buildMediaPayload } from '@/lib/media/media-payload';
import { getTemplatesForMediaByIds } from '@/lib/workout-routine/exercise-templates-db';

export const dynamic = 'force-dynamic';

const placeholderPayload = {
  kind: 'placeholder' as const,
  autoplayAllowed: false,
  notes: ['영상 준비 중입니다.'],
};

export async function POST(req: NextRequest) {
  try {
    const auth = await requireActivePlan(req);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const templateId = typeof body.templateId === 'string' ? body.templateId : null;
    const templateIdsRaw = body.templateIds;
    const ids: string[] = Array.isArray(templateIdsRaw)
      ? templateIdsRaw.filter((x): x is string => typeof x === 'string')
      : templateId
        ? [templateId]
        : [];

    if (ids.length === 0) {
      return NextResponse.json(
        { error: 'templateId 또는 templateIds가 필요합니다.' },
        { status: 400 }
      );
    }

    const templates = await getTemplatesForMediaByIds(ids);
    const settled = await Promise.allSettled(
      templates.map((t) => buildMediaPayload(t.media_ref, t.duration_sec ?? 300))
    );

    const mediaById: Record<string, typeof placeholderPayload> = {};
    templates.forEach((t, i) => {
      const payload =
        settled[i]?.status === 'fulfilled'
          ? (settled[i] as PromiseFulfilledResult<typeof placeholderPayload>).value
          : placeholderPayload;
      mediaById[t.id] = payload;
    });

    const res = NextResponse.json({
      success: true,
      mediaById,
    });
    res.headers.set('Cache-Control', 'no-store, max-age=0');
    return res;
  } catch (err) {
    console.error('[media/sign]', err);
    return NextResponse.json(
      { error: '미디어 서명에 실패했습니다.' },
      { status: 500 }
    );
  }
}
