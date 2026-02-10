import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/server';

const SCORING_VERSION = process.env.MOVEMENT_SCORING_VERSION ?? '1.0';

const SHARE_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateShareId(len = 8): string {
  let id = '';
  for (let i = 0; i < len; i++) {
    id += SHARE_ID_CHARS[Math.floor(Math.random() * SHARE_ID_CHARS.length)];
  }
  return id;
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user, response } = await requireUser();
    if (response) return response;

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
      return NextResponse.json({ error: '필수 필드가 누락되었습니다.' }, { status: 400 });
    }

    let lastError: unknown = null;

    for (let i = 0; i < 5; i++) {
      const shareId = generateShareId(8);

      const { data, error } = await supabase
        .from('movement_test_attempts')
        .insert({
          user_id: user.id,
          scoring_version: SCORING_VERSION,
          share_id: shareId,
          main_type: mainType,
          sub_type: subType,
          confidence: Number(confidence),
          type_scores: typeScores,
          imbalance_yes_count: imbalanceYesCount ?? 0,
          imbalance_severity: imbalanceSeverity ?? null,
          bias_main_type: biasMainType || null,
          completed_at: completedAt || new Date().toISOString(),
          duration_seconds: durationSeconds ?? null,
        })
        .select('id, share_id, scoring_version')
        .single();

      if (!error && data) {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
        const shareUrl = `${baseUrl}/movement-test/shared/${data.share_id}`;

        return NextResponse.json({
          success: true,
          id: data.id,
          shareId: data.share_id,
          shareUrl,
          scoringVersion: data.scoring_version,
        });
      }

      lastError = error;
      const msg = (error as any)?.message ?? '';
      const code = (error as any)?.code ?? '';
      const isUnique =
        code === '23505' ||
        msg.toLowerCase().includes('duplicate') ||
        msg.toLowerCase().includes('unique');

      if (!isUnique) {
        console.error('Failed to save attempt:', error);
        return NextResponse.json({ error: '결과 저장에 실패했습니다.' }, { status: 500 });
      }
    }

    console.error('Failed to save attempt after retries:', lastError);
    return NextResponse.json({ error: '결과 저장에 실패했습니다.' }, { status: 500 });
  } catch (error) {
    console.error('Save result error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
