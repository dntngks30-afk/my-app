/**
 * POST /api/admin/templates/[id]/toggle-status
 * Admin: is_active 토글
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;
  const { id } = await params;

  const { data: before, error: fetchErr } = await supabase
    .from('exercise_templates')
    .select('id,is_active')
    .eq('id', id)
    .single();

  if (fetchErr || !before) {
    return NextResponse.json({ error: 'TEMPLATE_NOT_FOUND' }, { status: 404 });
  }

  const newActive = !before.is_active;

  const { error: updateErr } = await supabase
    .from('exercise_templates')
    .update({ is_active: newActive })
    .eq('id', id);

  if (updateErr) {
    console.error('[admin/templates] toggle error:', updateErr);
    return NextResponse.json({ error: 'UPDATE_FAILED', details: updateErr.message }, { status: 500 });
  }

  const { error: auditErr } = await supabase.from('admin_template_actions').insert({
    actor_user_id: user.id,
    actor_email: user.email ?? '',
    template_id: id,
    action: 'toggle_status',
    before_diff: { is_active: before.is_active },
    after_diff: { is_active: newActive },
  });

  if (auditErr) {
    console.error('[admin_template_actions] insert error:', auditErr);
  }

  const res = NextResponse.json({ ok: true, is_active: newActive });
  res.headers.set('Cache-Control', 'no-store, max-age=0');
  return res;
}
