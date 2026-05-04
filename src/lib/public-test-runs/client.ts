'use client';

/**
 * PR-KPI-PUBLIC-TEST-RUNS-03B — Client-side active public test run (localStorage + best-effort APIs).
 * Never throws; failures must not block the public funnel.
 */

import { getOrCreateAnonId } from '@/lib/public-results/anon-id';
import { getPilotCodeForCurrentFlow } from '@/lib/pilot/pilot-context';
import { supabaseBrowser } from '@/lib/supabase';

export const PUBLIC_TEST_RUN_STORAGE_KEY = 'moveRePublicTestRun:v1';

export type StoredPublicTestRun = {
  runId: string;
  anonId: string;
  pilotCode: string | null;
  startedAt: string;
  ctaClickedAt?: string;
  startSynced?: boolean;
};

function generateClientUuid(): string | null {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function readStoredRun(): StoredPublicTestRun | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PUBLIC_TEST_RUN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const o = parsed as Record<string, unknown>;
    if (
      typeof o.runId !== 'string' ||
      typeof o.anonId !== 'string' ||
      typeof o.startedAt !== 'string'
    ) {
      return null;
    }
    return {
      runId: o.runId,
      anonId: o.anonId,
      pilotCode: typeof o.pilotCode === 'string' || o.pilotCode === null ? o.pilotCode : null,
      startedAt: o.startedAt,
      ctaClickedAt: typeof o.ctaClickedAt === 'string' ? o.ctaClickedAt : undefined,
      startSynced: typeof o.startSynced === 'boolean' ? o.startSynced : undefined,
    };
  } catch {
    return null;
  }
}

function writeStoredRun(run: StoredPublicTestRun): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PUBLIC_TEST_RUN_STORAGE_KEY, JSON.stringify(run));
  } catch {
    /* ignore */
  }
}

async function postStartSync(payload: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch('/api/public-test-runs/start', {
      method: 'POST',
      cache: 'no-store',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return false;
    const data = (await res.json().catch(() => null)) as { ok?: boolean } | null;
    return Boolean(data && data.ok === true);
  } catch {
    return false;
  }
}

async function postMarkSync(payload: Record<string, unknown>): Promise<void> {
  await fetch('/api/public-test-runs/mark', {
    method: 'POST',
    cache: 'no-store',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {
    /* best-effort */
  });
}

async function postAuthLinkSync(
  payload: Record<string, unknown>,
  accessToken: string
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const res = await fetch('/api/public-test-runs/auth-link', {
      method: 'POST',
      cache: 'no-store',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });
    if (res.status === 401) return { ok: true, reason: 'no_session' };
    const data = (await res.json().catch(() => null)) as { ok?: boolean; reason?: string } | null;
    return {
      ok: data?.ok === true,
      reason: typeof data?.reason === 'string' ? data.reason : undefined,
    };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'exception' };
  }
}

async function syncStartToServer(run: StoredPublicTestRun): Promise<boolean> {
  return postStartSync({
    runId: run.runId,
    anonId: run.anonId,
    pilotCode: run.pilotCode,
    startedAtIso: run.startedAt,
    ctaClickedAtIso: run.ctaClickedAt ?? run.startedAt,
  });
}

export function getActivePublicTestRun(): StoredPublicTestRun | null {
  return readStoredRun();
}

export function clearActivePublicTestRun(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(PUBLIC_TEST_RUN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export async function startNewPublicTestRunClient(input?: {
  entryPath?: string | null;
  entryReferrer?: string | null;
}): Promise<{ ok: boolean; runId?: string; reason?: string }> {
  try {
    const runId = generateClientUuid();
    if (!runId) {
      return { ok: false, reason: 'uuid_unavailable' };
    }

    const anonId = getOrCreateAnonId();
    if (!anonId || anonId.trim() === '') {
      return { ok: false, reason: 'anon_unavailable' };
    }

    const pilotCode = getPilotCodeForCurrentFlow();
    const startedAt = new Date().toISOString();
    const stored: StoredPublicTestRun = {
      runId,
      anonId,
      pilotCode,
      startedAt,
      ctaClickedAt: startedAt,
      startSynced: false,
    };

    writeStoredRun(stored);

    const synced = await postStartSync({
      runId,
      anonId,
      pilotCode,
      entryPath: input?.entryPath ?? null,
      entryReferrer: input?.entryReferrer ?? null,
      startedAtIso: startedAt,
      ctaClickedAtIso: startedAt,
    });

    const next = readStoredRun();
    if (next && next.runId === runId) {
      writeStoredRun({ ...next, startSynced: synced });
    }

    return { ok: true, runId };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'exception' };
  }
}

async function ensureRunSynced(run: StoredPublicTestRun): Promise<StoredPublicTestRun> {
  if (run.startSynced) return run;
  const ok = await syncStartToServer(run);
  const updated = readStoredRun();
  if (updated && updated.runId === run.runId) {
    writeStoredRun({ ...updated, startSynced: ok });
    return { ...updated, startSynced: ok };
  }
  return { ...run, startSynced: ok };
}

export async function markPublicTestRunMilestoneClient(
  milestone:
    | 'survey_started'
    | 'survey_completed'
    | 'result_viewed'
    | 'execution_cta_clicked'
    | 'auth_success'
    | 'first_app_home_viewed'
): Promise<{ ok: boolean; reason?: string }> {
  try {
    let active = readStoredRun();
    if (!active) {
      return { ok: true, reason: 'no_active_run' };
    }

    active = await ensureRunSynced(active);

    await postMarkSync({
      runId: active.runId,
      anonId: active.anonId,
      kind: 'milestone',
      milestone,
    });

    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'exception' };
  }
}

export async function linkActivePublicTestRunToCurrentUserClient(input?: {
  pilotCode?: string | null;
}): Promise<{ ok: boolean; reason?: string }> {
  try {
    let active = readStoredRun();
    if (!active) {
      return { ok: true, reason: 'no_active_run' };
    }

    active = await ensureRunSynced(active);

    const {
      data: { session },
    } = await supabaseBrowser.auth.getSession();
    const accessToken = session?.access_token;
    if (!accessToken) {
      return { ok: true, reason: 'no_session' };
    }

    return postAuthLinkSync(
      {
        runId: active.runId,
        anonId: active.anonId,
        pilotCode: input?.pilotCode ?? active.pilotCode,
      },
      accessToken
    );
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'exception' };
  }
}

export async function markPublicTestRunRefineChoiceClient(
  choice: 'baseline' | 'camera'
): Promise<{ ok: boolean; reason?: string }> {
  try {
    let active = readStoredRun();
    if (!active) {
      return { ok: true, reason: 'no_active_run' };
    }

    active = await ensureRunSynced(active);

    await postMarkSync({
      runId: active.runId,
      anonId: active.anonId,
      kind: 'refine_choice',
      choice,
    });

    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'exception' };
  }
}

export function getActivePublicTestRunForResult(): {
  publicTestRunId: string;
  publicTestRunAnonId: string;
} | null {
  const stored = readStoredRun();
  if (!stored) return null;

  const currentAnon = getOrCreateAnonId();
  if (!currentAnon || currentAnon.trim() !== stored.anonId.trim()) {
    return null;
  }

  return {
    publicTestRunId: stored.runId,
    publicTestRunAnonId: stored.anonId,
  };
}
