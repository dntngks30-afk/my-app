'use client';

/**
 * 앱 로그아웃: 인메모리 캐시·타깃 스토리지·Supabase 세션 정리 후 /app/auth.
 * 전역 localStorage.clear()는 사용하지 않는다 (테마 등 비계정 UI 설정 유지).
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
import { supabaseBrowser } from '@/lib/supabase';
import {
  MANUAL_EDIT_FLAG_STORAGE_KEY,
  MANUAL_OVERRIDES_STORAGE_KEY,
} from '@/features/map_ui_import/home_map_20260315/components/manual-node-overrides';

const DONOR_MAP_PANEL_POS_KEY = 'donor-map-edit-panel-pos-v1';
const PENDING_REQUEST_ID_KEY = 'pending_request_id';
const DEMO_DEEP_TEST_KEY = 'movere.demo.deepTest.v1';

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
        k.startsWith('mr_session_active_')
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
}

export async function performAppLogout(router: { replace: (href: string) => void }): Promise<void> {
  clearMoveReClientStateForLogout();
  await supabaseBrowser.auth.signOut();
  router.replace('/app/auth');
}
