import { NextResponse } from "next/server";
import { upsertLegacyUploadRequestIntake } from "@/lib/legacy/upload-report-rail";
import { getServerSupabaseAdmin } from "@/lib/supabase";

/**
 * Legacy upload intake rail.
 *
 * This route keeps the requests-based compat/ops pipeline alive.
 * It is not a canonical public analysis API and must not own public_results truth.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const supabase = getServerSupabaseAdmin();

    let form;
    try {
      form = await req.formData();
    } catch (formError) {
      console.error("FormData parsing error:", formError);
      return NextResponse.json(
        {
          error: "파일 업로드 실패: 파일이 올바른 형식이 아니었습니다.",
          details: formError instanceof Error ? formError.message : String(formError),
        },
        { status: 400 }
      );
    }

    const file = form.get("file") as File | null;
    const side = (form.get("side") as string) || "front";
    const legacyUserId = (form.get("user_id") as string) || null;
    const requestSide = side === "front" ? "front" : "side";

    if (!file) {
      return NextResponse.json({ error: "파일을 선택하지 않았습니다." }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        {
          error: "파일 크기가 너무 큽니다. 최대 10MB까지 업로드 가능합니다.",
          size: file.size,
        },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        {
          error: "이미지 파일만 업로드 가능합니다.",
          type: file.type,
        },
        { status: 400 }
      );
    }

    console.log("File info:", {
      name: file.name,
      type: file.type,
      size: file.size,
      side,
    });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const safeName = `${Date.now()}_${file.name}`;
    const path = `${safeName}`;

    const { error: uploadErr } = await supabase
      .storage.from("user-photos")
      .upload(path, buffer, { contentType: file.type });

    if (uploadErr) {
      console.error("upload error from supabase.storage.upload:", uploadErr);
      return NextResponse.json({ error: uploadErr.message }, { status: 500 });
    }

    const { data: publicData } = supabase.storage.from("user-photos").getPublicUrl(path);
    console.log("storage.getPublicUrl:", publicData);
    const baseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const legacyPublicUrl =
      (publicData as any)?.publicUrl || `${baseUrl}/storage/v1/object/public/user-photos/${path}`;

    const intakeResult = await upsertLegacyUploadRequestIntake({
      supabase,
      userId: legacyUserId,
      side: requestSide,
      publicUrl: legacyPublicUrl,
    });

    if (!intakeResult.ok) {
      console.error("[legacy-upload-report-rail] intake upsert error:", intakeResult.error);
      return NextResponse.json({ error: intakeResult.error }, { status: 500 });
    }

    console.log(
      `[legacy-upload-report-rail] request ${intakeResult.action}: ${intakeResult.requestId} (${requestSide})`
    );

    return NextResponse.json({ ok: true, url: legacyPublicUrl });
  } catch (err) {
    console.error("api/upload error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
