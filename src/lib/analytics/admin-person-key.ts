/**
 * KPI 읽기 경로 전용 canonical 신원 해석 모듈.
 *
 * IMPORTANT: src/lib/analytics/identity.ts#getAnalyticsPersonKey 는
 * 수집(쓰기) 경로의 raw 헬퍼이며, user_id / anon_id 문자열을 `user:` / `anon:` 접두사
 * 없이 그대로 반환하고 analytics_identity_links 링크 해석을 수행하지 않습니다.
 * KPI 집계에서 사람 단위 distinct 카운트를 계산할 때는 반드시 이 모듈의
 * resolveAnalyticsPersonKeyForKpi 를 사용하세요.
 *
 * NOTE: person_key 는 어드민 KPI 읽기 전용 식별자입니다.
 * 제품 상태(readiness, session, claim, payment) 의 truth 로 사용하지 않습니다.
 */

export type AnalyticsEventForPersonKey = {
  id: string;
  user_id: string | null;
  anon_id: string | null;
};

/**
 * Canonical person_key 해석 전략 (우선순위 순):
 * 1. user_id 존재 → "user:{user_id}"
 * 2. anon_id 가 analytics_identity_links 를 통해 user_id 로 연결됨 → "user:{linked_user_id}"
 * 3. anon_id 존재 → "anon:{anon_id}"
 * 4. fallback → "event:{id}"
 */
export function resolveAnalyticsPersonKeyForKpi(
  event: AnalyticsEventForPersonKey,
  identityLinkMap: Map<string, string>
): string {
  if (event.user_id) return `user:${event.user_id}`;
  if (event.anon_id) {
    const linked = identityLinkMap.get(event.anon_id);
    if (linked) return `user:${linked}`;
    return `anon:${event.anon_id}`;
  }
  return `event:${event.id}`;
}
