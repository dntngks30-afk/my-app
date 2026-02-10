'use client';

/**
 * PresetProvider - 디자인 프리셋 전역 관리
 * 
 * Context를 통해 프리셋을 전역으로 제공하고,
 * localStorage에 저장/복원합니다.
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { DESIGN_PRESETS, type DesignPreset } from './designPresets';

const STORAGE_KEY = 'designPreset:v1';

interface PresetContextValue {
  currentPreset: DesignPreset;
  setPreset: (presetId: string) => void;
  savePreset: () => void;
}

const PresetContext = createContext<PresetContextValue | undefined>(undefined);

export function PresetProvider({ children }: { children: ReactNode }) {
  const [currentPreset, setCurrentPreset] = useState<DesignPreset>(DESIGN_PRESETS[0]!);
  const [mounted, setMounted] = useState(false);

  // localStorage에서 저장된 프리셋 복원
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const preset = DESIGN_PRESETS.find((p) => p.id === saved);
        if (preset) {
          setCurrentPreset(preset);
        }
      }
    } catch (error) {
      console.error('[PresetProvider] 저장된 프리셋 로드 실패:', error);
    }
    setMounted(true);
  }, []);

  // 프리셋 적용 함수
  const applyPreset = (preset: DesignPreset) => {
    const root = document.documentElement;

    // 토큰 적용
    Object.entries(preset.tokens).forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, value);
    });

    // Shape 적용
    Object.entries(preset.shape).forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, value);
    });

    // Density 적용
    Object.entries(preset.density).forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, value);
    });

    // Elevation 적용
    Object.entries(preset.elevation).forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, value);
    });

    // Progress 적용
    Object.entries(preset.progress).forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, value);
    });

    // Font 적용 (dataset 기반)
    root.dataset.fontSans = preset.fontSans;
    root.dataset.fontDisplay = preset.fontDisplay;

    // Landing Layout 적용
    root.setAttribute('data-landing-variant', preset.heroVariant);
    root.setAttribute('data-bg-pattern', preset.bgPattern);
    root.setAttribute('data-card-style', preset.cardStyle);
  };

  // 프리셋 변경
  const setPreset = (presetId: string) => {
    const preset = DESIGN_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setCurrentPreset(preset);
      applyPreset(preset);
    }
  };

  // 프리셋 저장
  const savePreset = () => {
    try {
      localStorage.setItem(STORAGE_KEY, currentPreset.id);
      console.log(`[PresetProvider] 프리셋 "${currentPreset.name}" 저장됨`);
    } catch (error) {
      console.error('[PresetProvider] 프리셋 저장 실패:', error);
    }
  };

  // 마운트 후 초기 프리셋 적용
  useEffect(() => {
    if (mounted) {
      applyPreset(currentPreset);
    }
  }, [mounted, currentPreset]);

  return (
    <PresetContext.Provider value={{ currentPreset, setPreset, savePreset }}>
      {children}
    </PresetContext.Provider>
  );
}

export function usePreset() {
  const context = useContext(PresetContext);
  if (context === undefined) {
    throw new Error('usePreset must be used within PresetProvider');
  }
  return context;
}
