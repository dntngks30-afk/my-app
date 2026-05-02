'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { trackEvent } from '@/lib/analytics/trackEvent';
import {
  fetchVapidPublicKey,
  detectPushPlatform,
  getExistingPushSubscription,
  isPwaStandalone,
  isPushSupported,
  requestNotificationPermission,
  savePushSubscription,
  subscribeToPush,
} from '@/lib/push/pushClient';

const DISMISS_KEY = 'move-re:push-card-dismissed-at';
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000;

export type PushPermissionCardState =
  | 'unsupported'
  | 'not_standalone'
  | 'permission_default'
  | 'permission_granted_no_subscription'
  | 'permission_granted_subscribed'
  | 'permission_granted_subscribed_recent'
  | 'permission_denied'
  | 'subscribe_pending'
  | 'subscribe_error';

export function usePwaPushPermissionState() {
  const [hydrated, setHydrated] = useState(false);
  const [state, setState] = useState<PushPermissionCardState>('unsupported');
  const [dismissedForNow, setDismissedForNow] = useState(false);
  const successRefreshTimerRef = useRef<number | null>(null);

  const clearSuccessRefreshTimer = useCallback(() => {
    if (successRefreshTimerRef.current !== null) {
      window.clearTimeout(successRefreshTimerRef.current);
      successRefreshTimerRef.current = null;
    }
  }, []);

  const refreshState = useCallback(async () => {
    if (!isPushSupported()) {
      setState('unsupported');
      return;
    }
    if (!isPwaStandalone()) {
      setState('not_standalone');
      return;
    }

    if (Notification.permission === 'denied') {
      setState('permission_denied');
      return;
    }

    if (Notification.permission === 'default') {
      setState('permission_default');
      return;
    }

    const existing = await getExistingPushSubscription();
    const nextState = existing ? 'permission_granted_subscribed' : 'permission_granted_no_subscription';
    setState(nextState);

    if (process.env.NODE_ENV === 'development') {
      console.debug('[push]', {
        refresh_state_result: nextState,
        has_subscription: Boolean(existing),
      });
    }
  }, []);

  useEffect(() => {
    setHydrated(true);
    try {
      const dismissedAtRaw = localStorage.getItem(DISMISS_KEY);
      const dismissedAt = dismissedAtRaw ? Number(dismissedAtRaw) : 0;
      if (dismissedAt > 0 && Date.now() - dismissedAt < DISMISS_TTL_MS) {
        setDismissedForNow(true);
        setState('not_standalone');
        return;
      }
    } catch {
      // ignore storage access errors
    }
    void refreshState();
  }, [refreshState]);

  useEffect(() => () => clearSuccessRefreshTimer(), [clearSuccessRefreshTimer]);

  const dismissForNow = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore storage errors
    }
    setDismissedForNow(true);
    setState('not_standalone');
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    const shouldTrackPushCardShown =
      !dismissedForNow &&
      (state === 'permission_default' ||
        state === 'permission_granted_no_subscription' ||
        state === 'permission_denied');

    if (!shouldTrackPushCardShown) return;

    trackEvent('push_card_shown', {
      route_group: 'push_permission',
      permission_state: typeof Notification !== 'undefined' ? Notification.permission : null,
      standalone: isPwaStandalone(),
      supported: isPushSupported(),
    });
  }, [dismissedForNow, hydrated, state]);

  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return;

    const runRefreshFromFocusOrPageshow = () => {
      void refreshState();
    };

    const runRefreshFromVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== undefined) {
        if (document.visibilityState !== 'visible') return;
      }
      void refreshState();
    };

    window.addEventListener('focus', runRefreshFromFocusOrPageshow);
    window.addEventListener('pageshow', runRefreshFromFocusOrPageshow);
    document.addEventListener('visibilitychange', runRefreshFromVisibility);

    return () => {
      window.removeEventListener('focus', runRefreshFromFocusOrPageshow);
      window.removeEventListener('pageshow', runRefreshFromFocusOrPageshow);
      document.removeEventListener('visibilitychange', runRefreshFromVisibility);
    };
  }, [hydrated, refreshState]);

  const requestAndSubscribe = useCallback(async () => {
    if (!hydrated || !isPushSupported() || !isPwaStandalone()) return;
    if (Notification.permission === 'denied') {
      trackEvent('push_permission_denied', {
        route_group: 'push_permission',
        permission_after: 'denied',
      });
      setState('permission_denied');
      return;
    }

    setState('subscribe_pending');
    try {
      if (Notification.permission === 'default') {
        if (process.env.NODE_ENV === 'development') {
          console.debug('[push]', { permission_before: Notification.permission });
        }
        trackEvent('push_permission_requested', {
          route_group: 'push_permission',
          permission_before: 'default',
        });
        const permission = await requestNotificationPermission();
        if (process.env.NODE_ENV === 'development') {
          console.debug('[push]', { permission_after: permission });
        }
        if (permission === 'granted') {
          trackEvent('push_permission_granted', {
            route_group: 'push_permission',
            permission_after: 'granted',
          });
        } else {
          trackEvent('push_permission_denied', {
            route_group: 'push_permission',
            permission_after: permission,
          });
        }
        if (permission === 'denied') {
          setState('permission_denied');
          return;
        }
        if (permission !== 'granted') {
          setState('permission_default');
          return;
        }
      }

      const publicKey = await fetchVapidPublicKey();
      const subscription = await subscribeToPush(publicKey);
      await savePushSubscription(subscription);

      if (process.env.NODE_ENV === 'development') {
        console.debug('[push]', {
          permission_after: Notification.permission,
          subscription_saved: true,
        });
      }

      trackEvent('push_subscribe_success', {
        route_group: 'push_permission',
        platform: detectPushPlatform(),
        installed: isPwaStandalone(),
      });
      setState('permission_granted_subscribed_recent');

      clearSuccessRefreshTimer();
      if (process.env.NODE_ENV === 'development') {
        console.debug('[push]', { scheduled_refresh: true });
      }
      successRefreshTimerRef.current = window.setTimeout(() => {
        successRefreshTimerRef.current = null;
        void refreshState();
      }, 700);
    } catch {
      trackEvent('push_subscribe_failed', {
        route_group: 'push_permission',
        code: 'subscribe_failed',
        permission_state: typeof Notification !== 'undefined' ? Notification.permission : null,
      });
      setState('subscribe_error');
    }
  }, [clearSuccessRefreshTimer, hydrated, refreshState]);

  return useMemo(
    () => ({
      hydrated,
      state,
      requestAndSubscribe,
      dismissForNow,
      refreshState,
    }),
    [dismissForNow, hydrated, refreshState, requestAndSubscribe, state]
  );
}
