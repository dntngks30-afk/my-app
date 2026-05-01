import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;

  if (!publicKey || publicKey.trim().length === 0) {
    const res = NextResponse.json(
      { ok: false, code: 'MISSING_VAPID_PUBLIC_KEY' },
      { status: 500 }
    );
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  const res = NextResponse.json({ ok: true, publicKey: publicKey.trim() });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
