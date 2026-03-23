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

const AGE_OPTIONS = [
  { value: '10-19', label: '10대' },
  { value: '20-29', label: '20대' },
  { value: '30-39', label: '30대' },
  { value: '40-49', label: '40대' },
  { value: '50-59', label: '50대' },
  { value: '60+', label: '60대 이상' },
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
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');

  const handleSubmit = useCallback(() => {
    saveFunnel({
      age: age || undefined,
      gender: gender || undefined,
      introCompletedAt: new Date().toISOString(),
    });
    if (typeof window !== 'undefined') {
      mergeIntroProfileIntoSurveySession();
      router.push('/movement-test/survey');
    }
  }, [age, gender, router]);

  const canSubmit = Boolean(age && gender);

  return (
    <IntroSceneShell currentPath="/intro/profile" navVariant="hidden">
      <div className="w-full max-w-lg pb-28">
        <div className="mb-8 space-y-2 text-center">
          <p className="text-sm tracking-[0.3em] text-[#ffb77d] opacity-80" style={{ fontFamily: 'var(--font-sans-noto)' }}>
            시작 전,
          </p>
          <h1 className="text-4xl font-light text-[#dce1fb] [font-family:var(--font-display)]">몇 가지만 알려주세요</h1>
          <p className="text-sm font-light text-[#c6c6cd]" style={{ fontFamily: 'var(--font-sans-noto)' }}>
            맞춤형 웰니스 케어 제공을 위해 최소한의 정보를 수집합니다.
          </p>
        </div>

        <div className="space-y-10">
          <div className="space-y-4">
            <label
              className="block text-xs uppercase tracking-widest text-[#c6c6cd]/50"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              연령대
            </label>
            <select
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="w-full cursor-pointer appearance-none rounded-none border-0 border-b border-white/20 bg-transparent py-4 text-xl text-[#dce1fb] focus:border-[#ffb77d] focus:outline-none focus:ring-0"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              <option value="">연령대를 선택해주세요</option>
              {AGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} className="bg-[#0c1324]">
                  {o.label}
                </option>
              ))}
            </select>
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
                      : 'border-white/20 text-[#c6c6cd] hover:border-[#ffb77d]/50'
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
            className="w-full rounded-lg bg-gradient-to-br from-[#ffb77d] to-[#ab4c00] py-6 text-lg font-semibold text-[#4d2600] shadow-xl shadow-black/40 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            다음으로 진행
          </button>

          <p className="text-center text-[10px] text-slate-500" style={{ fontFamily: 'var(--font-sans-noto)' }}>
            입력하신 정보는 익명으로 안전하게 처리됩니다.
          </p>
        </div>

        <div className="mt-12 flex justify-center">
          <IntroStepIndicator step={7} />
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
