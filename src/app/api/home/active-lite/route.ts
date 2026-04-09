import { NextRequest } from 'next/server';
import { handleGetHomeActiveLiteBootstrap } from '@/lib/session/home-active-lite-bootstrap';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/home/active-lite
 *
 * Canonical home-lite owner route.
 * Returns only active-lite bootstrap data for home/stats/profile tab hydration.
 */
export async function GET(req: NextRequest) {
  return handleGetHomeActiveLiteBootstrap(req, {
    errorTag: '[home/active-lite]',
  });
}
