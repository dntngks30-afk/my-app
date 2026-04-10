import { NextResponse } from "next/server";
import { LEGACY_ADMIN_REQUESTS_SELECT } from "@/lib/legacy/upload-report-rail";
import { getServerSupabaseAdmin } from "@/lib/supabase";

/**
 * Ops-only legacy requests rail.
 * Admin/manual workflows read requests here; canonical public results stay on public_results.
 */

export async function GET() {
  try {
    // requests 테이블에서 최신순으로 요청 목록을 가져옵니다.
    const { data, error } = await getServerSupabaseAdmin()
      .from("requests")
      .select(LEGACY_ADMIN_REQUESTS_SELECT)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
