/**
 * PR-AUTH-HANDOFF-01 — 절대 URL 인앱 handoff 링크 생성 (클라이언트 전용).
 */

import {
  AUTH_HANDOFF_SOURCE,
  type HandoffMethod,
  type HandoffMode,
  sanitizeAuthNextPath,
  DEFAULT_HANDOFF_NEXT,
  validatePublicResultIdForHandoff,
  validateStageForHandoff,
  validateAnonIdForHandoff,
} from '@/lib/auth/authHandoffContract';
import { getPilotCodeFromSearchParams } from '@/lib/pilot/pilot-context';
import type { BridgeResultStage } from '@/lib/public-results/public-result-bridge';

const CANONICAL = process.env.NEXT_PUBLIC_CANONICAL_ORIGIN ?? null;

export type BuildAuthHandoffUrlInput = {
  method: HandoffMethod;
  mode?: HandoffMode;
  next?: string;
  publicResultId?: string | null;
  stage?: BridgeResultStage | null;
  anonId?: string | null;
  pilot?: string | null;
  ts?: number;
};

function handoffOrigin(): string {
  if (typeof window !== 'undefined') {
    return CANONICAL || window.location.origin;
  }
  return CANONICAL || '';
}

export function buildAuthHandoffAbsoluteUrl(input: BuildAuthHandoffUrlInput): string {
  const origin = handoffOrigin();
  if (!origin) return '';

  const next = sanitizeAuthNextPath(input.next, DEFAULT_HANDOFF_NEXT);
  const sp = new URLSearchParams();
  sp.set('method', input.method);
  if (input.method === 'email') {
    sp.set('mode', input.mode ?? 'login');
  }
  sp.set('source', AUTH_HANDOFF_SOURCE);
  sp.set('ts', String(input.ts ?? Date.now()));
  sp.set('next', next);

  if (
    input.publicResultId &&
    validatePublicResultIdForHandoff(input.publicResultId) &&
    input.stage &&
    validateStageForHandoff(input.stage)
  ) {
    sp.set('publicResultId', input.publicResultId);
    sp.set('stage', input.stage);
  }
  if (input.anonId && validateAnonIdForHandoff(input.anonId)) {
    sp.set('anonId', input.anonId);
  }
  if (input.pilot) {
    const p = getPilotCodeFromSearchParams(new URLSearchParams({ pilot: input.pilot }));
    if (p) sp.set('pilot', p);
  }

  return `${origin}/auth/handoff?${sp.toString()}`;
}
