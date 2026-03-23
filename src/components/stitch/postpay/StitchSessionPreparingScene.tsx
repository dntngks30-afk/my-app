'use client';

/**
 * PR-GENERATION-STAGE-07 — 세션 준비 장면 (stitch family 변형)
 */
import { PostpayChapterShell, PostpayBrandHeader, PostpayVerticalRail } from './shared';

export type StitchSessionPreparingSceneProps = {
  stageIndex: number;
  stageLines: readonly string[];
  onSkipNext: () => void;
};

export default function StitchSessionPreparingScene({
  stageIndex,
  stageLines,
  onSkipNext,
}: StitchSessionPreparingSceneProps) {
  const total = stageLines.length;
  const line = stageLines[stageIndex] ?? stageLines[0];
  const railFraction = (stageIndex + 1) / total;

  return (
    <PostpayChapterShell>
      <div className="flex min-h-[100svh] flex-col">
        <PostpayBrandHeader />

        <div className="flex min-h-0 flex-1 flex-col px-6 pb-6">
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center">
            <div className="mb-6 flex flex-col items-center">
              <PostpayVerticalRail fraction={railFraction} />
            </div>

            <div className="w-full space-y-8 text-center">
              <div className="space-y-2">
                <p
                  className="text-[10px] font-light uppercase tracking-[0.35em] text-[#c6c6cd]/70"
                  style={{ fontFamily: 'var(--font-sans-noto)' }}
                >
                  실행 직전
                </p>
                <h1 className="text-2xl font-light text-[#dce1fb] md:text-3xl [font-family:var(--font-display)]">
                  세션을 맞추는 중이에요
                </h1>
              </div>

              <div className="rounded-xl bg-[rgba(46,52,71,0.45)] px-5 py-8 backdrop-blur-xl">
                <p
                  key={stageIndex}
                  className="public-survey-question-swap text-sm leading-relaxed text-[#c6c6cd]"
                  style={{ fontFamily: 'var(--font-sans-noto)' }}
                  aria-live="polite"
                >
                  {line}
                </p>
                <div className="mt-6 flex justify-center gap-2" aria-hidden>
                  {stageLines.map((_, i) => (
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

              <p
                className="text-[11px] leading-relaxed text-slate-500"
                style={{ fontFamily: 'var(--font-sans-noto)' }}
              >
                분석 결과를 다시 묻는 단계가 아니라, 방금 맞춘 실행 설정을 세션에 반영하는 짧은 준비예요.
              </p>
            </div>
          </div>

          <div className="mx-auto w-full max-w-md shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-6">
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
