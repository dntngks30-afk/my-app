import { NextRequest } from 'next/server';
import { handlePostSessionPreviewBootstrap } from '@/lib/session/session-preview-bootstrap';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/session/preview
 *
 * Canonical session-preview owner route.
 * Returns current active-session preview or next-session pre-create preview only.
 */
export async function POST(req: NextRequest) {
  return handlePostSessionPreviewBootstrap(req, {
    errorTag: '[session/preview]',
  });
}
