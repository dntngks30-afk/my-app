/**
 * PR-PILOT-ENTRY-01 — Root query pilot attribution (entry-only).
 * Cleanup is triggered only when the current page load had a valid ?pilot= query (see landing page ref).
 */

import { FUNNEL_KEY } from '@/lib/public/intro-funnel';
import { SURVEY_SESSION_KEY } from '@/lib/public/survey-session-types';
import { clearBridgeContext } from '@/lib/public-results/public-result-bridge';
import { clearPublicResultHandoff } from '@/lib/public-results/public-result-handoff';
import { CAMERA_RESULT_KEY } from '@/lib/camera/camera-result';
import { CAMERA_TEST_KEY } from '@/lib/public/camera-test';
import { clearStoredCameraTraceData } from '@/lib/camera/trace/camera-trace-storage';

export const PILOT_CONTEXT_KEY = 'moveRePilotContext:v1';

/** Matches features/movement-test/utils/session.ts LEGACY_STORAGE_KEY */
const LEGACY_MOVEMENT_TEST_RESULT_KEY = 'movement-test-result';

const MOVEMENT_TEST_SESSION_V1_KEY = 'movementTestSession:v1';
const MOVEMENT_TEST_ANSWERS_KEY = 'movementTest:answers:v1';
const MOVEMENT_TEST_DRAFT_KEY = 'movementTest:draft:v1';

export type PilotContextSource = 'root_query' | 'in_app_auth_handoff';

export interface PilotContextV1 {
  code: string;
  source: PilotContextSource;
  enteredAt: string;
  version: 'pilot_entry_v1';
}

function removeLocalStorageKey(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/**
 * Validates `pilot` query value: non-empty, bounded length, safe charset only.
 */
export function getPilotCodeFromSearchParams(searchParams: URLSearchParams): string | null {
  const raw = searchParams.get('pilot');
  if (raw == null) return null;
  const code = raw.trim();
  if (code.length === 0 || code.length > 64) return null;
  if (!/^[a-zA-Z0-9._-]+$/.test(code)) return null;
  return code;
}

export function getPilotCodeFromCurrentUrl(): string | null {
  if (typeof window === 'undefined') return null;
  return getPilotCodeFromSearchParams(new URLSearchParams(window.location.search));
}

/** URL 또는 저장된 파일럿 컨텍스트에서 검증된 코드 (SSR 안전). */
export function getPilotCodeForCurrentFlow(): string | null {
  const fromUrl = getPilotCodeFromCurrentUrl();
  if (fromUrl) return fromUrl;

  const stored = readPilotContext()?.code ?? null;
  if (!stored) return null;

  return getPilotCodeFromSearchParams(new URLSearchParams({ pilot: stored }));
}

export function readPilotContext(): PilotContextV1 | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PILOT_CONTEXT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const p = parsed as Record<string, unknown>;
    if (
      typeof p.code !== 'string' ||
      (p.source !== 'root_query' && p.source !== 'in_app_auth_handoff') ||
      typeof p.enteredAt !== 'string' ||
      p.version !== 'pilot_entry_v1'
    ) {
      return null;
    }
    return {
      code: p.code,
      source: p.source as PilotContextSource,
      enteredAt: p.enteredAt,
      version: 'pilot_entry_v1',
    };
  } catch {
    return null;
  }
}

export function savePilotContextFromCode(code: string, source: PilotContextSource): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: PilotContextV1 = {
      code,
      source,
      enteredAt: new Date().toISOString(),
      version: 'pilot_entry_v1',
    };
    localStorage.setItem(PILOT_CONTEXT_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

/** Call only after successful pilot redeem (`redeemed` / `already_redeemed`). */
export function clearPilotContext(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(PILOT_CONTEXT_KEY);
  } catch {
    // ignore
  }
}

/**
 * Allowlisted public pre-auth temp keys only.
 * Does NOT remove moveRePilotContext:v1, moveReAnonId:v1, payment, /app, readiness, etc.
 */
export function clearPublicPreAuthTempStateForPilotStart(): void {
  if (typeof window === 'undefined') return;

  clearBridgeContext();
  clearPublicResultHandoff('baseline');
  clearPublicResultHandoff('refined');
  clearStoredCameraTraceData();

  removeLocalStorageKey(FUNNEL_KEY);
  removeLocalStorageKey(SURVEY_SESSION_KEY);
  removeLocalStorageKey(MOVEMENT_TEST_SESSION_V1_KEY);
  removeLocalStorageKey(LEGACY_MOVEMENT_TEST_RESULT_KEY);
  removeLocalStorageKey(MOVEMENT_TEST_ANSWERS_KEY);
  removeLocalStorageKey(MOVEMENT_TEST_DRAFT_KEY);
  removeLocalStorageKey(CAMERA_RESULT_KEY);
  removeLocalStorageKey(CAMERA_TEST_KEY);
}
