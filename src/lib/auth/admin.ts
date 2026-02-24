/**
 * Admin 권한 판별 유틸
 * (B) allowlist + role: ADMIN_EMAIL_ALLOWLIST 또는 public.users.role='admin'
 */

const RAW =
  (typeof process !== "undefined" && process.env.ADMIN_EMAIL_ALLOWLIST) || "";
const ALLOWLIST = RAW.split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/**
 * 이메일이 admin allowlist에 포함되는지
 */
export function isEmailInAdminAllowlist(email: string | null | undefined): boolean {
  if (!email) return false;
  return ALLOWLIST.includes(email.trim().toLowerCase());
}

/**
 * Admin 여부 판별
 * 1) email이 ADMIN_EMAIL_ALLOWLIST에 있으면 true
 * 2) 없으면 public.users에서 role='admin' 확인
 */
export async function isAdmin(
  actorEmail: string | null | undefined,
  actorId: string,
  supabase: ReturnType<typeof import("@/lib/supabase").getServerSupabaseAdmin>
): Promise<boolean> {
  if (isEmailInAdminAllowlist(actorEmail)) return true;

  const { data } = await supabase
    .from("users")
    .select("role")
    .eq("id", actorId)
    .maybeSingle();

  return data?.role === "admin";
}
