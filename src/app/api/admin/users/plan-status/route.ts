/**
 * Admin: 수동 plan_status / plan_tier 변경
 * POST /api/admin/users/plan-status
 * Authorization: Bearer <access_token> 필수
 * Body: { targetUserId?, targetEmail?, plan_status, plan_tier?, reason }
 *
 * 이메일 조회: 1) public.users (ilike 정규화) 2) 없으면 auth.admin.listUsers로 fallback
 * public.users row 누락 시 auth에서 찾아 backfill 후 업데이트 (멱등)
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseAdmin } from "@/lib/supabase";
import { isAdmin } from "@/lib/auth/admin";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

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

    let targetUser: { id: string; email: string | null; plan_status: string | null; plan_tier: string | null } | null = null;

    if (targetUserId && typeof targetUserId === "string") {
      const { data, error } = await supabase
        .from("users")
        .select("id, email, plan_status, plan_tier")
        .eq("id", targetUserId.trim())
        .maybeSingle();
      if (!error && data) targetUser = data;
    } else if (targetEmail && typeof targetEmail === "string") {
      const normalizedEmail = normalizeEmail(targetEmail);
      if (!normalizedEmail) {
        return NextResponse.json(
          { error: "targetEmail cannot be empty" },
          { status: 400 }
        );
      }

      // 1) public.users에서 ilike로 조회 (대소문자 무시)
      const { data: pubUser } = await supabase
        .from("users")
        .select("id, email, plan_status, plan_tier")
        .ilike("email", normalizedEmail)
        .limit(1)
        .maybeSingle();
      if (pubUser) {
        targetUser = pubUser;
      } else {
        // 2) auth.users fallback: listUsers pagination
        const MAX_PAGES = 20;
        const PER_PAGE = 500;
        let authUser: { id: string; email?: string } | null = null;
        for (let page = 1; page <= MAX_PAGES; page++) {
          const { data: listData } = await supabase.auth.admin.listUsers({
            page,
            perPage: PER_PAGE,
          });
          const users = listData?.users ?? [];
          const found = users.find(
            (u) => u.email?.trim().toLowerCase() === normalizedEmail
          );
          if (found) {
            authUser = { id: found.id, email: found.email ?? undefined };
            break;
          }
          if (users.length < PER_PAGE) break;
        }

        if (!authUser) {
          return NextResponse.json({ error: "TARGET_NOT_FOUND" }, { status: 404 });
        }

        // 3) public.users backfill (멱등)
        const { error: upsertErr } = await supabase.from("users").upsert(
          {
            id: authUser.id,
            email: normalizedEmail,
            role: "user",
          },
          { onConflict: "id", ignoreDuplicates: true }
        );
        if (upsertErr) {
          console.error("plan-status backfill error:", upsertErr);
          return NextResponse.json(
            { error: "BACKFILL_FAILED", details: upsertErr.message },
            { status: 500 }
          );
        }

        // backfill 수행 시 감사 로그 (best-effort, 실패해도 진행)
        supabase.from("admin_actions").insert({
          actor_user_id: actor.id,
          actor_email: actor.email ?? "",
          target_user_id: authUser.id,
          target_email: normalizedEmail,
          action: "backfill_public_user",
          reason: `plan_status override lookup: email=${normalizedEmail}`,
          before: {},
          after: { backfill: true },
        }).then(({ error }) => {
          if (error) console.warn("admin_actions backfill log:", error.message);
        });

        const { data: afterFill } = await supabase
          .from("users")
          .select("id, email, plan_status, plan_tier")
          .eq("id", authUser.id)
          .single();
        targetUser = afterFill;
      }
    } else {
      return NextResponse.json(
        { error: "targetUserId or targetEmail is required" },
        { status: 400 }
      );
    }

    if (!targetUser) {
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
