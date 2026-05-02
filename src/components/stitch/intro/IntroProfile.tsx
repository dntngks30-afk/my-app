'use client';

/**
 * stitch code.html Screen 8 — Profile form (로직은 기존 page truth 유지)
 */
import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { IntroSceneShell, IntroStepIndicator } from './IntroSceneShell';
import { FUNNEL_KEY, type FunnelData } from '@/lib/public/intro-funnel';
import { mergeIntroProfileIntoSurveySession } from '@/lib/public/survey-bridge';
import { getOrCreateAnonId } from '@/lib/public-results/anon-id';
import type { AcquisitionSource } from '@/lib/analytics/kpi-demographics-types';
import {
  ACQUISITION_SOURCE_LABELS,
  ACQUISITION_SOURCES,
  birthDateToAgeBand,
  mapIntroGenderToGenderBucket,
} from '@/lib/analytics/kpi-demographics-types';

const GENDER_OPTIONS = [
  { value: 'male', label: '남성' },
  { value: 'female', label: '여성' },
] as const;

const ACQUISITION_OPTIONS = ACQUISITION_SOURCES.filter((s) => s !== 'unknown');

function localIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('');
  const [acquisition, setAcquisition] = useState<AcquisitionSource | ''>('');
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    setFormError(null);
    const ageBand = birthDateToAgeBand(birthDate);
    if (ageBand === 'unknown') {
      setFormError('생년월일을 확인해 주세요. (만 14~100세 범위)');
      return;
    }
    const genderBucket = mapIntroGenderToGenderBucket(gender);
    if (genderBucket !== 'male' && genderBucket !== 'female') {
      setFormError('성별을 선택해 주세요.');
      return;
    }

    const acquisitionSource: AcquisitionSource =
      acquisition === '' ? 'unknown' : acquisition;

    saveFunnel({
      age_band: ageBand,
      gender: genderBucket,
      acquisition_source: acquisitionSource,
      introCompletedAt: new Date().toISOString(),
    });
    if (typeof window !== 'undefined') {
      const anonId = getOrCreateAnonId();
      if (anonId) {
        await Promise.race([
          fetch('/api/public-test-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              anonId,
              ageBand,
              gender: genderBucket,
              acquisitionSource,
            }),
            keepalive: true,
          }),
          new Promise<void>((resolve) => {
            window.setTimeout(resolve, 450);
          }),
        ]).catch(() => null);
      }
      mergeIntroProfileIntoSurveySession();
      router.push('/movement-test/survey');
    }
  }, [acquisition, birthDate, gender, router]);

  const canSubmit = Boolean(birthDate && gender);

  const todayIso = typeof window !== 'undefined' ? localIsoDate(new Date()) : '';

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
              생년월일
            </label>
            <input
              type="date"
              max={todayIso}
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="w-full rounded-none border-0 border-b border-white/20 bg-transparent px-[50px] py-4 text-center text-[18px] font-light tracking-[-0.8px] text-[#dce1fb] focus:border-[#ffb77d] focus:outline-none focus:ring-0"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            />
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

          <div className="space-y-4">
            <label
              className="block text-xs uppercase tracking-widest text-[#c6c6cd]/50"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              유입 경로 <span className="normal-case text-[#c6c6cd]/40">(선택)</span>
            </label>
            <select
              value={acquisition}
              onChange={(e) => setAcquisition((e.target.value || '') as AcquisitionSource | '')}
              className="w-full cursor-pointer appearance-none rounded-none border-0 border-b border-white/20 bg-transparent px-[50px] py-4 text-center text-[18px] font-light tracking-[-0.8px] text-[#dce1fb] focus:border-[#ffb77d] focus:outline-none focus:ring-0"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              <option value="">선택 안 함</option>
              {ACQUISITION_OPTIONS.map((key) => (
                <option key={key} value={key} className="bg-[#0c1324]">
                  {ACQUISITION_SOURCE_LABELS[key]}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full rounded-lg bg-gradient-to-br from-[#ffb77d] to-[#ab4c00] py-5 text-lg font-semibold tracking-[-1.2px] text-[#1e1e1f] shadow-xl shadow-black/40 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            다음으로 진행
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
