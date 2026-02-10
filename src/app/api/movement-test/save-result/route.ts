/**
 * Movement Test - 결과 저장 API (attempt 기반)
 *
 * POST /api/movement-test/save-result
 * 항상 새 attempt insert. user_id는 서버 세션 우선.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseAdmin } from '@/lib/supabase';

const SCORING_VERSION = process.env.MOVEMENT_SCORING_VERSION ?? '1.0';

const SHARE_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateShareId(): string {
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += SHARE_ID_CHARS[Math.floor(Math.random() * SHARE_ID_CHARS.length)];
  }
  return id;
}

async function getCurrentUserId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  const supabase = getServerSupabaseAdmin();
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    return user.id;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      mainType,
      subType,
      confidence,
      typeScores,
      imbalanceYesCount,
      imbalanceSeverity,
      biasMainType,
      completedAt,
      durationSeconds,
    } = body;

    if (!mainType || !subType || confidence === undefined || !typeScores) {
      return NextResponse.json(
        { error: '필수 필드가 누락되었습니다.' },
        { status: 400 }
      );
    }

    const userId = await getCurrentUserId(request);
    const supabase = getServerSupabaseAdmin();
    const shareId = generateShareId();

    const { data, error } = await supabase
      .from('movement_test_attempts')
      .insert({
        user_id: userId ?? null,
        scoring_version: SCORING_VERSION,
        share_id: shareId,
        main_type: mainType,
        sub_type: subType,
        confidence: Number(confidence),
        type_scores: typeScores,
        imbalance_yes_count: imbalanceYesCount ?? 0,
        imbalance_severity: imbalanceSeverity ?? 'none',
        bias_main_type: biasMainType || null,
        completed_at: completedAt || new Date().toISOString(),
        duration_seconds: durationSeconds ?? null,
      })
      .select('id, share_id, scoring_version')
      .single();

    if (error) {
      console.error('Failed to save attempt:', error);
      return NextResponse.json(
        { error: '결과 저장에 실패했습니다.' },
        { status: 500 }
      );
    }

    const shareUrl = `${process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin}/movement-test/shared/${data.share_id}`;

    return NextResponse.json({
      success: true,
      id: data.id,
      shareId: data.share_id,
      shareUrl,
      scoringVersion: data.scoring_version,
    });
  } catch (error) {
    console.error('Save result error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
