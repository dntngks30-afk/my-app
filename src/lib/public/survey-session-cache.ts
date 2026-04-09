import type { TestAnswerValue } from '@/features/movement-test/v2';
import { FUNNEL_KEY, toProfileMerge, type FunnelData } from './intro-funnel';
import {
  SURVEY_SESSION_KEY,
  type SurveyAnswersById,
  type SurveySessionCacheV2,
} from './survey-session-types';

function readLocalJson(key: string): unknown | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function sanitizeAnswersById(raw: unknown): SurveyAnswersById {
  if (!raw || typeof raw !== 'object') return {};
  const answersById: SurveyAnswersById = {};
  let allZeros = true;

  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'number' && value >= 0 && value <= 4) {
      answersById[key] = value as TestAnswerValue;
      if (value !== 0) allZeros = false;
    }
  }

  return allZeros && Object.keys(answersById).length > 0 ? {} : answersById;
}

function sanitizeProfile(raw: unknown): Record<string, unknown> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  return raw as Record<string, unknown>;
}

export function loadSurveySessionCache(): SurveySessionCacheV2 | null {
  const data = readLocalJson(SURVEY_SESSION_KEY);
  if (!data || typeof data !== 'object') return null;

  const parsed = data as Record<string, unknown>;
  if (parsed.version !== 'v2') return null;

  return {
    version: 'v2',
    isCompleted: parsed.isCompleted === true,
    startedAt:
      typeof parsed.startedAt === 'string' ? parsed.startedAt : new Date().toISOString(),
    completedAt:
      typeof parsed.completedAt === 'string' ? parsed.completedAt : undefined,
    profile: sanitizeProfile(parsed.profile),
    answersById: sanitizeAnswersById(parsed.answersById),
  };
}

export function saveSurveySessionCache(session: SurveySessionCacheV2): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SURVEY_SESSION_KEY, JSON.stringify(session));
  } catch {
    // ignore
  }
}

export function loadIntroProfileSeedFromFunnel(): Record<string, unknown> {
  const funnel = readLocalJson(FUNNEL_KEY);
  if (!funnel || typeof funnel !== 'object') return {};

  const merged = toProfileMerge(funnel as FunnelData);
  return Object.fromEntries(
    Object.entries(merged).filter(([, value]) => value != null)
  );
}

export function resolveSurveySeedProfile(
  existingProfile?: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...(existingProfile ?? {}),
    ...loadIntroProfileSeedFromFunnel(),
  };
}

export function createFreshSurveySession(
  profile?: Record<string, unknown>
): SurveySessionCacheV2 {
  return {
    version: 'v2',
    isCompleted: false,
    startedAt: new Date().toISOString(),
    profile: resolveSurveySeedProfile(profile),
    answersById: {},
  };
}

export function loadCompletedSurveyAnswersCache(): SurveyAnswersById | null {
  const session = loadSurveySessionCache();
  if (!session?.isCompleted) return null;
  if (Object.keys(session.answersById).length === 0) return null;
  return session.answersById;
}
