'use client';

/**
 * stitch code.html Screen 6 — Types (번호 리스트)
 */
import { IntroSceneShell, IntroStepIndicator } from './IntroSceneShell';

const LINES = [
  '어떤 사람은 안정성이 먼저 필요하고',
  '어떤 사람은 가동성부터 풀어야 합니다',
  '어떤 사람은 좌우 불균형이 먼저 드러납니다',
] as const;

export default function IntroTypes() {
  return (
    <IntroSceneShell currentPath="/intro/types">
      <div className="w-full max-w-2xl px-2">
        <h2 className="mb-12 text-center text-4xl font-light text-[#dce1fb] [font-family:var(--font-display)]">
          사람마다 움직임 타입이 다릅니다
        </h2>

        <ul className="space-y-10">
          {LINES.map((line, i) => (
            <li key={line} className="group flex items-start gap-6">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#ffb77d]/30 text-sm text-[#ffb77d]"
                style={{ fontFamily: 'var(--font-sans-noto)' }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0">
                <p
                  className="text-xl font-light text-[#dce1fb] transition-colors group-hover:text-[#ffb77d]"
                  style={{ fontFamily: 'var(--font-sans-noto)' }}
                >
                  {line}
                </p>
                <div className="mt-2 h-px w-0 bg-[#ffb77d]/20 transition-all duration-700 group-hover:w-full" />
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-16 flex justify-center">
          <IntroStepIndicator step={5} />
        </div>
      </div>
    </IntroSceneShell>
  );
}
