/**
 * UI 스타일 스위처 오버레이
 * 
 * 개발 모드에서만 표시되는 프리셋 선택 오버레이
 */

'use client';

import { useEffect, useState } from 'react';
import { themes, type ThemePreset } from '@/lib/themes';

const STORAGE_KEY = 'ui-preset:v1';

export default function UIStyleSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  useEffect(() => {
    // 개발 모드가 아니면 표시하지 않음
    if (process.env.NODE_ENV === 'production') {
      return;
    }

    // 저장된 프리셋 로드
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const presetId = JSON.parse(saved);
        applyPreset(presetId);
        setSelectedPreset(presetId);
      } catch (e) {
        console.error('Failed to load saved preset:', e);
      }
    }
  }, []);

  const applyPreset = (presetId: string) => {
    const preset = themes.find((t) => t.id === presetId);
    if (!preset) return;

    const root = document.documentElement;
    const tokens = preset.tokens;

    // CSS 변수 적용
    root.style.setProperty('--bg', tokens.bg);
    root.style.setProperty('--surface', tokens.surface);
    root.style.setProperty('--surface-2', tokens.surface2);
    root.style.setProperty('--text', tokens.text);
    root.style.setProperty('--muted', tokens.muted);
    root.style.setProperty('--border', tokens.border);
    root.style.setProperty('--border-strong', tokens.borderStrong);
    root.style.setProperty('--brand', tokens.brand);
    root.style.setProperty('--brand-soft', tokens.brandSoft);
    root.style.setProperty('--radius', tokens.radius);
    root.style.setProperty('--tile-h', tokens.tileH);
    root.style.setProperty('--tile-px', tokens.tilePx);
    root.style.setProperty('--tile-py', tokens.tilePy);
    root.style.setProperty('--shadow-0', tokens.shadow0);
    root.style.setProperty('--shadow-1', tokens.shadow1);
    root.style.setProperty('--progress-h', tokens.progressH);
    root.style.setProperty('--shadow-inset', tokens.shadowInset);
    root.style.setProperty('--warn-soft', tokens.warnSoft);
    root.style.setProperty('--warn', tokens.warn);
    root.style.setProperty('--warn-text', tokens.warnText);
    root.style.setProperty('--accent', tokens.accent);
    root.style.setProperty('--card-pad', tokens.cardPad);
    root.style.setProperty('--section-gap', tokens.sectionGap);
  };

  const handlePresetClick = (presetId: string) => {
    applyPreset(presetId);
    setSelectedPreset(presetId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presetId));
  };

  // 프로덕션에서는 렌더링하지 않음
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <>
      {/* 토글 버튼 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-50 rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white shadow-lg hover:opacity-90 transition-all"
        style={{ backgroundColor: 'var(--brand)' }}
      >
        🎨 UI Lab
      </button>

      {/* 오버레이 패널 */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-[var(--surface)] border-b border-[var(--border)] p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-[var(--text)]">UI 프리셋 선택</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-[var(--muted)] hover:text-[var(--text)]"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {themes.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handlePresetClick(preset.id)}
                    className={`text-left p-4 rounded-lg border-2 transition-all ${
                      selectedPreset === preset.id
                        ? 'border-[var(--brand)] bg-[var(--brand-soft)]'
                        : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--brand)]'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: preset.tokens.brand }}
                      />
                      <h3 className="font-semibold text-[var(--text)]">{preset.name}</h3>
                    </div>
                    <p className="text-sm text-[var(--muted)]">{preset.description}</p>
                    {selectedPreset === preset.id && (
                      <div className="mt-2 text-xs text-[var(--brand)] font-medium">✓ 선택됨</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
