/**
 * PR-CAM-09 — completionBlockedReason → retry failure 태그 매핑.
 *
 * squat-completion-state.ts 의 completionBlockedReason 문자열을
 * auto-progression / retry UI 가 사용하는 failure reason 태그로 변환한다.
 *
 * 소유권: 이 매핑은 "왜 사이클이 완료되지 못했는가" → "유저/retry 루프에 어떤 태그를 보낼 것인가"
 * 변환 전용이다. completion 판정 로직은 squat-completion-state.ts 가 소유한다.
 */

/**
 * completionBlockedReason → failure reason 태그 목록.
 *
 * 반환값은 failureReasons Set 에 add 되던 값들을 추출한 것이다.
 * null 이거나 알 수 없는 reason 은 빈 배열을 반환한다.
 */
export function completionBlockedReasonToFailureTags(
  completionBlockedReason: string | null
): string[] {
  switch (completionBlockedReason) {
    // 상승·복귀 구간 미확인
    case 'no_reversal':
    case 'no_ascend':
    case 'not_standing_recovered':
    case 'recovery_hold_too_short':
    case 'ascent_recovery_span_too_short':
      return ['ascent_not_detected'];

    // 하강·커밋 미확인 또는 타이밍 너무 짧음
    case 'no_descend':
    case 'no_commitment':
    case 'insufficient_relative_depth':
    case 'not_armed':
    case 'descent_span_too_short':
      return ['rep_incomplete'];

    default:
      return [];
  }
}
