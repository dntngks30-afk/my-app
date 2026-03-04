/**
 * POST /api/media/sign
 *
 * 배치 계약(SSOT): body { templateIds: string[] } (최대 50, 중복 제거)
 * 200: { results: Array<{ templateId, payload, cache_ttl_sec }> } — 입력 순서 유지
 * templateId당 60초 메모리 캐시, 동일 templateIds 조합 3~5초 dedupe
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireActivePlan } from '@/lib/auth/requireActivePlan';
import { validateMediaRefForApi } from '@/lib/admin/media-ref-schema';
import { createServerTiming } from '@/lib/debug/serverTiming';
import { buildMediaPayload } from '@/lib/media/media-payload';
import { getTemplatesForMediaByIds } from '@/lib/workout-routine/exercise-templates-db';
import type { MediaPayload } from '@/lib/media/media-payload';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_TEMPLATE_IDS = 50;
const CACHE_TTL_SEC = 60;
const DEDUPE_TTL_MS = 4000; // 4초

const placeholderPayload: MediaPayload = {
  kind: 'placeholder',
  autoplayAllowed: false,
  notes: ['영상 준비 중입니다.'],
};

/** templateId → { payload, expiresAt } */
const payloadCache = new Map<string, { payload: MediaPayload; expiresAt: number }>();
/** templateIds key → { promise, expiresAt } */
const inflightMap = new Map<string, { promise: Promise<unknown>; expiresAt: number }>();

function traceId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

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

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const templateIdsRaw = body.templateIds;
    const ids: string[] = Array.isArray(templateIdsRaw)
      ? [...new Set(templateIdsRaw.filter((x): x is string => typeof x === 'string'))]
      : [];

    if (ids.length === 0) {
      const res = NextResponse.json(
        { error: 'templateIds가 필요합니다.', code: 'MISSING_TEMPLATE_IDS' },
        { status: 400 }
      );
      res.headers.set('Server-Timing', t.header());
      res.headers.set('x-mr-trace', rid);
      return res;
    }

    if (ids.length > MAX_TEMPLATE_IDS) {
      const res = NextResponse.json(
        { error: `templateIds는 최대 ${MAX_TEMPLATE_IDS}개입니다.`, code: 'TOO_MANY_IDS' },
        { status: 400 }
      );
      res.headers.set('Server-Timing', t.header());
      res.headers.set('x-mr-trace', rid);
      return res;
    }

    const dedupeKey = [...ids].sort().join(',');
    const now = Date.now();
    const cached = inflightMap.get(dedupeKey);
    if (cached && cached.expiresAt > now) {
      const prev = await cached.promise as { results: Array<{ templateId: string; payload: MediaPayload; cache_ttl_sec: number }> };
      const byId = new Map(prev.results.map((r) => [r.templateId, r]));
      const results = ids.map((id) => byId.get(id) ?? { templateId: id, payload: placeholderPayload, cache_ttl_sec: CACHE_TTL_SEC });
      const res = NextResponse.json({ results });
      res.headers.set('Cache-Control', 'no-store, max-age=0');
      res.headers.set('Server-Timing', t.header());
      res.headers.set('x-mr-trace', rid);
      res.headers.set('x-mr-cache', 'dedupe');
      return res;
    }

    const doFetch = async () => {
      const templates = await getTemplatesForMediaByIds(ids);
      t.mark('db');
      const byId = new Map(templates.map((t) => [t.id, t]));

      const results: Array<{ templateId: string; payload: MediaPayload; cache_ttl_sec: number }> = [];
      for (const id of ids) {
        const tmpl = byId.get(id);
        if (!tmpl) {
          results.push({ templateId: id, payload: placeholderPayload, cache_ttl_sec: CACHE_TTL_SEC });
          continue;
        }
        const validation = validateMediaRefForApi(tmpl.media_ref);
        if (!validation.ok) {
          const res = NextResponse.json(
            { error: validation.reason, code: validation.code },
            { status: 422 }
          );
          res.headers.set('Server-Timing', t.header());
          res.headers.set('x-mr-trace', rid);
          throw res;
        }
        const cached = payloadCache.get(id);
        if (cached && cached.expiresAt > now) {
          results.push({ templateId: id, payload: cached.payload, cache_ttl_sec: CACHE_TTL_SEC });
          continue;
        }
        const payload = await buildMediaPayload(tmpl.media_ref, tmpl.duration_sec ?? 300);
        payloadCache.set(id, { payload, expiresAt: now + CACHE_TTL_SEC * 1000 });
        results.push({ templateId: id, payload, cache_ttl_sec: CACHE_TTL_SEC });
      }
      t.mark('sign_compute');
      return { results };
    };

    const promise = doFetch();
    inflightMap.set(dedupeKey, { promise, expiresAt: now + DEDUPE_TTL_MS });
    setTimeout(() => {
      if (inflightMap.get(dedupeKey)?.expiresAt <= Date.now()) {
        inflightMap.delete(dedupeKey);
      }
    }, DEDUPE_TTL_MS + 100);

    const data = await promise;
    inflightMap.delete(dedupeKey);

    const res = NextResponse.json(data);
    res.headers.set('Cache-Control', 'no-store, max-age=0');
    res.headers.set('Server-Timing', t.header());
    res.headers.set('x-mr-trace', rid);
    return res;
  } catch (err) {
    if (err instanceof NextResponse) return err;
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
