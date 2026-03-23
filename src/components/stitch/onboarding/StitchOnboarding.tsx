'use client';

/**
 * FLOW-04 — Post-Pay Onboarding (표현만 stitch family)
 */
import type { TargetFrequency, ExerciseExperienceLevel } from '@/lib/session/profile';
import { StitchSceneShell } from '@/components/stitch/shared/SceneShell';

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

export type StitchOnboardingProps = {
  targetFrequency: TargetFrequency | null;
  setTargetFrequency: (v: TargetFrequency) => void;
  exerciseExperienceLevel: ExerciseExperienceLevel | null;
  setExerciseExperienceLevel: (v: ExerciseExperienceLevel) => void;
  painOrDiscomfortPresent: boolean | null;
  setPainOrDiscomfortPresent: (v: boolean) => void;
  lifestyleNote: string;
  setLifestyleNote: (v: string) => void;
  error: string | null;
  saving: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
};

export default function StitchOnboarding({
  targetFrequency,
  setTargetFrequency,
  exerciseExperienceLevel,
  setExerciseExperienceLevel,
  painOrDiscomfortPresent,
  setPainOrDiscomfortPresent,
  lifestyleNote,
  setLifestyleNote,
  error,
  saving,
  canSubmit,
  onSubmit,
}: StitchOnboardingProps) {
  const chip = (active: boolean) =>
    `rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
      active
        ? 'border-[#ffb77d]/60 bg-[#ffb77d]/15 text-[#fce9dc]'
        : 'border-white/10 bg-[#151b2d]/60 text-[#c6c6cd] hover:border-[#ffb77d]/35'
    }`;

  return (
    <StitchSceneShell>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-10">
        <div className="mx-auto w-full max-w-md space-y-8">
          <div className="space-y-3 text-left">
            <p
              className="text-[10px] font-light uppercase tracking-[0.35em] text-[#ffb77d]/90"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              실행 시작 설정
            </p>
            <div className="h-px w-12 bg-[#ffb77d]/50" aria-hidden />
            <h1 className="text-2xl font-light text-[#dce1fb] [font-family:var(--font-display)]">
              첫 세션 바로 앞이에요
            </h1>
            <p className="text-sm font-light leading-relaxed text-[#c6c6cd]" style={{ fontFamily: 'var(--font-sans-noto)' }}>
              분석은 이미 끝났어요. 지금은{' '}
              <span className="text-[#dce1fb]">한 주에 몇 번 돌릴지·시작 강도·몸의 불편 신호</span>만 맞추면 실행 루틴으로
              이어져요.
            </p>
          </div>

          <div className="space-y-6 rounded-2xl border border-white/[0.06] bg-[#151b2d]/40 p-5 backdrop-blur-md">
            <div>
              <label className="mb-3 block text-xs font-medium text-slate-400" style={{ fontFamily: 'var(--font-sans-noto)' }}>
                1. 이번 주기에 맞출 주간 횟수
              </label>
              <div className="flex flex-wrap gap-2">
                {FREQUENCY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTargetFrequency(opt.value)}
                    className={chip(targetFrequency === opt.value)}
                    style={{ fontFamily: 'var(--font-sans-noto)' }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-3 block text-xs font-medium text-slate-400" style={{ fontFamily: 'var(--font-sans-noto)' }}>
                2. 최근 운동·움직임 경험 (시작 강도에 씀)
              </label>
              <div className="flex flex-wrap gap-2">
                {EXPERIENCE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setExerciseExperienceLevel(opt.value)}
                    className={chip(exerciseExperienceLevel === opt.value)}
                    style={{ fontFamily: 'var(--font-sans-noto)' }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-slate-400" style={{ fontFamily: 'var(--font-sans-noto)' }}>
                3. 지금 뻐근함·불편이 자주 느껴지나요? (안전 쪽 맞춤)
              </label>
              <p className="mb-3 text-[11px] leading-relaxed text-slate-500" style={{ fontFamily: 'var(--font-sans-noto)' }}>
                이전에 답하신 내용을 참고해 제안할 수 있어요. 필요하면 바꿔 주세요.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setPainOrDiscomfortPresent(false)}
                  className={`flex-1 px-4 py-3 ${chip(painOrDiscomfortPresent === false)}`}
                  style={{ fontFamily: 'var(--font-sans-noto)' }}
                >
                  거의 없음
                </button>
                <button
                  type="button"
                  onClick={() => setPainOrDiscomfortPresent(true)}
                  className={`flex-1 px-4 py-3 ${chip(painOrDiscomfortPresent === true)}`}
                  style={{ fontFamily: 'var(--font-sans-noto)' }}
                >
                  자주 있음
                </button>
              </div>
            </div>

            <details className="rounded-xl border border-white/[0.06] bg-[#0c1324]/40 px-3 py-2 text-left">
              <summary
                className="cursor-pointer list-none text-[11px] text-slate-500 select-none [&::-webkit-details-marker]:hidden"
                style={{ fontFamily: 'var(--font-sans-noto)' }}
              >
                더 적어 두기 (선택) — 수술·부상 등 실행 시 조심할 점 <span className="text-slate-600">▼</span>
              </summary>
              <div className="pb-1 pt-3">
                <label htmlFor="lifestyle-note-stitch" className="sr-only">
                  실행 시 조심할 점 (선택)
                </label>
                <textarea
                  id="lifestyle-note-stitch"
                  value={lifestyleNote}
                  onChange={(e) => setLifestyleNote(e.target.value.slice(0, LIFESTYLE_MAX))}
                  rows={2}
                  placeholder="없으면 비워 두셔도 돼요."
                  className="w-full rounded-xl border border-white/10 bg-[#070d1f]/60 px-3 py-2 text-sm text-[#dce1fb] placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#ffb77d]/30"
                  style={{ fontFamily: 'var(--font-sans-noto)' }}
                />
                <p className="mt-1 text-right text-[10px] text-slate-600">
                  {lifestyleNote.length}/{LIFESTYLE_MAX}
                </p>
              </div>
            </details>
          </div>

          {error ? (
            <p className="text-center text-sm text-[#fcb973]" style={{ fontFamily: 'var(--font-sans-noto)' }}>
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="w-full rounded-lg bg-gradient-to-br from-[#ffb77d] to-[#ab4c00] py-4 text-base font-semibold text-[#4d2600] shadow-[0_20px_40px_rgba(2,6,23,0.08)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            {saving ? '저장 중...' : '설정 저장하고 이어가기'}
          </button>
        </div>
      </div>
    </StitchSceneShell>
  );
}
