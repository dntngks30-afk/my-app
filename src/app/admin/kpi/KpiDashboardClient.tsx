'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSessionSafe } from '@/lib/supabase';
import {
  ADMIN_KPI_DETAIL_SECTION_EXPLANATIONS,
  ADMIN_KPI_FUNNEL_FOOTER,
  ADMIN_KPI_FUNNEL_STEP_LABELS_KO,
  ADMIN_KPI_HELP_TEXTS,
  ADMIN_KPI_RAW_EVENTS_COLUMNS,
  ADMIN_KPI_SECTION_TITLES,
  ADMIN_KPI_SUMMARY_METRICS,
} from '@/lib/analytics/admin-kpi-labels';
import type {
  KpiDemographicsSummary,
  KpiDetailsResponse,
  KpiFunnelResponse,
  KpiRawEventsResponse,
  KpiRetentionResponse,
  KpiSummaryResponse,
} from '@/lib/analytics/admin-kpi-types';
import { ADMIN_KPI_AUTH_INTENT } from '@/lib/auth/authHandoffContract';

function funnelStepLabelKo(eventName: string, apiLabel: string): string {
  return ADMIN_KPI_FUNNEL_STEP_LABELS_KO[eventName] ?? apiLabel;
}

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

function formatDemographicsRatio(ratio: number) {
  return `${(ratio * 100).toFixed(0)}%`;
}

function dominantBucketLabel(rows: { label: string; count: number }[] | undefined): string {
  if (!rows?.length) return '-';
  const sorted = [...rows].sort((a, b) => b.count - a.count);
  return sorted[0]?.label ?? '-';
}

function DemographicsDistributionCard({
  title,
  rows,
}: {
  title: string;
  rows: { key: string; label: string; count: number; ratio: number; low_sample?: boolean }[];
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-sm font-medium text-slate-200">{title}</p>
      <ul className="mt-3 space-y-1.5 text-sm text-slate-300">
        {rows.map((r) => (
          <li key={r.key} className="flex flex-wrap justify-between gap-2 border-b border-slate-800/80 py-1 last:border-0">
            <span>
              {r.label}
              {r.low_sample ? <span className="ml-1 text-xs text-amber-400">(소표본)</span> : null}
            </span>
            <span className="text-slate-400">
              {formatCount(r.count)}명 · {formatDemographicsRatio(r.ratio)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DemographicsSection({ demographics }: { demographics: KpiDemographicsSummary | undefined }) {
  if (!demographics) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-lg font-semibold text-slate-100">인구통계(bucket)</h2>
        <p className="mt-2 text-sm text-slate-500">요약 응답에 demographics 가 없습니다.</p>
      </section>
    );
  }

  const genderRows = demographics.total?.by_gender ?? demographics.test_started?.by_gender ?? [];
  const ageRows = demographics.total?.by_age_band ?? demographics.test_started?.by_age_band ?? [];
  const acquisitionRows =
    demographics.total?.by_acquisition_source ?? demographics.test_started?.by_acquisition_source ?? [];

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">인구통계(bucket)</h2>
        <p className="mt-1 text-xs text-slate-500">
          테스트 시작(SURVEY_STARTED) distinct 사용자 기준 분포입니다. free_test_intro 프로필만 반영합니다.
          미입력·소표본 구간은 과해석에 주의하세요.
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-slate-500">
          {demographics.limitations.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      {genderRows.length === 0 && ageRows.length === 0 && acquisitionRows.length === 0 ? (
        <p className="text-sm text-slate-500">이 기간에 표시할 인구통계 bucket 이 없습니다.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <DemographicsDistributionCard title="성별 분포" rows={genderRows} />
          <DemographicsDistributionCard title="연령대 분포" rows={ageRows} />
          <DemographicsDistributionCard title="유입 경로" rows={acquisitionRows} />
        </div>
      )}

      {demographics.funnel_steps.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-sm font-medium text-slate-200">단계별 요약</p>
          <table className="mt-3 min-w-full text-left text-sm text-slate-300">
            <thead className="border-b border-slate-700 text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-4">단계</th>
                <th className="py-2 pr-4">표본 수</th>
                <th className="py-2 pr-4">최다 연령대</th>
                <th className="py-2 pr-4">최다 성별</th>
                <th className="py-2">최다 유입경로</th>
              </tr>
            </thead>
            <tbody>
              {demographics.funnel_steps.map((step) => (
                <tr key={step.step} className="border-b border-slate-800/80">
                  <td className="py-2 pr-4">{step.label_ko}</td>
                  <td className="py-2 pr-4">{formatCount(step.sample_size)}</td>
                  <td className="py-2 pr-4">{dominantBucketLabel(step.by_age_band)}</td>
                  <td className="py-2 pr-4">{dominantBucketLabel(step.by_gender)}</td>
                  <td className="py-2">{dominantBucketLabel(step.by_acquisition_source)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-amber-300">표본 수가 적은 구간은 해석에 주의하세요.</p>
        </div>
      ) : null}
    </section>
  );
}

function InsightCard({
  title,
  description,
  value,
  subtitle,
}: {
  title: string;
  description: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-sm font-medium text-slate-200">{title}</p>
      <p className="mt-1 text-xs leading-snug text-slate-500">{description}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-100">{value}</p>
      {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
    </div>
  );
}

function FunnelSection({
  title,
  explanation,
  steps,
}: {
  title: string;
  explanation?: string;
  steps: KpiFunnelResponse['steps'] | undefined;
}) {
  const maxCount = Math.max(...(steps?.map((step) => step.count) ?? [0]), 1);

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <div className="mb-4 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
          <span className="shrink-0 text-xs text-slate-500">{ADMIN_KPI_FUNNEL_FOOTER.distinctPersonKey}</span>
        </div>
        {explanation ? <p className="text-xs leading-snug text-slate-500">{explanation}</p> : null}
      </div>
      {!steps || steps.length === 0 ? (
        <p className="text-sm text-slate-500">{ADMIN_KPI_FUNNEL_FOOTER.noData}</p>
      ) : (
        <div className="space-y-4">
          {steps.map((step) => {
            const width = `${Math.max(8, (step.count / maxCount) * 100)}%`;
            const labelKo = funnelStepLabelKo(step.event_name, step.label);
            return (
              <div key={`${title}-${step.event_name}`} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-slate-200">{labelKo}</span>
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
                  <span>
                    {ADMIN_KPI_FUNNEL_FOOTER.fromStart}: {formatRate(step.conversion_from_start)}
                  </span>
                  <span>
                    {ADMIN_KPI_FUNNEL_FOOTER.dropoff}: {step.dropoff_count == null ? '-' : formatCount(step.dropoff_count)} /{' '}
                    {formatRate(step.dropoff_rate)}
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
        router.push(
          `/app/auth?next=${encodeURIComponent('/admin/kpi')}&intent=${encodeURIComponent(ADMIN_KPI_AUTH_INTENT)}`,
        );
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
        router.push(
          `/app/auth?next=${encodeURIComponent('/admin/kpi')}&intent=${encodeURIComponent(ADMIN_KPI_AUTH_INTENT)}`,
        );
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
    if (!top) return '아직 이탈 구간 진단 데이터가 없습니다.';
    const fromL = funnelStepLabelKo(top.from_event, top.from_event);
    const toL = funnelStepLabelKo(top.to_event, top.to_event);
    return `${ADMIN_KPI_SECTION_TITLES.topDropoff}: ${fromL} → ${toL}, ${formatRate(top.dropoff_rate)}`;
  }, [state.summary?.top_dropoff]);

  const sm = ADMIN_KPI_SUMMARY_METRICS;

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <p className="text-slate-300">관리자 권한 확인 중...</p>
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center">
          <p className="text-slate-300">관리자 권한이 필요합니다.</p>
          <Link
            href="/admin"
            className="mt-4 inline-block rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
          >
            어드민 홈
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
            <h1 className="text-3xl font-bold text-slate-100">{ADMIN_KPI_SECTION_TITLES.pageTitle}</h1>
            <p className="mt-2 text-sm text-slate-400">{ADMIN_KPI_SECTION_TITLES.pageSubtitle}</p>
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
              어드민 홈
            </Link>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-100">{ADMIN_KPI_SECTION_TITLES.coreSummary}</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <InsightCard
              title={sm.visitors.label}
              description={sm.visitors.description}
              value={formatCount(state.summary?.cards.visitors)}
            />
            <InsightCard
              title={sm.test_start_rate.label}
              description={sm.test_start_rate.description}
              value={formatRate(state.summary?.cards.test_start_rate)}
            />
            <InsightCard
              title={sm.survey_completion_rate.label}
              description={sm.survey_completion_rate.description}
              value={formatRate(state.summary?.cards.survey_completion_rate)}
            />
            <InsightCard
              title={sm.result_view_rate.label}
              description={sm.result_view_rate.description}
              value={formatRate(state.summary?.cards.result_view_rate)}
            />
            <InsightCard
              title={sm.result_to_execution_rate.label}
              description={sm.result_to_execution_rate.description}
              value={formatRate(state.summary?.cards.result_to_execution_rate)}
            />
            <InsightCard
              title={sm.checkout_success_rate.label}
              description={sm.checkout_success_rate.description}
              value={formatRate(state.summary?.cards.checkout_success_rate)}
            />
            <InsightCard
              title={sm.onboarding_completion_rate.label}
              description={sm.onboarding_completion_rate.description}
              value={formatRate(state.summary?.cards.onboarding_completion_rate)}
            />
            <InsightCard
              title={sm.session_create_rate.label}
              description={sm.session_create_rate.description}
              value={formatRate(state.summary?.cards.session_create_rate)}
            />
            <InsightCard
              title={sm.first_session_completion_rate.label}
              description={sm.first_session_completion_rate.description}
              value={formatRate(state.summary?.cards.first_session_completion_rate)}
            />
            <InsightCard
              title={sm.d1_return_rate.label}
              description={sm.d1_return_rate.description}
              value={state.summary?.cards.d1_return_rate == null ? '집계 대기' : formatRate(state.summary.cards.d1_return_rate)}
              subtitle={sm.d1_return_rate.subtitle}
            />
            <InsightCard
              title={sm.d3_d7_return_rate.label}
              description={sm.d3_d7_return_rate.description}
              value={`${state.summary?.cards.d3_return_rate == null ? '대기' : formatRate(state.summary.cards.d3_return_rate)} / ${state.summary?.cards.d7_return_rate == null ? '대기' : formatRate(state.summary.cards.d7_return_rate)}`}
              subtitle={sm.d3_d7_return_rate.subtitle}
            />
          </div>
        </section>

        <DemographicsSection demographics={state.summary?.demographics} />

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h3 className="text-sm font-semibold text-slate-200">{ADMIN_KPI_SECTION_TITLES.helpGlossary}</h3>
          <ul className="mt-2 space-y-1 text-xs leading-snug text-slate-500">
            <li>• {ADMIN_KPI_HELP_TEXTS.pending}</li>
            <li>• {ADMIN_KPI_HELP_TEXTS.weightedCohort}</li>
            <li>• {ADMIN_KPI_HELP_TEXTS.eventCount}</li>
          </ul>
        </section>

        <div className="grid gap-6 xl:grid-cols-3">
          <FunnelSection title={ADMIN_KPI_SECTION_TITLES.publicFunnel} steps={state.publicFunnel?.steps} />
          <FunnelSection title={ADMIN_KPI_SECTION_TITLES.executionFunnel} steps={state.executionFunnel?.steps} />
          <FunnelSection title={ADMIN_KPI_SECTION_TITLES.firstSessionFunnel} steps={state.firstSessionFunnel?.steps} />
        </div>

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-lg font-semibold text-slate-100">{ADMIN_KPI_SECTION_TITLES.topDropoff}</h2>
          <p className="mt-3 text-sm text-amber-300">{topDropoffLabel}</p>
          {state.summary?.top_dropoff?.funnel ? (
            <p className="mt-1 text-xs text-slate-500">
              {ADMIN_KPI_FUNNEL_FOOTER.funnelAxis}: {state.summary.top_dropoff.funnel}
            </p>
          ) : null}
        </section>

        <div className="grid gap-6 xl:grid-cols-3">
          <FunnelSection
            title={ADMIN_KPI_SECTION_TITLES.sessionDropoff}
            explanation={ADMIN_KPI_DETAIL_SECTION_EXPLANATIONS.sessionDropoff}
            steps={state.details?.session_detail.steps}
          />
          <FunnelSection
            title={ADMIN_KPI_SECTION_TITLES.cameraRefine}
            explanation={ADMIN_KPI_DETAIL_SECTION_EXPLANATIONS.cameraRefine}
            steps={state.details?.camera.steps}
          />
          <div className="space-y-6">
            <FunnelSection
              title={ADMIN_KPI_SECTION_TITLES.pwaInstall}
              explanation={ADMIN_KPI_DETAIL_SECTION_EXPLANATIONS.pwaInstall}
              steps={state.details?.pwa.steps}
            />
            <FunnelSection
              title={ADMIN_KPI_SECTION_TITLES.pushPermission}
              explanation={ADMIN_KPI_DETAIL_SECTION_EXPLANATIONS.pushPermission}
              steps={state.details?.push.steps}
            />
          </div>
        </div>

        <section className="grid gap-6 xl:grid-cols-3">
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-lg font-semibold text-slate-100">{ADMIN_KPI_SECTION_TITLES.sessionDetailTable}</h2>
            <p className="mt-2 text-sm text-slate-400">
              완료 전 닫기: {formatCount(state.details?.session_detail.close_before_complete_count)}
            </p>
            {state.details?.session_detail.metric_note ? (
              <p className="mt-1 text-xs text-slate-500">
                {state.details.session_detail.metric_note} ({ADMIN_KPI_HELP_TEXTS.eventCount})
              </p>
            ) : null}
            {!state.details?.session_detail.by_exercise_index.length ? (
              <p className="mt-4 text-sm text-slate-500">운동 index 상세 데이터가 없습니다.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-slate-400">
                    <tr>
                      <th className="px-3 py-2">운동 번호</th>
                      <th className="px-3 py-2">열림</th>
                      <th className="px-3 py-2">기록</th>
                      <th className="px-3 py-2">다음</th>
                      <th className="px-3 py-2">닫힘</th>
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
            <h2 className="text-lg font-semibold text-slate-100">{ADMIN_KPI_SECTION_TITLES.cameraDetail}</h2>
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">단계 완료</p>
                {!state.details?.camera.step_completed_by_movement.length ? (
                  <p className="mt-2 text-sm text-slate-500">완료된 카메라 단계가 없습니다.</p>
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
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">대체 사유</p>
                {!state.details?.camera.fallback_reasons.length ? (
                  <p className="mt-2 text-sm text-slate-500">대체 사유가 없습니다.</p>
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
            <h2 className="text-lg font-semibold text-slate-100">{ADMIN_KPI_SECTION_TITLES.pwaPushDetail}</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-200">
              <div className="flex items-center justify-between">
                <span>{ADMIN_KPI_FUNNEL_STEP_LABELS_KO.pwa_install_prompt_accepted ?? '설치 프롬프트 수락'}</span>
                <span>{formatCount(state.details?.pwa.steps.at(-1)?.count)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>{ADMIN_KPI_FUNNEL_STEP_LABELS_KO.push_permission_denied ?? '권한 거절'}</span>
                <span>{formatCount(state.details?.push.denied_count)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>{ADMIN_KPI_FUNNEL_STEP_LABELS_KO.push_subscribe_success ?? '구독 저장 성공'}</span>
                <span>{formatCount(state.details?.push.steps.at(-1)?.count)}</span>
              </div>
            </div>
          </section>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-4 flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-slate-100">{ADMIN_KPI_SECTION_TITLES.retention}</h2>
            <p className="text-xs leading-snug text-slate-500">{ADMIN_KPI_DETAIL_SECTION_EXPLANATIONS.retention}</p>
            <p className="text-xs text-slate-500">코호트: 사람당 첫 app_home_viewed · D1/D3/D7 = +1/+3/+7 (KST)</p>
          </div>
          {!state.retention?.rows.length ? (
            <p className="text-sm text-slate-500">선택한 기간에 재방문 코호트가 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-slate-400">
                  <tr>
                    <th className="px-3 py-2">코호트 일</th>
                    <th className="px-3 py-2">규모</th>
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
                      <td className="px-3 py-2">
                        {!row.eligible_d1
                          ? <span className="text-slate-500">대기</span>
                          : `${formatCount(row.d1_returned)} / ${formatRate(row.d1_rate)}`}
                      </td>
                      <td className="px-3 py-2">
                        {!row.eligible_d3
                          ? <span className="text-slate-500">대기</span>
                          : `${formatCount(row.d3_returned)} / ${formatRate(row.d3_rate)}`}
                      </td>
                      <td className="px-3 py-2">
                        {!row.eligible_d7
                          ? <span className="text-slate-500">대기</span>
                          : `${formatCount(row.d7_returned)} / ${formatRate(row.d7_rate)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">{ADMIN_KPI_SECTION_TITLES.rawEvents}</h2>
              <p className="mt-1 text-xs leading-snug text-slate-500">{ADMIN_KPI_DETAIL_SECTION_EXPLANATIONS.rawEvents}</p>
            </div>
            <input
              type="text"
              placeholder="이벤트 이름으로 필터"
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500"
            />
          </div>
          {!state.rawEvents?.events.length ? (
            <p className="text-sm text-slate-500">이 기간에 이벤트가 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-slate-400">
                  <tr>
                    <th className="px-3 py-2">{ADMIN_KPI_RAW_EVENTS_COLUMNS.time}</th>
                    <th className="px-3 py-2">{ADMIN_KPI_RAW_EVENTS_COLUMNS.eventName}</th>
                    <th className="px-3 py-2">{ADMIN_KPI_RAW_EVENTS_COLUMNS.source}</th>
                    <th className="px-3 py-2">{ADMIN_KPI_RAW_EVENTS_COLUMNS.route}</th>
                    <th className="px-3 py-2">{ADMIN_KPI_RAW_EVENTS_COLUMNS.user}</th>
                    <th className="px-3 py-2">{ADMIN_KPI_RAW_EVENTS_COLUMNS.props}</th>
                  </tr>
                </thead>
                <tbody>
                  {state.rawEvents.events.map((event) => {
                    const ko = ADMIN_KPI_FUNNEL_STEP_LABELS_KO[event.event_name];
                    return (
                      <tr key={event.id} className="border-t border-slate-800 text-slate-200">
                        <td className="px-3 py-2 whitespace-nowrap">{new Date(event.created_at).toLocaleString('ko-KR')}</td>
                        <td className="px-3 py-2 align-top">
                          <code className="text-xs text-slate-300">{event.event_name}</code>
                          {ko ? <div className="mt-0.5 text-xs text-slate-500">{ko}</div> : null}
                        </td>
                        <td className="px-3 py-2">{event.source}</td>
                        <td className="px-3 py-2">{event.route_path ?? event.route_group ?? '-'}</td>
                        <td className="px-3 py-2 text-xs">{event.user_id_preview ?? event.anon_id_preview ?? '-'}</td>
                        <td className="px-3 py-2">
                          <code className="text-xs text-slate-400">
                            {JSON.stringify(event.props_preview)}
                          </code>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {state.summary?.range.range_clamped && (
          <div className="rounded-xl border border-amber-800 bg-amber-950/40 px-4 py-3 text-sm text-amber-300">
            조회 범위가 최대 90일로 클램프되었습니다. 표시된 from ~ to 기준으로 집계됩니다.
          </div>
        )}

        {(state.summary?.generated_at || state.summary?.source) && (
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500 mb-2">{ADMIN_KPI_SECTION_TITLES.dataMeta}</p>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-400">
              {state.summary.generated_at && (
                <span>생성: {new Date(state.summary.generated_at).toLocaleString('ko-KR')}</span>
              )}
              {state.summary.source && (
                <span>소스: {state.summary.source}</span>
              )}
              {state.summary.range && (
                <span>범위: {state.summary.range.from} ~ {state.summary.range.to} ({state.summary.range.tz})</span>
              )}
            </div>
            {state.summary.limitations && state.summary.limitations.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
                {state.summary.limitations.map((lim) => (
                  <li key={lim}>• {lim}</li>
                ))}
              </ul>
            )}
          </section>
        )}

        {loading && (
          <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-400">
            KPI 데이터 불러오는 중...
          </div>
        )}
      </div>
    </div>
  );
}
