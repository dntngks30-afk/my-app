import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { getCachedUserId } from '@/lib/auth/requestAuthCache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FEEDBACK_TO_EMAIL =
  process.env.FEEDBACK_TO_EMAIL?.trim() || 'movere311@gmail.com';

const FEEDBACK_FROM_EMAIL =
  process.env.FEEDBACK_FROM_EMAIL?.trim() || 'MOVE RE <onboarding@resend.dev>';

const MAX_FEEDBACK_LENGTH = 2000;
const MIN_FEEDBACK_LENGTH = 5;

const ALLOWED_CATEGORIES = new Set([
  'general',
  'bug',
  'question',
  'improvement',
]);

function json(code: string, status: number) {
  return NextResponse.json({ ok: false, code }, { status });
}

function sanitizeCategory(value: unknown): string {
  if (typeof value !== 'string') return 'general';
  const trimmed = value.trim();
  return ALLOWED_CATEGORIES.has(trimmed) ? trimmed : 'general';
}

function sanitizeMessage(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) {
      console.error('[feedback] missing RESEND_API_KEY');
      return json('MISSING_EMAIL_CONFIG', 500);
    }

    const supabase = getServerSupabaseAdmin();
    const userId = await getCachedUserId(req, supabase);

    if (!userId) {
      return json('UNAUTHORIZED', 401);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json('INVALID_JSON', 400);
    }

    const payload = body as {
      message?: unknown;
      category?: unknown;
    };

    const message = sanitizeMessage(payload.message);
    const category = sanitizeCategory(payload.category);

    if (message.length < MIN_FEEDBACK_LENGTH) {
      return json('MESSAGE_TOO_SHORT', 400);
    }

    if (message.length > MAX_FEEDBACK_LENGTH) {
      return json('MESSAGE_TOO_LONG', 400);
    }

    let userEmail: string | null = null;
    try {
      const { data, error } = await supabase.auth.admin.getUserById(userId);
      if (!error && data.user) {
        userEmail = data.user.email ?? null;
      }
    } catch {
      userEmail = null;
    }

    const userAgent = req.headers.get('user-agent') ?? 'unknown';
    const referer = req.headers.get('referer') ?? 'unknown';
    const createdAt = new Date().toISOString();

    const resend = new Resend(apiKey);

    const subject = `[MOVE RE 피드백] ${category}`;

    const text = [
      `category: ${category}`,
      `user_id: ${userId}`,
      `user_email: ${userEmail ?? 'unknown'}`,
      `created_at: ${createdAt}`,
      `referer: ${referer}`,
      `user_agent: ${userAgent}`,
      '',
      'message:',
      message,
    ].join('\n');

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6;">
        <h2>MOVE RE 피드백</h2>
        <p><strong>Category:</strong> ${escapeHtml(category)}</p>
        <p><strong>User ID:</strong> ${escapeHtml(userId)}</p>
        <p><strong>User Email:</strong> ${escapeHtml(userEmail ?? 'unknown')}</p>
        <p><strong>Created At:</strong> ${escapeHtml(createdAt)}</p>
        <p><strong>Referer:</strong> ${escapeHtml(referer)}</p>
        <p><strong>User Agent:</strong> ${escapeHtml(userAgent)}</p>
        <hr />
        <pre style="white-space: pre-wrap; font-family: inherit;">${escapeHtml(message)}</pre>
      </div>
    `;

    const { error } = await resend.emails.send({
      from: FEEDBACK_FROM_EMAIL,
      to: [FEEDBACK_TO_EMAIL],
      subject,
      text,
      html,
    });

    if (error) {
      console.error('[feedback] resend failed', error);
      return json('EMAIL_SEND_FAILED', 502);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[feedback] server error', error);
    return json('SERVER_ERROR', 500);
  }
}
