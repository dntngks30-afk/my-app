'use client';

/**
 * stitch code.html Screen 8 — Profile form (로직은 기존 page truth 유지)
 * 무료테스트 시작 전: 나이대 + 성별만 (생년월일·유입경로는 회원가입으로 이동)
 */
import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { IntroSceneShell, IntroStepIndicator } from './IntroSceneShell';
import { FUNNEL_KEY, type FunnelData } from '@/lib/public/intro-funnel';
import { mergeIntroProfileIntoSurveySession } from '@/lib/public/survey-bridge';
import { getOrCreateAnonId } from '@/lib/public-results/anon-id';
import type { AgeBand } from '@/lib/analytics/kpi-demographics-types';
import { mapIntroGenderToGenderBucket } from '@/lib/analytics/kpi-demographics-types';
import {
  flushPendingPublicTestProfile,
  savePendingPublicTestProfile,
} from '@/lib/analytics/publicProfileClient';
import { getPilotCodeForCurrentFlow } from '@/lib/pilot/pilot-context';

const AGE_BAND_OPTIONS: { value: AgeBand; label: string }[] = [
  { value: '10s', label: '10대' },
  { value: '20s', label: '20대' },
  { value: '30s', label: '30대' },
  { value: '40s', label: '40대' },
  { value: '50s', label: '50대' },
  { value: '60s_plus', label: '60대 이상' },
];

const GENDER_OPTIONS = [
  { value: 'male', label: '남성' },
  { value: 'female', label: '여성' },
] as const;

function loadFunnel(): Partial<FunnelData> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(FUNNEL_KEY);
    return raw ? (JSON.parse(raw) as Partial<FunnelData>) : {};
  } catch {
    return {};
  }
}

function saveFunnel(data: Partial<FunnelData>) {
  if (typeof window === 'undefined') return;
  try {
    const current = loadFunnel();
    const merged = { ...current, ...data };
    localStorage.setItem(FUNNEL_KEY, JSON.stringify(merged));
  } catch {
    // ignore
  }
}

export default function IntroProfile() {
  const router = useRouter();
  const [ageBand, setAgeBand] = useState<AgeBand | ''>('');
  const [gender, setGender] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    setFormError(null);
    if (!ageBand || ageBand === 'unknown') {
      setFormError('나이대를 선택해 주세요.');
      return;
    }
    const genderBucket = mapIntroGenderToGenderBucket(gender);
    if (genderBucket !== 'male' && genderBucket !== 'female') {
      setFormError('성별을 선택해 주세요.');
      return;
    }

    setIsSubmitting(true);

    saveFunnel({
      age_band: ageBand,
      gender: genderBucket,
      introCompletedAt: new Date().toISOString(),
    });
    if (typeof window !== 'undefined') {
      const anonId = getOrCreateAnonId();
      if (anonId) {
        savePendingPublicTestProfile({
          anonId,
          ageBand,
          gender: genderBucket,
          pilotCode: getPilotCodeForCurrentFlow(),
        });
        await Promise.race([
          flushPendingPublicTestProfile(),
          new Promise<boolean>((resolve) => window.setTimeout(() => resolve(false), 400)),
        ]);
      }
      mergeIntroProfileIntoSurveySession();
      router.push('/movement-test/survey');
    }
  }, [ageBand, gender, router]);

  const canSubmit = Boolean(ageBand && gender) && !isSubmitting;

  return (
    <IntroSceneShell currentPath="/intro/profile" navVariant="hidden" mainClassName="py-[30px]">
      <div className="w-full max-w-lg pb-28">
        <div className="mb-8 space-y-2 text-center">
          <p className="text-sm font-bold tracking-[1px] text-[#ffb77d] opacity-80" style={{ fontFamily: 'var(--font-sans-noto)' }}>
            시작 전,
          </p>
          <h1 className="mr-public-brand-serif text-[29px] font-semibold tracking-[-1.2px] text-[#dce1fb]">
            몇 가지만 알려주세요
          </h1>
          <p className="text-[11px] font-light text-[#c6c6cd]" style={{ fontFamily: 'var(--font-sans-noto)' }}>
            맞춤형 웰니스 케어 제공을 위한 정보 수집입니다.
          </p>
        </div>

        <div className="space-y-10">
          {formError ? (
            <p
              role="alert"
              className="rounded-lg border border-red-900/40 bg-red-950/30 px-3 py-2 text-center text-sm text-red-100/95"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              {formError}
            </p>
          ) : null}

          <div className="space-y-4">
            <label
              className="block text-xs uppercase tracking-widest text-[#c6c6cd]/50"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              나이대
            </label>
            <div className="grid grid-cols-2 gap-3">
              {AGE_BAND_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setAgeBand(o.value)}
                  className={`rounded-lg border py-4 text-base font-light transition-all ${
                    ageBand === o.value
                      ? 'border-[#ffb77d] text-[#dce1fb]'
                      : 'border-white/20 text-[#c6c6cd]/80 hover:border-[#ffb77d]/50'
                  }`}
                  style={{ fontFamily: 'var(--font-sans-noto)' }}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <label
              className="block text-xs uppercase tracking-widest text-[#c6c6cd]/50"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              성별
            </label>
            <div className="flex gap-4">
              {GENDER_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setGender(o.value)}
                  className={`flex-1 rounded-lg border py-5 text-lg font-light transition-all ${
                    gender === o.value
                      ? 'border-[#ffb77d] text-[#dce1fb]'
                      : 'border-white/20 text-[#c6c6cd]/80 hover:border-[#ffb77d]/50'
                  }`}
                  style={{ fontFamily: 'var(--font-sans-noto)' }}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full rounded-lg bg-gradient-to-br from-[#ffb77d] to-[#ab4c00] py-5 text-lg font-semibold tracking-[-1.2px] text-[#1e1e1f] shadow-xl shadow-black/40 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            {isSubmitting ? '이동 중…' : '다음으로 진행'}
          </button>

          <p className="text-center text-[10px] text-slate-500" style={{ fontFamily: 'var(--font-sans-noto)' }}>
            입력하신 정보는 익명으로 안전하게 처리됩니다.
          </p>
        </div>

        <div className="mt-12 flex justify-center">
          <IntroStepIndicator step={6} />
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 z-[60] flex w-full items-center px-8 py-10 md:px-12">
        <Link
          href="/intro/trust"
          className="group flex items-center gap-2 text-slate-500/80 transition-colors hover:text-[#fcb973]"
          aria-label="이전"
        >
          <ChevronLeft className="size-5 shrink-0" strokeWidth={1.5} />
          <span
            className="text-xs font-light uppercase tracking-[0.2em]"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            이전
          </span>
        </Link>
      </nav>
    </IntroSceneShell>
  );
}
