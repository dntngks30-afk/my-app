import type { Answer } from '@/types/movement-test';

const SESSION_STORAGE_KEY = 'movementTestSession:v1';
const LEGACY_STORAGE_KEY = 'movement-test-result';

export function loadMovementTestAnswersFromStorage(): Answer[] | null {
  try {
    const sessionRaw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (sessionRaw) {
      const sessionData = JSON.parse(sessionRaw);
      if (sessionData.isCompleted && sessionData.answers) {
        const answersArray: Answer[] = Object.values(sessionData.answers).filter(
          (a): a is Answer => a !== null && typeof a === 'object'
        );
        return answersArray.length > 0 ? answersArray : null;
      }
    }

    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const legacyData = JSON.parse(legacyRaw);
      return legacyData.answers || null;
    }

    return null;
  } catch {
    return null;
  }
}
