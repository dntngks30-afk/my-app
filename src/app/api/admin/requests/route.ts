import { NextResponse } from "next/server";
import { getServerSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    // requests 테이블에서 최신순으로 요청 목록을 가져옵니다.
    const { data, error } = await getServerSupabaseAdmin()
      .from("requests")
      .select("id, user_id, front_url, side_url, status, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

