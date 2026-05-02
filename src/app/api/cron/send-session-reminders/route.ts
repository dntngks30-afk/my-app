import { NextRequest, NextResponse } from 'next/server';
import * as webpush from 'web-push';
import type { PushSubscription } from 'web-push';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { getKstDayKeyUTC } from '@/lib/time/kst';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NOTIFICATION_TYPE = 'daily_session';
const DAILY_SESSION_PAYLOAD = {
  title: '오늘의 리셋 세션이 준비됐어요',
  body: '7분만 몸을 다시 정렬해볼까요?',
  url: '/push/open?to=/app/home&type=daily_session',
  tag: 'move-re-daily-session',
  type: NOTIFICATION_TYPE,
} as const;

type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  failure_count: number | null;
};

type ProgressRow = {
  user_id: string;
  total_sessions: number | null;
  completed_sessions: number | null;
  last_completed_day_key: string | null;
};

type DeliveryRow = {
  id: string;
};

type AttemptMetadata = {
  subscription_id: string;
  status: 'sent' | 'failed';
  error_code?: string;
};

function json(code: string, status: number) {
  return NextResponse.json({ ok: false, code }, { status });
}

function readRequiredWebPushEnv() {
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

function getStatusCode(error: unknown): number | null {
  if (!error || typeof error !== 'object' || !('statusCode' in error)) return null;
  const statusCode = (error as { statusCode?: unknown }).statusCode;
  return typeof statusCode === 'number' ? statusCode : null;
}

function isUniqueConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; message?: unknown };
  return candidate.code === '23505' || String(candidate.message ?? '').includes('duplicate key');
}

function groupSubscriptions(rows: PushSubscriptionRow[]) {
  const grouped = new Map<string, PushSubscriptionRow[]>();
  for (const row of rows) {
    const list = grouped.get(row.user_id) ?? [];
    list.push(row);
    grouped.set(row.user_id, list);
  }
  return grouped;
}

async function updateSubscriptionState(
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
    console.error('[cron/send-session-reminders] subscription update failed');
  }
}

async function reserveDelivery(
  supabase: ReturnType<typeof getServerSupabaseAdmin>,
  userId: string,
  localDate: string,
  scheduledFor: string
): Promise<DeliveryRow | null | 'duplicate'> {
  const { data, error } = await supabase
    .from('notification_deliveries')
    .insert({
      user_id: userId,
      notification_type: NOTIFICATION_TYPE,
      local_date: localDate,
      scheduled_for: scheduledFor,
      status: 'pending',
      metadata: {},
    })
    .select('id')
    .single();

  if (error) {
    if (isUniqueConflict(error)) return 'duplicate';
    console.error('[cron/send-session-reminders] delivery reserve failed');
    return null;
  }

  return data as DeliveryRow;
}

async function updateDelivery(
  supabase: ReturnType<typeof getServerSupabaseAdmin>,
  deliveryId: string,
  patch: Record<string, unknown>
) {
  const { error } = await supabase
    .from('notification_deliveries')
    .update(patch)
    .eq('id', deliveryId);

  if (error) {
    console.error('[cron/send-session-reminders] delivery update failed');
  }
}

async function handleCron(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) return json('MISSING_CRON_SECRET', 500);

  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return json('UNAUTHORIZED', 401);
  }

  const env = readRequiredWebPushEnv();
  if (!env) return json('MISSING_WEB_PUSH_ENV', 500);

  const supabase = getServerSupabaseAdmin();
  const todayKey = getKstDayKeyUTC();
  const now = new Date().toISOString();

  const summary = {
    considered: 0,
    eligible: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    deactivated: 0,
  };

  try {
    const { data: subscriptionData, error: subscriptionError } = await supabase
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth, failure_count')
      .eq('is_active', true);

    if (subscriptionError) {
      console.error('[cron/send-session-reminders] subscription query failed');
      return json('SERVER_ERROR', 500);
    }

    const grouped = groupSubscriptions((subscriptionData ?? []) as PushSubscriptionRow[]);
    const userIds = [...grouped.keys()];
    summary.considered = userIds.length;

    if (userIds.length === 0) {
      return NextResponse.json({ ok: true, eligible: 0, sent: 0, skipped: 0, failed: 0, deactivated: 0, considered: 0 });
    }

    const { data: progressData, error: progressError } = await supabase
      .from('session_program_progress')
      .select('user_id, total_sessions, completed_sessions, last_completed_day_key')
      .in('user_id', userIds);

    if (progressError) {
      console.error('[cron/send-session-reminders] progress query failed');
      return json('SERVER_ERROR', 500);
    }

    const progressByUser = new Map<string, ProgressRow>();
    for (const row of (progressData ?? []) as ProgressRow[]) {
      progressByUser.set(row.user_id, row);
    }

    const eligibleUserIds = userIds.filter((userId) => {
      const progress = progressByUser.get(userId);
      if (!progress) return false;
      const total = progress.total_sessions ?? 0;
      const completed = progress.completed_sessions ?? 0;
      const lastCompletedKey = progress.last_completed_day_key != null
        ? String(progress.last_completed_day_key)
        : null;

      return total > 0 && completed < total && lastCompletedKey !== todayKey;
    });

    summary.eligible = eligibleUserIds.length;
    webpush.setVapidDetails(env.contactEmail, env.publicKey, env.privateKey);

    for (const userId of eligibleUserIds) {
      const delivery = await reserveDelivery(supabase, userId, todayKey, now);
      if (delivery === 'duplicate') {
        summary.skipped += 1;
        continue;
      }
      if (!delivery) {
        summary.failed += 1;
        continue;
      }

      const subscriptions = grouped.get(userId) ?? [];
      const attempts: AttemptMetadata[] = [];
      let sentCount = 0;
      let failedCount = 0;
      let deactivatedCount = 0;
      let representativeSubscriptionId: string | null = null;

      for (const row of subscriptions) {
        const subscription: PushSubscription = {
          endpoint: row.endpoint,
          keys: {
            p256dh: row.p256dh,
            auth: row.auth,
          },
        };

        try {
          await webpush.sendNotification(subscription, JSON.stringify(DAILY_SESSION_PAYLOAD));
          sentCount += 1;
          representativeSubscriptionId ??= row.id;
          attempts.push({ subscription_id: row.id, status: 'sent' });
          await updateSubscriptionState(supabase, row, {
            last_success_at: now,
            failure_count: 0,
          });
        } catch (error) {
          failedCount += 1;
          representativeSubscriptionId ??= row.id;
          const statusCode = getStatusCode(error);
          const shouldDeactivate = statusCode === 404 || statusCode === 410;
          if (shouldDeactivate) {
            deactivatedCount += 1;
            summary.deactivated += 1;
          }
          attempts.push({
            subscription_id: row.id,
            status: 'failed',
            error_code: shouldDeactivate ? 'WEB_PUSH_GONE' : 'WEB_PUSH_FAILED',
          });
          await updateSubscriptionState(supabase, row, {
            ...(shouldDeactivate ? { is_active: false } : {}),
            last_failure_at: now,
            failure_count: (row.failure_count ?? 0) + 1,
          });
        }
      }

      const deliveryPatch = {
        subscription_id: representativeSubscriptionId,
        metadata: {
          attempts,
          sent_count: sentCount,
          failed_count: failedCount,
          deactivated_count: deactivatedCount,
        },
      };

      if (sentCount > 0) {
        summary.sent += 1;
        await updateDelivery(supabase, delivery.id, {
          ...deliveryPatch,
          status: 'sent',
          sent_at: now,
          error_code: null,
          error_message: null,
        });
      } else {
        summary.failed += 1;
        await updateDelivery(supabase, delivery.id, {
          ...deliveryPatch,
          status: 'failed',
          error_code: 'WEB_PUSH_FAILED',
          error_message: 'All active push subscriptions failed',
        });
      }
    }

    return NextResponse.json({ ok: true, ...summary });
  } catch {
    console.error('[cron/send-session-reminders] server error');
    return json('SERVER_ERROR', 500);
  }
}

export async function GET(req: NextRequest) {
  return handleCron(req);
}

export async function POST(req: NextRequest) {
  return handleCron(req);
}
