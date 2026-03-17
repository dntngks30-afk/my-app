'use client';

/**
 * PR G1: camera funnel 공통 layout - shared stream provider
 * motion 간 전환 시 layout 유지 → stream 재사용, permission 재요청 없음
 */
import { ReactNode } from 'react';
import { CameraSessionProvider } from '@/lib/camera/camera-session-context';

export default function CameraLayout({ children }: { children: ReactNode }) {
  return <CameraSessionProvider>{children}</CameraSessionProvider>;
}
