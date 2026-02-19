// Toss Payments 결제 승인 API입니다.
// 결제 성공 후 클라이언트에서 이 API를 호출하여 결제를 최종 승인합니다.

import { NextResponse } from "next/server";
import { getServerSupabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { paymentKey, orderId, amount, requestId, userId } = body;

    // 필수 파라미터 검증
    if (!paymentKey || !orderId || !amount) {
      return NextResponse.json(
        { error: "paymentKey, orderId, amount are required" },
        { status: 400 }
      );
    }

    // Toss Payments 승인 API 호출
    const tossSecretKey = process.env.TOSS_SECRET_KEY || "";
    
    // Base64 인코딩 (secretKey:)
    const encodedKey = Buffer.from(`${tossSecretKey}:`).toString("base64");

    const tossResponse = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: {
        Authorization: `Basic ${encodedKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        paymentKey,
        orderId,
        amount,
      }),
    });

    const tossData = await tossResponse.json();

    if (!tossResponse.ok) {
      console.error("Toss 결제 승인 실패:", tossData);
      return NextResponse.json(
        { error: tossData.message || "결제 승인에 실패했습니다." },
        { status: 400 }
      );
    }

    // 결제 성공 - DB에 기록
    const supabase = getServerSupabaseAdmin();

    // payments 테이블에 결제 기록 저장
    const { error: paymentError } = await supabase.from("payments").insert({
      user_id: userId || null,
      request_id: requestId || null,
      amount: amount,
      order_id: orderId,
      payment_key: paymentKey,
      status: "completed",
      created_at: new Date().toISOString(),
    });

    if (paymentError) {
      console.error("결제 기록 저장 실패:", paymentError);
      // 결제는 성공했으므로 에러를 반환하지 않고 계속 진행
    }

    // requestId가 있으면 requests 테이블 상태 업데이트
    if (requestId) {
      const { error: updateError } = await supabase
        .from("requests")
        .update({
          status: "paid",
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (updateError) {
        console.error("요청 상태 업데이트 실패:", updateError);
      }
    }

    return NextResponse.json({
      ok: true,
      payment: {
        orderId: tossData.orderId,
        status: tossData.status,
        totalAmount: tossData.totalAmount,
        method: tossData.method,
        approvedAt: tossData.approvedAt,
      },
    });
  } catch (err) {
    console.error("결제 처리 에러:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
