'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  | 'permission_denied'
  | 'subscribe_pending'
  | 'subscribe_error';

export function usePwaPushPermissionState() {
  const [hydrated, setHydrated] = useState(false);
  const [state, setState] = useState<PushPermissionCardState>('unsupported');
  const [dismissedForNow, setDismissedForNow] = useState(false);

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
    setState(existing ? 'permission_granted_subscribed' : 'permission_granted_no_subscription');
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
    const hidden =
      state === 'unsupported' ||
      state === 'not_standalone' ||
      state === 'permission_granted_subscribed' ||
      dismissedForNow;
    if (hidden) return;
    trackEvent('push_card_shown', {
      route_group: 'push_permission',
      permission_state: typeof Notification !== 'undefined' ? Notification.permission : null,
      standalone: isPwaStandalone(),
      supported: isPushSupported(),
    });
  }, [dismissedForNow, hydrated, state]);

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
        trackEvent('push_permission_requested', {
          route_group: 'push_permission',
          permission_before: 'default',
        });
        const permission = await requestNotificationPermission();
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
      trackEvent('push_subscribe_success', {
        route_group: 'push_permission',
        platform: detectPushPlatform(),
        installed: isPwaStandalone(),
      });
      setState('permission_granted_subscribed');
    } catch {
      trackEvent('push_subscribe_failed', {
        route_group: 'push_permission',
        code: 'subscribe_failed',
        permission_state: typeof Notification !== 'undefined' ? Notification.permission : null,
      });
      setState('subscribe_error');
    }
  }, [hydrated]);

  return useMemo(() => ({
    hydrated,
    state,
    requestAndSubscribe,
    dismissForNow,
    refreshState,
  }), [dismissForNow, hydrated, refreshState, requestAndSubscribe, state]);
}
