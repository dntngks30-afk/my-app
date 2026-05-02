'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSessionSafe } from '@/lib/supabase';
import type {
  KpiDetailsResponse,
  KpiFunnelResponse,
  KpiRawEventsResponse,
  KpiRetentionResponse,
  KpiSummaryResponse,
} from '@/lib/analytics/admin-kpi-types';

const EVENT_LABELS: Record<string, string> = {
  landing_viewed: 'Landing Viewed',
  public_cta_clicked: 'Test Start Clicked',
  survey_started: 'Survey Started',
  survey_completed: 'Survey Completed',
  result_viewed: 'Result Viewed',
  execution_cta_clicked: 'Execution CTA Clicked',
  auth_success: 'Auth Success',
  checkout_success: 'Checkout Success',
  onboarding_completed: 'Onboarding Completed',
  public_result_claim_success: 'Public Result Claimed',
  session_create_success: 'Session Created',
  app_home_viewed: 'App Home Viewed',
  reset_map_opened: 'Reset Map Opened',
  session_panel_opened: 'Session Panel Opened',
  exercise_player_opened: 'Exercise Player Opened',
  exercise_logged: 'Exercise Logged',
  exercise_next_clicked: 'Exercise Next Clicked',
  exercise_player_closed: 'Exercise Player Closed',
  session_complete_clicked: 'Session Complete Clicked',
  session_complete_success: 'Session Completed',
  camera_flow_started: 'Camera Flow Started',
  camera_setup_viewed: 'Camera Setup Viewed',
  camera_step_started: 'Camera Step Started',
  camera_step_completed: 'Camera Step Completed',
  camera_refine_completed: 'Camera Refine Completed',
  pwa_install_card_shown: 'PWA Card Shown',
  pwa_install_cta_clicked: 'PWA CTA Clicked',
  pwa_install_prompt_accepted: 'PWA Prompt Accepted',
  push_card_shown: 'Push Card Shown',
  push_permission_requested: 'Push Permission Requested',
  push_permission_granted: 'Push Permission Granted',
  push_subscribe_success: 'Push Subscribe Success',
};

type RangePreset = 7 | 14 | 30;

type DashboardState = {
  summary: KpiSummaryResponse | null;
  publicFunnel: KpiFunnelResponse | null;
  executionFunnel: KpiFunnelResponse | null;
  firstSessionFunnel: KpiFunnelResponse | null;
  retention: KpiRetentionResponse | null;
  rawEvents: KpiRawEventsResponse | null;
  details: KpiDetailsResponse | null;
};

function getKstDayString(date: Date): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
  }).format(date);
}

function addDays(day: string, delta: number): string {
  const [year, month, date] = day.split('-').map(Number);
  const ms = Date.UTC(year, month - 1, date) + delta * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

function buildRange(days: RangePreset) {
  const to = getKstDayString(new Date());
  const from = addDays(to, -(days - 1));
  return { from, to };
}

function buildQuery(params: Record<string, string | number | null | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === '') continue;
    query.set(key, String(value));
  }
  return query.toString();
}

function formatRate(value: number | null | undefined) {
  if (value == null) return '-';
  return `${value.toFixed(1)}%`;
}

function formatCount(value: number | null | undefined) {
  return new Intl.NumberFormat('en-US').format(value ?? 0);
}

function InsightCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-100">{value}</p>
    </div>
  );
}

function FunnelSection({
  title,
  steps,
}: {
  title: string;
  steps: KpiFunnelResponse['steps'] | undefined;
}) {
  const maxCount = Math.max(...(steps?.map((step) => step.count) ?? [0]), 1);

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
        <span className="text-xs text-slate-500">Distinct person_key</span>
      </div>
      {!steps || steps.length === 0 ? (
        <p className="text-sm text-slate-500">No funnel data in this range.</p>
      ) : (
        <div className="space-y-4">
          {steps.map((step) => {
            const width = `${Math.max(8, (step.count / maxCount) * 100)}%`;
            return (
              <div key={`${title}-${step.event_name}`} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-slate-200">{step.label}</span>
                  <span className="text-slate-400">
                    {formatCount(step.count)} / {formatRate(step.conversion_from_previous)}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-orange-500"
                    style={{ width }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>From start: {formatRate(step.conversion_from_start)}</span>
                  <span>
                    Drop-off: {step.dropoff_count == null ? '-' : formatCount(step.dropoff_count)} / {formatRate(step.dropoff_rate)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function KpiDashboardClient() {
  const router = useRouter();
  const [range, setRange] = useState(buildRange(7));
  const [preset, setPreset] = useState<RangePreset>(7);
  const [eventFilter, setEventFilter] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<DashboardState>({
    summary: null,
    publicFunnel: null,
    executionFunnel: null,
    firstSessionFunnel: null,
    retention: null,
    rawEvents: null,
    details: null,
  });

  const loadDashboard = useCallback(async (from: string, to: string, rawEventName?: string) => {
    setLoading(true);
    setError(null);

    try {
      const { session, error: sessionError } = await getSessionSafe();
      if (sessionError || !session?.access_token) {
        router.push('/app/auth?next=' + encodeURIComponent('/admin/kpi'));
        return;
      }

      const authHeader = { Authorization: `Bearer ${session.access_token}` };
      const baseParams = { from, to, tz: 'Asia/Seoul' };
      const [summaryRes, publicRes, executionRes, firstSessionRes, retentionRes, rawEventsRes, detailsRes] = await Promise.all([
        fetch(`/api/admin/kpi/summary?${buildQuery(baseParams)}`, { headers: authHeader, cache: 'no-store' }),
        fetch(`/api/admin/kpi/funnel?${buildQuery({ ...baseParams, funnel: 'public' })}`, { headers: authHeader, cache: 'no-store' }),
        fetch(`/api/admin/kpi/funnel?${buildQuery({ ...baseParams, funnel: 'execution' })}`, { headers: authHeader, cache: 'no-store' }),
        fetch(`/api/admin/kpi/funnel?${buildQuery({ ...baseParams, funnel: 'first_session' })}`, { headers: authHeader, cache: 'no-store' }),
        fetch(`/api/admin/kpi/retention?${buildQuery({ ...baseParams, cohort: 'app_home' })}`, { headers: authHeader, cache: 'no-store' }),
        fetch(`/api/admin/kpi/raw-events?${buildQuery({ ...baseParams, event_name: rawEventName || null, limit: 100 })}`, { headers: authHeader, cache: 'no-store' }),
        fetch(`/api/admin/kpi/details?${buildQuery(baseParams)}`, { headers: authHeader, cache: 'no-store' }),
      ]);

      if ([summaryRes, publicRes, executionRes, firstSessionRes, retentionRes, rawEventsRes, detailsRes].some((res) => res.status === 401 || res.status === 403)) {
        setIsAdmin(false);
        return;
      }
      if ([summaryRes, publicRes, executionRes, firstSessionRes, retentionRes, rawEventsRes, detailsRes].some((res) => !res.ok)) {
        throw new Error('Failed to load KPI dashboard data');
      }

      const [summary, publicFunnel, executionFunnel, firstSessionFunnel, retention, rawEvents, details] = await Promise.all([
        summaryRes.json() as Promise<KpiSummaryResponse>,
        publicRes.json() as Promise<KpiFunnelResponse>,
        executionRes.json() as Promise<KpiFunnelResponse>,
        firstSessionRes.json() as Promise<KpiFunnelResponse>,
        retentionRes.json() as Promise<KpiRetentionResponse>,
        rawEventsRes.json() as Promise<KpiRawEventsResponse>,
        detailsRes.json() as Promise<KpiDetailsResponse>,
      ]);

      setState({
        summary,
        publicFunnel,
        executionFunnel,
        firstSessionFunnel,
        retention,
        rawEvents,
        details,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load KPI dashboard');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const check = async () => {
      const { session, error: sessionError } = await getSessionSafe();
      if (sessionError || !session?.access_token) {
        router.push('/app/auth?next=' + encodeURIComponent('/admin/kpi'));
        return;
      }
      try {
        const res = await fetch('/api/admin/check', {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: 'no-store',
        });
        const data = await res.json();
        setIsAdmin(Boolean(data?.isAdmin));
      } catch {
        setIsAdmin(false);
      } finally {
        setAuthLoading(false);
      }
    };

    check();
  }, [router]);

  useEffect(() => {
    if (isAdmin) {
      void loadDashboard(range.from, range.to, eventFilter);
    }
  }, [eventFilter, isAdmin, loadDashboard, range.from, range.to]);

  const topDropoffLabel = useMemo(() => {
    const top = state.summary?.top_dropoff;
    if (!top) return 'No drop-off insight yet.';
    return `가장 큰 이탈: ${EVENT_LABELS[top.from_event] ?? top.from_event} -> ${EVENT_LABELS[top.to_event] ?? top.to_event}, ${formatRate(top.dropoff_rate)}`;
  }, [state.summary?.top_dropoff]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <p className="text-slate-300">Checking admin access...</p>
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center">
          <p className="text-slate-300">Admin access is required.</p>
          <Link
            href="/admin"
            className="mt-4 inline-block rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
          >
            Back to Admin
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-100">KPI Dashboard</h1>
            <p className="mt-2 text-sm text-slate-400">Pilot funnel metrics</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {[7, 14, 30].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => {
                  const next = buildRange(days as RangePreset);
                  setPreset(days as RangePreset);
                  setRange(next);
                }}
                className={`rounded-lg px-3 py-2 text-sm ${preset === days ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
              >
                {days}d
              </button>
            ))}
            <input
              type="date"
              value={range.from}
              onChange={(e) => {
                setPreset(7);
                setRange((prev) => ({ ...prev, from: e.target.value }));
              }}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
            />
            <input
              type="date"
              value={range.to}
              onChange={(e) => {
                setPreset(7);
                setRange((prev) => ({ ...prev, to: e.target.value }));
              }}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
            />
            <Link
              href="/admin"
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
            >
              Admin Home
            </Link>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <InsightCard title="Visitors" value={formatCount(state.summary?.cards.visitors)} />
          <InsightCard title="Test Start Rate" value={formatRate(state.summary?.cards.test_start_rate)} />
          <InsightCard title="Survey Completion" value={formatRate(state.summary?.cards.survey_completion_rate)} />
          <InsightCard title="Result View Rate" value={formatRate(state.summary?.cards.result_view_rate)} />
          <InsightCard title="Result -> Execution" value={formatRate(state.summary?.cards.result_to_execution_rate)} />
          <InsightCard title="Checkout Success" value={formatRate(state.summary?.cards.checkout_success_rate)} />
          <InsightCard title="Session Create" value={formatRate(state.summary?.cards.session_create_rate)} />
          <InsightCard title="First Session Complete" value={formatRate(state.summary?.cards.first_session_completion_rate)} />
          <InsightCard title="D1 Return" value={formatRate(state.summary?.cards.d1_return_rate)} />
          <InsightCard title="D3 / D7 Return" value={`${formatRate(state.summary?.cards.d3_return_rate)} / ${formatRate(state.summary?.cards.d7_return_rate)}`} />
        </section>

        <div className="grid gap-6 xl:grid-cols-3">
          <FunnelSection title="Public Funnel" steps={state.publicFunnel?.steps} />
          <FunnelSection title="Execution Funnel" steps={state.executionFunnel?.steps} />
          <FunnelSection title="First Session Funnel" steps={state.firstSessionFunnel?.steps} />
        </div>

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-lg font-semibold text-slate-100">Top Drop-off</h2>
          <p className="mt-3 text-sm text-amber-300">{topDropoffLabel}</p>
          {state.summary?.top_dropoff?.funnel ? (
            <p className="mt-1 text-xs text-slate-500">Funnel: {state.summary.top_dropoff.funnel}</p>
          ) : null}
        </section>

        <div className="grid gap-6 xl:grid-cols-3">
          <FunnelSection title="Session Drop-off" steps={state.details?.session_detail.steps} />
          <FunnelSection title="Camera Refine" steps={state.details?.camera.steps} />
          <div className="space-y-6">
            <FunnelSection title="PWA Install" steps={state.details?.pwa.steps} />
            <FunnelSection title="Push Permission" steps={state.details?.push.steps} />
          </div>
        </div>

        <section className="grid gap-6 xl:grid-cols-3">
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-lg font-semibold text-slate-100">Session Detail</h2>
            <p className="mt-2 text-sm text-slate-400">
              Close before complete: {formatCount(state.details?.session_detail.close_before_complete_count)}
            </p>
            {!state.details?.session_detail.by_exercise_index.length ? (
              <p className="mt-4 text-sm text-slate-500">No exercise index detail yet.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-slate-400">
                    <tr>
                      <th className="px-3 py-2">Exercise</th>
                      <th className="px-3 py-2">Opened</th>
                      <th className="px-3 py-2">Logged</th>
                      <th className="px-3 py-2">Next</th>
                      <th className="px-3 py-2">Closed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.details.session_detail.by_exercise_index.map((row) => (
                      <tr key={`exercise-${row.exercise_index}`} className="border-t border-slate-800 text-slate-200">
                        <td className="px-3 py-2">{row.exercise_index}</td>
                        <td className="px-3 py-2">{formatCount(row.opened)}</td>
                        <td className="px-3 py-2">{formatCount(row.logged)}</td>
                        <td className="px-3 py-2">{formatCount(row.next_clicked)}</td>
                        <td className="px-3 py-2">{formatCount(row.closed)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-lg font-semibold text-slate-100">Camera Detail</h2>
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Step Completed</p>
                {!state.details?.camera.step_completed_by_movement.length ? (
                  <p className="mt-2 text-sm text-slate-500">No completed camera steps yet.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {state.details.camera.step_completed_by_movement.map((row) => (
                      <div key={row.movement_key} className="flex items-center justify-between text-sm text-slate-200">
                        <span>{row.movement_key}</span>
                        <span>{formatCount(row.count)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Fallback Reasons</p>
                {!state.details?.camera.fallback_reasons.length ? (
                  <p className="mt-2 text-sm text-slate-500">No fallback reasons yet.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {state.details.camera.fallback_reasons.map((row) => (
                      <div key={row.reason} className="flex items-center justify-between text-sm text-slate-200">
                        <span>{row.reason}</span>
                        <span>{formatCount(row.count)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-lg font-semibold text-slate-100">PWA / Push Detail</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-200">
              <div className="flex items-center justify-between">
                <span>PWA Prompt Accepted</span>
                <span>{formatCount(state.details?.pwa.steps.at(-1)?.count)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Push Permission Denied</span>
                <span>{formatCount(state.details?.push.denied_count)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Push Subscribe Success</span>
                <span>{formatCount(state.details?.push.steps.at(-1)?.count)}</span>
              </div>
            </div>
          </section>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">Retention</h2>
            <span className="text-xs text-slate-500">Cohort: first app_home_viewed per person</span>
          </div>
          {!state.retention?.rows.length ? (
            <p className="text-sm text-slate-500">No retention cohorts in this range.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Cohort Day</th>
                    <th className="px-3 py-2">Size</th>
                    <th className="px-3 py-2">D1</th>
                    <th className="px-3 py-2">D3</th>
                    <th className="px-3 py-2">D7</th>
                  </tr>
                </thead>
                <tbody>
                  {state.retention.rows.map((row) => (
                    <tr key={row.cohort_day} className="border-t border-slate-800 text-slate-200">
                      <td className="px-3 py-2">{row.cohort_day}</td>
                      <td className="px-3 py-2">{formatCount(row.cohort_size)}</td>
                      <td className="px-3 py-2">{formatCount(row.d1_returned)} / {formatRate(row.d1_rate)}</td>
                      <td className="px-3 py-2">{formatCount(row.d3_returned)} / {formatRate(row.d3_rate)}</td>
                      <td className="px-3 py-2">{formatCount(row.d7_returned)} / {formatRate(row.d7_rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="text-lg font-semibold text-slate-100">Recent Raw Events</h2>
            <input
              type="text"
              placeholder="Filter by event name"
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500"
            />
          </div>
          {!state.rawEvents?.events.length ? (
            <p className="text-sm text-slate-500">No events in this range.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Time</th>
                    <th className="px-3 py-2">Event</th>
                    <th className="px-3 py-2">Source</th>
                    <th className="px-3 py-2">Route</th>
                    <th className="px-3 py-2">Anon</th>
                    <th className="px-3 py-2">User</th>
                    <th className="px-3 py-2">Props</th>
                  </tr>
                </thead>
                <tbody>
                  {state.rawEvents.events.map((event) => (
                    <tr key={event.id} className="border-t border-slate-800 text-slate-200">
                      <td className="px-3 py-2 whitespace-nowrap">{new Date(event.created_at).toLocaleString('ko-KR')}</td>
                      <td className="px-3 py-2">{event.event_name}</td>
                      <td className="px-3 py-2">{event.source}</td>
                      <td className="px-3 py-2">{event.route_path ?? event.route_group ?? '-'}</td>
                      <td className="px-3 py-2">{event.anon_id_preview ?? '-'}</td>
                      <td className="px-3 py-2">{event.user_id_preview ?? '-'}</td>
                      <td className="px-3 py-2">
                        <code className="text-xs text-slate-400">
                          {JSON.stringify(event.props_preview)}
                        </code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {loading && (
          <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-400">
            Loading KPI data...
          </div>
        )}
      </div>
    </div>
  );
}
