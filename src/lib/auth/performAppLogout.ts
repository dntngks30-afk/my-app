'use client';

/**
 * 앱 로그아웃: 인메모리 캐시·타깃 스토리지·Supabase 세션 정리 후 public landing(`/`)으로 이동.
 * 전역 localStorage.clear()는 사용하지 않는다 (테마·폰트 프리셋 등 비계정 UI 설정 유지).
 *
 * 계정 삭제·서버 레코드 삭제·OAuth 제공자 쿠키 삭제가 아님 — 이 기기 클라이언트 상태만 정리.
 */

import { invalidateCache } from '@/lib/cache/tabDataCache';
import { invalidateAppBootstrapCache } from '@/lib/app/bootstrapClient';
import { invalidateActiveCache } from '@/lib/session/active-cache';
import { clearBridgeContext } from '@/lib/public-results/public-result-bridge';
import { clearPublicResultHandoff } from '@/lib/public-results/public-result-handoff';
import { ANON_ID_KEY } from '@/lib/public-results/anon-id';
import { clearAllSessionDrafts } from '@/lib/session/draftStorage';
import { clearResetMapClientState } from '@/lib/reset-map/clientStorage';
import { clearAllKeysForNewFlow } from '@/lib/reset-map/clientIdempotency';
import { SURVEY_SESSION_KEY } from '@/lib/public/survey-session-types';
import { FUNNEL_KEY } from '@/lib/public/intro-funnel';
import { CAMERA_RESULT_KEY } from '@/lib/camera/camera-result';
import { CAMERA_TEST_KEY } from '@/lib/public/camera-test';
import { clearStoredCameraTraceData } from '@/lib/camera/trace/camera-trace-storage';
import { clearReadinessCheck } from '@/lib/readiness/readinessSessionFlag';
import { clearPilotContext } from '@/lib/pilot/pilot-context';
import { supabaseBrowser } from '@/lib/supabase';
import {
  MANUAL_EDIT_FLAG_STORAGE_KEY,
  MANUAL_OVERRIDES_STORAGE_KEY,
} from '@/features/map_ui_import/home_map_20260315/components/manual-node-overrides';

const DONOR_MAP_PANEL_POS_KEY = 'donor-map-edit-panel-pos-v1';
const PENDING_REQUEST_ID_KEY = 'pending_request_id';
const DEMO_DEEP_TEST_KEY = 'movere.demo.deepTest.v1';

/** 테마·개발 폰트/프리셋 등 로그아웃 후에도 유지할 비계정 키 — 무차별 prefix 삭제 방지용 */
const PRESERVE_LOCAL_STORAGE_KEYS = new Set<string>([
  'theme-preset',
  'designPreset:v1',
  'ui-preset:v1',
  'fontPreset:v1',
  'dev:fontSwitcherUI:v1',
  'ui:themePreset:v3',
]);

function removeLocalStorageKeys(keys: string[]): void {
  if (typeof window === 'undefined') return;
  for (const key of keys) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

/**
 * MOVE RE 클라 관련 로컬 키 추가 정리 — prefix 패턴 및 알려진 퍼널/세션 키.
 * Supabase auth 저장소 키는 signOut에 맡기며, sb- 로 시작하는 키는 건드리지 않는다.
 */
function removeMoveReLocalStorageByScan(): void {
  if (typeof window === 'undefined') return;
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (PRESERVE_LOCAL_STORAGE_KEYS.has(key)) continue;
      if (key.startsWith('sb-')) continue;
      if (shouldRemoveMoveReLocalStorageKey(key)) {
        toRemove.push(key);
      }
    }
    for (const key of toRemove) {
      try {
        localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
}

function shouldRemoveMoveReLocalStorageKey(key: string): boolean {
  if (
    key.startsWith('moveRe') ||
    key.startsWith('move-re:') ||
    key.startsWith('movementTest') ||
    key.startsWith('movement-test') ||
    key.startsWith('movementTest:') ||
    key.startsWith('movere') ||
    key === 'movement-test-result' ||
    key === 'pending_request_id' ||
    key === 'user_id'
  ) {
    return true;
  }
  return false;
}

function clearTargetedSessionStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (!k) continue;
      if (
        k === 'movementTestSession:v1' ||
        k === 'movementTestSession:v2' ||
        k === 'move-re-app-booted' ||
        k.startsWith('moveReResumeExec:v1:') ||
        k.startsWith('mr_session_active_') ||
        k.startsWith('move-re-readiness-checked') ||
        k.startsWith('moveRe') ||
        k.startsWith('move-re') ||
        k.startsWith('movementTest')
      ) {
        toRemove.push(k);
      }
    }
    for (const k of toRemove) sessionStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}

/**
 * Supabase signOut 전에 호출 — 이전 계정 데이터가 메모리·스토리지에 남지 않게 한다.
 */
export function clearMoveReClientStateForLogout(): void {
  invalidateCache();
  invalidateAppBootstrapCache();
  invalidateActiveCache();
  clearReadinessCheck();
  clearResetMapClientState();
  clearAllKeysForNewFlow();
  clearTargetedSessionStorage();

  clearPilotContext();

  clearBridgeContext();
  clearPublicResultHandoff('baseline');
  clearPublicResultHandoff('refined');
  clearAllSessionDrafts();
  clearStoredCameraTraceData();

  removeLocalStorageKeys([
    ANON_ID_KEY,
    SURVEY_SESSION_KEY,
    FUNNEL_KEY,
    MANUAL_OVERRIDES_STORAGE_KEY,
    MANUAL_EDIT_FLAG_STORAGE_KEY,
    DONOR_MAP_PANEL_POS_KEY,
    CAMERA_RESULT_KEY,
    CAMERA_TEST_KEY,
    PENDING_REQUEST_ID_KEY,
    DEMO_DEEP_TEST_KEY,
  ]);

  /** 명시 목록 이후 MOVE RE 관련 키(stray 패턴) 추가 스캔 */
  removeMoveReLocalStorageByScan();
}

export async function performAppLogout(
  router: { replace: (href: string) => void },
  options?: { redirectTo?: string }
): Promise<void> {
  const redirectTo = options?.redirectTo ?? '/';

  clearMoveReClientStateForLogout();

  try {
    await supabaseBrowser.auth.signOut();
  } catch {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[performAppLogout] signOut failed; redirecting anyway');
    }
  } finally {
    router.replace(redirectTo);
  }
}
