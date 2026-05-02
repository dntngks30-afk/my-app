/**
 * intro -> movement-test survey bridge
 * intro profile canonical source is moveRePublicFunnel:v1,
 * and movementTestSession:v2 is only a seeded survey draft cache snapshot.
 */
import {
  createFreshSurveySession,
  loadSurveySessionCache,
  saveSurveySessionCache,
} from './survey-session-cache';

/**
 * intro profile(age_band, gender) is seeded from funnel state into survey cache.
 * 유입경로 등은 회원가입 후 signup_profiles 에만 저장합니다.
 */
export function mergeIntroProfileIntoSurveySession(): void {
  const existing = loadSurveySessionCache();
  const fresh = createFreshSurveySession(existing?.profile);
  saveSurveySessionCache(fresh);
}
