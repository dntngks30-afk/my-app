/**
 * FLOW-03 — Public Result Bridge Context
 *
 * public result → login/pay → onboarding-prep 흐름에서
 * 결과 identity를 유지하기 위한 최소 bridge contract.
 *
 * ─── 역할 경계 ─────────────────────────────────────────────────────────────────
 * - 이 파일은 bridge context 저장/로드만 담당
 * - CTA 분기 로직은 useExecutionStartBridge 훅에서 처리
 * - onboarding 구현은 FLOW-04, claim은 FLOW-05
 *
 * ─── localStorage 키 ──────────────────────────────────────────────────────────
 * moveReBridgeContext:v1 — JSON { publicResultId, resultStage, anonId?, createdAt }
 *
 * ─── 사용 시나리오 ────────────────────────────────────────────────────────────
 * 1. 결과 페이지에서 "실행 시작" 클릭 → context 저장 후 login/pay로 이동
 * 2. login/pay 완료 후 onboarding-prep 진입 시 context 복구
 * 3. query param으로도 전달 가능: /onboarding-prep?publicResultId=xxx&stage=baseline
 *
 * @see src/lib/public-results/public-result-handoff.ts (FLOW-02)
 * @see src/app/onboarding-prep/page.tsx (FLOW-03 bridge destination)
 */

import { loadPublicResultHandoff } from './public-result-handoff';

// ─── 타입 ─────────────────────────────────────────────────────────────────────

export type BridgeResultStage = 'baseline' | 'refined';

/**
 * PR-PAY-CONTINUITY-05 — 로그인/회원가입 후 결과 페이지로 돌아올 때
 * "실행 시작"을 한 번 더 누르지 않도록 URL에 붙이는 쿼리.
 * @see useResumeExecutionAfterAuth
 */
export const CONTINUE_EXECUTION_QUERY = 'continue' as const;
export const CONTINUE_EXECUTION_VALUE = 'execution' as const;

export interface PublicResultBridgeContext {
  publicResultId: string;
  resultStage: BridgeResultStage;
  anonId?: string | null;
  /** 저장 시각 (ISO) — 만료/정리용 */
  createdAt: string;
}

const BRIDGE_KEY = 'moveReBridgeContext:v1';

// ─── Bridge Context 헬퍼 ─────────────────────────────────────────────────────

/**
 * bridge context를 localStorage에 저장한다.
 * login/pay redirect 전에 호출.
 */
export function saveBridgeContext(ctx: Omit<PublicResultBridgeContext, 'createdAt'>): void {
  if (typeof window === 'undefined') return;
  try {
    const full: PublicResultBridgeContext = {
      ...ctx,
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem(BRIDGE_KEY, JSON.stringify(full));
  } catch {
    // localStorage 실패 시 조용히 무시
  }
}

/**
 * 저장된 bridge context를 읽는다.
 * 없거나 파싱 실패 시 null.
 */
export function loadBridgeContext(): PublicResultBridgeContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(BRIDGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const p = parsed as Record<string, unknown>;
    if (
      typeof p.publicResultId !== 'string' ||
      (p.resultStage !== 'baseline' && p.resultStage !== 'refined')
    ) {
      return null;
    }
    return {
      publicResultId: p.publicResultId as string,
      resultStage: p.resultStage as BridgeResultStage,
      anonId: typeof p.anonId === 'string' ? p.anonId : null,
      createdAt: typeof p.createdAt === 'string' ? p.createdAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * bridge context를 삭제한다.
 * (onboarding 완료 후 등)
 */
export function clearBridgeContext(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(BRIDGE_KEY);
  } catch {
    // 무시
  }
}

/**
 * onboarding-prep URL을 생성한다.
 * query param으로 publicResultId, stage 전달.
 * checkout success next로 사용.
 */
export function buildOnboardingPrepUrl(
  publicResultId: string,
  stage: BridgeResultStage,
  anonId?: string | null
): string {
  const params = new URLSearchParams();
  params.set('publicResultId', publicResultId);
  params.set('stage', stage);
  if (anonId && typeof anonId === 'string') {
    params.set('anonId', anonId);
  }
  return `/onboarding-prep?${params.toString()}`;
}

/**
 * 실행 시작 CTA → 로그인으로 갈 때 `next`에 붙여, 인증 후 같은 결과 페이지에서
 * bridge 컨텍스트가 있으면 실행 분기(결제/온보딩)를 자동으로 한 번 이어준다.
 */
export function appendContinueExecutionParam(path: string): string {
  if (path.includes(`${CONTINUE_EXECUTION_QUERY}=`)) return path;
  return path.includes('?')
    ? `${path}&${CONTINUE_EXECUTION_QUERY}=${CONTINUE_EXECUTION_VALUE}`
    : `${path}?${CONTINUE_EXECUTION_QUERY}=${CONTINUE_EXECUTION_VALUE}`;
}

/**
 * URL에서 continue=execution 제거 (자동 이어가기 후 주소 정리용).
 */
export function stripContinueExecutionParam(fullPath: string): string {
  const qIndex = fullPath.indexOf('?');
  if (qIndex < 0) return fullPath;
  const pathname = fullPath.slice(0, qIndex);
  const qs = fullPath.slice(qIndex + 1);
  const sp = new URLSearchParams(qs);
  if (sp.get(CONTINUE_EXECUTION_QUERY) !== CONTINUE_EXECUTION_VALUE) return fullPath;
  sp.delete(CONTINUE_EXECUTION_QUERY);
  const next = sp.toString();
  return next ? `${pathname}?${next}` : pathname;
}

/**
 * 페이지 state·핸드오프·bridge context 순으로 public result id를 해석한다.
 * (로그인 직후 persist 비동기 타이밍에서도 bridge에 저장된 id로 이어갈 수 있게)
 */
export function resolvePublicResultIdForBridgeStage(
  explicit: string | null,
  stage: BridgeResultStage
): string | null {
  if (explicit) return explicit;
  const ctx = loadBridgeContext();
  if (ctx && ctx.resultStage === stage && ctx.publicResultId) return ctx.publicResultId;
  return loadPublicResultHandoff(stage);
}
