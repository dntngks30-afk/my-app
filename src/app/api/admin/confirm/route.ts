import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Supabase 클라이언트를 모듈 로드 시점에 생성하지 않고 요청 시점에 생성합니다.
// 이렇게 하면 빌드 단계에서 process.env 값이 없어도 에러가 발생하지 않습니다.
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "";

  return createClient(url, key);
}

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
    const { data: reqRow, error: selectErr } = await getSupabaseClient()
      .from("requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (selectErr) {
      return NextResponse.json({ error: selectErr.message }, { status: 500 });
    }

    // 1) requests 테이블 상태 업데이트
    const { error: updateErr } = await getSupabaseClient()
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

    const { error: insertErr } = await getSupabaseClient().from("solutions").insert(insertPayload);
    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
// 빌드 타임에 환경 변수가 없어도 에러를 내지 않게 만드는 코드
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

// 만약 기존에 아래와 같은 줄이 있다면 위 변수를 사용하도록 수정하세요
// const supabase = createClient(supabaseUrl, supabaseKey);

