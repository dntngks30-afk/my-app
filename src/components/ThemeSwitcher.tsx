'use client';

/**
 * ThemeSwitcher - 개발 모드 전용 테마 프리셋 스위처
 * 
 * 개발 환경에서만 표시되며, 테마 프리셋을 빠르게 전환할 수 있습니다.
 */

import { useEffect, useState } from 'react';
import { THEME_PRESETS, applyPreset, savePresetName, getSavedPresetName, applySavedPreset, type ThemePreset } from './ThemePresets';

export default function ThemeSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentPreset, setCurrentPreset] = useState<string>('Light');
  const [savedPreset, setSavedPreset] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string>('');

  // 개발 모드가 아니면 렌더링하지 않음
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  useEffect(() => {
    setMounted(true);
    // 저장된 프리셋 자동 적용
    applySavedPreset();
    
    // 현재 적용된 프리셋 확인
    const saved = getSavedPresetName();
    if (saved) {
      setCurrentPreset(saved);
      setSavedPreset(saved);
    }
  }, []);

  const handlePresetClick = (preset: ThemePreset) => {
    applyPreset(preset);
    setCurrentPreset(preset.name);
    setSavedMessage(''); // 프리셋 변경 시 메시지 초기화
  };

  const handleSaveAsDefault = () => {
    try {
      savePresetName(currentPreset);
      setSavedPreset(currentPreset);
      setSavedMessage(`✓ "${currentPreset}" 저장됨`);
      console.log(`[ThemeSwitcher] 프리셋 "${currentPreset}" 저장됨`);
      
      // 3초 후 메시지 제거
      setTimeout(() => {
        setSavedMessage('');
      }, 3000);
    } catch (error) {
      console.error('[ThemeSwitcher] 저장 실패:', error);
      setSavedMessage('❌ 저장 실패');
      setTimeout(() => {
        setSavedMessage('');
      }, 3000);
    }
  };

  // 클라이언트 사이드에서만 렌더링
  if (!mounted) {
    return null;
  }

  return (
    <>
      {/* 토글 버튼 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-20 right-4 z-50 px-3 py-2 bg-[var(--brand)] text-white text-xs font-medium rounded-lg shadow-lg hover:bg-[#ea580c] transition-colors"
        aria-label="테마 프리셋 전환"
      >
        🎨 Theme
      </button>

      {/* 패널 */}
      {isOpen && (
        <div className="fixed top-32 right-4 z-50 w-64 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[var(--text)]">Theme Presets</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-[var(--muted)] hover:text-[var(--text)] text-lg"
              aria-label="닫기"
            >
              ×
            </button>
          </div>

          {/* 프리셋 목록 */}
          <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
            {THEME_PRESETS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => handlePresetClick(preset)}
                className={`
                  w-full text-left p-3 rounded-lg border-2 transition-all
                  ${
                    currentPreset === preset.name
                      ? 'border-[var(--brand)] bg-[var(--brand-soft)]'
                      : 'border-[var(--border)] hover:border-[var(--brand)]/50'
                  }
                `}
              >
                <div className="font-medium text-sm text-[var(--text)]">{preset.name}</div>
                <div className="text-xs text-[var(--muted)] mt-1">{preset.description}</div>
              </button>
            ))}
          </div>

          {/* 저장 버튼 */}
          <button
            onClick={handleSaveAsDefault}
            className="w-full px-4 py-2 bg-[var(--brand)] text-white text-sm font-medium rounded-lg hover:bg-[#ea580c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!currentPreset}
          >
            Save as default
          </button>

          {/* 저장 메시지 */}
          {savedMessage && (
            <div className="mt-2 text-xs text-green-600 text-center font-medium">
              {savedMessage}
            </div>
          )}

          {/* 현재 프리셋 표시 */}
          <div className="mt-3 text-xs text-[var(--muted)] text-center">
            Current: {currentPreset}
            {savedPreset === currentPreset && (
              <span className="ml-2 text-green-600 font-medium">(저장됨)</span>
            )}
          </div>
        </div>
      )}
    </>
  );
}
