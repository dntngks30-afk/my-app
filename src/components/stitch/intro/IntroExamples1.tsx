'use client';

/**
 * stitch code.html Screen 4 — Examples 1 (비교 카드)
 */
import Image from 'next/image';
import { IntroSceneShell, IntroStepIndicator } from './IntroSceneShell';

export default function IntroExamples1() {
  return (
    <IntroSceneShell currentPath="/intro/examples/1">
      <div className="w-full max-w-6xl px-2">
        <h2 className="mb-12 flex flex-col items-center gap-1 text-center font-medium leading-[25px] text-[#dce1fb] md:gap-1.5 md:text-4xl md:leading-tight [font-family:var(--font-serif-noto)]">
          <span className="text-[23px] font-semibold [font-family:var(--font-serif-noto)] md:text-4xl">같은 자세도,</span>
          <span className="text-[24px] font-bold tracking-[-1.2px] [font-family:var(--font-serif-noto)] md:text-4xl">
            <span className="text-[25px] text-[#FCB973] md:text-4xl">움직임</span>이 다를 수 있습니다.
          </span>
        </h2>

        <div className="grid min-h-[280px] gap-8 md:grid-cols-2 md:min-h-[360px]">
          <div className="relative h-[280px] overflow-hidden rounded-lg border border-white/10 bg-[#23293c]/80 md:h-[360px]">
            <Image
              src="/intro/good-pattern-lift.png"
              alt="올바른 움직임 예시: 중립 자세로 무게를 낮추며 물건을 드는 모습"
              fill
              className="object-cover object-[center_35%]"
              sizes="(max-width: 768px) 100vw, 50vw"
              priority
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-[#0c1324]/95 via-[#0c1324]/45 to-transparent"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-br from-emerald-500/15 to-transparent opacity-70"
            />
            <div className="relative z-10 flex h-full flex-col justify-end p-6">
              <span className="mb-2 inline-block w-max bg-[#ffb77d]/20 px-3 py-1 text-xs uppercase tracking-widest text-[#ffb77d]">
                Good Pattern
              </span>
              <h3 className="text-lg font-light text-white" style={{ fontFamily: '"Noto Sans KR"' }}>
                올바른 움직임
              </h3>
              <p
                className="mt-1 max-w-full px-0 text-left text-sm font-light text-[#c6c6cd]"
                style={{
                  fontFamily: 'var(--font-sans-noto)',
                  lineHeight: 1.2,
                  textAlign: 'left',
                  paddingLeft: 0,
                  paddingRight: 0,
                }}
              >
                신체 정렬이 유지되며 주동근이
                <br />
                효율적으로 활성화됨
              </p>
            </div>
          </div>

          <div className="relative h-[280px] overflow-hidden rounded-lg border border-white/10 bg-[#23293c]/80 md:h-[360px]">
            <Image
              src="/intro/compensation-lift.png"
              alt="잘못된 움직임 예시: 허리만 굽혀 물건을 들려는 보상 패턴"
              fill
              className="object-cover object-[center_35%] grayscale-[0.3]"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-[#0c1324]/95 via-[#0c1324]/45 to-transparent"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-br from-red-500/25 to-transparent opacity-70"
            />
            <div className="relative z-10 flex h-full flex-col justify-end p-6">
              <span className="mb-2 inline-block w-max bg-[#2e3447] px-3 py-1 text-xs uppercase tracking-widest text-[#c6c6cd]">
                Compensation
              </span>
              <h3 className="text-lg font-light text-white" style={{ fontFamily: '"Noto Sans KR"' }}>
                잘못된 움직임
              </h3>
              <p
                className="mt-1 max-w-full px-0 text-left text-sm font-light text-[#c6c6cd]"
                style={{
                  fontFamily: 'var(--font-sans-noto)',
                  lineHeight: 1.2,
                  textAlign: 'left',
                  paddingLeft: 0,
                  paddingRight: 0,
                }}
              >
                불필요한 보상 작용으로
                <br />
                관절에 과도한 스트레스 발생
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12 flex justify-center">
          <IntroStepIndicator step={2} />
        </div>
      </div>
    </IntroSceneShell>
  );
}
