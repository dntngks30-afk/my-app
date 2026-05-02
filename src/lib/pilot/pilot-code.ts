const PILOT_CODE_MAX_LEN = 64;
const PILOT_CODE_RE = /^[a-zA-Z0-9._-]+$/;

export function sanitizePilotCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const code = value.trim();
  if (code.length === 0 || code.length > PILOT_CODE_MAX_LEN) return null;
  if (!PILOT_CODE_RE.test(code)) return null;
  return code;
}

export function getPilotCodeFromSearchParams(searchParams: URLSearchParams): string | null {
  return sanitizePilotCode(searchParams.get('pilot'));
}
