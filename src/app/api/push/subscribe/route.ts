import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { getCachedUserId } from '@/lib/auth/requestAuthCache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Platform = 'ios' | 'android' | 'desktop' | 'other';

type SubscribeBody = {
  endpoint?: unknown;
  keys?: {
    p256dh?: unknown;
    auth?: unknown;
  };
  platform?: unknown;
  userAgent?: unknown;
  timezone?: unknown;
  installed?: unknown;
};

function badRequest(message: string) {
  return NextResponse.json({ ok: false, code: 'INVALID_PAYLOAD', message }, { status: 400 });
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getServerSupabaseAdmin();
    const userId = await getCachedUserId(req, supabase);
    if (!userId) {
      return NextResponse.json({ ok: false, code: 'UNAUTHORIZED' }, { status: 401 });
    }

    let body: SubscribeBody;
    try {
      body = await req.json();
    } catch {
      return badRequest('Invalid JSON body');
    }

    const endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : '';
    const p256dh = typeof body.keys?.p256dh === 'string' ? body.keys.p256dh.trim() : '';
    const auth = typeof body.keys?.auth === 'string' ? body.keys.auth.trim() : '';

    if (!endpoint) return badRequest('endpoint is required');
    if (!p256dh) return badRequest('keys.p256dh is required');
    if (!auth) return badRequest('keys.auth is required');

    const allowedPlatforms: Platform[] = ['ios', 'android', 'desktop', 'other'];
    const platform = (typeof body.platform === 'string' ? body.platform : 'other') as Platform;
    if (!allowedPlatforms.includes(platform)) {
      return badRequest('platform must be one of ios, android, desktop, other');
    }

    const userAgent = typeof body.userAgent === 'string' ? body.userAgent.trim() : null;
    const timezone = typeof body.timezone === 'string' ? body.timezone.trim() : null;
    const installed = typeof body.installed === 'boolean' ? body.installed : false;

    if (userAgent && userAgent.length > 512) return badRequest('userAgent too long');
    if (timezone && timezone.length > 64) return badRequest('timezone too long');

    const { data, error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          endpoint,
          user_id: userId,
          p256dh,
          auth,
          platform,
          user_agent: userAgent,
          timezone,
          installed,
          is_active: true,
          failure_count: 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' }
      )
      .select('id')
      .single();

    if (error || !data) {
      console.error('[push/subscribe] upsert failed');
      return NextResponse.json({ ok: false, code: 'SERVER_ERROR' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, subscriptionId: data.id });
  } catch {
    return NextResponse.json({ ok: false, code: 'SERVER_ERROR' }, { status: 500 });
  }
}
