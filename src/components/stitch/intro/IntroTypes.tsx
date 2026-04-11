'use client';

/**
 * stitch code.html Screen 6 — Types (번호 리스트)
 */
import { IntroSceneShell, IntroStepIndicator } from './IntroSceneShell';

const LINES = [
  { lead: '안정성', rest: '부터 갖춰야 하는 사람' },
  { lead: '가동성', rest: '부터 개선해야 하는 사람' },
  { lead: '좌우 균형', rest: '부터 맞춰야 하는 사람' },
] as const;

export default function IntroTypes() {
  return (
    <IntroSceneShell currentPath="/intro/types">
      <div className="w-full max-w-2xl px-2">
        <h2 className="mb-12 text-center text-[26px] font-semibold leading-[31px] tracking-[-1.2px] text-[rgba(220,225,251,1)] [font-family:var(--font-serif-noto)]">
          사람마다
          <br />
          <span className="text-[#FCB973]">시작점</span>이 다릅니다.
        </h2>

        <ul className="space-y-10">
          {LINES.map(({ lead, rest }, i) => (
            <li key={lead} className="group flex items-start gap-6">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#ffb77d]/30 text-[11px] text-[#ffb77d]"
                style={{ fontFamily: 'var(--font-sans-noto)' }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0">
                <p className="py-[10px] text-[14px] font-light leading-[16px] tracking-[-1.2px] text-[rgba(220,225,251,1)] [font-family:var(--font-sans-noto)]">
                  <span className="text-[16px] text-[#fcb973] transition-colors group-hover:text-[#ffb77d]">{lead}</span>
                  <span className="transition-colors group-hover:text-[#ffb77d]">{rest}</span>
                </p>
                <div className="mt-2 h-px w-0 bg-[#ffb77d]/20 transition-all duration-700 group-hover:w-full" />
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-16 flex justify-center">
          <IntroStepIndicator step={4} />
        </div>
      </div>
    </IntroSceneShell>
  );
}
