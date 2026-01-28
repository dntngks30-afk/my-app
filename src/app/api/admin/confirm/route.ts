import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

// 미리 저장된 NASM-CES 4단계 데이터 템플릿
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
    const body = await req.json();
    const { requestId, diagnoses } = body;
    if (!requestId) {
      return NextResponse.json({ error: "requestId required" }, { status: 400 });
    }

    // 요청 정보 조회
    const { data: reqRow, error: selectErr } = await supabase
      .from("requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (selectErr) {
      return NextResponse.json({ error: selectErr.message }, { status: 500 });
    }

    // 1) requests 테이블 상태 업데이트
    const { error: updateErr } = await supabase
      .from("requests")
      .update({
        status: "completed",
        diagnoses: diagnoses || [],
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // 2) solutions 테이블에 NASM 템플릿 저장 (사용자 마이페이지에서 불러오게 함)
    const insertPayload = {
      user_id: reqRow.user_id,
      request_id: requestId,
      content: NASM_CES_TEMPLATE,
      created_at: new Date().toISOString(),
    };

    const { error: insertErr } = await supabase.from("solutions").insert(insertPayload);
    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

