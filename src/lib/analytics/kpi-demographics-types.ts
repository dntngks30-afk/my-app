/**
 * KPI demographic buckets only — no birthdate persisted server-side, no mixed scoring truth.
 */

export const AGE_BANDS = [
  '10s',
  '20s',
  '30s',
  '40s',
  '50s',
  '60s_plus',
  'unknown',
] as const;

export type AgeBand = (typeof AGE_BANDS)[number];

export const GENDER_BUCKETS = [
  'male',
  'female',
  'other',
  'prefer_not_to_say',
  'unknown',
] as const;

export type GenderBucket = (typeof GENDER_BUCKETS)[number];

/** Intro KPI writes accept 남/여 only (stored as male/female). */
export type KpiIntroGender = 'male' | 'female';

export const ACQUISITION_SOURCES = [
  'instagram',
  'search',
  'referral',
  'threads',
  'youtube',
  'other',
  'unknown',
] as const;

export type AcquisitionSource = (typeof ACQUISITION_SOURCES)[number];

export const AGE_BAND_LABELS: Record<AgeBand, string> = {
  '10s': '10대',
  '20s': '20대',
  '30s': '30대',
  '40s': '40대',
  '50s': '50대',
  '60s_plus': '60대 이상',
  unknown: '미입력',
};

export const GENDER_LABELS: Record<GenderBucket, string> = {
  male: '남성',
  female: '여성',
  other: '기타',
  prefer_not_to_say: '응답 안 함',
  unknown: '미입력',
};

export const ACQUISITION_SOURCE_LABELS: Record<AcquisitionSource, string> = {
  instagram: 'Instagram',
  search: '검색',
  referral: '지인 소개',
  threads: 'Threads',
  youtube: 'YouTube',
  other: '기타',
  unknown: '미선택',
};

const AGE_SET = new Set<string>(AGE_BANDS);
const GENDER_SET = new Set<string>(GENDER_BUCKETS);
const ACQUISITION_SET = new Set<string>(ACQUISITION_SOURCES);

export function isAgeBand(value: unknown): value is AgeBand {
  return typeof value === 'string' && AGE_SET.has(value);
}

export function isGenderBucket(value: unknown): value is GenderBucket {
  return typeof value === 'string' && GENDER_SET.has(value);
}

export function isKpiIntroGender(value: unknown): value is KpiIntroGender {
  return value === 'male' || value === 'female';
}

export function isAcquisitionSource(value: unknown): value is AcquisitionSource {
  return typeof value === 'string' && ACQUISITION_SET.has(value);
}

/**
 * Client-side birth date (yyyy-mm-dd) → KPI age band. Does not persist DOB server-side.
 * Uses local calendar dates. Ages outside 14–100 → unknown.
 */
export function birthDateToAgeBand(isoDateStr: string, referenceDate: Date = new Date()): AgeBand {
  const m = isoDateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return 'unknown';
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || mo < 1 || mo > 12 || d < 1 || d > 31) return 'unknown';
  const birth = new Date(y, mo - 1, d);
  if (birth.getFullYear() !== y || birth.getMonth() !== mo - 1 || birth.getDate() !== d) {
    return 'unknown';
  }
  const ref = referenceDate;
  let age = ref.getFullYear() - birth.getFullYear();
  const md = ref.getMonth() - birth.getMonth();
  if (md < 0 || (md === 0 && ref.getDate() < birth.getDate())) age--;
  if (age < 14 || age > 100) return 'unknown';
  if (age < 20) return '10s';
  if (age < 30) return '20s';
  if (age < 40) return '30s';
  if (age < 50) return '40s';
  if (age < 60) return '50s';
  return '60s_plus';
}

/** @deprecated Legacy intro funnel age bracket strings; prefer birthDateToAgeBand. */
export function mapIntroAgeToAgeBand(value: unknown): AgeBand {
  if (typeof value !== 'string') return 'unknown';
  switch (value.trim()) {
    case '10-19':
      return '10s';
    case '20-29':
      return '20s';
    case '30-39':
      return '30s';
    case '40-49':
      return '40s';
    case '50-59':
      return '50s';
    case '60+':
      return '60s_plus';
    default:
      return 'unknown';
  }
}

export function mapIntroGenderToGenderBucket(value: unknown): GenderBucket {
  if (value === 'male' || value === 'female') return value;
  return 'unknown';
}
