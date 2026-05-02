import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { getCachedUserId } from '@/lib/auth/requestAuthCache';
import {
  MAX_FEEDBACK_LENGTH,
  MIN_FEEDBACK_LENGTH,
  sanitizeFeedbackCategory,
  sanitizeFeedbackMessage,
} from '@/lib/feedback/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FEEDBACK_TO_EMAIL =
  process.env.FEEDBACK_TO_EMAIL?.trim() || 'movere311@gmail.com';

const FEEDBACK_FROM_EMAIL =
  process.env.FEEDBACK_FROM_EMAIL?.trim() || 'MOVE RE <onboarding@resend.dev>';

function json(code: string, status: number) {
  return NextResponse.json({ ok: false, code }, { status });
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

    const message = sanitizeFeedbackMessage(payload.message);
    const category = sanitizeFeedbackCategory(payload.category);

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

    const userAgent = req.headers.get('user-agent');
    const referer = req.headers.get('referer');

    const { data: inserted, error: insertError } = await supabase
      .from('feedback_reports')
      .insert({
        user_id: userId,
        user_email: userEmail,
        category,
        message,
        status: 'new',
        source: 'journey_feedback',
        user_agent: userAgent,
        referer,
      })
      .select('id')
      .single();

    if (insertError || !inserted?.id) {
      console.error('[feedback] DB insert failed', insertError);
      return json('FEEDBACK_SAVE_FAILED', 500);
    }

    const feedbackId = inserted.id as string;

    let emailSent = false;
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) {
      console.warn('[feedback] missing RESEND_API_KEY; skipped email');
    } else {
      try {
        const resend = new Resend(apiKey);
        const subject = `[MOVE RE 피드백] ${category}`;
        const ua = userAgent ?? 'unknown';
        const ref = referer ?? 'unknown';
        const createdAt = new Date().toISOString();

        const text = [
          `feedback_id: ${feedbackId}`,
          `category: ${category}`,
          `user_id: ${userId}`,
          `user_email: ${userEmail ?? 'unknown'}`,
          `created_at: ${createdAt}`,
          `referer: ${ref}`,
          `user_agent: ${ua}`,
          '',
          'message:',
          message,
        ].join('\n');

        const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6;">
        <h2>MOVE RE 피드백</h2>
        <p><strong>Feedback ID:</strong> ${escapeHtml(feedbackId)}</p>
        <p><strong>Category:</strong> ${escapeHtml(category)}</p>
        <p><strong>User ID:</strong> ${escapeHtml(userId)}</p>
        <p><strong>User Email:</strong> ${escapeHtml(userEmail ?? 'unknown')}</p>
        <p><strong>Created At:</strong> ${escapeHtml(createdAt)}</p>
        <p><strong>Referer:</strong> ${escapeHtml(ref)}</p>
        <p><strong>User Agent:</strong> ${escapeHtml(ua)}</p>
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
          console.error('[feedback] resend failed; saved to DB', error);
        } else {
          emailSent = true;
        }
      } catch (e) {
        console.error('[feedback] resend failed; saved to DB', e);
      }
    }

    return NextResponse.json({
      ok: true,
      id: feedbackId,
      email_sent: emailSent,
    });
  } catch (error) {
    console.error('[feedback] server error', error);
    return json('SERVER_ERROR', 500);
  }
}
