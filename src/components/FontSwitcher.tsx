'use client';

/**
 * FontSwitcher - 개발 모드 전용 폰트 스위처 오버레이 (토글 가능)
 *
 * ✅ Dev에서만 렌더링
 * ✅ Ctrl + Shift + F 로 켜/끄기
 * ✅ 닫혀있을 때는 작은 "Fonts" 버튼만 표시
 * ✅ 폰트 프리셋은 localStorage에 저장되어 새로고침 후에도 유지됨
 */

import { useEffect, useMemo, useState } from 'react';

const PRESET_STORAGE_KEY = 'fontPreset:v1';          // 기존 키 유지
const UI_STORAGE_KEY = 'dev:fontSwitcherUI:v1';      // 오버레이 열림/닫힘 상태 저장

interface FontPreset {
  sans: 'ibm' | 'noto' | 'gothicA1' | 'nanumGothic';
  display: 'gowun' | 'jua' | 'dohyeon' | 'nanumPen';
}

const DEFAULT_PRESET: FontPreset = {
  sans: 'ibm',
  display: 'gowun',
};

const SANS_OPTIONS: Array<{ value: FontPreset['sans']; label: string }> = [
  { value: 'ibm', label: 'IBM Plex Sans KR' },
  { value: 'noto', label: 'Noto Sans KR' },
  { value: 'gothicA1', label: 'Gothic A1' },
  { value: 'nanumGothic', label: 'Nanum Gothic' },
];

const DISPLAY_OPTIONS: Array<{ value: FontPreset['display']; label: string }> = [
  { value: 'gowun', label: 'Gowun Dodum' },
  { value: 'jua', label: 'Jua' },
  { value: 'dohyeon', label: 'Do Hyeon' },
  { value: 'nanumPen', label: 'Nanum Pen Script' },
];

function isValidPreset(obj: any): obj is FontPreset {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.sans === 'string' &&
    typeof obj.display === 'string'
  );
}

export default function FontSwitcher() {
  // ✅ Dev에서만 렌더링 (배포/프로덕션에선 완전 제거)
  const isDev = process.env.NODE_ENV === 'development';
  if (!isDev) return null;

  const [preset, setPreset] = useState<FontPreset>(DEFAULT_PRESET);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  const hint = useMemo(() => 'Ctrl+Shift+F', []);

  // 프리셋 적용 함수
  const applyPreset = (newPreset: FontPreset) => {
    const root = document.documentElement;
    root.dataset.fontSans = newPreset.sans;
    root.dataset.fontDisplay = newPreset.display;
  };

  const savePreset = (newPreset: FontPreset) => {
    try {
      localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(newPreset));
    } catch (error) {
      console.error('Failed to save font preset:', error);
    }
  };

  const setOpenPersist = (next: boolean) => {
    setOpen(next);
    try {
      localStorage.setItem(UI_STORAGE_KEY, next ? '1' : '0');
    } catch (error) {
      console.error('Failed to save UI state:', error);
    }
  };

  // 초기 로드 (FOUC 방지 + saved preset 적용 + UI 상태)
  useEffect(() => {
    setMounted(true);

    // 0) 기본값 즉시 적용 (dataset 없을 때만)
    const root = document.documentElement;
    if (!root.dataset.fontSans && !root.dataset.fontDisplay) {
      applyPreset(DEFAULT_PRESET);
    }

    // 1) 저장된 프리셋 로드
    try {
      const saved = localStorage.getItem(PRESET_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (isValidPreset(parsed)) {
          setPreset(parsed);
          applyPreset(parsed);
        } else {
          setPreset(DEFAULT_PRESET);
          applyPreset(DEFAULT_PRESET);
        }
      } else {
        setPreset(DEFAULT_PRESET);
        applyPreset(DEFAULT_PRESET);
      }
    } catch (error) {
      console.error('Failed to load font preset:', error);
      setPreset(DEFAULT_PRESET);
      applyPreset(DEFAULT_PRESET);
    }

    // 2) UI 열림 상태 로드
    try {
      const ui = localStorage.getItem(UI_STORAGE_KEY);
      if (ui === '1') setOpen(true);
    } catch (error) {
      console.error('Failed to load UI state:', error);
    }

    // 3) URL 파라미터로 강제 토글 (선택)
    //   ?fontui=1  -> 열기
    //   ?fontui=0  -> 닫기
    try {
      const params = new URLSearchParams(window.location.search);
      const q = params.get('fontui');
      if (q === '1') setOpenPersist(true);
      if (q === '0') setOpenPersist(false);
    } catch {
      // ignore
    }

    // 4) 단축키: Ctrl + Shift + F 로 토글
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setOpenPersist(!open);
      }
      // ESC로 닫기
      if (e.key === 'Escape') {
        setOpenPersist(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 변경 핸들러
  const handleSansChange = (value: FontPreset['sans']) => {
    const next = { ...preset, sans: value };
    setPreset(next);
    applyPreset(next);
    savePreset(next);
  };

  const handleDisplayChange = (value: FontPreset['display']) => {
    const next = { ...preset, display: value };
    setPreset(next);
    applyPreset(next);
    savePreset(next);
  };

  const handleReset = () => {
    setPreset(DEFAULT_PRESET);
    applyPreset(DEFAULT_PRESET);
    savePreset(DEFAULT_PRESET);
  };

  if (!mounted) return null;

  // 닫혀있을 때: 작은 버튼만 (거슬리지 않게)
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpenPersist(true)}
        className="
          fixed top-4 right-4 z-[9999]
          rounded-xl border bg-white/90
          px-3 py-2 text-xs shadow
          hover:bg-white
        "
        aria-label="Open Font Switcher"
        title={`Open Font Switcher (${hint})`}
      >
        Fonts
      </button>
    );
  }

  // 열려있을 때: 오버레이
  return (
    <div className="fixed top-4 right-4 z-[9999] bg-white border border-gray-300 rounded-lg shadow-lg p-4 min-w-[280px]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            Font Switcher (Dev Only)
          </h3>
          <p className="mt-1 text-[11px] text-gray-500">
            Toggle: <span className="font-medium">{hint}</span> · Close: <span className="font-medium">ESC</span>
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpenPersist(false)}
          className="rounded-md border px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-100"
          aria-label="Hide Font Switcher"
          title="Hide"
        >
          Hide
        </button>
      </div>

      <div className="space-y-3">
        {/* 본문 폰트 */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            Sans (본문)
          </label>
          <select
            value={preset.sans}
            onChange={(e) => handleSansChange(e.target.value as FontPreset['sans'])}
            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {SANS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* 타이틀 폰트 */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            Display (타이틀)
          </label>
          <select
            value={preset.display}
            onChange={(e) => handleDisplayChange(e.target.value as FontPreset['display'])}
            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {DISPLAY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* 리셋 */}
        <button
          onClick={handleReset}
          className="w-full px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
        >
          Reset (IBM + Gowun)
        </button>
      </div>
    </div>
  );
}
