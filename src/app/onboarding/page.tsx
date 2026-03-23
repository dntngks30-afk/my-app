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

export default function OnboardingPage() {
  const router = useRouter();
  const [targetFrequency, setTargetFrequency] = useState<TargetFrequency | null>(4);
  const [exerciseExperienceLevel, setExerciseExperienceLevel] = useState<ExerciseExperienceLevel | null>(null);
  const [painOrDiscomfortPresent, setPainOrDiscomfortPresent] = useState<boolean | null>(null);
  const [lifestyleNote, setLifestyleNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

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
    setSaving(true);

    try {
      const {
        data: { session },
      } = await supabaseBrowser.auth.getSession();
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
      <StitchSceneShell contentEnter="off">
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-slate-400">확인 중...</p>
        </div>
      </StitchSceneShell>
    );
  }

  return (
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
  );
}
