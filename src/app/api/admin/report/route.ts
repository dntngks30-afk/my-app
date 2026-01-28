// 관리자 리포트 저장 API입니다.
// 관리자가 사용자의 체형 분석 결과를 작성하고 저장합니다.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Supabase 클라이언트 (서버용)
function getSupabaseClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return createClient(url, key);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      requestId,
      userId,
      diagnoses,          // 진단 결과 배열: ["거북목", "라운드숄더", ...]
      inhibitContent,     // 억제 운동 내용
      lengthenContent,    // 신장 운동 내용
      activateContent,    // 활성화 운동 내용
      integrateContent,   // 통합 운동 내용
      expertNotes,        // 전문가 소견
    } = body;

    // 필수 파라미터 검증
    if (!requestId) {
      return NextResponse.json({ error: "requestId is required" }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // solutions 테이블에 리포트 저장
    const { data: solution, error: insertError } = await supabase
      .from("solutions")
      .insert({
        request_id: requestId,
        user_id: userId || null,
        diagnoses: diagnoses || [],
        inhibit_content: inhibitContent || "",
        lengthen_content: lengthenContent || "",
        activate_content: activateContent || "",
        integrate_content: integrateContent || "",
        expert_notes: expertNotes || "",
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("리포트 저장 에러:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // requests 테이블의 상태를 'completed'로 업데이트
    const { error: updateError } = await supabase
      .from("requests")
      .update({
        status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (updateError) {
      console.error("요청 상태 업데이트 에러:", updateError);
      // 리포트는 저장되었으므로 에러를 반환하지 않고 계속 진행
    }

    return NextResponse.json({
      ok: true,
      solution: {
        id: solution.id,
        request_id: solution.request_id,
      },
    });
  } catch (err) {
    console.error("리포트 저장 에러:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// 특정 요청의 리포트 조회
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const requestId = searchParams.get("requestId");
    const userId = searchParams.get("userId");

    const supabase = getSupabaseClient();

    let query = supabase
      .from("solutions")
      .select("*");

    if (requestId) {
      query = query.eq("request_id", requestId);
    }

    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      console.error("리포트 조회 에러:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("리포트 조회 에러:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
