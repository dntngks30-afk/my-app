'use client';

import { useEffect, useState } from 'react';

import { shouldPlayPublicDecorativeMotion } from './decorative-motion';
import { usePublicReducedMotion } from './usePublicReducedMotion';

function readSaveData(): boolean {
  if (typeof navigator === 'undefined') return false;
  const conn = (navigator as Navigator & {
    connection?: { saveData?: boolean };
  }).connection;
  return Boolean(conn?.saveData);
}

/**
 * 장식용 모션/루프 비디오를 켜도 되는지 (공개 퍼널 전용).
 * - 하이드레이션 전·감소 모션·절약 데이터 모드면 false
 * - 모바일에서 불필요한 디코딩을 줄이기 위한 기본 게이트
 */
export function usePublicDecorativeMotionAllowed(): boolean {
  const reduced = usePublicReducedMotion();
  const [saveData, setSaveData] = useState(false);

  useEffect(() => {
    setSaveData(readSaveData());
  }, []);

  return shouldPlayPublicDecorativeMotion({ reducedMotion: reduced, saveData });
}
