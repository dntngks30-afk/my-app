import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// (주의) Service role 키 대신 anon 키를 사용하도록 변경했습니다.
// 이미 Storage 정책에서 anon에 INSERT 권한을 부여하셨으므로 서버에서 NEXT_PUBLIC_SUPABASE_ANON_KEY로 동작합니다.
const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

export async function POST(req: Request) {
  try {
    // 빠른 로그: env 존재 여부 출력 (키 값 자체는 노출하지 않음)
    console.log("api/upload called", {
      has_url: !!process.env.SUPABASE_URL,
      has_service_role: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    });
    // 빠른 환경변수 검증 -> 빈 값이면 명확한 에러 반환
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set" },
        { status: 500 }
      );
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
    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from("user-photos")
      .upload(path, buffer, { contentType: file.type });

    if (uploadErr) {
      console.error("upload error from supabase.storage.upload:", uploadErr);
      return NextResponse.json({ error: uploadErr.message }, { status: 500 });
    }

    // public URL 얻기 (버킷이 public으로 설정되어 있어야 바로 접근 가능)
    const { data: publicData } = supabase.storage.from("user-photos").getPublicUrl(path);
    console.log("storage.getPublicUrl:", publicData);
    const publicURL =
      (publicData as any)?.publicUrl || `${process.env.SUPABASE_URL}/storage/v1/object/public/user-photos/${path}`;

    // requests 테이블에 레코드 추가 (간단한 구조)
    const insertPayload: Record<string, any> = {
      user_id,
      status: "pending",
      created_at: new Date().toISOString(),
    };
    if (side === "front") insertPayload.front_url = publicURL;
    else insertPayload.side_url = publicURL;

    const { error: insertErr } = await supabase.from("requests").insert(insertPayload);
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

