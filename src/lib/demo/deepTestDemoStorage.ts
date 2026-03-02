/**
 * Demo Deep Test - localStorage only (no server persistence)
 * Key: movere.demo.deepTest.v1
 */

const STORAGE_KEY = 'movere.demo.deepTest.v1';

export interface DemoStoredData {
  version: number;
  savedAt: string;
  answers: Record<string, unknown>;
  derived: Record<string, unknown>;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

export function load(): { answers: Record<string, unknown>; derived: Record<string, unknown> } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return null;
    const answers = parsed.answers;
    const derived = parsed.derived;
    if (!isRecord(answers) || !isRecord(derived)) return null;
    return { answers, derived };
  } catch {
    return null;
  }
}

export function saveAnswers(partial: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = load();
    const answers = { ...(existing?.answers ?? {}), ...partial };
    const derived = existing?.derived ?? {};
    const payload: DemoStoredData = {
      version: 1,
      savedAt: new Date().toISOString(),
      answers,
      derived,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

export function saveDerived(derived: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = load();
    const answers = existing?.answers ?? {};
    const payload: DemoStoredData = {
      version: 1,
      savedAt: new Date().toISOString(),
      answers,
      derived,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

export function reset(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
