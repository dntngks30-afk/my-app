/**
 * intro → movement-test survey 브릿지
 * intro/profile 완료 시 age, gender를 movementTestSession:v2.profile에 merge
 */
import { FUNNEL_KEY } from './intro-funnel';

const SESSION_KEY = 'movementTestSession:v2';

interface SessionV2 {
  version: 'v2';
  isCompleted: boolean;
  startedAt: string;
  completedAt?: string;
  profile?: Record<string, unknown>;
  answersById: Record<string, 0 | 1 | 2 | 3 | 4>;
}

function loadFunnel(): Record<string, unknown> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(FUNNEL_KEY);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function loadSession(): SessionV2 | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data?.version !== 'v2') return null;
    return data as SessionV2;
  } catch {
    return null;
  }
}

function saveSession(session: SessionV2) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // ignore
  }
}

/**
 * intro profile(age, gender)를 movementTestSession:v2.profile에 merge
 * 기존 profile 필드는 preserve, age/gender는 intro 값으로 덮어씀
 * 새 설문 시작을 위한 fresh session 생성 (isCompleted: false, answersById: {})
 */
export function mergeIntroProfileIntoSurveySession(): void {
  const funnel = loadFunnel();
  const introProfile: Record<string, unknown> = {};
  if (funnel.age != null) introProfile.age = funnel.age;
  if (funnel.gender != null) introProfile.gender = funnel.gender;

  const existing = loadSession();
  const mergedProfile: Record<string, unknown> = {
    ...(existing?.profile ?? {}),
    ...introProfile,
  };

  const fresh: SessionV2 = {
    version: 'v2',
    isCompleted: false,
    startedAt: new Date().toISOString(),
    profile: mergedProfile,
    answersById: {},
  };
  saveSession(fresh);
}
