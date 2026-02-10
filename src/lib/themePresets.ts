/**
 * 테마 프리셋 정의
 * 
 * shadcn/ui 토큰 기반 20개 프리셋
 */

export type ThemePresetId =
  | 'clean'
  | 'bold'
  | 'playful'
  | 'mono'
  | 'warm'
  | 'cool'
  | 'neo'
  | 'glass'
  | 'ink'
  | 'beige'
  | 'forest'
  | 'sunset'
  | 'midnight'
  | 'lavender'
  | 'sky'
  | 'stone'
  | 'contrast'
  | 'soft'
  | 'retro'
  | 'zen';

export interface ThemePresetTokens {
  radius: string;
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  ring: string;
}

export interface ThemePreset {
  id: ThemePresetId;
  label: string;
  desc: string;
  tokens: ThemePresetTokens;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'clean',
    label: '클린',
    desc: '깔끔하고 미니멀한 기본 스타일',
    tokens: {
      radius: '0.5rem',
      background: '0 0% 100%',
      foreground: '222 47% 11%',
      card: '0 0% 100%',
      cardForeground: '222 47% 11%',
      primary: '221 83% 53%',
      primaryForeground: '0 0% 100%',
      muted: '210 40% 96%',
      mutedForeground: '215 16% 47%',
      border: '214 32% 91%',
      ring: '221 83% 53%',
    },
  },
  {
    id: 'bold',
    label: '볼드',
    desc: '강렬하고 대담한 색상',
    tokens: {
      radius: '0.5rem',
      background: '0 0% 100%',
      foreground: '222 47% 11%',
      card: '0 0% 100%',
      cardForeground: '222 47% 11%',
      primary: '0 84% 60%',
      primaryForeground: '0 0% 100%',
      muted: '210 40% 96%',
      mutedForeground: '215 16% 47%',
      border: '214 32% 91%',
      ring: '0 84% 60%',
    },
  },
  {
    id: 'playful',
    label: '플레이풀',
    desc: '활기찬 오렌지 톤',
    tokens: {
      radius: '0.5rem',
      background: '0 0% 100%',
      foreground: '222 47% 11%',
      card: '0 0% 100%',
      cardForeground: '222 47% 11%',
      primary: '24 95% 53%',
      primaryForeground: '0 0% 100%',
      muted: '210 40% 96%',
      mutedForeground: '215 16% 47%',
      border: '214 32% 91%',
      ring: '24 95% 53%',
    },
  },
  {
    id: 'mono',
    label: '모노',
    desc: '단색 그레이스케일',
    tokens: {
      radius: '0.5rem',
      background: '0 0% 100%',
      foreground: '222 47% 11%',
      card: '0 0% 100%',
      cardForeground: '222 47% 11%',
      primary: '215 16% 47%',
      primaryForeground: '0 0% 100%',
      muted: '210 40% 96%',
      mutedForeground: '215 16% 47%',
      border: '214 32% 91%',
      ring: '215 16% 47%',
    },
  },
  {
    id: 'warm',
    label: '웜',
    desc: '따뜻한 노란색 기반',
    tokens: {
      radius: '0.5rem',
      background: '0 0% 100%',
      foreground: '222 47% 11%',
      card: '0 0% 100%',
      cardForeground: '222 47% 11%',
      primary: '45 93% 47%',
      primaryForeground: '0 0% 9%',
      muted: '210 40% 96%',
      mutedForeground: '215 16% 47%',
      border: '214 32% 91%',
      ring: '45 93% 47%',
    },
  },
  {
    id: 'cool',
    label: '쿨',
    desc: '차분한 청록색',
    tokens: {
      radius: '0.5rem',
      background: '0 0% 100%',
      foreground: '222 47% 11%',
      card: '0 0% 100%',
      cardForeground: '222 47% 11%',
      primary: '173 80% 40%',
      primaryForeground: '0 0% 100%',
      muted: '210 40% 96%',
      mutedForeground: '215 16% 47%',
      border: '214 32% 91%',
      ring: '173 80% 40%',
    },
  },
  {
    id: 'neo',
    label: '네오',
    desc: '네온 그린 모던 스타일',
    tokens: {
      radius: '0.5rem',
      background: '0 0% 100%',
      foreground: '222 47% 11%',
      card: '0 0% 100%',
      cardForeground: '222 47% 11%',
      primary: '142 76% 36%',
      primaryForeground: '0 0% 100%',
      muted: '210 40% 96%',
      mutedForeground: '215 16% 47%',
      border: '214 32% 91%',
      ring: '142 76% 36%',
    },
  },
  {
    id: 'glass',
    label: '글라스',
    desc: '투명한 글래스모피즘',
    tokens: {
      radius: '0.5rem',
      background: '0 0% 100%',
      foreground: '222 47% 11%',
      card: '0 0% 100%',
      cardForeground: '222 47% 11%',
      primary: '262 83% 58%',
      primaryForeground: '0 0% 100%',
      muted: '210 40% 96%',
      mutedForeground: '215 16% 47%',
      border: '214 32% 91%',
      ring: '262 83% 58%',
    },
  },
  {
    id: 'ink',
    label: '잉크',
    desc: '진한 네이비 블루',
    tokens: {
      radius: '0.5rem',
      background: '0 0% 100%',
      foreground: '222 47% 11%',
      card: '0 0% 100%',
      cardForeground: '222 47% 11%',
      primary: '222 47% 11%',
      primaryForeground: '0 0% 100%',
      muted: '210 40% 96%',
      mutedForeground: '215 16% 47%',
      border: '214 32% 91%',
      ring: '222 47% 11%',
    },
  },
  {
    id: 'beige',
    label: '베이지',
    desc: '부드러운 베이지 톤',
    tokens: {
      radius: '0.5rem',
      background: '0 0% 100%',
      foreground: '222 47% 11%',
      card: '0 0% 100%',
      cardForeground: '222 47% 11%',
      primary: '38 92% 50%',
      primaryForeground: '0 0% 9%',
      muted: '210 40% 96%',
      mutedForeground: '215 16% 47%',
      border: '214 32% 91%',
      ring: '38 92% 50%',
    },
  },
  {
    id: 'forest',
    label: '포레스트',
    desc: '자연스러운 숲 녹색',
    tokens: {
      radius: '0.5rem',
      background: '0 0% 100%',
      foreground: '222 47% 11%',
      card: '0 0% 100%',
      cardForeground: '222 47% 11%',
      primary: '142 71% 45%',
      primaryForeground: '0 0% 100%',
      muted: '210 40% 96%',
      mutedForeground: '215 16% 47%',
      border: '214 32% 91%',
      ring: '142 71% 45%',
    },
  },
  {
    id: 'sunset',
    label: '선셋',
    desc: '노을빛 핑크-오렌지',
    tokens: {
      radius: '0.5rem',
      background: '0 0% 100%',
      foreground: '222 47% 11%',
      card: '0 0% 100%',
      cardForeground: '222 47% 11%',
      primary: '346 77% 50%',
      primaryForeground: '0 0% 100%',
      muted: '210 40% 96%',
      mutedForeground: '215 16% 47%',
      border: '214 32% 91%',
      ring: '346 77% 50%',
    },
  },
  {
    id: 'midnight',
    label: '미드나잇',
    desc: '깊은 자정 블루',
    tokens: {
      radius: '0.5rem',
      background: '0 0% 100%',
      foreground: '222 47% 11%',
      card: '0 0% 100%',
      cardForeground: '222 47% 11%',
      primary: '222 84% 5%',
      primaryForeground: '0 0% 100%',
      muted: '210 40% 96%',
      mutedForeground: '215 16% 47%',
      border: '214 32% 91%',
      ring: '222 84% 5%',
    },
  },
  {
    id: 'lavender',
    label: '라벤더',
    desc: '우아한 라벤더 퍼플',
    tokens: {
      radius: '0.5rem',
      background: '0 0% 100%',
      foreground: '222 47% 11%',
      card: '0 0% 100%',
      cardForeground: '222 47% 11%',
      primary: '262 52% 47%',
      primaryForeground: '0 0% 100%',
      muted: '210 40% 96%',
      mutedForeground: '215 16% 47%',
      border: '214 32% 91%',
      ring: '262 52% 47%',
    },
  },
  {
    id: 'sky',
    label: '스카이',
    desc: '맑은 하늘 블루',
    tokens: {
      radius: '0.5rem',
      background: '0 0% 100%',
      foreground: '222 47% 11%',
      card: '0 0% 100%',
      cardForeground: '222 47% 11%',
      primary: '199 89% 48%',
      primaryForeground: '0 0% 100%',
      muted: '210 40% 96%',
      mutedForeground: '215 16% 47%',
      border: '214 32% 91%',
      ring: '199 89% 48%',
    },
  },
  {
    id: 'stone',
    label: '스톤',
    desc: '중립적인 스톤 그레이',
    tokens: {
      radius: '0.5rem',
      background: '0 0% 100%',
      foreground: '222 47% 11%',
      card: '0 0% 100%',
      cardForeground: '222 47% 11%',
      primary: '25 5% 45%',
      primaryForeground: '0 0% 100%',
      muted: '210 40% 96%',
      mutedForeground: '215 16% 47%',
      border: '214 32% 91%',
      ring: '25 5% 45%',
    },
  },
  {
    id: 'contrast',
    label: '컨트라스트',
    desc: '높은 대비 블랙&화이트',
    tokens: {
      radius: '0.5rem',
      background: '0 0% 100%',
      foreground: '222 47% 11%',
      card: '0 0% 100%',
      cardForeground: '222 47% 11%',
      primary: '0 0% 9%',
      primaryForeground: '0 0% 100%',
      muted: '210 40% 96%',
      mutedForeground: '215 16% 47%',
      border: '214 32% 91%',
      ring: '0 0% 9%',
    },
  },
  {
    id: 'soft',
    label: '소프트',
    desc: '부드러운 파스텔 톤',
    tokens: {
      radius: '0.5rem',
      background: '0 0% 100%',
      foreground: '222 47% 11%',
      card: '0 0% 100%',
      cardForeground: '222 47% 11%',
      primary: '280 100% 70%',
      primaryForeground: '0 0% 9%',
      muted: '210 40% 96%',
      mutedForeground: '215 16% 47%',
      border: '214 32% 91%',
      ring: '280 100% 70%',
    },
  },
  {
    id: 'retro',
    label: '레트로',
    desc: '빈티지 오렌지-브라운',
    tokens: {
      radius: '0.5rem',
      background: '0 0% 100%',
      foreground: '222 47% 11%',
      card: '0 0% 100%',
      cardForeground: '222 47% 11%',
      primary: '25 95% 53%',
      primaryForeground: '0 0% 100%',
      muted: '210 40% 96%',
      mutedForeground: '215 16% 47%',
      border: '214 32% 91%',
      ring: '25 95% 53%',
    },
  },
  {
    id: 'zen',
    label: '젠',
    desc: '평온한 민트 그린',
    tokens: {
      radius: '0.5rem',
      background: '0 0% 100%',
      foreground: '222 47% 11%',
      card: '0 0% 100%',
      cardForeground: '222 47% 11%',
      primary: '158 64% 52%',
      primaryForeground: '0 0% 100%',
      muted: '210 40% 96%',
      mutedForeground: '215 16% 47%',
      border: '214 32% 91%',
      ring: '158 64% 52%',
    },
  },
];

export const THEME_STORAGE_KEY = 'ui:themePreset:v3';

/**
 * 프리셋 ID로 프리셋 조회
 */
export function getPreset(id: ThemePresetId): ThemePreset | undefined {
  return THEME_PRESETS.find((p) => p.id === id);
}
