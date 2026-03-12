import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseAdmin } from "@/lib/supabase";
import { getCurrentUserId } from "@/lib/auth/getCurrentUserId";

export const dynamic = "force-dynamic";

/**
 * ✅ 사용자용 "내 리포트" 조회 API
 * - Authorization: Bearer <access_token> 으로 사용자 식별 (shared getCurrentUserId)
 * - solutions.user_id === 현재 로그인 유저만 조회
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId(req);
    if (!userId) {
      const r = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      r.headers.set("Cache-Control", "no-store");
      return r;
    }

    const supabase = getServerSupabaseAdmin();
    const { data, error } = await supabase
      .from("solutions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("my-report query error:", error);
      const r = NextResponse.json({ error: error.message }, { status: 500 });
      r.headers.set("Cache-Control", "no-store");
      return r;
    }

    const res = NextResponse.json({ data: data ?? [] });
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return res;
  } catch (err) {
    console.error("my-report error:", err);
    const r = NextResponse.json({ error: "Server error" }, { status: 500 });
    r.headers.set("Cache-Control", "no-store");
    return r;
  }
}
