/**
 * Movement Test 피드백 API (PR1-FEEDBACK SIMPLIFY)
 * POST: 4단 평가 설문 제출 → movement_test_feedback insert
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseAdmin } from '@/lib/supabase';

const VALID_ACCURACY = ['YES', 'MAYBE', 'NO'];
const VALID_WANTS_PRECISION = ['YES', 'MAYBE', 'UNKNOWN', 'NO'];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const accuracyFeel = body.accuracyFeel ?? body.accuracy_feel;
    if (
      typeof accuracyFeel !== 'string' ||
      !VALID_ACCURACY.includes(accuracyFeel)
    ) {
      return NextResponse.json(
        { ok: false, error: 'accuracy_feel 필수 (YES/MAYBE/NO)' },
        { status: 400 }
      );
    }

    const wantsPrecision = body.wantsPrecision ?? body.wants_precision;
    if (
      typeof wantsPrecision !== 'string' ||
      !VALID_WANTS_PRECISION.includes(wantsPrecision)
    ) {
      return NextResponse.json(
        { ok: false, error: 'wants_precision 필수 (YES/MAYBE/UNKNOWN/NO)' },
        { status: 400 }
      );
    }

    const showQ3Q4 = wantsPrecision !== 'NO';
    const precisionFeature = body.precisionFeature ?? body.precision_feature ?? null;
    const precisionFeatureOther = body.precisionFeatureOther ?? body.precision_feature_other ?? null;
    const priceRange = body.priceRange ?? body.price_range ?? null;
    const priceOther = body.priceOther ?? body.price_other ?? null;

    if (showQ3Q4) {
      if (!precisionFeature && !precisionFeatureOther) {
        return NextResponse.json(
          { ok: false, error: 'precision_feature 필수' },
          { status: 400 }
        );
      }
      if (!priceRange && !priceOther) {
        return NextResponse.json(
          { ok: false, error: 'price_range 필수' },
          { status: 400 }
        );
      }
    }

    const supabase = getServerSupabaseAdmin();
    const referrer = request.headers.get('referer') ?? null;
    const userAgent = request.headers.get('user-agent') ?? null;

    const accuracyRatingMap: Record<string, number> = { YES: 5, MAYBE: 3, NO: 1 };
    const insertPayload: Record<string, unknown> = {
      movement_test_version: body.movementTestVersion ?? body.movement_test_version ?? 'v2',
      result_main_animal: body.resultMainAnimal ?? body.result_main_animal ?? null,
      result_type: body.resultType ?? body.result_type ?? null,
      axis_scores: body.axisScores ?? body.axis_scores ?? null,
      accuracy_rating: accuracyRatingMap[accuracyFeel] ?? 3,
      accuracy_feel: accuracyFeel,
      wants_precision: wantsPrecision,
      precision_feature: showQ3Q4 ? (precisionFeature ?? 'OTHER') : null,
      precision_feature_other: showQ3Q4 && precisionFeature === 'other' ? precisionFeatureOther : null,
      price_range: showQ3Q4 ? (priceRange ?? 'OTHER') : null,
      price_other: showQ3Q4 && priceRange === 'other' ? priceOther : null,
      user_agent: userAgent,
      referrer,
    };

    const { error } = await supabase
      .from('movement_test_feedback')
      .insert(insertPayload);

    if (error) {
      console.error('feedback insert error:', error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('feedback API error:', e);
    return NextResponse.json(
      { ok: false, error: '서버 오류' },
      { status: 500 }
    );
  }
}
