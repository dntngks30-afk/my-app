'use client';

/**
 * intro profile: age + gender 입력 후 localStorage 저장
 * PR-PUBLIC-ENTRY-02 — 완료 시 항상 설문 baseline(/movement-test/survey)으로 진입.
 * 카메라 first-entry 분기 제거 (refine-bridge에서만 optional 제공).
 */
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { IntroSlide } from '@/components/public/IntroSlide';
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

export default function IntroProfilePage() {
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
    <IntroSlide currentPath="/intro/profile" hideBottomBar>
      <div className="mx-auto flex w-full max-w-md flex-col items-stretch gap-7">
        <div className="w-full space-y-2 text-center">
          <p className="text-sm text-slate-400" style={{ fontFamily: 'var(--font-sans-noto)' }}>
            시작 전,
          </p>
          <h1
            className="text-2xl font-bold text-slate-100 md:text-3xl"
            style={{ fontFamily: 'var(--font-serif-noto)' }}
          >
            몇 가지만 알려주세요
          </h1>
          <p className="text-sm text-slate-400" style={{ fontFamily: 'var(--font-sans-noto)' }}>
            맞춤형 웰니스 케어 제공을 위해 최소한의 정보를 수집합니다.
          </p>
        </div>

        <div className="w-full space-y-3">
          <div>
            <label className="mb-1.5 block text-xs text-slate-400" style={{ fontFamily: 'var(--font-sans-noto)' }}>
              연령대
            </label>
            <select
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--mr-public-accent)]"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              <option value="">연령대를 선택해주세요</option>
              {AGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-slate-400" style={{ fontFamily: 'var(--font-sans-noto)' }}>
              성별
            </label>
            <div className="flex gap-2">
              {GENDER_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setGender(o.value)}
                  className={`flex-1 rounded-xl border py-2.5 text-sm font-medium transition-colors ${
                    gender === o.value
                      ? 'border-[var(--mr-public-accent)]/50 bg-[color-mix(in_srgb,var(--mr-public-accent)_20%,transparent)] text-white'
                      : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/20'
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
            className="w-full rounded-xl bg-white py-3.5 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            다음으로 진행
          </button>
          <p className="text-center text-[10px] text-slate-500">입력하신 정보는 익명으로 안전하게 처리됩니다.</p>
        </div>
      </div>
    </IntroSlide>
  );
}
