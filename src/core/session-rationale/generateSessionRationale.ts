/**
 * PR-ALG-10: Session Rationale Engine — Session Rationale Generation
 *
 * Deep Result + session_number → session rationale
 * State Vector → Session Focus Axes → Session Rationale → Exercise Mapping
 */

import { getAxisDescription, getAxisSessionGoal } from './axisDescriptions';

export interface DeepResultInput {
  priority_vector?: Record<string, number> | null;
  pain_mode?: 'none' | 'caution' | 'protected' | null;
}

export interface SessionRationaleOutput {
  session_focus_axes: string[];
  rationale_text: string;
  /** 축별 설명 (UI용) */
  axis_descriptions: string[];
}

/**
 * priority_vector에서 상위 1~2개 축 추출 후 rationale 생성.
 */
export function generateSessionRationale(
  deepResult: DeepResultInput,
  _sessionNumber?: number
): SessionRationaleOutput {
  const priorityVector = deepResult?.priority_vector;
  const axes =
    priorityVector && typeof priorityVector === 'object'
      ? Object.entries(priorityVector)
          .filter(([, v]) => typeof v === 'number' && v > 0)
          .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
          .slice(0, 2)
          .map(([axis]) => axis)
      : [];

  if (axes.length === 0) {
    return {
      session_focus_axes: [],
      rationale_text: '오늘의 운동을 안전하고 효과적으로 수행하기 위한 구성입니다.',
      axis_descriptions: [],
    };
  }

  const primary = axes[0];
  const primaryDesc = getAxisDescription(primary);
  const primaryGoal = getAxisSessionGoal(primary);
  const rationaleText = `${primaryDesc} ${primaryGoal}`;

  const axis_descriptions = axes.map((a) => getAxisDescription(a));

  return {
    session_focus_axes: axes,
    rationale_text: rationaleText,
    axis_descriptions,
  };
}
