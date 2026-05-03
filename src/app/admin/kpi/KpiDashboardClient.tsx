'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSessionSafe } from '@/lib/supabase';
import {
  ADMIN_KPI_DETAIL_SECTION_EXPLANATIONS,
  ADMIN_KPI_FUNNEL_COHORT_BASE_KO,
  ADMIN_KPI_FUNNEL_FOOTER,
  ADMIN_KPI_FUNNEL_STEP_LABELS_KO,
  ADMIN_KPI_HELP_TEXTS,
  ADMIN_KPI_RAW_EVENTS_COLUMNS,
  ADMIN_KPI_SECTION_TITLES,
  ADMIN_KPI_SUMMARY_METRICS,
} from '@/lib/analytics/admin-kpi-labels';
import type {
  KpiActivityStep,
  KpiDemographicsSummary,
  KpiDetailsResponse,
  KpiFunnelKey,
  KpiFunnelResponse,
  KpiPilotFraction,
  KpiRawEventsResponse,
  KpiRetentionResponse,
  KpiSummaryResponse,
} from '@/lib/analytics/admin-kpi-types';
import { ADMIN_KPI_AUTH_INTENT } from '@/lib/auth/authHandoffContract';
import BusinessKpiSummaryModal from './BusinessKpiSummaryModal';

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

function formatPilotFractionLine(m: KpiPilotFraction | undefined): string {
  if (!m) return '-';
  const pct = m.rate_percent == null ? '-' : formatRate(m.rate_percent);
  return `${pct}\n${formatCount(m.numerator)} / ${formatCount(m.denominator)}명`;
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

  const introSurveyStarted =
    demographics.free_test_intro.funnel_steps.find((s) => s.step === 'survey_started') ??
    demographics.free_test_intro.funnel_steps[0];
  const genderRowsIntro = introSurveyStarted?.by_gender ?? [];
  const ageRowsIntro = introSurveyStarted?.by_age_band ?? [];

  const signupAuthStep =
    demographics.signup_profile.funnel_steps.find((s) => s.step === 'auth_success') ??
    demographics.signup_profile.funnel_steps[0];
  const ageRowsSignup = signupAuthStep?.by_age_band ?? [];
  const acquisitionRowsSignup = signupAuthStep?.by_acquisition_source ?? [];

  const introHasCards =
    genderRowsIntro.some((r) => r.count > 0) || ageRowsIntro.some((r) => r.count > 0);
  const signupHasCards =
    ageRowsSignup.some((r) => r.count > 0) || acquisitionRowsSignup.some((r) => r.count > 0);

  return (
    <section className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">인구통계(bucket)</h2>
        <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-slate-500">
          {demographics.limitations.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <div>
          <h3 className="text-base font-semibold text-slate-100">무료테스트 프로필</h3>
          <p className="mt-1 text-xs text-slate-400">
            무료테스트 프로필은 테스트 시작 전 입력값 기준입니다. (나이대·성별만)
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-slate-500">
            {demographics.free_test_intro.limitations.map((line) => (
              <li key={`intro-${line}`}>{line}</li>
            ))}
          </ul>
        </div>

        {!introHasCards ? (
          <p className="text-sm text-slate-500">이 기간에 표시할 무료테스트 인구통계가 없습니다.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <DemographicsDistributionCard title="무료테스트 성별 분포" rows={genderRowsIntro} />
            <DemographicsDistributionCard title="무료테스트 나이대 분포" rows={ageRowsIntro} />
          </div>
        )}

        {demographics.free_test_intro.funnel_steps.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-sm font-medium text-slate-200">무료테스트 단계별 요약</p>
            <table className="mt-3 min-w-full text-left text-sm text-slate-300">
              <thead className="border-b border-slate-700 text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-4">단계</th>
                  <th className="py-2 pr-4">표본 수</th>
                  <th className="py-2 pr-4">최다 연령대</th>
                  <th className="py-2">최다 성별</th>
                </tr>
              </thead>
              <tbody>
                {demographics.free_test_intro.funnel_steps.map((step) => (
                  <tr key={step.step} className="border-b border-slate-800/80">
                    <td className="py-2 pr-4">{step.label_ko}</td>
                    <td className="py-2 pr-4">{formatCount(step.sample_size)}</td>
                    <td className="py-2 pr-4">{dominantBucketLabel(step.by_age_band)}</td>
                    <td className="py-2">{dominantBucketLabel(step.by_gender)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <div>
          <h3 className="text-base font-semibold text-slate-100">회원가입 프로필</h3>
          <p className="mt-1 text-xs text-slate-400">
            회원가입 프로필은 실제 가입 시 입력한 생년월일과 유입경로 기준입니다. 무료테스트 프로필과 합산하지
            않습니다.
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-slate-500">
            {demographics.signup_profile.limitations.map((line) => (
              <li key={`signup-${line}`}>{line}</li>
            ))}
          </ul>
        </div>

        {!signupHasCards ? (
          <p className="text-sm text-slate-500">이 기간에 표시할 회원가입 인구통계가 없습니다.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <DemographicsDistributionCard title="가입자 연령대" rows={ageRowsSignup} />
            <DemographicsDistributionCard title="가입 경로" rows={acquisitionRowsSignup} />
          </div>
        )}

        {demographics.signup_profile.funnel_steps.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-sm font-medium text-slate-200">회원가입 프로필 단계별 요약</p>
            <table className="mt-3 min-w-full text-left text-sm text-slate-300">
              <thead className="border-b border-slate-700 text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-4">단계</th>
                  <th className="py-2 pr-4">표본 수</th>
                  <th className="py-2 pr-4">최다 연령대</th>
                  <th className="py-2">최다 유입경로</th>
                </tr>
              </thead>
              <tbody>
                {demographics.signup_profile.funnel_steps.map((step) => (
                  <tr key={step.step} className="border-b border-slate-800/80">
                    <td className="py-2 pr-4">{step.label_ko}</td>
                    <td className="py-2 pr-4">{formatCount(step.sample_size)}</td>
                    <td className="py-2 pr-4">{dominantBucketLabel(step.by_age_band)}</td>
                    <td className="py-2">{dominantBucketLabel(step.by_acquisition_source)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <p className="text-xs text-amber-300/95">표본 수가 적은 구간은 해석에 주의하세요.</p>
      </div>
    </section>
  );
}

function InsightCard({
  title,
  description,
  value,
  subtitle,
  valueClassName,
}: {
  title: string;
  description: string;
  value: string;
  subtitle?: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-sm font-medium text-slate-200">{title}</p>
      <p className="mt-1 text-xs leading-snug text-slate-500">{description}</p>
      <p className={`mt-2 text-2xl font-semibold text-slate-100 ${valueClassName ?? ''}`}>{value}</p>
      {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
    </div>
  );
}

function CohortFunnelSection({
  funnelKey,
  title,
  response,
}: {
  funnelKey: KpiFunnelKey;
  title: string;
  response: KpiFunnelResponse | null | undefined;
}) {
  const steps = response?.cohort_steps;
  const baseCount = steps?.[0]?.base_count ?? 0;
  const maxCount = Math.max(baseCount, 1);

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <div className="mb-4 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
          <span className="shrink-0 text-xs text-slate-500">{ADMIN_KPI_FUNNEL_FOOTER.distinctPersonKey}</span>
        </div>
        <p className="text-xs font-medium text-orange-300/90">{ADMIN_KPI_FUNNEL_COHORT_BASE_KO[funnelKey]}</p>
        <p className="text-xs leading-snug text-slate-500">{ADMIN_KPI_FUNNEL_FOOTER.cohortNote}</p>
        <p className="text-xs text-slate-400">
          기준 코호트 규모:{' '}
          <span className="font-semibold text-slate-200">{formatCount(baseCount)}명</span>
          {response?.cohort_base_event_name ? (
            <span className="text-slate-500"> ({response.cohort_base_event_name})</span>
          ) : null}
        </p>
      </div>
      {!steps || steps.length === 0 ? (
        <p className="text-sm text-slate-500">{ADMIN_KPI_FUNNEL_FOOTER.noData}</p>
      ) : (
        <div className="space-y-5">
          {steps.map((step) => {
            const labelKo = funnelStepLabelKo(step.event_name, step.label);
            const width = `${Math.max(8, (step.count / maxCount) * 100)}%`;
            const prevPct =
              step.conversion_from_previous == null ? '-' : formatRate(step.conversion_from_previous);
            const dropN =
              step.dropoff_count_from_previous == null ? '-' : formatCount(step.dropoff_count_from_previous);
            return (
              <div key={`${title}-${step.event_name}`} className="space-y-2 border-b border-slate-800/60 pb-4 last:border-0 last:pb-0">
                <p className="text-sm font-medium text-slate-100">{labelKo}</p>
                <p className="text-sm text-slate-300">
                  도달 <span className="font-semibold text-white">{formatCount(step.count)}명</span>
                  {' / '}
                  기준 <span className="text-slate-200">{formatCount(step.base_count)}명</span>
                </p>
                <p className="text-xl font-semibold text-orange-300">
                  시작 대비 <span className="text-orange-200">{formatRate(step.conversion_from_start)}</span>
                </p>
                <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-orange-500" style={{ width }} />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                  <span>
                    이전 단계 대비 <span className="text-slate-200">{prevPct}</span>
                  </span>
                  <span>
                    이탈 <span className="text-slate-200">{dropN}명</span>
                    {step.dropoff_rate_from_previous != null ? (
                      <span className="text-slate-500"> ({formatRate(step.dropoff_rate_from_previous)})</span>
                    ) : null}
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

function EventActivityColumn({
  title,
  steps,
}: {
  title: string;
  steps: KpiActivityStep[] | undefined;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
      <p className="text-sm font-semibold text-slate-200">{title}</p>
      {!steps?.length ? (
        <p className="mt-3 text-sm text-slate-500">{ADMIN_KPI_FUNNEL_FOOTER.noData}</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm text-slate-300">
          {steps.map((step) => (
            <li key={`${title}-${step.event_name}`} className="flex justify-between gap-3 border-b border-slate-800/70 py-1.5 last:border-0">
              <span>{funnelStepLabelKo(step.event_name, step.label)}</span>
              <span className="shrink-0 text-slate-400">{formatCount(step.count)}명</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DetailActivitySection({
  title,
  explanation,
  steps,
}: {
  title: string;
  explanation?: string;
  steps: KpiActivityStep[] | undefined;
}) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
      <div className="mb-3 flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
        {explanation ? <p className="text-xs leading-snug text-slate-500">{explanation}</p> : null}
        <p className="text-xs text-amber-200/90">{ADMIN_KPI_HELP_TEXTS.eventActivityIndependent}</p>
      </div>
      {!steps?.length ? (
        <p className="text-sm text-slate-500">{ADMIN_KPI_FUNNEL_FOOTER.noData}</p>
      ) : (
        <ul className="space-y-2 text-sm text-slate-300">
          {steps.map((step) => (
            <li key={`${title}-${step.event_name}`} className="flex justify-between gap-3 border-b border-slate-800/70 py-2 last:border-0">
              <span>{funnelStepLabelKo(step.event_name, step.label)}</span>
              <span className="text-slate-400">{formatCount(step.count)}명</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function KpiDashboardClient() {
  const router = useRouter();
  const [range, setRange] = useState(buildRange(7));
  const [preset, setPreset] = useState<RangePreset>(7);
  const [eventFilter, setEventFilter] = useState('');
  const [pilotCodeInput, setPilotCodeInput] = useState('');
  const [pilotCodeFilter, setPilotCodeFilter] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [businessSummaryOpen, setBusinessSummaryOpen] = useState(false);
  const [state, setState] = useState<DashboardState>({
    summary: null,
    publicFunnel: null,
    executionFunnel: null,
    firstSessionFunnel: null,
    retention: null,
    rawEvents: null,
    details: null,
  });

  const loadDashboard = useCallback(async (from: string, to: string, rawEventName?: string, pilotCode?: string) => {
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
      const baseParams = {
        from,
        to,
        tz: 'Asia/Seoul',
        ...(pilotCode ? { pilot_code: pilotCode } : {}),
      };
      const [summaryRes, publicRes, executionRes, firstSessionRes, retentionRes, rawEventsRes, detailsRes] =
        await Promise.all([
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

      for (const res of [summaryRes, publicRes, executionRes, firstSessionRes, retentionRes, rawEventsRes, detailsRes]) {
        if (res.status === 400) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          if (body?.error === 'INVALID_PILOT_CODE') {
            throw new Error('유효하지 않은 파일럿 코드입니다.');
          }
          throw new Error('요청이 거절되었습니다.');
        }
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

  const applyPilotFilter = useCallback(() => {
    setPilotCodeFilter(pilotCodeInput.trim());
  }, [pilotCodeInput]);

  const resetPilotFilter = useCallback(() => {
    setPilotCodeInput('');
    setPilotCodeFilter('');
  }, []);

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
      void loadDashboard(range.from, range.to, eventFilter, pilotCodeFilter);
    }
  }, [eventFilter, pilotCodeFilter, isAdmin, loadDashboard, range.from, range.to]);

  const topDropoffLabel = useMemo(() => {
    const top = state.summary?.top_dropoff;
    if (!top) return '아직 이탈 구간 진단 데이터가 없습니다.';
    const fromL = funnelStepLabelKo(top.from_event, top.from_event);
    const toL = funnelStepLabelKo(top.to_event, top.to_event);
    const rate = top.dropoff_rate == null ? '-' : formatRate(top.dropoff_rate);
    return `${ADMIN_KPI_SECTION_TITLES.topDropoff}: ${fromL} → ${toL}, 이탈 ${formatCount(top.dropoff_count)}명 (${rate})`;
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
            <button
              type="button"
              onClick={() => setBusinessSummaryOpen(true)}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-400"
            >
              핵심 KPI 요약
            </button>
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
            {pilotCodeFilter ? (
              <span className="rounded-full border border-emerald-800 bg-emerald-950/60 px-3 py-2 text-xs font-medium text-emerald-200">
                파일럿: {pilotCodeFilter}
              </span>
            ) : null}
            <div className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">pilot_code</span>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="pilot_code"
                  value={pilotCodeInput}
                  onChange={(e) => setPilotCodeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') applyPilotFilter();
                  }}
                  className="min-w-[140px] rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500"
                  aria-label="파일럿 코드 입력"
                />
                <button
                  type="button"
                  onClick={applyPilotFilter}
                  className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
                >
                  파일럿 적용
                </button>
                <button
                  type="button"
                  onClick={resetPilotFilter}
                  className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
                >
                  초기화
                </button>
              </div>
              <p className="max-w-md text-[11px] leading-snug text-slate-500">{ADMIN_KPI_HELP_TEXTS.pilotFilterHelp}</p>
            </div>
            <Link
              href="/admin"
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
            >
              어드민 홈
            </Link>
          </div>
        </header>

        <BusinessKpiSummaryModal
          open={businessSummaryOpen}
          onClose={() => setBusinessSummaryOpen(false)}
        />

        {error && (
          <div className="rounded-xl border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-100">{ADMIN_KPI_SECTION_TITLES.coreSummary}</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <InsightCard
              title={sm.test_start_clickers.label}
              description={sm.test_start_clickers.description}
              value={`${formatCount(state.summary?.cards.test_start_clickers)}명`}
            />
            <InsightCard
              title={sm.survey_completed_vs_started.label}
              description={sm.survey_completed_vs_started.description}
              value={formatPilotFractionLine(state.summary?.cards.survey_completed_vs_started)}
              valueClassName="whitespace-pre-line text-xl leading-snug"
            />
            <InsightCard
              title={sm.result_viewed_vs_survey_completed.label}
              description={sm.result_viewed_vs_survey_completed.description}
              value={formatPilotFractionLine(state.summary?.cards.result_viewed_vs_survey_completed)}
              valueClassName="whitespace-pre-line text-xl leading-snug"
            />
            <InsightCard
              title={sm.execution_click_vs_result_viewed.label}
              description={sm.execution_click_vs_result_viewed.description}
              value={formatPilotFractionLine(state.summary?.cards.execution_click_vs_result_viewed)}
              valueClassName="whitespace-pre-line text-xl leading-snug"
            />
            <InsightCard
              title={sm.app_home_vs_execution_click.label}
              description={sm.app_home_vs_execution_click.description}
              value={formatPilotFractionLine(state.summary?.cards.app_home_vs_execution_click)}
              valueClassName="whitespace-pre-line text-xl leading-snug"
            />
            <InsightCard
              title={sm.first_session_complete_vs_created.label}
              description={sm.first_session_complete_vs_created.description}
              value={formatPilotFractionLine(state.summary?.cards.first_session_complete_vs_created)}
              valueClassName="whitespace-pre-line text-xl leading-snug"
            />
            <InsightCard
              title={sm.landing_visitors.label}
              description={sm.landing_visitors.description}
              value={`${formatCount(state.summary?.cards.landing_visitors)}명`}
            />
            <InsightCard
              title={sm.checkout_vs_execution_click.label}
              description={sm.checkout_vs_execution_click.description}
              value={formatPilotFractionLine(state.summary?.cards.checkout_vs_execution_click)}
              valueClassName="whitespace-pre-line text-xl leading-snug"
            />
            <InsightCard
              title={sm.onboarding_vs_checkout.label}
              description={sm.onboarding_vs_checkout.description}
              value={formatPilotFractionLine(state.summary?.cards.onboarding_vs_checkout)}
              valueClassName="whitespace-pre-line text-xl leading-snug"
            />
            <InsightCard
              title={sm.session_create_vs_claim.label}
              description={sm.session_create_vs_claim.description}
              value={formatPilotFractionLine(state.summary?.cards.session_create_vs_claim)}
              valueClassName="whitespace-pre-line text-xl leading-snug"
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
            <li>• {ADMIN_KPI_HELP_TEXTS.cohortSequentialFunnel}</li>
            <li>• {ADMIN_KPI_HELP_TEXTS.eventActivityIndependent}</li>
            <li>• {ADMIN_KPI_HELP_TEXTS.pending}</li>
            <li>• {ADMIN_KPI_HELP_TEXTS.weightedCohort}</li>
            <li>• {ADMIN_KPI_HELP_TEXTS.eventCount}</li>
          </ul>
        </section>

        <div className="grid gap-6 xl:grid-cols-3">
          <CohortFunnelSection
            funnelKey="public"
            title={ADMIN_KPI_SECTION_TITLES.publicFunnel}
            response={state.publicFunnel}
          />
          <CohortFunnelSection
            funnelKey="execution"
            title={ADMIN_KPI_SECTION_TITLES.executionFunnel}
            response={state.executionFunnel}
          />
          <CohortFunnelSection
            funnelKey="first_session"
            title={ADMIN_KPI_SECTION_TITLES.firstSessionFunnel}
            response={state.firstSessionFunnel}
          />
        </div>

        <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">{ADMIN_KPI_SECTION_TITLES.eventActivityOverview}</h2>
            <p className="mt-1 text-xs text-amber-200/90">{ADMIN_KPI_HELP_TEXTS.eventActivityIndependent}</p>
            <p className="mt-1 text-xs text-slate-500">
              최근 기간 내 이벤트별 고유 사용자 수입니다. 퍼널 단계와 숫자를 직접 비교하지 마세요.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <EventActivityColumn title={ADMIN_KPI_SECTION_TITLES.publicFunnel} steps={state.publicFunnel?.activity_steps} />
            <EventActivityColumn title={ADMIN_KPI_SECTION_TITLES.executionFunnel} steps={state.executionFunnel?.activity_steps} />
            <EventActivityColumn title={ADMIN_KPI_SECTION_TITLES.firstSessionFunnel} steps={state.firstSessionFunnel?.activity_steps} />
          </div>
        </section>

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
          <DetailActivitySection
            title={ADMIN_KPI_SECTION_TITLES.sessionDropoff}
            explanation={ADMIN_KPI_DETAIL_SECTION_EXPLANATIONS.sessionDropoff}
            steps={state.details?.session_detail.steps}
          />
          <DetailActivitySection
            title={ADMIN_KPI_SECTION_TITLES.cameraRefine}
            explanation={ADMIN_KPI_DETAIL_SECTION_EXPLANATIONS.cameraRefine}
            steps={state.details?.camera.steps}
          />
          <div className="space-y-6">
            <DetailActivitySection
              title={ADMIN_KPI_SECTION_TITLES.pwaInstall}
              explanation={ADMIN_KPI_DETAIL_SECTION_EXPLANATIONS.pwaInstall}
              steps={state.details?.pwa.steps}
            />
            <DetailActivitySection
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
              {state.summary.filters?.pilot_code ? (
                <span>
                  활성 파일럿 필터: {state.summary.filters.pilot_code}
                  {state.summary.filters.pilot_attribution_mode
                    ? ` (${state.summary.filters.pilot_attribution_mode})`
                    : ''}
                </span>
              ) : null}
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
