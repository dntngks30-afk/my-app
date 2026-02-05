/**
 * 디자인 프리셋 정의
 * 
 * "귀여움 중간 + 클리닉 중간" 톤
 * - 과한 채도 금지
 * - pure white(#fff) 금지
 * - border 알파 0.08~0.14 정도
 */

export interface DesignPreset {
  id: string;
  name: string;
  description: string;
  tokens: {
    bg: string;
    surface: string;
    'surface-2': string;
    text: string;
    muted: string;
    border: string;
    'border-strong': string;
    brand: string;
    'brand-soft': string;
    accent: string;
  };
  shape: {
    radius: string;
  };
  density: {
    'tile-h': string;
    'tile-px': string;
    'tile-py': string;
    'card-pad': string;
    'section-gap': string;
  };
  elevation: {
    'shadow-0': string;
    'shadow-1': string;
  };
  progress: {
    'progress-h': string;
    'shadow-inset': string;
  };
  fontSans: 'noto' | 'ibm';
  fontDisplay: 'gowun' | 'noto' | 'ibm';
  heroVariant: 'center' | 'split';
  bgPattern: 'none' | 'dots' | 'softGradient' | 'blob';
  cardStyle: 'soft' | 'outline';
}

export const DESIGN_PRESETS: DesignPreset[] = [
  // 1. 기본 안정 (Noto + Gowun, 블루)
  {
    id: 'stable-blue',
    name: '기본 안정',
    description: '신뢰감 있는 기본 스타일',
    tokens: {
      bg: '#F7F9FC',
      surface: '#FEFEFE',
      'surface-2': '#F3F6FB',
      text: '#0F172A',
      muted: '#475569',
      border: 'rgba(15, 23, 42, 0.10)',
      'border-strong': 'rgba(15, 23, 42, 0.14)',
      brand: '#2563EB',
      'brand-soft': '#E8F0FF',
      accent: '#3B82F6',
    },
    shape: { radius: '18px' },
    density: {
      'tile-h': '64px',
      'tile-px': '18px',
      'tile-py': '16px',
      'card-pad': '24px',
      'section-gap': '48px',
    },
    elevation: {
      'shadow-0': '0 1px 2px rgba(15, 23, 42, 0.05)',
      'shadow-1': '0 2px 10px rgba(15, 23, 42, 0.08)',
    },
    progress: {
      'progress-h': '10px',
      'shadow-inset': 'inset 0 -1px 0 rgba(255, 255, 255, 0.35)',
    },
    fontSans: 'noto',
    fontDisplay: 'gowun',
    heroVariant: 'center',
    bgPattern: 'none',
    cardStyle: 'outline',
  },

  // 2. 따뜻한 클리닉 (Noto + Gowun, 오렌지)
  {
    id: 'warm-clinic',
    name: '따뜻한 클리닉',
    description: '따뜻하고 친근한 클리닉 톤',
    tokens: {
      bg: '#FFF8F5',
      surface: '#FEFEFE',
      'surface-2': '#FFF4ED',
      text: '#1C1917',
      muted: '#78716C',
      border: 'rgba(28, 25, 23, 0.10)',
      'border-strong': 'rgba(28, 25, 23, 0.14)',
      brand: '#EA580C',
      'brand-soft': '#FFF7ED',
      accent: '#F97316',
    },
    shape: { radius: '20px' },
    density: {
      'tile-h': '68px',
      'tile-px': '20px',
      'tile-py': '18px',
      'card-pad': '28px',
      'section-gap': '56px',
    },
    elevation: {
      'shadow-0': '0 1px 3px rgba(28, 25, 23, 0.06)',
      'shadow-1': '0 4px 12px rgba(28, 25, 23, 0.10)',
    },
    progress: {
      'progress-h': '10px',
      'shadow-inset': 'inset 0 -1px 0 rgba(255, 255, 255, 0.35)',
    },
    fontSans: 'noto',
    fontDisplay: 'gowun',
    heroVariant: 'center',
    bgPattern: 'softGradient',
    cardStyle: 'soft',
  },

  // 3. 프로페셔널 그린 (IBM + Noto, 그린)
  {
    id: 'professional-green',
    name: '프로페셔널 그린',
    description: '전문적이고 차분한 그린 톤',
    tokens: {
      bg: '#F0FDF4',
      surface: '#FEFEFE',
      'surface-2': '#ECFDF5',
      text: '#14532D',
      muted: '#4B5563',
      border: 'rgba(20, 83, 45, 0.10)',
      'border-strong': 'rgba(20, 83, 45, 0.14)',
      brand: '#16A34A',
      'brand-soft': '#DCFCE7',
      accent: '#22C55E',
    },
    shape: { radius: '16px' },
    density: {
      'tile-h': '60px',
      'tile-px': '16px',
      'tile-py': '14px',
      'card-pad': '20px',
      'section-gap': '40px',
    },
    elevation: {
      'shadow-0': '0 1px 2px rgba(20, 83, 45, 0.04)',
      'shadow-1': '0 2px 8px rgba(20, 83, 45, 0.06)',
    },
    progress: {
      'progress-h': '10px',
      'shadow-inset': 'inset 0 -1px 0 rgba(255, 255, 255, 0.35)',
    },
    fontSans: 'ibm',
    fontDisplay: 'noto',
    heroVariant: 'split',
    bgPattern: 'dots',
    cardStyle: 'outline',
  },

  // 4. 부드러운 퍼플 (Noto + Gowun, 퍼플)
  {
    id: 'soft-purple',
    name: '부드러운 퍼플',
    description: '부드럽고 우아한 퍼플 톤',
    tokens: {
      bg: '#FAF5FF',
      surface: '#FEFEFE',
      'surface-2': '#F3E8FF',
      text: '#3B1F5C',
      muted: '#6B7280',
      border: 'rgba(59, 31, 92, 0.10)',
      'border-strong': 'rgba(59, 31, 92, 0.14)',
      brand: '#9333EA',
      'brand-soft': '#E9D5FF',
      accent: '#A855F7',
    },
    shape: { radius: '24px' },
    density: {
      'tile-h': '72px',
      'tile-px': '24px',
      'tile-py': '20px',
      'card-pad': '32px',
      'section-gap': '64px',
    },
    elevation: {
      'shadow-0': '0 2px 4px rgba(59, 31, 92, 0.06)',
      'shadow-1': '0 4px 16px rgba(59, 31, 92, 0.10)',
    },
    progress: {
      'progress-h': '10px',
      'shadow-inset': 'inset 0 -1px 0 rgba(255, 255, 255, 0.35)',
    },
    fontSans: 'noto',
    fontDisplay: 'gowun',
    heroVariant: 'split',
    bgPattern: 'blob',
    cardStyle: 'soft',
  },

  // 5. 미니멀 클리닉 (IBM + IBM, 미니멀)
  {
    id: 'minimal-clinic',
    name: '미니멀 클리닉',
    description: '깔끔하고 전문적인 미니멀 스타일',
    tokens: {
      bg: '#FAFAFA',
      surface: '#FEFEFE',
      'surface-2': '#F5F5F5',
      text: '#1A1A1A',
      muted: '#666666',
      border: 'rgba(0, 0, 0, 0.08)',
      'border-strong': 'rgba(0, 0, 0, 0.12)',
      brand: '#000000',
      'brand-soft': '#F5F5F5',
      accent: '#333333',
    },
    shape: { radius: '12px' },
    density: {
      'tile-h': '56px',
      'tile-px': '16px',
      'tile-py': '12px',
      'card-pad': '20px',
      'section-gap': '32px',
    },
    elevation: {
      'shadow-0': '0 1px 1px rgba(0, 0, 0, 0.03)',
      'shadow-1': '0 2px 4px rgba(0, 0, 0, 0.05)',
    },
    progress: {
      'progress-h': '8px',
      'shadow-inset': 'inset 0 -1px 0 rgba(255, 255, 255, 0.35)',
    },
    fontSans: 'ibm',
    fontDisplay: 'ibm',
    heroVariant: 'center',
    bgPattern: 'none',
    cardStyle: 'outline',
  },

  // 6. 활기찬 옐로우 (Noto + Gowun, 옐로우)
  {
    id: 'vibrant-yellow',
    name: '활기찬 옐로우',
    description: '밝고 활기찬 옐로우 톤',
    tokens: {
      bg: '#FFFBEB',
      surface: '#FEFEFE',
      'surface-2': '#FEF3C7',
      text: '#78350F',
      muted: '#92400E',
      border: 'rgba(120, 53, 15, 0.10)',
      'border-strong': 'rgba(120, 53, 15, 0.14)',
      brand: '#F59E0B',
      'brand-soft': '#FEF3C7',
      accent: '#FBBF24',
    },
    shape: { radius: '20px' },
    density: {
      'tile-h': '68px',
      'tile-px': '20px',
      'tile-py': '18px',
      'card-pad': '28px',
      'section-gap': '56px',
    },
    elevation: {
      'shadow-0': '0 2px 4px rgba(120, 53, 15, 0.08)',
      'shadow-1': '0 4px 16px rgba(120, 53, 15, 0.12)',
    },
    progress: {
      'progress-h': '10px',
      'shadow-inset': 'inset 0 -1px 0 rgba(255, 255, 255, 0.35)',
    },
    fontSans: 'noto',
    fontDisplay: 'gowun',
    heroVariant: 'center',
    bgPattern: 'dots',
    cardStyle: 'soft',
  },

  // 7. 차갑고 깔끔한 (IBM + Noto, 시안)
  {
    id: 'cool-cyan',
    name: '차갑고 깔끔한',
    description: '차갑고 전문적인 시안 톤',
    tokens: {
      bg: '#ECFEFF',
      surface: '#FEFEFE',
      'surface-2': '#CFFAFE',
      text: '#083344',
      muted: '#0E7490',
      border: 'rgba(8, 51, 68, 0.10)',
      'border-strong': 'rgba(8, 51, 68, 0.14)',
      brand: '#06B6D4',
      'brand-soft': '#CFFAFE',
      accent: '#22D3EE',
    },
    shape: { radius: '14px' },
    density: {
      'tile-h': '60px',
      'tile-px': '18px',
      'tile-py': '14px',
      'card-pad': '24px',
      'section-gap': '44px',
    },
    elevation: {
      'shadow-0': '0 1px 2px rgba(8, 51, 68, 0.05)',
      'shadow-1': '0 2px 8px rgba(8, 51, 68, 0.08)',
    },
    progress: {
      'progress-h': '10px',
      'shadow-inset': 'inset 0 -1px 0 rgba(255, 255, 255, 0.35)',
    },
    fontSans: 'ibm',
    fontDisplay: 'noto',
    heroVariant: 'split',
    bgPattern: 'softGradient',
    cardStyle: 'outline',
  },

  // 8. 로맨틱 핑크 (Noto + Gowun, 핑크)
  {
    id: 'romantic-pink',
    name: '로맨틱 핑크',
    description: '로맨틱하고 부드러운 핑크 톤',
    tokens: {
      bg: '#FDF2F8',
      surface: '#FEFEFE',
      'surface-2': '#FCE7F3',
      text: '#831843',
      muted: '#9F1239',
      border: 'rgba(131, 24, 67, 0.10)',
      'border-strong': 'rgba(131, 24, 67, 0.14)',
      brand: '#EC4899',
      'brand-soft': '#FCE7F3',
      accent: '#F472B6',
    },
    shape: { radius: '22px' },
    density: {
      'tile-h': '70px',
      'tile-px': '22px',
      'tile-py': '18px',
      'card-pad': '30px',
      'section-gap': '60px',
    },
    elevation: {
      'shadow-0': '0 2px 4px rgba(131, 24, 67, 0.06)',
      'shadow-1': '0 4px 16px rgba(131, 24, 67, 0.10)',
    },
    progress: {
      'progress-h': '10px',
      'shadow-inset': 'inset 0 -1px 0 rgba(255, 255, 255, 0.35)',
    },
    fontSans: 'noto',
    fontDisplay: 'gowun',
    heroVariant: 'split',
    bgPattern: 'blob',
    cardStyle: 'soft',
  },

  // 9. 프로페셔널 네이비 (IBM + IBM, 네이비)
  {
    id: 'professional-navy',
    name: '프로페셔널 네이비',
    description: '전문적이고 신뢰감 있는 네이비 톤',
    tokens: {
      bg: '#F8FAFC',
      surface: '#FEFEFE',
      'surface-2': '#F1F5F9',
      text: '#0C1E3F',
      muted: '#475569',
      border: 'rgba(12, 30, 63, 0.10)',
      'border-strong': 'rgba(12, 30, 63, 0.14)',
      brand: '#1E3A8A',
      'brand-soft': '#DBEAFE',
      accent: '#2563EB',
    },
    shape: { radius: '16px' },
    density: {
      'tile-h': '62px',
      'tile-px': '18px',
      'tile-py': '15px',
      'card-pad': '24px',
      'section-gap': '48px',
    },
    elevation: {
      'shadow-0': '0 1px 2px rgba(12, 30, 63, 0.05)',
      'shadow-1': '0 2px 10px rgba(12, 30, 63, 0.08)',
    },
    progress: {
      'progress-h': '10px',
      'shadow-inset': 'inset 0 -1px 0 rgba(255, 255, 255, 0.35)',
    },
    fontSans: 'ibm',
    fontDisplay: 'ibm',
    heroVariant: 'center',
    bgPattern: 'dots',
    cardStyle: 'outline',
  },

  // 10. 자연스러운 브라운 (Noto + Gowun, 브라운)
  {
    id: 'natural-brown',
    name: '자연스러운 브라운',
    description: '자연스럽고 따뜻한 브라운 톤',
    tokens: {
      bg: '#FEFDFB',
      surface: '#FEFEFE',
      'surface-2': '#FEF3E7',
      text: '#292524',
      muted: '#78716C',
      border: 'rgba(41, 37, 36, 0.10)',
      'border-strong': 'rgba(41, 37, 36, 0.14)',
      brand: '#A16207',
      'brand-soft': '#FEF3C7',
      accent: '#D97706',
    },
    shape: { radius: '18px' },
    density: {
      'tile-h': '64px',
      'tile-px': '18px',
      'tile-py': '16px',
      'card-pad': '24px',
      'section-gap': '48px',
    },
    elevation: {
      'shadow-0': '0 1px 2px rgba(41, 37, 36, 0.05)',
      'shadow-1': '0 2px 10px rgba(41, 37, 36, 0.08)',
    },
    progress: {
      'progress-h': '10px',
      'shadow-inset': 'inset 0 -1px 0 rgba(255, 255, 255, 0.35)',
    },
    fontSans: 'noto',
    fontDisplay: 'gowun',
    heroVariant: 'center',
    bgPattern: 'softGradient',
    cardStyle: 'soft',
  },

  // 11. 에너지 레드 (Noto + Gowun, 레드)
  {
    id: 'energy-red',
    name: '에너지 레드',
    description: '강렬하고 에너지 넘치는 레드 톤',
    tokens: {
      bg: '#FEF2F2',
      surface: '#FEFEFE',
      'surface-2': '#FEE2E2',
      text: '#7F1D1D',
      muted: '#991B1B',
      border: 'rgba(127, 29, 29, 0.10)',
      'border-strong': 'rgba(127, 29, 29, 0.14)',
      brand: '#DC2626',
      'brand-soft': '#FEE2E2',
      accent: '#EF4444',
    },
    shape: { radius: '20px' },
    density: {
      'tile-h': '68px',
      'tile-px': '20px',
      'tile-py': '18px',
      'card-pad': '28px',
      'section-gap': '56px',
    },
    elevation: {
      'shadow-0': '0 2px 4px rgba(127, 29, 29, 0.08)',
      'shadow-1': '0 4px 16px rgba(127, 29, 29, 0.12)',
    },
    progress: {
      'progress-h': '10px',
      'shadow-inset': 'inset 0 -1px 0 rgba(255, 255, 255, 0.35)',
    },
    fontSans: 'noto',
    fontDisplay: 'gowun',
    heroVariant: 'split',
    bgPattern: 'blob',
    cardStyle: 'outline',
  },

  // 12. 부드러운 티 (IBM + Gowun, 티)
  {
    id: 'soft-teal',
    name: '부드러운 티',
    description: '부드럽고 편안한 티 톤',
    tokens: {
      bg: '#F0FDFA',
      surface: '#FEFEFE',
      'surface-2': '#CCFBF1',
      text: '#134E4A',
      muted: '#0F766E',
      border: 'rgba(19, 78, 74, 0.10)',
      'border-strong': 'rgba(19, 78, 74, 0.14)',
      brand: '#14B8A6',
      'brand-soft': '#CCFBF1',
      accent: '#2DD4BF',
    },
    shape: { radius: '18px' },
    density: {
      'tile-h': '64px',
      'tile-px': '18px',
      'tile-py': '16px',
      'card-pad': '24px',
      'section-gap': '48px',
    },
    elevation: {
      'shadow-0': '0 1px 2px rgba(19, 78, 74, 0.05)',
      'shadow-1': '0 2px 10px rgba(19, 78, 74, 0.08)',
    },
    progress: {
      'progress-h': '10px',
      'shadow-inset': 'inset 0 -1px 0 rgba(255, 255, 255, 0.35)',
    },
    fontSans: 'ibm',
    fontDisplay: 'gowun',
    heroVariant: 'split',
    bgPattern: 'softGradient',
    cardStyle: 'soft',
  },
];
