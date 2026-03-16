'use client';

/**
 * PR-4: dev-only trace 관측 패널
 * - 최근 attempt 수, export, clear
 */
import { useCallback, useEffect, useState } from 'react';
import {
  getRecentAttempts,
  clearAttempts,
  getQuickStats,
  type AttemptSnapshot,
} from '@/lib/camera/camera-trace';

export function TraceDebugPanel() {
  const [attempts, setAttempts] = useState<AttemptSnapshot[]>([]);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);

  const refresh = useCallback(() => {
    const list = getRecentAttempts();
    setAttempts(list);
    setRefreshedAt(new Date().toISOString());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleExport = useCallback(() => {
    const list = getRecentAttempts();
    const stats = getQuickStats(list);
    const payload = { attempts: list, quickStats: stats, exportedAt: new Date().toISOString() };
    const json = JSON.stringify(payload, null, 2);
    if (typeof navigator?.clipboard?.writeText === 'function') {
      navigator.clipboard.writeText(json).then(
        () => console.info('[camera-trace] exported to clipboard'),
        () => console.warn('[camera-trace] clipboard write failed')
      );
    }
    console.table(
      list.map((a) => ({
        ts: a.ts.slice(11, 19),
        movement: a.movementType,
        outcome: a.outcome,
        quality: a.captureQuality,
        conf: a.confidence.toFixed(2),
      }))
    );
    refresh();
  }, [refresh]);

  const handleClear = useCallback(() => {
    clearAttempts();
    setAttempts([]);
    setRefreshedAt(null);
  }, []);

  const stats = attempts.length > 0 ? getQuickStats(attempts) : null;
  const okCount = stats?.byOutcome?.ok ?? 0;
  const lowCount =
    (stats?.byOutcome?.low ?? 0) +
    (stats?.byOutcome?.retry_required ?? 0) +
    (stats?.byOutcome?.retry_optional ?? 0);
  const invalidCount = (stats?.byOutcome?.invalid ?? 0) + (stats?.byOutcome?.failed ?? 0);

  return (
    <div className="mt-3 rounded-lg border border-slate-600/50 bg-slate-900/50 p-3">
      <p className="text-[11px] text-slate-400" style={{ fontFamily: 'var(--font-sans-noto)' }}>
        PR-4 trace ({attempts.length} attempts)
        {refreshedAt && ` · refreshed ${refreshedAt.slice(11, 19)}`}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={refresh}
          className="rounded border border-slate-500/50 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700/50"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          새로고침
        </button>
        <button
          type="button"
          onClick={handleExport}
          className="rounded border border-slate-500/50 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700/50"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          Export JSON
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="rounded border border-slate-500/50 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700/50"
          style={{ fontFamily: 'var(--font-sans-noto)' }}
        >
          Clear
        </button>
      </div>
      {attempts.length > 0 && (
        <div className="mt-2 max-h-24 overflow-y-auto text-[10px] text-slate-500">
          <p>
            ok={okCount} low={lowCount} invalid={invalidCount}
          </p>
        </div>
      )}
    </div>
  );
}
