'use client';

/**
 * PR-SESSION-PREPARING-TRANSPLANT-MIN-DWELL-02 - zip(9) tone session preparing scene.
 */
import { PostpayChapterShell, PostpayBrandHeader, PostpayHorizontalPreparingBar } from './shared';

export type StitchSessionPreparingSceneProps = {
  stageIndex: number;
  visualProgress: number;
  errorMessage: string | null;
  onSkipNext: () => void;
};

const STAGE_LINES = [
  '지금 정리된 상태를 반영해, 운동 시작점을 맞추고 있어요.',
  '조심해야 할 움직임과 난이도에 맞춰 세션을 잡고 있어요.',
  '리셋맵에 이어질 전체 세션 구성을 준비하고 있어요.',
] as const;

export default function StitchSessionPreparingScene({
  stageIndex,
  visualProgress,
  errorMessage,
  onSkipNext,
}: StitchSessionPreparingSceneProps) {
  const line = STAGE_LINES[stageIndex] ?? STAGE_LINES[0];

  return (
    <PostpayChapterShell>
      <div className="flex min-h-[100svh] flex-col">
        <PostpayBrandHeader />

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-6 pb-6">
          <div className="pointer-events-none absolute left-1/2 top-[28%] z-0 h-[min(500px,90vw)] w-[min(500px,90vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,#ffb77d_0%,rgba(255,183,125,0)_70%)] opacity-40 blur-[60px] motion-safe:animate-pulse" />

          <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center text-center">
            <div className="relative mb-8 flex h-32 w-32 shrink-0 items-center justify-center">
              <div
                className="absolute inset-0 scale-150 rounded-full border border-[#ffb77d]/20 opacity-30"
                aria-hidden
              />
              <div
                className="size-4 rounded-full bg-[#ffb77d] shadow-[0_0_24px_rgba(255,183,125,0.75)]"
                aria-hidden
              />
            </div>

            <div className="w-full space-y-6">
              <div className="space-y-3">
                <p
                  className="text-[10px] font-light uppercase tracking-[0.3em] text-[#c6c6cd]/65"
                  style={{ fontFamily: 'var(--font-sans-noto)' }}
                >
                  실행 직전
                </p>
                <h1 className="break-keep text-[1.65rem] font-light italic leading-tight tracking-tight text-[#dce1fb] sm:text-3xl [font-family:var(--font-display)]">
                  개인화된 세션이 조율되고 있습니다.
                </h1>
                <p
                  className="mx-auto max-w-sm break-keep text-[15px] font-light leading-relaxed text-[#c6c6cd]/85"
                  style={{ fontFamily: 'var(--font-sans-noto)' }}
                >
                  지금 맞춰 둔 설정과 결과를 바탕으로, 첫 리셋의 리듬을 맞추고 있어요.
                </p>
              </div>

              <div className="rounded-2xl bg-[#23293c]/55 px-5 py-7 backdrop-blur-xl">
                <p
                  key={stageIndex}
                  className="public-survey-question-swap min-h-[4.5rem] break-keep text-sm leading-relaxed text-[#dce1fb]/95"
                  style={{ fontFamily: 'var(--font-sans-noto)' }}
                  aria-live="polite"
                >
                  {line}
                </p>
                <div className="mt-6 flex flex-col items-center gap-3">
                  <PostpayHorizontalPreparingBar fraction={visualProgress} />
                  <div className="flex justify-center gap-2" aria-hidden>
                    {STAGE_LINES.map((_, i) => (
                      <span
                        key={i}
                        className="h-1.5 w-1.5 rounded-full transition-colors duration-300"
                        style={{
                          backgroundColor: i <= stageIndex ? '#ffb77d' : 'rgba(255,255,255,0.12)',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {errorMessage ? (
                <p
                  className="break-keep rounded-xl border border-red-500/25 bg-red-950/30 px-4 py-3 text-sm text-red-200/95"
                  style={{ fontFamily: 'var(--font-sans-noto)' }}
                  role="alert"
                >
                  {errorMessage}
                </p>
              ) : (
                <p
                  className="break-keep text-[11px] leading-relaxed text-slate-500"
                  style={{ fontFamily: 'var(--font-sans-noto)' }}
                >
                  분석을 다시 묻는 단계가 아니라, 방금 맞춘 실행 설정을 세션에 반영하는 준비예요.
                </p>
              )}
            </div>
          </div>

          <div className="relative z-10 mx-auto mt-auto w-full max-w-md shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-6">
            <button
              type="button"
              onClick={onSkipNext}
              className="flex min-h-[48px] w-full items-center justify-center rounded-lg border border-[#ffb77d]/30 bg-transparent text-sm font-medium text-[#c6c6cd] transition-colors hover:bg-white/5 hover:text-[#dce1fb]"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              바로 다음으로
            </button>
          </div>
        </div>
      </div>
    </PostpayChapterShell>
  );
}