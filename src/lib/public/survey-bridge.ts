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
 * intro profile(age, gender) is seeded from funnel state into survey cache.
 * existing cached profile fields are preserved, but funnel-owned fields win.
 */
export function mergeIntroProfileIntoSurveySession(): void {
  const existing = loadSurveySessionCache();
  const fresh = createFreshSurveySession(existing?.profile);
  saveSurveySessionCache(fresh);
}
