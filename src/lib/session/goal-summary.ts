/**
 * Session goal summary — Phase 기반 사용자별 목표 요약
 *
 * 나중에 서버에서 goal_summary를 내려줄 때 TodayGoalCard의 goal prop만 교체하면 됨.
 */

const TOTAL_SESSIONS_DEFAULT = 16;

export type Phase = 1 | 2 | 3 | 4;

export type GoalSummaryMeta = {
  session_number?: number;
  phase?: number;
  result_type?: string;
  confidence?: string | number;
  focus?: string[];
  avoid?: string[];
};

export type GoalSummary = {
  title: string;
  description: string;
  weekLabel: string;
  chips: string[];
};

/**
 * totalSessions(기본 16)와 session_number로 Phase(1~4) 계산
 */
export function computePhase(
  totalSessions: number,
  sessionNumber: number
): Phase {
  if (sessionNumber < 1) return 1;
  const perPhase = Math.max(1, Math.floor(totalSessions / 4));
  const phase = Math.min(4, Math.ceil(sessionNumber / perPhase));
  return (phase as Phase) || 1;
}

/**
 * Phase별 주차 라벨
 */
function getPhaseWeekLabel(phase: Phase): string {
  const labels: Record<Phase, string> = {
    1: '1주차',
    2: '2주차',
    3: '3주차',
    4: '4주차',
  };
  return labels[phase];
}

/**
 * meta(plan_json.meta)에서 Phase 기반 목표 요약 생성
 * - Phase 1: 1순위 타겟 해결 (Primary focus)
 * - Phase 2: 2순위 타겟 해결 (Secondary focus)
 * - Phase 3: 통합 (Primary+Secondary)
 * - Phase 4: 릴렉스/유지 (avoid 반영)
 * 톤: 가이드/움직임 개선/밸런스/안정화 (진단/치료/교정 표현 금지)
 */
export function buildWeeklyGoalSummary(
  meta: GoalSummaryMeta | null | undefined,
  totalSessions?: number
): GoalSummary {
  const total = totalSessions ?? TOTAL_SESSIONS_DEFAULT;
  const sessionNum = meta?.session_number ?? 1;
  const phase = (meta?.phase != null && meta.phase >= 1 && meta.phase <= 4)
    ? (meta.phase as Phase)
    : computePhase(total, sessionNum);

  const focus = meta?.focus ?? [];
  const avoid = meta?.avoid ?? [];
  const primary = focus[0] ?? meta?.result_type ?? '움직임';
  const secondary = focus[1] ?? focus[0] ?? primary;

  const fallback: GoalSummary = {
    title: '오늘의 움직임 목표',
    description: '균형 잡힌 움직임으로 몸의 안정성을 높여보세요.',
    weekLabel: getPhaseWeekLabel(phase),
    chips: phase <= 2 ? [primary] : ['통합'],
  };

  if (!meta) return fallback;

  switch (phase) {
    case 1: {
      return {
        title: `${primary} 안정화`,
        description: `1순위 타겟인 ${primary} 영역의 밸런스와 안정성을 개선하는 움직임입니다.`,
        weekLabel: '1주차',
        chips: [primary, '안정화'],
      };
    }
    case 2: {
      return {
        title: `${secondary} 심화`,
        description: `2순위 타겟인 ${secondary} 영역을 더 깊이 다루는 움직임입니다.`,
        weekLabel: '2주차',
        chips: [secondary, '심화'],
      };
    }
    case 3: {
      return {
        title: `${primary}와 ${secondary} 통합`,
        description: `1순위와 2순위 타겟을 연결하는 통합 움직임으로 몸의 균형을 맞춥니다.`,
        weekLabel: '3주차',
        chips: [primary, secondary, '통합'],
      };
    }
    case 4: {
      return {
        title: '릴렉스 및 유지',
        description: avoid.length > 0
          ? `${avoid[0]} 회복을 고려한 안정적인 유지 움직임입니다.`
          : '몸의 안정성을 유지하는 릴렉스 움직임입니다.',
        weekLabel: '4주차',
        chips: ['유지', '릴렉스'],
      };
    }
    default:
      return fallback;
  }
}
