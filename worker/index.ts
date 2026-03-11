/**
 * Custom worker code injected into next-pwa generated SW.
 * Listens for SKIP_WAITING to activate waiting worker (used by PwaUpdateHandler).
 */
self.addEventListener("message", (event: MessageEvent) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
