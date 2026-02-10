/**
 * Theme Presets - 디자인 프리셋 정의
 * 
 * 개발 모드에서 테마를 빠르게 전환하기 위한 프리셋 모음
 */

export interface ThemePreset {
  name: string;
  description: string;
  tokens: {
    '--bg': string;
    '--surface': string;
    '--text': string;
    '--muted': string;
    '--border': string;
    '--shadow': string;
    '--brand': string;
    '--brand-soft': string;
    '--accent': string;
    '--radius': string;
  };
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    name: 'Light',
    description: '기본 라이트 테마',
    tokens: {
      '--bg': '#fafafa',
      '--surface': '#ffffff',
      '--text': '#1a1a1a',
      '--muted': '#6b7280',
      '--border': '#e5e7eb',
      '--shadow': '0 1px 3px 0 rgb(0 0 0 / 0.1)',
      '--brand': '#f97316',
      '--brand-soft': '#fff7ed',
      '--accent': '#3b82f6',
      '--radius': '0.5rem',
    },
  },
  {
    name: 'Light Warm',
    description: '따뜻한 톤의 라이트 테마',
    tokens: {
      '--bg': '#fef9f3',
      '--surface': '#ffffff',
      '--text': '#1c1917',
      '--muted': '#78716c',
      '--border': '#e7e5e4',
      '--shadow': '0 1px 3px 0 rgb(0 0 0 / 0.08)',
      '--brand': '#ea580c',
      '--brand-soft': '#fff7ed',
      '--accent': '#f59e0b',
      '--radius': '0.75rem',
    },
  },
  {
    name: 'Light Cool',
    description: '시원한 톤의 라이트 테마',
    tokens: {
      '--bg': '#f8fafc',
      '--surface': '#ffffff',
      '--text': '#0f172a',
      '--muted': '#64748b',
      '--border': '#e2e8f0',
      '--shadow': '0 1px 3px 0 rgb(0 0 0 / 0.1)',
      '--brand': '#3b82f6',
      '--brand-soft': '#eff6ff',
      '--accent': '#06b6d4',
      '--radius': '0.5rem',
    },
  },
  {
    name: 'Light Minimal',
    description: '미니멀 라이트 테마',
    tokens: {
      '--bg': '#ffffff',
      '--surface': '#ffffff',
      '--text': '#000000',
      '--muted': '#9ca3af',
      '--border': '#d1d5db',
      '--shadow': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      '--brand': '#000000',
      '--brand-soft': '#f9fafb',
      '--accent': '#6366f1',
      '--radius': '0.25rem',
    },
  },
  {
    name: 'Light Soft',
    description: '부드러운 라이트 테마',
    tokens: {
      '--bg': '#f5f5f4',
      '--surface': '#ffffff',
      '--text': '#292524',
      '--muted': '#78716c',
      '--border': '#d6d3d1',
      '--shadow': '0 2px 4px 0 rgb(0 0 0 / 0.06)',
      '--brand': '#f97316',
      '--brand-soft': '#fef3c7',
      '--accent': '#84cc16',
      '--radius': '1rem',
    },
  },
  {
    name: 'Light High Contrast',
    description: '고대비 라이트 테마',
    tokens: {
      '--bg': '#ffffff',
      '--surface': '#ffffff',
      '--text': '#000000',
      '--muted': '#525252',
      '--border': '#000000',
      '--shadow': '0 2px 4px 0 rgb(0 0 0 / 0.2)',
      '--brand': '#dc2626',
      '--brand-soft': '#fee2e2',
      '--accent': '#2563eb',
      '--radius': '0.5rem',
    },
  },
];

/**
 * 프리셋을 CSS 변수로 적용
 */
export function applyPreset(preset: ThemePreset) {
  Object.entries(preset.tokens).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value);
  });
}

/**
 * localStorage에서 저장된 프리셋 이름 가져오기
 */
export function getSavedPresetName(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('theme-preset');
}

/**
 * 프리셋 이름을 localStorage에 저장
 */
export function savePresetName(name: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('theme-preset', name);
}

/**
 * 저장된 프리셋 적용
 */
export function applySavedPreset() {
  const savedName = getSavedPresetName();
  if (!savedName) return;

  const preset = THEME_PRESETS.find((p) => p.name === savedName);
  if (preset) {
    applyPreset(preset);
  }
}
