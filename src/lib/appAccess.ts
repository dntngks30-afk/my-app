/**
 * PWA App 액세스 allowlist 체크
 * APP_ACCESS_EMAILS 환경변수: 쉼표로 구분된 이메일 목록 (공백 trim)
 */

/** 서버: APP_ACCESS_EMAILS, 클라이언트: NEXT_PUBLIC_APP_ACCESS_EMAILS */
const RAW =
  (typeof process !== "undefined" && process.env.APP_ACCESS_EMAILS) ||
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_APP_ACCESS_EMAILS) ||
  "";
const EMAILS = RAW.split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/**
 * 이메일이 앱 액세스 허용 목록에 포함되는지 확인
 * @param email - 확인할 이메일 (소문자 변환 후 비교)
 */
export function isAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  return EMAILS.includes(email.trim().toLowerCase());
}

/**
 * allowlist가 비어있는지 (환경변수 미설정)
 */
export function isAllowlistEmpty(): boolean {
  return EMAILS.length === 0;
}
