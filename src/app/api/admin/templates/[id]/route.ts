/**
 * GET /api/admin/templates/[id] - 상세 조회
 * PATCH /api/admin/templates/[id] - 메타 수정
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { validateMediaRef } from '@/lib/admin/media-ref-schema';

const ALLOWED_FIELDS = [
  'name', 'level', 'focus_tags', 'contraindications', 'equipment',
  'duration_sec', 'media_ref',
] as const;

function sanitizeBody(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of ALLOWED_FIELDS) {
    if (body[k] !== undefined) out[k] = body[k];
  }
  return out;
}

function validateLevel(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 3;
}

function validateStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const { supabase } = auth;
  const { id } = await params;

  const { data: template, error } = await supabase
    .from('exercise_templates')
    .select('id,name,level,focus_tags,contraindications,equipment,duration_sec,media_ref,template_version,scoring_version,is_fallback,is_active,created_at,updated_at')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[admin/templates] get error:', error);
    return NextResponse.json({ error: 'FETCH_FAILED', details: error.message }, { status: 500 });
  }
  if (!template) {
    return NextResponse.json({ error: 'TEMPLATE_NOT_FOUND' }, { status: 404 });
  }

  const res = NextResponse.json({ template });
  res.headers.set('Cache-Control', 'no-store, max-age=0');
  return res;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;
  const { id } = await params;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }

  const updates = sanitizeBody(body);
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'NO_VALID_FIELDS' }, { status: 400 });
  }

  if (updates.name !== undefined) {
    if (typeof updates.name !== 'string' || !updates.name.trim()) {
      return NextResponse.json({ error: 'name must be non-empty string' }, { status: 400 });
    }
  }
  if (updates.level !== undefined && !validateLevel(updates.level)) {
    return NextResponse.json({ error: 'level must be 1, 2, or 3' }, { status: 400 });
  }
  if (updates.focus_tags !== undefined && !validateStringArray(updates.focus_tags)) {
    return NextResponse.json({ error: 'focus_tags must be string array' }, { status: 400 });
  }
  if (updates.contraindications !== undefined && !validateStringArray(updates.contraindications)) {
    return NextResponse.json({ error: 'contraindications must be string array' }, { status: 400 });
  }
  if (updates.equipment !== undefined && !validateStringArray(updates.equipment)) {
    return NextResponse.json({ error: 'equipment must be string array' }, { status: 400 });
  }
  if (updates.duration_sec !== undefined) {
    const d = updates.duration_sec;
    if (typeof d !== 'number' || !Number.isInteger(d) || d < 60 || d > 3600) {
      return NextResponse.json({ error: 'duration_sec must be 60–3600' }, { status: 400 });
    }
  }

  if (updates.media_ref !== undefined) {
    const vr = validateMediaRef(updates.media_ref);
    if (!vr.valid) {
      return NextResponse.json({
        error: 'VALIDATION_ERROR',
        details: vr.errors,
      }, { status: 400 });
    }
    updates.media_ref = updates.media_ref ?? null;
  }

  const { data: before } = await supabase
    .from('exercise_templates')
    .select('name,level,focus_tags,contraindications,equipment,duration_sec,media_ref,is_active')
    .eq('id', id)
    .single();

  if (!before) {
    return NextResponse.json({ error: 'TEMPLATE_NOT_FOUND' }, { status: 404 });
  }

  const updatePayload: Record<string, unknown> = { ...updates };
  const { error: updateError } = await supabase
    .from('exercise_templates')
    .update(updatePayload)
    .eq('id', id);

  if (updateError) {
    console.error('[admin/templates] update error:', updateError);
    return NextResponse.json({ error: 'UPDATE_FAILED', details: updateError.message }, { status: 500 });
  }

  const after = { ...before, ...updates };

  const { data: auditRow, error: auditError } = await supabase
    .from('admin_template_actions')
    .insert({
      actor_user_id: user.id,
      actor_email: user.email ?? '',
      template_id: id,
      action: 'update',
      before_diff: before,
      after_diff: after,
    })
    .select('id')
    .single();

  if (auditError) {
    console.error('[admin_template_actions] insert error:', auditError);
  }

  const { data: template } = await supabase
    .from('exercise_templates')
    .select('*')
    .eq('id', id)
    .single();

  const res = NextResponse.json({
    ok: true,
    template: template ?? after,
    auditId: auditRow?.id,
  });
  res.headers.set('Cache-Control', 'no-store, max-age=0');
  return res;
}
