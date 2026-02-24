/**
 * Admin 권한 체크 (plan-override UI용)
 * GET /api/admin/check
 * Authorization: Bearer <access_token> 필수
 * Returns: { isAdmin: boolean }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseAdmin } from "@/lib/supabase";
import { isAdmin } from "@/lib/auth/admin";

export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) {
      return NextResponse.json({ isAdmin: false }, { status: 200 });
    }

    const supabase = getServerSupabaseAdmin();
    const {
      data: { user: actor },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !actor) {
      return NextResponse.json({ isAdmin: false }, { status: 200 });
    }

    const adminOk = await isAdmin(actor.email, actor.id, supabase);
    return NextResponse.json({ isAdmin: adminOk });
  } catch {
    return NextResponse.json({ isAdmin: false }, { status: 200 });
  }
}
