/**
 * POST /api/media/sign
 *
 * On-demand Mux JWT 서명. templateId(단건) 또는 templateIds(배치) 지원.
 * requireActivePlan 필수. mediaPayload만 반환(내부 ref 노출 금지).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireActivePlan } from '@/lib/auth/requireActivePlan';
import { createServerTiming } from '@/lib/debug/serverTiming';
import { buildMediaPayload } from '@/lib/media/media-payload';
import { getTemplatesForMediaByIds } from '@/lib/workout-routine/exercise-templates-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function traceId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

const placeholderPayload = {
  kind: 'placeholder' as const,
  autoplayAllowed: false,
  notes: ['영상 준비 중입니다.'],
};

export async function POST(req: NextRequest) {
  const t = createServerTiming();
  const rid = traceId();
  try {
    const auth = await requireActivePlan(req);
    t.mark('auth');
    if (auth instanceof NextResponse) {
      auth.headers.set('Server-Timing', t.header());
      auth.headers.set('x-mr-trace', rid);
      return auth;
    }

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const templateId = typeof body.templateId === 'string' ? body.templateId : null;
    const templateIdsRaw = body.templateIds;
    const ids: string[] = Array.isArray(templateIdsRaw)
      ? templateIdsRaw.filter((x): x is string => typeof x === 'string')
      : templateId
        ? [templateId]
        : [];

    if (ids.length === 0) {
      const res = NextResponse.json(
        { error: 'templateId 또는 templateIds가 필요합니다.' },
        { status: 400 }
      );
      res.headers.set('Server-Timing', t.header());
      res.headers.set('x-mr-trace', rid);
      return res;
    }

    const templates = await getTemplatesForMediaByIds(ids);
    const settled = await Promise.allSettled(
      templates.map((tmpl) => buildMediaPayload(tmpl.media_ref, tmpl.duration_sec ?? 300))
    );
    t.mark('sign_compute');

    const mediaById: Record<string, typeof placeholderPayload> = {};
    templates.forEach((tmpl, i) => {
      const payload =
        settled[i]?.status === 'fulfilled'
          ? (settled[i] as PromiseFulfilledResult<typeof placeholderPayload>).value
          : placeholderPayload;
      mediaById[tmpl.id] = payload;
    });

    const res = NextResponse.json({
      success: true,
      mediaById,
    });
    res.headers.set('Cache-Control', 'no-store, max-age=0');
    res.headers.set('Server-Timing', t.header());
    res.headers.set('x-mr-trace', rid);
    return res;
  } catch (err) {
    console.error('[media/sign]', err);
    const res = NextResponse.json(
      { error: '미디어 서명에 실패했습니다.' },
      { status: 500 }
    );
    res.headers.set('Server-Timing', t.header());
    res.headers.set('x-mr-trace', rid);
    return res;
  }
}
