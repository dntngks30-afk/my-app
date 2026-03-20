'use client';

/**
 * FLOW-04 — Post-Pay Onboarding (PR-ONBOARDING-MIN-06 최소 실행 준비)
 *
 * 결제 후 실행 준비 입력 수집.
 * session_user_profile에 저장 (target_frequency, exercise_experience_level,
 * pain_or_discomfort_present, 선택 lifestyle_tag).
 *
 * - 설문에서 이미 패턴·체감은 반영됨 → 여기서는 주당 횟수·경험·안전 신호만.
 * - 통증 여부는 설문 q2(불편 슬롯) 평균으로 보수적 프리필(없으면 사용자 선택).
 * - 연령/성별은 회원가입·프로필 경로에서 수집 — 본 화면에서 재질문하지 않음.
 *
 * @see src/app/api/session/profile/route.ts
 * @see src/lib/onboarding/surveyOnboardingHints.ts
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';
import type { TargetFrequency, ExerciseExperienceLevel } from '@/lib/session/profile';
import { inferPainHintFromSurveyV2 } from '@/lib/onboarding/surveyOnboardingHints';

const BG = '#0d161f';
const ACCENT = '#ff7b00';
const LIFESTYLE_MAX = 200;

const FREQUENCY_OPTIONS: { value: TargetFrequency; label: string }[] = [
  { value: 2, label: '주 2회' },
  { value: 3, label: '주 3회' },
  { value: 4, label: '주 4회' },
  { value: 5, label: '주 5회' },
];

const EXPERIENCE_OPTIONS: { value: ExerciseExperienceLevel; label: string }[] = [
  { value: 'beginner', label: '초보' },
  { value: 'intermediate', label: '중급' },
  { value: 'advanced', label: '숙련' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [targetFrequency, setTargetFrequency] = useState<TargetFrequency | null>(4);
  const [exerciseExperienceLevel, setExerciseExperienceLevel] = useState<ExerciseExperienceLevel | null>(null);
  const [painOrDiscomfortPresent, setPainOrDiscomfortPresent] = useState<boolean | null>(null);
  /** 기존 DB 컬럼 lifestyle_tag — 질환/수술 등 조심할 점 한 줄(선택) */
  const [lifestyleNote, setLifestyleNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      if (!cancelled) {
        setAuthChecked(true);
        if (!session) {
          router.replace(`/app/auth?next=${encodeURIComponent('/onboarding')}`);
        }
      }
    }
    check();
    return () => { cancelled = true; };
  }, [router]);

  /** 설문 완료 시 통증 신호만 보수적으로 제안(강제 아님) */
  useEffect(() => {
    const hint = inferPainHintFromSurveyV2();
    if (hint !== undefined) {
      setPainOrDiscomfortPresent((prev) => (prev === null ? hint : prev));
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (targetFrequency == null || exerciseExperienceLevel == null || painOrDiscomfortPresent == null) {
      setError('위 세 가지를 선택해 주세요.');
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      if (!session) {
        setError('로그인이 필요합니다.');
        setSaving(false);
        return;
      }

      const trimmedNote = lifestyleNote.trim();
      const res = await fetch('/api/session/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          target_frequency: targetFrequency,
          exercise_experience_level: exerciseExperienceLevel,
          pain_or_discomfort_present: painOrDiscomfortPresent,
          // 비어 있으면 키 생략 → 서버가 기존 lifestyle_tag 를 덮어쓰지 않음
          ...(trimmedNote ? { lifestyle_tag: trimmedNote.slice(0, LIFESTYLE_MAX) } : {}),
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json?.message ?? json?.error ?? '저장에 실패했습니다.');
        setSaving(false);
        return;
      }

      router.push('/onboarding-complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.');
      setSaving(false);
    }
  }, [targetFrequency, exerciseExperienceLevel, painOrDiscomfortPresent, lifestyleNote, router]);

  const canSubmit =
    targetFrequency != null &&
    exerciseExperienceLevel != null &&
    painOrDiscomfortPresent != null &&
    !saving;

  if (!authChecked) {
    return (
      <div className="min-h-[100svh] flex items-center justify-center" style={{ backgroundColor: BG }}>
        <p className="text-slate-400 text-sm">확인 중...</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-[100svh] flex flex-col items-center px-6 py-8"
      style={{ backgroundColor: BG }}
    >
      <div className="w-full max-w-md space-y-5">
        <div className="text-center space-y-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-500" style={{ fontFamily: 'var(--font-sans-noto)' }}>
            마지막 실행 준비
          </p>
          <h1 className="text-xl font-bold text-slate-100 leading-snug" style={{ fontFamily: 'var(--font-sans-noto)' }}>
            결제는 끝났어요. 이제 루틴만 맞출게요
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed" style={{ fontFamily: 'var(--font-sans-noto)' }}>
            설문·결과로 <span className="text-slate-300">패턴은 이미 반영</span>되어 있어요. 여기서는{' '}
            <span className="text-slate-300">주당 횟수·운동 경험·안전 신호</span>만 확인하면 바로 이어갑니다.
          </p>
        </div>

        <div className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div>
            <label className="block text-slate-300 text-xs font-medium mb-2" style={{ fontFamily: 'var(--font-sans-noto)' }}>
              1. 이번 루틴에서 목표로 할 주당 횟수
            </label>
            <div className="flex flex-wrap gap-2">
              {FREQUENCY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTargetFrequency(opt.value)}
                  className="px-3 py-2 rounded-xl text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: targetFrequency === opt.value ? ACCENT : 'rgba(255,255,255,0.08)',
                    color: targetFrequency === opt.value ? '#0d161f' : '#94a3b8',
                    fontFamily: 'var(--font-sans-noto)',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-slate-300 text-xs font-medium mb-2" style={{ fontFamily: 'var(--font-sans-noto)' }}>
              2. 최근 운동·움직임 경험
            </label>
            <div className="flex flex-wrap gap-2">
              {EXPERIENCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setExerciseExperienceLevel(opt.value)}
                  className="px-3 py-2 rounded-xl text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: exerciseExperienceLevel === opt.value ? ACCENT : 'rgba(255,255,255,0.08)',
                    color: exerciseExperienceLevel === opt.value ? '#0d161f' : '#94a3b8',
                    fontFamily: 'var(--font-sans-noto)',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-slate-300 text-xs font-medium mb-2" style={{ fontFamily: 'var(--font-sans-noto)' }}>
              3. 지금 뻐근함·통증이 자주 느껴지나요?
            </label>
            <p className="text-[11px] text-slate-500 mb-2 leading-relaxed" style={{ fontFamily: 'var(--font-sans-noto)' }}>
              설문에서 불편이 크게 잡힌 경우 자동으로 하나가 선택될 수 있어요. 필요하면 바꿔 주세요.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setPainOrDiscomfortPresent(false)}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-colors"
                style={{
                  backgroundColor: painOrDiscomfortPresent === false ? ACCENT : 'rgba(255,255,255,0.08)',
                  color: painOrDiscomfortPresent === false ? '#0d161f' : '#94a3b8',
                  fontFamily: 'var(--font-sans-noto)',
                }}
              >
                거의 없음
              </button>
              <button
                type="button"
                onClick={() => setPainOrDiscomfortPresent(true)}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-colors"
                style={{
                  backgroundColor: painOrDiscomfortPresent === true ? ACCENT : 'rgba(255,255,255,0.08)',
                  color: painOrDiscomfortPresent === true ? '#0d161f' : '#94a3b8',
                  fontFamily: 'var(--font-sans-noto)',
                }}
              >
                자주 있음
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="lifestyle-note"
              className="block text-slate-300 text-xs font-medium mb-2"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              4. 수술·부상·의사가 제한한 동작 등, 특히 조심할 점{' '}
              <span className="text-slate-500 font-normal">(선택)</span>
            </label>
            <textarea
              id="lifestyle-note"
              value={lifestyleNote}
              onChange={(e) => setLifestyleNote(e.target.value.slice(0, LIFESTYLE_MAX))}
              rows={2}
              placeholder="없으면 비워 두셔도 돼요."
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            />
            <p className="text-[10px] text-slate-600 mt-1 text-right">{lifestyleNote.length}/{LIFESTYLE_MAX}</p>
          </div>
        </div>

        {error && (
          <p className="text-sm text-amber-400 text-center" style={{ fontFamily: 'var(--font-sans-noto)' }}>
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full min-h-[52px] rounded-2xl font-bold text-slate-900 transition-colors disabled:opacity-50"
          style={{ backgroundColor: ACCENT, fontFamily: 'var(--font-sans-noto)' }}
        >
          {saving ? '저장 중...' : '저장하고 루틴 연결하기'}
        </button>
      </div>
    </div>
  );
}
