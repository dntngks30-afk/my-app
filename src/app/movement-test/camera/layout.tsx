'use client';

/**
 * PR G1: camera funnel 공통 layout - shared stream provider
 * motion 간 전환 시 layout 유지 → stream 재사용, permission 재요청 없음
 * PR G4: funnel 이탈 시 funnel intro 상태 초기화 (다음 진입 시 intro 재생 허용)
 */
import { ReactNode, useEffect } from 'react';
import { CameraSessionProvider } from '@/lib/camera/camera-session-context';
import { clearFunnelIntro } from '@/lib/camera/voice-guidance';

export default function CameraLayout({ children }: { children: ReactNode }) {
  useEffect(() => () => clearFunnelIntro(), []);
  return <CameraSessionProvider>{children}</CameraSessionProvider>;
}
