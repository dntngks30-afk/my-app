'use client';

/**
 * FLOW-04 — Post-Pay Onboarding
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';
import type { TargetFrequency, ExerciseExperienceLevel } from '@/lib/session/profile';
import { inferPainHintFromSurveyV2 } from '@/lib/onboarding/surveyOnboardingHints';
import { StitchSceneShell } from '@/components/stitch/shared/SceneShell';
import StitchOnboarding from '@/components/stitch/onboarding/StitchOnboarding';

const LIFESTYLE_MAX = 200;

function OnboardingAuthLoadingScene() {
  return (
    <StitchSceneShell contentEnter="calm">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-10">
        <div className="mx-auto w-full max-w-md space-y-8">
          <div className="space-y-3 text-left">
            <p
              className="text-[10px] font-light uppercase tracking-[0.35em] text-[#ffb77d]/90"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              실행 시작 설정
            </p>
            <div className="h-px w-12 animate-pulse bg-[#ffb77d]/40" aria-hidden />
            <div className="h-8 w-4/5 max-w-sm animate-pulse rounded-lg bg-[#151b2d]/80" aria-hidden />
            <div className="h-4 w-full animate-pulse rounded-md bg-[#151b2d]/50" aria-hidden />
            <div className="h-4 w-11/12 animate-pulse rounded-md bg-[#151b2d]/45" aria-hidden />
          </div>
          <div className="space-y-4 rounded-2xl border border-white/[0.06] bg-[#151b2d]/35 p-5 backdrop-blur-md">
            <div className="h-24 animate-pulse rounded-xl bg-[#0c1324]/70" aria-hidden />
            <div className="h-24 animate-pulse rounded-xl bg-[#0c1324]/65" aria-hidden />
            <div className="h-20 animate-pulse rounded-xl bg-[#0c1324]/60" aria-hidden />
          </div>
          <p className="text-center text-sm font-light text-[#c6c6cd]" style={{ fontFamily: 'var(--font-sans-noto)' }}>
            계정 확인 중…
          </p>
        </div>
      </div>
    </StitchSceneShell>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [targetFrequency, setTargetFrequency] = useState<TargetFrequency | null>(null);
  const [exerciseExperienceLevel, setExerciseExperienceLevel] = useState<ExerciseExperienceLevel | null>(null);
  const [painOrDiscomfortPresent, setPainOrDiscomfortPresent] = useState<boolean | null>(null);
  const [lifestyleNote, setLifestyleNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitTransition, setSubmitTransition] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    router.prefetch('/session-preparing');
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const {
        data: { session },
      } = await supabaseBrowser.auth.getSession();
      if (!cancelled) {
        setAuthChecked(true);
        if (!session) {
          router.replace(`/app/auth?next=${encodeURIComponent('/onboarding')}`);
        }
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [router]);

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
    setSubmitTransition(true);
    setSaving(true);

    try {
      const {
        data: { session },
      } = await supabaseBrowser.auth.getSession();
      if (!session) {
        setError('로그인이 필요합니다.');
        setSaving(false);
        setSubmitTransition(false);
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
          onboarding_completed: true,
          ...(trimmedNote ? { lifestyle_tag: trimmedNote.slice(0, LIFESTYLE_MAX) } : {}),
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json?.message ?? json?.error ?? '저장에 실패했습니다.');
        setSaving(false);
        setSubmitTransition(false);
        return;
      }

      router.push('/session-preparing');
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.');
      setSaving(false);
      setSubmitTransition(false);
    }
  }, [targetFrequency, exerciseExperienceLevel, painOrDiscomfortPresent, lifestyleNote, router]);

  const canSubmit =
    targetFrequency != null &&
    exerciseExperienceLevel != null &&
    painOrDiscomfortPresent != null &&
    !saving &&
    !submitTransition;

  if (!authChecked) {
    return <OnboardingAuthLoadingScene />;
  }

  return (
    <div className="relative">
      {(submitTransition || saving) && (
        <div
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-3 bg-[#0c1324]/88 px-8 backdrop-blur-md"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <p
            className="max-w-xs text-center text-base font-medium text-[#dce1fb]"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            실행 설정을 저장하고 있어요
          </p>
          <p
            className="max-w-xs text-center text-sm font-light leading-relaxed text-[#c6c6cd]"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            첫 세션 준비 화면으로 이동합니다
          </p>
          <span className="mt-2 inline-block size-8 animate-spin rounded-full border-2 border-[#ffb77d]/25 border-t-[#ffb77d]" aria-hidden />
        </div>
      )}
      <StitchOnboarding
        targetFrequency={targetFrequency}
        setTargetFrequency={setTargetFrequency}
        exerciseExperienceLevel={exerciseExperienceLevel}
        setExerciseExperienceLevel={setExerciseExperienceLevel}
        painOrDiscomfortPresent={painOrDiscomfortPresent}
        setPainOrDiscomfortPresent={setPainOrDiscomfortPresent}
        lifestyleNote={lifestyleNote}
        setLifestyleNote={setLifestyleNote}
        error={error}
        saving={saving}
        canSubmit={canSubmit}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
