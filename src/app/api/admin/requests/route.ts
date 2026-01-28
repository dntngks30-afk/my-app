import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// 서버 사이드에서 Supabase service role 키를 사용합니다.
const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function GET() {
  try {
    // requests 테이블에서 최신순으로 요청 목록을 가져옵니다.
    const { data, error } = await supabase
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

