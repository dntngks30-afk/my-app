import { NextResponse } from "next/server";
import { getServerSupabaseAdmin } from "@/lib/supabase";

// 빌드 시 프리렌더링 방지
export const dynamic = 'force-dynamic';

// App Router에서는 route segment config로 설정
export const maxDuration = 60; // 최대 실행 시간 (초)
export const runtime = 'nodejs'; // Node.js 런타임 사용

export async function POST(req: Request) {
  try {
    const supabase = getServerSupabaseAdmin();

    // FormData 파싱 시도
    let form;
    try {
      form = await req.formData();
    } catch (formError) {
      console.error("FormData parsing error:", formError);
      return NextResponse.json({ 
        error: "파일 업로드 실패: 파일이 너무 크거나 형식이 잘못되었습니다.",
        details: formError instanceof Error ? formError.message : String(formError)
      }, { status: 400 });
    }
    const file = form.get("file") as File | null;
    const side = (form.get("side") as string) || "front";
    const user_id = (form.get("user_id") as string) || null;

    if (!file) {
      return NextResponse.json({ error: "파일이 선택되지 않았습니다." }, { status: 400 });
    }
    
    // 파일 크기 검증 (최대 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ 
        error: "파일 크기가 너무 큽니다. 최대 10MB까지 업로드 가능합니다.",
        size: file.size 
      }, { status: 400 });
    }
    
    // 파일 타입 검증
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ 
        error: "이미지 파일만 업로드 가능합니다.",
        type: file.type 
      }, { status: 400 });
    }
    
    console.log("File info:", {
      name: file.name,
      type: file.type,
      size: file.size,
      side: side
    });

    // 파일 데이터를 업로드 가능한 형태로 변환
    const arrayBuffer = await file.arrayBuffer();
    // Node 환경에서는 Buffer가 더 안전합니다.
    const buffer = Buffer.from(arrayBuffer);
    const safeName = `${Date.now()}_${(file as File).name}`;
    const path = `${safeName}`;

    // user-photos 버킷에 업로드
    const { data: uploadData, error: uploadErr } = await supabase
      .storage.from("user-photos")
      .upload(path, buffer, { contentType: file.type });

    if (uploadErr) {
      console.error("upload error from supabase.storage.upload:", uploadErr);
      return NextResponse.json({ error: uploadErr.message }, { status: 500 });
    }

    // public URL 얻기 (버킷이 public으로 설정되어 있어야 바로 접근 가능)
    const { data: publicData } = supabase.storage.from("user-photos").getPublicUrl(path);
    console.log("storage.getPublicUrl:", publicData);
    const baseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const publicURL =
      (publicData as any)?.publicUrl || `${baseUrl}/storage/v1/object/public/user-photos/${path}`;

    // requests 테이블에 레코드 추가/업데이트
    // 같은 user_id의 최근 요청을 찾아서 업데이트하거나, 없으면 새로 생성
    
    // 최근 24시간 이내의 같은 사용자 요청 찾기
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: existingRequests, error: findErr } = await supabase
      .from("requests")
      .select("*")
      .eq("user_id", user_id)
      .gte("created_at", oneDayAgo)
      .order("created_at", { ascending: false })
      .limit(1);

    if (findErr) {
      console.error("find error:", findErr);
    }

    let finalRequestId = null;

    if (existingRequests && existingRequests.length > 0) {
      // 기존 요청이 있으면 업데이트
      const existingRequest = existingRequests[0];
      const updatePayload: Record<string, any> = {};
      
      if (side === "front") {
        updatePayload.front_url = publicURL;
      } else {
        updatePayload.side_url = publicURL;
      }

      const { error: updateErr } = await supabase
        .from("requests")
        .update(updatePayload)
        .eq("id", existingRequest.id);

      if (updateErr) {
        console.error("update error:", updateErr);
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }
      
      finalRequestId = existingRequest.id;
      console.log(`✅ 기존 요청 업데이트: ${existingRequest.id} (${side})`);
    } else {
      // 새 요청 생성
      const insertPayload: Record<string, any> = {
        user_id,
        status: "pending",
      };
      
      if (side === "front") {
        insertPayload.front_url = publicURL;
      } else {
        insertPayload.side_url = publicURL;
      }

      const { data: insertData, error: insertErr } = await supabase
        .from("requests")
        .insert(insertPayload)
        .select()
        .single();

      if (insertErr) {
        console.error("insert error into requests:", insertErr);
        return NextResponse.json({ error: insertErr.message }, { status: 500 });
      }
      
      finalRequestId = insertData?.id;
      console.log(`✅ 새 요청 생성: ${finalRequestId} (${side})`);
    }

    return NextResponse.json({ ok: true, url: publicURL });
  } catch (err) {
    console.error("api/upload error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

