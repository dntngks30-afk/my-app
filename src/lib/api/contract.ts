/**
 * Session Rail API 응답 계약 — SSOT.
 * 성공: { ok: true, data, ...extras }
 * 실패: { ok: false, error: { code, message, details? } }
 */

import { NextResponse } from 'next/server';

export const ApiErrorCode = {
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  FORBIDDEN: 'FORBIDDEN',
  DEEP_RESULT_MISSING: 'DEEP_RESULT_MISSING',
  SESSION_PLAN_NOT_FOUND: 'SESSION_PLAN_NOT_FOUND',
  PROGRAM_PROGRESS_NOT_FOUND: 'PROGRAM_PROGRESS_NOT_FOUND',
  PROGRAM_FINISHED: 'PROGRAM_FINISHED',
  DAILY_LIMIT_REACHED: 'DAILY_LIMIT_REACHED',
  SESSION_ALREADY_COMPLETED: 'SESSION_ALREADY_COMPLETED',
  CONCURRENT_UPDATE: 'CONCURRENT_UPDATE',
  REQUEST_DEDUPED: 'REQUEST_DEDUPED',
  PAST_SESSION_READ_ONLY: 'PAST_SESSION_READ_ONLY',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  POLICY_LOCKED: 'POLICY_LOCKED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  /** PR-DATA-01: evidence gate */
  NOT_ENOUGH_COMPLETION_COVERAGE: 'NOT_ENOUGH_COMPLETION_COVERAGE',
  MAIN_SEGMENT_REQUIRED: 'MAIN_SEGMENT_REQUIRED',
  INSUFFICIENT_EXECUTION_EVIDENCE: 'INSUFFICIENT_EXECUTION_EVIDENCE',
} as const;

export type ApiErrorCode = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

/** PR-24: User-scoped API 응답은 SW/runtime 캐시에 저장되면 안 됨. */
const CACHE_NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * 성공 응답. data + extras(하위호환용 top-level 필드).
 * Cache-Control: no-store 자동 적용.
 */
export function ok<T>(data: T, extras?: Record<string, unknown>): NextResponse {
  const body = { ok: true as const, data, ...extras };
  return NextResponse.json(body, { status: 200, headers: CACHE_NO_STORE });
}

/**
 * 실패 응답. details는 1KB 이하, 민감정보 금지.
 * errorExtras: error 객체에 병합 (예: next_unlock_at — FE 하위호환)
 */
export function fail(
  status: number,
  code: ApiErrorCode,
  message: string,
  details?: Record<string, unknown>,
  errorExtras?: Record<string, unknown>
): NextResponse {
  const error: Record<string, unknown> = { code, message };
  if (details) error.details = details;
  if (errorExtras) Object.assign(error, errorExtras);
  return NextResponse.json(
    { ok: false as const, error },
    { status, headers: CACHE_NO_STORE }
  );
}
