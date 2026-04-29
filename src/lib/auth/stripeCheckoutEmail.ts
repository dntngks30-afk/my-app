/**
 * PR-AUTH-IOS-LOGIN-POLICY-01 — Stripe checkout 고객 이메일 결정 (JWT 우선, DB 폴백)
 */

export function coalesceStripeUserEmail(
  authEmail: string | null | undefined,
  dbEmail: string | null | undefined,
): string {
  const a = authEmail != null ? String(authEmail).trim() : '';
  if (a) return a;
  const b = dbEmail != null ? String(dbEmail).trim() : '';
  return b;
}
