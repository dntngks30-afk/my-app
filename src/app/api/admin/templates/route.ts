/**
 * GET /api/admin/templates
 * Admin 전용: 템플릿 목록 (검색, 필터, 정렬)
 * Query: q, status, level, equipment, focus_tags, contraindications, sort, order, limit, offset
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';

const VALID_SORT = ['updated_at', 'name', 'id', 'level'] as const;
const VALID_ORDER = ['asc', 'desc'] as const;

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const { supabase } = auth;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim() || '';
  const status = searchParams.get('status') || 'all'; // active | inactive | all
  const levelRaw = searchParams.get('level');
  const levels = levelRaw
    ? levelRaw.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => n >= 1 && n <= 3)
    : null;
  const equipment = searchParams.get('equipment')?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  const focusTags = searchParams.get('focus_tags')?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  const contraindications = searchParams.get('contraindications')?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  const sort = (searchParams.get('sort') || 'updated_at') as (typeof VALID_SORT)[number];
  const order = (searchParams.get('order') || 'desc') as (typeof VALID_ORDER)[number];
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50));
  const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10) || 0);

  const sortCol = VALID_SORT.includes(sort) ? sort : 'updated_at';
  const orderDir = VALID_ORDER.includes(order) ? order : 'desc';

  try {
    let query = supabase
      .from('exercise_templates')
      .select('id,name,level,focus_tags,contraindications,equipment,duration_sec,media_ref,is_active,updated_at,scoring_version', { count: 'exact' });

    if (status === 'active') query = query.eq('is_active', true);
    else if (status === 'inactive') query = query.eq('is_active', false);

    if (levels && levels.length > 0) {
      query = query.in('level', levels);
    }
    if (equipment.length > 0) {
      query = query.overlaps('equipment', equipment);
    }
    if (focusTags.length > 0) {
      query = query.overlaps('focus_tags', focusTags);
    }
    if (contraindications.length > 0) {
      query = query.overlaps('contraindications', contraindications);
    }

    if (q) {
      const safe = q.replace(/[%_\\]/g, '\\$&');
      query = query.or(`name.ilike.%${safe}%,id.ilike.%${safe}%`);
    }

    query = query.order(sortCol, { ascending: orderDir === 'asc' }).range(offset, offset + limit - 1);

    const { data: templates, error, count } = await query;

    if (error) {
      console.error('[admin/templates] list error:', error);
      return NextResponse.json(
        { error: 'LIST_FAILED', details: error.message },
        { status: 500 }
      );
    }

    const res = NextResponse.json({
      templates: templates ?? [],
      total: count ?? 0,
    });
    res.headers.set('Cache-Control', 'no-store, max-age=0');
    return res;
  } catch (err) {
    console.error('[admin/templates]', err);
    return NextResponse.json(
      { error: 'SERVER_ERROR', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
