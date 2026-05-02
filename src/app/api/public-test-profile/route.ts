import { NextRequest, NextResponse } from 'next/server';
import {
  isAcquisitionSource,
  isAgeBand,
  isKpiIntroGender,
} from '@/lib/analytics/kpi-demographics-types';
import {
  isValidAnonIdForPublicTestProfile,
  upsertPublicTestProfile,
} from '@/lib/analytics/public-test-profile';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      anonId?: unknown;
      ageBand?: unknown;
      gender?: unknown;
      acquisitionSource?: unknown;
    };

    const anonId = body.anonId;
    const ageBand = body.ageBand;
    const gender = body.gender;
    const acquisitionRaw = body.acquisitionSource;

    if (!isValidAnonIdForPublicTestProfile(anonId)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    if (!isAgeBand(ageBand) || !isKpiIntroGender(gender)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const acquisitionSource =
      acquisitionRaw === undefined || acquisitionRaw === null || acquisitionRaw === ''
        ? undefined
        : isAcquisitionSource(acquisitionRaw)
          ? acquisitionRaw
          : null;

    if (acquisitionSource === null) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    await upsertPublicTestProfile({
      anonId,
      ageBand,
      gender,
      acquisitionSource,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
