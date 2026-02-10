import { NextResponse } from 'next/server';

export function requireAdminKey(req: Request) {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) {
    return NextResponse.json(
      { error: 'Server misconfigured: ADMIN_API_KEY missing' },
      { status: 500 }
    );
  }

  const got = req.headers.get('x-admin-key');
  if (!got || got !== expected) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return null;
}
