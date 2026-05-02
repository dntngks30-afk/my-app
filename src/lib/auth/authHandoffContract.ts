/**
 * PR-AUTH-HANDOFF-01 — /auth/handoff 및 next 계약 검증.
 * 토큰·이메일·auth code 는 URL 금지.
 */

import type { BridgeResultStage } from '@/lib/public-results/public-result-bridge';
import { getPilotCodeFromSearchParams } from '@/lib/pilot/pilot-context';

export const AUTH_HANDOFF_SOURCE = 'in_app_auth_handoff' as const;

/** 10~15분 권장 중간값 */
export const AUTH_HANDOFF_TTL_MS = 12 * 60 * 1000;

export type HandoffMethod = 'google' | 'kakao' | 'email';
export type HandoffMode = 'login' | 'signup';

export const DEFAULT_HANDOFF_NEXT = '/execution/start';

const UUID_LIKE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * 내부 상대 경로만 허용. open redirect·scheme injection 차단.
 */
export function sanitizeAuthNextPath(
  path: string | null | undefined,
  defaultPath: string = '/app/home',
): string {
  if (!path || typeof path !== 'string') return defaultPath;
  const t = path.trim();
  if (!t.startsWith('/') || t.startsWith('//')) return defaultPath;
  const lower = t.toLowerCase();
  if (lower.startsWith('/\\') || lower.includes('javascript:')) return defaultPath;
  const pathOnly = t.split('?')[0].split('#')[0];
  if (pathOnly.includes(':')) return defaultPath;
  return t;
}

/** `/admin/kpi` 직접 진입 후 인증으로 보낼 때만 사용 (일반 로그인에는 붙이지 않음). */
export const ADMIN_KPI_AUTH_INTENT = 'admin_kpi' as const;

/** 안전하게 검증된 next 문자열이 KPI 대시보드 경로인지 (`/admin/kpi`, `/admin/kpi?…`). */
export function isAdminKpiReturnPath(path: string): boolean {
  const t = path.trim();
  const pathOnly = t.split('?')[0].split('#')[0];
  if (pathOnly !== '/admin/kpi') return false;
  return true;
}

/**
 * /app/auth 진입 전용: `/admin/kpi`는 `intent=admin_kpi`일 때만 허용.
 * intent 없이 `next=/admin/kpi`만 오면 open redirect·권한 우회 인상을 줄이기 위해 기본 경로로 떨어짐.
 */
export function resolveAppAuthLoginRedirect(
  rawNext: string | null | undefined,
  intent: string | null | undefined,
  defaultPath: string = '/app/home',
): string {
  let normalized: string | null | undefined = rawNext;
  if (typeof rawNext === 'string' && rawNext.length > 0) {
    try {
      normalized = decodeURIComponent(rawNext);
    } catch {
      normalized = rawNext;
    }
  }
  const sanitized = sanitizeAuthNextPath(
    typeof normalized === 'string' ? normalized : null,
    defaultPath,
  );

  if (intent === ADMIN_KPI_AUTH_INTENT && isAdminKpiReturnPath(sanitized)) {
    return sanitized;
  }
  if (isAdminKpiReturnPath(sanitized)) {
    return defaultPath;
  }
  return sanitized;
}

export function validatePublicResultIdForHandoff(id: string | null | undefined): id is string {
  if (id == null || typeof id !== 'string') return false;
  const t = id.trim();
  if (t.length < 8 || t.length > 128) return false;
  if (!/^[0-9a-fA-F-]+$/.test(t)) return false;
  return true;
}

export function validateAnonIdForHandoff(id: string | null | undefined): id is string {
  if (id == null || typeof id !== 'string') return false;
  const t = id.trim();
  return t.length > 0 && t.length <= 128 && UUID_LIKE.test(t);
}

export function validateStageForHandoff(s: string | null | undefined): s is BridgeResultStage {
  return s === 'baseline' || s === 'refined';
}

export function parseHandoffTimestamp(raw: string | null): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return n < 1e12 ? n * 1000 : n;
}

export type ParsedAuthHandoff = {
  method: HandoffMethod;
  mode: HandoffMode;
  next: string;
  publicResultId: string | null;
  stage: BridgeResultStage | null;
  anonId: string | null;
  pilot: string | null;
  ts: number;
};

export function parseAuthHandoffSearchParams(
  searchParams: URLSearchParams,
  nowMs: number = Date.now(),
): { ok: true; value: ParsedAuthHandoff } | { ok: false } {
  const methodRaw = searchParams.get('method');
  const modeRaw = searchParams.get('mode');
  const source = searchParams.get('source');
  const tsRaw = searchParams.get('ts');

  if (source !== AUTH_HANDOFF_SOURCE) return { ok: false };

  const method =
    methodRaw === 'google' || methodRaw === 'kakao' || methodRaw === 'email'
      ? methodRaw
      : null;
  if (!method) return { ok: false };

  let mode: HandoffMode = 'login';
  if (method === 'email') {
    if (modeRaw !== 'login' && modeRaw !== 'signup') return { ok: false };
    mode = modeRaw;
  } else if (modeRaw != null && modeRaw !== 'login') {
    return { ok: false };
  }

  const ts = parseHandoffTimestamp(tsRaw);
  if (ts == null) return { ok: false };
  if (nowMs - ts > AUTH_HANDOFF_TTL_MS || nowMs - ts < -60_000) return { ok: false };

  const next = sanitizeAuthNextPath(searchParams.get('next'), DEFAULT_HANDOFF_NEXT);

  const pr = searchParams.get('publicResultId');
  const stageRaw = searchParams.get('stage');
  let publicResultId: string | null = null;
  let stage: BridgeResultStage | null = null;
  if (pr != null && pr !== '') {
    if (!validatePublicResultIdForHandoff(pr)) return { ok: false };
    if (!validateStageForHandoff(stageRaw)) return { ok: false };
    publicResultId = pr.trim();
    stage = stageRaw;
  } else if (stageRaw != null && stageRaw !== '') {
    return { ok: false };
  }

  const anonParam = searchParams.get('anonId');
  let anonId: string | null = null;
  if (anonParam != null && anonParam !== '') {
    if (!validateAnonIdForHandoff(anonParam)) return { ok: false };
    anonId = anonParam.trim();
  }

  const pilot = getPilotCodeFromSearchParams(searchParams);

  return {
    ok: true,
    value: {
      method,
      mode,
      next,
      publicResultId,
      stage,
      anonId,
      pilot,
      ts,
    },
  };
}

export function buildExecutionStartQueryParts(input: {
  publicResultId: string | null;
  stage: BridgeResultStage;
  anonId: string | null;
  pilot: string | null;
}): URLSearchParams {
  const sp = new URLSearchParams();
  if (input.publicResultId && validatePublicResultIdForHandoff(input.publicResultId)) {
    sp.set('publicResultId', input.publicResultId);
    sp.set('stage', input.stage);
  }
  if (input.anonId && validateAnonIdForHandoff(input.anonId)) {
    sp.set('anonId', input.anonId);
  }
  if (input.pilot && getPilotCodeFromSearchParams(new URLSearchParams({ pilot: input.pilot }))) {
    sp.set('pilot', input.pilot);
  }
  return sp;
}

export function buildExecutionStartPathWithBridgeQuery(input: {
  publicResultId: string | null;
  stage: BridgeResultStage;
  anonId: string | null;
  pilot: string | null;
}): string {
  const q = buildExecutionStartQueryParts(input);
  const qs = q.toString();
  return qs ? `${DEFAULT_HANDOFF_NEXT}?${qs}` : DEFAULT_HANDOFF_NEXT;
}

/** `/execution/start?...` 또는 내부 next 문자열에서 handoff용 bridge 필드 추출 */
export function extractBridgeQueryFromInternalPath(path: string): {
  publicResultId: string | null;
  stage: BridgeResultStage | null;
  anonId: string | null;
  pilot: string | null;
} {
  const empty = {
    publicResultId: null,
    stage: null,
    anonId: null,
    pilot: null,
  } as const;
  const qIdx = path.indexOf('?');
  if (qIdx < 0) return { ...empty };
  const sp = new URLSearchParams(path.slice(qIdx + 1));
  const pr = sp.get('publicResultId');
  const st = sp.get('stage');
  if (!pr || !validatePublicResultIdForHandoff(pr)) return { ...empty };
  if (!validateStageForHandoff(st)) return { ...empty };
  const rawAnon = sp.get('anonId');
  return {
    publicResultId: pr.trim(),
    stage: st,
    anonId: rawAnon && validateAnonIdForHandoff(rawAnon) ? rawAnon.trim() : null,
    pilot: getPilotCodeFromSearchParams(sp),
  };
}
