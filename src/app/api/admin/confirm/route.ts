import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// [핵심 1] 빌드 시점에 이 파일을 미리 실행(정적 최적화)하지 않도록 강제합니다.
export const dynamic = 'force-dynamic';

function getSupabaseClient() {
  // [핵심 2] 빌드 시점에 환경변수가 없어도 Supabase SDK가 화내지 않도록 
  // 최소한 URL 형식을 갖춘 가짜 주소를 넣어줍니다.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";

  return createClient(url, key);
}

const NASM_CES_TEMPLATE = {
  steps: [
    { label: "01", title: "억제", content: "과도하게 긴장된 근육 완화용 테크닉 및 가이드." },
    { label: "02", title: "신장", content: "굳은 라인을 위한 안전한 스트레칭 가이드." },
    { label: "03", title: "활성화", content: "안정근 활성화를 위한 능동적 운동 루틴." },
    { label: "04", title: "통합", content: "일상 자세에 연결하는 통합 훈련 루틴." },
  ],
};

export async function POST(req: Request) {
  try {
    // [핵심 3] 실제 실행 시점에 환경 변수가 진짜로 없는지 한 번 더 체크합니다.
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      console.error("환경 변수 NEXT_PUBLIC_SUPABASE_URL 가 없습니다.");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const body = await req.json();
    const { requestId, diagnoses } = body;
    if (!requestId) {
      return NextResponse.json({ error: "requestId required" }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // 요청 정보 조회
    const { data: reqRow, error: selectErr } = await supabase
      .from("requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (selectErr) return NextResponse.json({ error: selectErr.message }, { status: 500 });

    // 1) requests 테이블 업데이트
    const { error: updateErr } = await supabase
      .from("requests")
      .update({
        status: "completed",
        diagnoses: diagnoses || [],
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    // 2) solutions 테이블 저장
    const insertPayload = {
      user_id: reqRow.user_id,
      request_id: requestId,
      content: NASM_CES_TEMPLATE,
      created_at: new Date().toISOString(),
    };

    const { error: insertErr } = await supabase.from("solutions").insert(insertPayload);
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}