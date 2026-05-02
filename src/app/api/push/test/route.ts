import { NextRequest, NextResponse } from 'next/server';
import * as webpush from 'web-push';
import type { PushSubscription } from 'web-push';
import { getCachedUserId } from '@/lib/auth/requestAuthCache';
import { getServerSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TEST_PUSH_URL = '/push/open?to=/app/home&type=test';
const DEFAULT_TITLE = 'MOVE RE 테스트 알림';
const DEFAULT_BODY = '알림이 정상적으로 연결됐어요.';

type TestPushBody = {
  title?: unknown;
  body?: unknown;
};

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  failure_count: number | null;
};

function json(code: string, status: number) {
  return NextResponse.json({ ok: false, code }, { status });
}

function readRequiredEnv() {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim();
  const contactEmail = process.env.WEB_PUSH_CONTACT_EMAIL?.trim();

  if (!publicKey || !privateKey || !contactEmail) {
    return null;
  }

  return {
    publicKey,
    privateKey,
    contactEmail: contactEmail.startsWith('mailto:') ? contactEmail : `mailto:${contactEmail}`,
  };
}

function limitedText(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLength);
}

function getStatusCode(error: unknown): number | null {
  if (!error || typeof error !== 'object' || !('statusCode' in error)) return null;
  const statusCode = (error as { statusCode?: unknown }).statusCode;
  return typeof statusCode === 'number' ? statusCode : null;
}

async function updateDeliveryState(
  supabase: ReturnType<typeof getServerSupabaseAdmin>,
  row: PushSubscriptionRow,
  patch: Record<string, unknown>
) {
  const { error } = await supabase
    .from('push_subscriptions')
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id);

  if (error) {
    console.error('[push/test] subscription state update failed');
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getServerSupabaseAdmin();
    const userId = await getCachedUserId(req, supabase);
    if (!userId) return json('UNAUTHORIZED', 401);

    const env = readRequiredEnv();
    if (!env) return json('MISSING_WEB_PUSH_ENV', 500);

    const body = (await req.json().catch(() => ({}))) as TestPushBody;
    const payload = {
      title: limitedText(body.title, DEFAULT_TITLE, 80),
      body: limitedText(body.body, DEFAULT_BODY, 160),
      url: TEST_PUSH_URL,
      tag: 'move-re-test',
      type: 'test',
    };

    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth, failure_count')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) {
      console.error('[push/test] subscription query failed');
      return json('SERVER_ERROR', 500);
    }

    const rows = (data ?? []) as PushSubscriptionRow[];
    if (rows.length === 0) {
      return json('NO_ACTIVE_SUBSCRIPTION', 404);
    }

    webpush.setVapidDetails(env.contactEmail, env.publicKey, env.privateKey);

    let sent = 0;
    let failed = 0;
    let deactivated = 0;
    const now = new Date().toISOString();

    for (const row of rows) {
      const subscription: PushSubscription = {
        endpoint: row.endpoint,
        keys: {
          p256dh: row.p256dh,
          auth: row.auth,
        },
      };

      try {
        await webpush.sendNotification(subscription, JSON.stringify(payload));
        sent += 1;
        await updateDeliveryState(supabase, row, {
          last_success_at: now,
          failure_count: 0,
        });
      } catch (error) {
        failed += 1;
        const statusCode = getStatusCode(error);
        const shouldDeactivate = statusCode === 404 || statusCode === 410;
        if (shouldDeactivate) deactivated += 1;

        await updateDeliveryState(supabase, row, {
          ...(shouldDeactivate ? { is_active: false } : {}),
          last_failure_at: now,
          failure_count: (row.failure_count ?? 0) + 1,
        });
      }
    }

    return NextResponse.json({ ok: true, sent, failed, deactivated });
  } catch {
    console.error('[push/test] server error');
    return json('SERVER_ERROR', 500);
  }
}
