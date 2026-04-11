'use client';



/**

 * intro trust — 테스트 직전 기대 정리(진행 씬)

 * 셸·내비·스텝은 IntroSceneShell SSOT 유지, 본문 카피·정보 패턴만 교체.

 */

import { IntroSceneShell, IntroStepIndicator } from './IntroSceneShell';



const PANEL_SECTIONS = [

  {

    title: '현재 상태 요약',

    body: (

      <>

        움직임 패턴과 몸의 상태를

        <br />

        한눈에 이해할 수 있게 정리해드려요

      </>

    ),

  },

  {

    title: '우선 과제',

    body: (

      <>

        가장 먼저 실행해야 할 움직임을

        <br />

        분명하게 알려드려요

      </>

    ),

  },

  {

    title: '추천 루틴',

    body: (

      <>

        지금 상태에 맞는 시작점을 제안해

        <br />

        바로 실행 할 루틴을 제공합니다

      </>

    ),

  },

] as const;



export default function IntroTrust() {

  return (

    <IntroSceneShell currentPath="/intro/trust">

      <div className="w-full max-w-2xl px-2 text-center">

        <h2
          className="mb-8 text-[21px] font-semibold leading-8 tracking-[-1.2px] text-[#dce1fb]"
          style={{ fontFamily: '"Noto Serif KR"' }}
        >

          테스트 종료 후,

          <br />

          <span className="text-[25px] font-bold text-[#fcb973]">맞춤형 움직임</span>을 제공합니다.

        </h2>



        <div className="mx-auto w-full max-w-md rounded-lg border border-white/10 bg-[#23293c]/90 px-5 py-5 text-left">

          <div className="divide-y divide-white/10">

            {PANEL_SECTIONS.map(({ title, body }) => (

              <div key={title} className="py-4 first:pt-0 last:pb-0">

                <h3 className="text-sm font-semibold tracking-wide text-[#ffb77d] [font-family:var(--font-sans-noto)]">
                  {title}
                </h3>

                <p

                  className="mt-2 text-[13px] font-normal leading-[17px] tracking-[-0.9px] text-[#c6c6cd]/90"

                  style={{ fontFamily: 'var(--font-sans-noto)' }}

                >

                  {body}

                </p>

              </div>

            ))}

          </div>

        </div>



        <p

          className="mx-auto mt-8 max-w-sm text-[13px] font-light leading-[15px] tracking-[-0.4px] text-[#c6c6cd]"

          style={{ fontFamily: 'var(--font-sans-noto)' }}

        >

          이 테스트는 몸의 움직임을 간단히 파악하여

          <br />

          다음 행동으로 연결하기 위한 시작점입니다.

        </p>



        <div className="mt-12 flex justify-center md:mt-16">

          <IntroStepIndicator step={5} />

        </div>

      </div>

    </IntroSceneShell>

  );

}

