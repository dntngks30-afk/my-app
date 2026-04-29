/**
 * PR-AUTH-IOS-LOGIN-POLICY-01 — 이메일 수집 API·스모크 공용 검증
 */

const EMAIL_RE =
  /^[a-z0-9._%+-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;

export function normalizeCollectEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim().toLowerCase();
  if (!t || t.length > 320) return null;
  if (!EMAIL_RE.test(t)) return null;
  return t;
}
