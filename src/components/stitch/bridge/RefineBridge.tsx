'use client';

/**
 * PR-PUBLIC-BRIDGE-01 — stitch screen 27: 2-choice premium scene (문구·순서 truth 유지)
 */
import { StitchSceneShell } from '@/components/stitch/shared/SceneShell';

export type RefineBridgeProps = {
  loading?: boolean;
  onResultFirst: () => void;
  onCameraRefine: () => void;
};

export default function RefineBridge({ loading, onResultFirst, onCameraRefine }: RefineBridgeProps) {
  if (loading) {
    return (
      <StitchSceneShell>
        <div className="flex flex-1 items-center justify-center px-6">
          <p className="text-sm text-slate-500" style={{ fontFamily: 'var(--font-sans-noto)' }}>
            준비 중...
          </p>
        </div>
      </StitchSceneShell>
    );
  }

  return (
    <StitchSceneShell>
      <main className="flex min-h-0 flex-1 flex-col justify-center px-6 py-12 md:px-10">
        <div className="animate-in fade-in mx-auto w-full max-w-md space-y-10 duration-500">
          <div className="space-y-4 text-center">
            <p
              className="text-[10px] font-light uppercase tracking-[0.35em] text-[#ffb77d]/80"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              다음 단계
            </p>
            <h1 className="break-keep text-3xl font-light leading-tight tracking-tight text-[#dce1fb] md:text-4xl [font-family:var(--font-display)]">
              설문 결과는 준비됐어요
            </h1>
            <p
              className="break-keep text-base font-light leading-relaxed text-[#c6c6cd]"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              원하시면 20~30초 동작 체크로 움직임 신호를 조금 더 반영할 수 있어요. 진단이 아니라, 더 맞는 운동
              시작점을 잡기 위한 간단한 확인이에요.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <button
              type="button"
              onClick={onResultFirst}
              className="w-full rounded-lg bg-gradient-to-br from-[#ffb77d] to-[#ab4c00] py-5 text-base font-medium tracking-wide text-[#4d2600] shadow-[0_20px_40px_rgba(2,6,23,0.06)] transition-all hover:brightness-110"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              결과 먼저 보기
            </button>
            <button
              type="button"
              onClick={onCameraRefine}
              className="w-full rounded-lg border border-[#ffb77d]/35 bg-[#151b2d]/80 py-5 text-base font-medium text-[#ffb77d] backdrop-blur-sm transition-colors hover:border-[#ffb77d]/55 hover:bg-[#23293c]/80"
              style={{ fontFamily: 'var(--font-sans-noto)' }}
            >
              카메라로 움직임 체크하기
            </button>
          </div>

          <p
            className="break-keep text-center text-xs text-slate-500"
            style={{ fontFamily: 'var(--font-sans-noto)' }}
          >
            동작 체크 없이도 결과와 이후 단계를 모두 이용할 수 있어요.
          </p>
        </div>
      </main>
    </StitchSceneShell>
  );
}
