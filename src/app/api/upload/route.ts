import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Supabase 클라이언트를 모듈 로드 시점에 생성하지 않고 요청 시점에 생성합니다.
// 빌드 단계에서 env가 없더라도 모듈 로드가 실패하지 않도록 합니다.
function getSupabaseClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";
  return createClient(url, key);
}

export async function POST(req: Request) {
  try {
    // 빠른 로그: env 존재 여부 출력 (키 값 자체는 노출하지 않음)
    console.log("api/upload called", {
      has_url: !!(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL),
      has_key: !!(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
    });
    // 환경변수가 충분하지 않으면 명확한 에러 반환
    if (!(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)) {
      return NextResponse.json({ error: "SUPABASE_URL is not set" }, { status: 500 });
    }
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const side = (form.get("side") as string) || "front";
    const user_id = (form.get("user_id") as string) || null;

    if (!file) {
      return NextResponse.json({ error: "file missing" }, { status: 400 });
    }

    // 파일 데이터를 업로드 가능한 형태로 변환
    const arrayBuffer = await file.arrayBuffer();
    // Node 환경에서는 Buffer가 더 안전합니다.
    const buffer = Buffer.from(arrayBuffer);
    const safeName = `${Date.now()}_${(file as File).name}`;
    const path = `${safeName}`;

    // user-photos 버킷에 업로드
    const { data: uploadData, error: uploadErr } = await getSupabaseClient()
      .storage.from("user-photos")
      .upload(path, buffer, { contentType: file.type });

    if (uploadErr) {
      console.error("upload error from supabase.storage.upload:", uploadErr);
      return NextResponse.json({ error: uploadErr.message }, { status: 500 });
    }

    // public URL 얻기 (버킷이 public으로 설정되어 있어야 바로 접근 가능)
    const { data: publicData } = getSupabaseClient().storage.from("user-photos").getPublicUrl(path);
    console.log("storage.getPublicUrl:", publicData);
    const baseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const publicURL =
      (publicData as any)?.publicUrl || `${baseUrl}/storage/v1/object/public/user-photos/${path}`;

    // requests 테이블에 레코드 추가 (간단한 구조)
    const insertPayload: Record<string, any> = {
      user_id,
      status: "pending",
      created_at: new Date().toISOString(),
    };
    if (side === "front") insertPayload.front_url = publicURL;
    else insertPayload.side_url = publicURL;

    const { error: insertErr } = await getSupabaseClient().from("requests").insert(insertPayload);
    if (insertErr) {
      console.error("insert error into requests:", insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, url: publicURL });
  } catch (err) {
    console.error("api/upload error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

