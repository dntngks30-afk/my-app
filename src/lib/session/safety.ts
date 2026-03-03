/**
 * Session Safety Gate
 * meta.avoid + pain_flags → contraindications 매핑으로 제외할 태그 Set 생성.
 */

/**
 * 제외 대상 태그 Set 생성.
 * - meta.avoid: Deep 결과의 avoid_tags (contraindication 코드)
 * - pain_flags: 사용자 입력 통증 플래그 (contraindication 코드로 매핑 가능)
 *
 * tag_codebook의 kind='contraindication' 코드와 일치.
 * pain_flags가 이미 contraindication 코드면 그대로 사용.
 */
export function buildExcludeSet(
  avoid: string[],
  painFlags: string[] = []
): Set<string> {
  const set = new Set<string>();

  for (const a of avoid) {
    if (typeof a === 'string' && a.trim()) set.add(a.trim());
  }

  for (const p of painFlags) {
    if (typeof p === 'string' && p.trim()) set.add(p.trim());
  }

  return set;
}

/**
 * 템플릿의 contraindications가 excludeSet과 겹치면 true (제외 대상)
 */
export function hasContraindicationOverlap(
  contraindications: string[],
  excludeSet: Set<string>
): boolean {
  if (excludeSet.size === 0) return false;
  return contraindications.some((c) => excludeSet.has(c));
}
