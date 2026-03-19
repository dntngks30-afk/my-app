/**
 * FLOW-01 — Anon ID 헬퍼
 *
 * public_results 테이블의 anon 소유권 식별자.
 * client에서 생성·저장·전송하는 UUID.
 *
 * 전략:
 * - localStorage에 UUID v4 형태로 저장
 * - 브라우저 재시작/캐시 삭제 전까지 유지
 * - FLOW-05 claim 후에도 유지 (새 anon ID가 새 결과용으로 계속 사용됨)
 *
 * ⚠️ 이 ID는 보안 토큰이 아니다. 식별 목적만.
 *    실제 소유권 잠금은 서버 side에서 user_id claim으로 처리됨 (FLOW-05).
 *
 * @see supabase/migrations/202603270000_flow01_public_results.sql
 */

export const ANON_ID_KEY = 'moveReAnonId:v1';

/**
 * 간단한 UUID v4 생성 (crypto.randomUUID 우선, fallback 포함)
 */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // fallback: 수동 UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * 현재 anon ID를 반환한다.
 * 없으면 새로 생성하고 localStorage에 저장한다.
 *
 * @returns anon ID string
 */
export function getOrCreateAnonId(): string {
  if (typeof window === 'undefined') {
    // SSR 환경: 런타임 anon ID 생성 불가 → 빈 문자열 반환
    // 실제 저장은 항상 브라우저 클라이언트에서 발생
    return '';
  }
  try {
    const existing = localStorage.getItem(ANON_ID_KEY);
    if (existing && existing.length > 0) return existing;
    const newId = generateUUID();
    localStorage.setItem(ANON_ID_KEY, newId);
    return newId;
  } catch {
    // localStorage 접근 실패 (개인정보 보호 모드 등) → 일시적 ID
    return generateUUID();
  }
}

/**
 * 현재 anon ID를 읽는다 (생성하지 않음).
 * 없으면 null 반환.
 */
export function readAnonId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(ANON_ID_KEY) || null;
  } catch {
    return null;
  }
}
