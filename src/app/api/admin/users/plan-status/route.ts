/**
 * Admin: 수동 plan_status / plan_tier 변경
 * POST /api/admin/users/plan-status
 * Authorization: Bearer <access_token> 필수
 * Body: { targetUserId?, targetEmail?, plan_status, plan_tier?, reason }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseAdmin } from "@/lib/supabase";
import { isAdmin } from "@/lib/auth/admin";

const VALID_PLAN_STATUS = [
  "active",
  "inactive",
  "cancelled",
  "canceled",
  "expired",
  "trialing",
  "past_due",
] as const;

function normalizePlanStatus(s: string): string {
  return s === "canceled" ? "cancelled" : s;
}

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const supabase = getServerSupabaseAdmin();
    const {
      data: { user: actor },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !actor) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const adminOk = await isAdmin(actor.email, actor.id, supabase);
    if (!adminOk) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
    }

    const {
      targetUserId,
      targetEmail,
      plan_status: planStatusRaw,
      plan_tier: planTierRaw,
      reason,
    } = body;

    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return NextResponse.json(
        { error: "reason is required and must be non-empty" },
        { status: 400 }
      );
    }

    if (!targetUserId && !targetEmail) {
      return NextResponse.json(
        { error: "targetUserId or targetEmail is required" },
        { status: 400 }
      );
    }

    const planStatus =
      typeof planStatusRaw === "string" && planStatusRaw.trim()
        ? planStatusRaw.trim()
        : null;
    if (!planStatus || !VALID_PLAN_STATUS.includes(planStatus as (typeof VALID_PLAN_STATUS)[number])) {
      return NextResponse.json(
        { error: "plan_status must be one of: " + VALID_PLAN_STATUS.join(", ") },
        { status: 400 }
      );
    }

    const planTier =
      planTierRaw == null
        ? undefined
        : typeof planTierRaw === "string"
          ? planTierRaw.trim()
          : String(planTierRaw);

    let targetQuery = supabase.from("users").select("id, email, plan_status, plan_tier");
    if (targetUserId && typeof targetUserId === "string") {
      targetQuery = targetQuery.eq("id", targetUserId);
    } else if (targetEmail && typeof targetEmail === "string") {
      targetQuery = targetQuery.eq("email", targetEmail.trim());
    } else {
      return NextResponse.json(
        { error: "targetUserId or targetEmail is required" },
        { status: 400 }
      );
    }

    const { data: targetUser, error: targetError } = await targetQuery.single();

    if (targetError || !targetUser) {
      return NextResponse.json({ error: "TARGET_NOT_FOUND" }, { status: 404 });
    }

    const before = {
      plan_status: targetUser.plan_status ?? "inactive",
      plan_tier: targetUser.plan_tier ?? "free",
    };

    const after = {
      plan_status: normalizePlanStatus(planStatus),
      plan_tier: planTier ?? before.plan_tier,
    };

    const updatePayload: Record<string, string> = {
      plan_status: after.plan_status,
      plan_tier: after.plan_tier,
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from("users")
      .update(updatePayload)
      .eq("id", targetUser.id);

    if (updateError) {
      console.error("plan-status update error:", updateError);
      return NextResponse.json(
        { error: "UPDATE_FAILED", details: updateError.message },
        { status: 500 }
      );
    }

    const { error: insertError } = await supabase.from("admin_actions").insert({
      actor_user_id: actor.id,
      actor_email: actor.email ?? "",
      target_user_id: targetUser.id,
      target_email: targetUser.email,
      action: "set_plan_status",
      reason: reason.trim(),
      before,
      after,
    });

    if (insertError) {
      console.error("admin_actions insert error:", insertError);
      return NextResponse.json(
        { error: "AUDIT_LOG_FAILED", details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      targetUserId: targetUser.id,
      before,
      after,
    });
  } catch (err) {
    console.error("plan-status API error:", err);
    return NextResponse.json(
      { error: "SERVER_ERROR", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
