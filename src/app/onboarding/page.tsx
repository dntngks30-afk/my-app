'use client';

/**
 * FLOW-04 — Post-Pay Onboarding
 * PR-ONBOARDING-01 — 표현만 최소화: 실행 시작 설정(빈도·경험·안전 신호) 3필드 중심.
 *
 * session_user_profile: target_frequency, exercise_experience_level,
 * pain_or_discomfort_present, 선택 lifestyle_tag(POST body 키 생략 가능).
 *
 * @see src/app/api/session/profile/route.ts
 * @see src/lib/onboarding/surveyOnboardingHints.ts
 * @see src/app/session-preparing/page.tsx
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';
import type { TargetFrequency, ExerciseExperienceLevel } from '@/lib/session/profile';
import { inferPainHintFromSurveyV2 } from '@/lib/onboarding/surveyOnboardingHints';
import {
  MoveReChoiceChip,
  MoveReFullscreenScreen,
  MoveRePrimaryCTA,
  MoveReSurfaceCard,
} from '@/components/public-brand';

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
      setError('주간 횟수·경험·불편 여부 세 가지를 선택해 주세요.');
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

      router.push('/session-preparing');
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
      <MoveReFullscreenScreen showCosmicGlow={false}>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-slate-400">확인 중...</p>
        </div>
      </MoveReFullscreenScreen>
    );
  }

  return (
    <MoveReFullscreenScreen>
      <div className="flex flex-1 flex-col items-center px-6 py-8">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center space-y-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-500" style={{ fontFamily: 'var(--font-sans-noto)' }}>
            실행 시작 설정
          </p>
          <h1 className="text-xl font-bold text-slate-100 leading-snug" style={{ fontFamily: 'var(--font-sans-noto)' }}>
            첫 세션 바로 앞이에요
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed" style={{ fontFamily: 'var(--font-sans-noto)' }}>
            분석은 이미 끝났어요. 지금은{' '}
            <span className="text-slate-300">한 주에 몇 번 돌릴지·시작 강도·몸의 불편 신호</span>만 맞추면
            실행 루틴으로 이어져요.
          </p>
        </div>

        <MoveReSurfaceCard className="space-y-5 p-4">
          <div>
            <label className="mb-2 block text-xs font-medium text-slate-300" style={{ fontFamily: 'var(--font-sans-noto)' }}>
              1. 이번 주기에 맞출 주간 횟수
            </label>
            <div className="flex flex-wrap gap-2">
              {FREQUENCY_OPTIONS.map((opt) => (
                <MoveReChoiceChip
                  key={opt.value}
                  type="button"
                  onClick={() => setTargetFrequency(opt.value)}
                  selected={targetFrequency === opt.value}
                >
                  {opt.label}
                </MoveReChoiceChip>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-slate-300" style={{ fontFamily: 'var(--font-sans-noto)' }}>
              2. 최근 운동·움직임 경험 (시작 강도에 씀)
            </label>
            <div className="flex flex-wrap gap-2">
              {EXPERIENCE_OPTIONS.map((opt) => (
                <MoveReChoiceChip
                  key={opt.value}
                  type="button"
                  onClick={() => setExerciseExperienceLevel(opt.value)}
                  selected={exerciseExperienceLevel === opt.value}
                >
                  {opt.label}
                </MoveReChoiceChip>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-slate-300" style={{ fontFamily: 'var(--font-sans-noto)' }}>
              3. 지금 뻐근함·불편이 자주 느껴지나요? (안전 쪽 맞춤)
            </label>
            <p className="mb-2 text-[11px] leading-relaxed text-slate-500" style={{ fontFamily: 'var(--font-sans-noto)' }}>
              이전에 답하신 내용을 참고해 제안할 수 있어요. 필요하면 바꿔 주세요.
            </p>
            <div className="flex gap-3">
              <MoveReChoiceChip
                type="button"
                className="flex-1 px-4 py-3"
                onClick={() => setPainOrDiscomfortPresent(false)}
                selected={painOrDiscomfortPresent === false}
              >
                거의 없음
              </MoveReChoiceChip>
              <MoveReChoiceChip
                type="button"
                className="flex-1 px-4 py-3"
                onClick={() => setPainOrDiscomfortPresent(true)}
                selected={painOrDiscomfortPresent === true}
              >
                자주 있음
              </MoveReChoiceChip>
            </div>
          </div>

          {/* 선택 필드: 메인 3필드와 분리해 부담 최소화 (readiness 미사용) */}
          <details className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-left">
            <summary
              className="text-[11px] text-slate-500 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              더 적어 두기 (선택) — 수술·부상 등 실행 시 조심할 점{' '}
              <span className="text-slate-600">▼</span>
            </summary>
            <div className="pt-3 pb-1">
              <label htmlFor="lifestyle-note" className="sr-only">
                실행 시 조심할 점 (선택)
              </label>
              <textarea
                id="lifestyle-note"
                value={lifestyleNote}
                onChange={(e) => setLifestyleNote(e.target.value.slice(0, LIFESTYLE_MAX))}
                rows={2}
                placeholder="없으면 비워 두셔도 돼요."
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                style={{ fontFamily: 'var(--font-sans-noto)' }}
              />
              <p className="text-[10px] text-slate-600 mt-1 text-right">{lifestyleNote.length}/{LIFESTYLE_MAX}</p>
            </div>
          </details>
        </MoveReSurfaceCard>

        {error && (
          <p className="text-center text-sm text-amber-400" style={{ fontFamily: 'var(--font-sans-noto)' }}>
            {error}
          </p>
        )}

        <MoveRePrimaryCTA onClick={handleSubmit} disabled={!canSubmit}>
          {saving ? '저장 중...' : '설정 저장하고 이어가기'}
        </MoveRePrimaryCTA>
      </div>
      </div>
    </MoveReFullscreenScreen>
  );
}
