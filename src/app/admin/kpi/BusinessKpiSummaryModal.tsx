'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSessionSafe } from '@/lib/supabase';
import type {
  KpiFunnelResponse,
  KpiRetentionResponse,
  KpiSummaryResponse,
} from '@/lib/analytics/admin-kpi-types';
import { ADMIN_KPI_AUTH_INTENT } from '@/lib/auth/authHandoffContract';
import {
  buildBusinessKpiSummary,
  type BusinessKpiMetric,
  type BusinessKpiStatus,
  type BusinessKpiSummaryViewModel,
} from './business-kpi-summary';

const PILOT_START_DAY = '2026-05-01';

type BusinessKpiSummaryModalProps = {
  open: boolean;
  onClose: () => void;
};

function getKstDayString(date: Date): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
  }).format(date);
}

function buildQuery(params: Record<string, string | number | null | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === '') continue;
    query.set(key, String(value));
  }
  return query.toString();
}

function formatCount(value: number | null | undefined) {
  return new Intl.NumberFormat('ko-KR').format(value ?? 0);
}

function formatRate(value: number | null | undefined) {
  if (value == null) return '집계 대기';
  return `${value.toFixed(1)}%`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '대기';
  return new Date(value).toLocaleString('ko-KR');
}

function statusClassName(status: BusinessKpiStatus) {
  if (status === 'green') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
  if (status === 'yellow') return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
  if (status === 'red') return 'border-red-500/30 bg-red-500/10 text-red-200';
  return 'border-slate-700 bg-slate-800 text-slate-300';
}

function statusLabel(status: BusinessKpiStatus) {
  if (status === 'green') return '양호';
  if (status === 'yellow') return '관찰';
  if (status === 'red') return '주의';
  return '대기';
}

function sampleBandLabel(sampleBand: BusinessKpiSummaryViewModel['sample']['sampleBand']) {
  if (sampleBand === 'too_low') return '표본 부족';
  if (sampleBand === 'directional') return '방향성 참고';
  return '판단 가능';
}

function metricRatio(metric: BusinessKpiMetric) {
  if (metric.denominator == null) {
    return metric.numerator == null ? '-' : `${formatCount(metric.numerator)}명`;
  }
  return `${formatCount(metric.numerator)} / ${formatCount(metric.denominator)}명`;
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error('business_kpi_fetch_failed');
  }
  return res.json() as Promise<T>;
}

async function loadBusinessKpiSummary(): Promise<BusinessKpiSummaryViewModel> {
  const { session, error: sessionError } = await getSessionSafe();
  if (sessionError || !session?.access_token) {
    throw new Error('admin_auth_required');
  }

  const to = getKstDayString(new Date());
  const baseParams = { from: PILOT_START_DAY, to, tz: 'Asia/Seoul' };
  const authHeader = { Authorization: `Bearer ${session.access_token}` };

  const [summaryRes, publicRes, executionRes, firstSessionRes, retentionRes] = await Promise.all([
    fetch(`/api/admin/kpi/summary?${buildQuery(baseParams)}`, { headers: authHeader, cache: 'no-store' }),
    fetch(`/api/admin/kpi/funnel?${buildQuery({ ...baseParams, funnel: 'public' })}`, { headers: authHeader, cache: 'no-store' }),
    fetch(`/api/admin/kpi/funnel?${buildQuery({ ...baseParams, funnel: 'execution' })}`, { headers: authHeader, cache: 'no-store' }),
    fetch(`/api/admin/kpi/funnel?${buildQuery({ ...baseParams, funnel: 'first_session' })}`, { headers: authHeader, cache: 'no-store' }),
    fetch(`/api/admin/kpi/retention?${buildQuery({ ...baseParams, cohort: 'app_home' })}`, { headers: authHeader, cache: 'no-store' }),
  ]);

  if ([summaryRes, publicRes, executionRes, firstSessionRes].some((res) => res.status === 401 || res.status === 403)) {
    throw new Error('admin_auth_required');
  }

  const [summary, publicFunnel, executionFunnel, firstSessionFunnel] = await Promise.all([
    parseJson<KpiSummaryResponse>(summaryRes),
    parseJson<KpiFunnelResponse>(publicRes),
    parseJson<KpiFunnelResponse>(executionRes),
    parseJson<KpiFunnelResponse>(firstSessionRes),
  ]);

  let retentionUnavailable = false;
  if (retentionRes.ok) {
    await retentionRes.json() as KpiRetentionResponse;
  } else {
    retentionUnavailable = true;
  }

  return buildBusinessKpiSummary({
    summary,
    publicFunnel,
    executionFunnel,
    firstSessionFunnel,
    from: PILOT_START_DAY,
    to,
    refreshedAt: new Date().toISOString(),
    retentionUnavailable,
  });
}

function AxisCard({ card }: { card: BusinessKpiSummaryViewModel['axisCards'][number] }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-slate-100">{card.title}</p>
        <span className={`rounded-full border px-2 py-0.5 text-xs ${statusClassName(card.status)}`}>
          {statusLabel(card.status)}
        </span>
      </div>
      <p className="mt-3 text-sm leading-snug text-slate-400">{card.headline}</p>
    </div>
  );
}

function MetricRow({ metric }: { metric: BusinessKpiMetric }) {
  return (
    <div className="grid gap-3 border-b border-slate-800/80 py-4 last:border-0 md:grid-cols-[1.1fr_0.8fr_0.7fr_1.4fr] md:items-start">
      <div>
        <p className="text-sm font-semibold text-slate-100">{metric.label}</p>
        <p className="mt-1 text-xs leading-snug text-slate-500">{metric.interpretation}</p>
      </div>
      <div>
        <p className="text-xl font-semibold text-slate-100">{metric.displayValue}</p>
        <p className="mt-1 text-xs text-slate-500">{metricRatio(metric)}</p>
      </div>
      <div>
        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${statusClassName(metric.status)}`}>
          {statusLabel(metric.status)}
        </span>
      </div>
      <p className="text-xs leading-snug text-slate-500">{metric.thresholdNote}</p>
    </div>
  );
}

export default function BusinessKpiSummaryModal({ open, onClose }: BusinessKpiSummaryModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewModel, setViewModel] = useState<BusinessKpiSummaryViewModel | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const next = await loadBusinessKpiSummary();
      setViewModel(next);
    } catch (err) {
      if (err instanceof Error && err.message === 'admin_auth_required') {
        router.push(
          `/app/auth?next=${encodeURIComponent('/admin/kpi')}&intent=${encodeURIComponent(ADMIN_KPI_AUTH_INTENT)}`,
        );
        return;
      }
      setError('핵심 KPI 요약을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (open) {
      void refresh();
    }
  }, [open, refresh]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-sm md:p-6">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 bg-slate-900 px-5 py-4 md:px-6">
          <div>
            <h2 className="text-xl font-bold text-slate-100">핵심 KPI 요약</h2>
            <p className="mt-1 text-sm text-slate-400">파일럿 시작일 이후 누적</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              <span>
                범위: {viewModel?.from ?? PILOT_START_DAY} ~ {viewModel?.to ?? getKstDayString(new Date())}
              </span>
              <span>마지막 갱신: {formatDateTime(viewModel?.refreshedAt)}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
            aria-label="핵심 KPI 요약 닫기"
          >
            닫기
          </button>
        </div>

        <div className="max-h-[calc(92vh-96px)] overflow-y-auto px-5 py-5 md:px-6">
          {loading && !viewModel ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-8 text-center text-sm text-slate-400">
              최신 누적 KPI를 불러오는 중...
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-red-800 bg-red-950/40 px-4 py-5">
              <p className="text-sm text-red-200">{error}</p>
              <button
                type="button"
                onClick={() => void refresh()}
                className="mt-3 rounded-lg bg-red-500 px-3 py-2 text-sm font-medium text-white hover:bg-red-400"
              >
                재시도
              </button>
            </div>
          ) : null}

          {viewModel ? (
            <div className="space-y-5">
              <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${statusClassName(viewModel.verdict.code === 'INSUFFICIENT_SAMPLE' ? 'gray' : viewModel.verdict.code === 'GO_CONTINUE' ? 'green' : viewModel.verdict.code === 'HOLD_BUSINESS' ? 'red' : 'yellow')}`}>
                        {viewModel.verdict.label}
                      </span>
                      <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-300">
                        {sampleBandLabel(viewModel.sample.sampleBand)}
                      </span>
                    </div>
                    <p className="mt-3 text-lg font-semibold text-slate-100">{viewModel.verdict.summary}</p>
                    <ul className="mt-3 space-y-1 text-sm text-slate-400">
                      {viewModel.verdict.reasons.slice(0, 3).map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                    <p className="mt-3 text-xs text-amber-200/90">{viewModel.verdict.confidenceNote}</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-300 md:min-w-48">
                    <p className="text-xs text-slate-500">테스트 시작자</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-100">
                      {formatCount(viewModel.sample.testStartClickers)}명
                    </p>
                    <p className="mt-1 text-xs text-slate-500">30명 미만은 판단 보류</p>
                  </div>
                </div>
              </section>

              <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {viewModel.axisCards.map((card) => (
                  <AxisCard key={card.key} card={card} />
                ))}
              </section>

              <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                <div className="mb-2 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-100">핵심 지표</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      raw event 이름 대신 사업 판단용 라벨과 순차 전환 기준으로 표시합니다.
                    </p>
                  </div>
                  {loading ? <span className="text-xs text-slate-500">새로고침 중...</span> : null}
                </div>
                <div>
                  {viewModel.metrics.map((metric) => (
                    <MetricRow key={metric.key} metric={metric} />
                  ))}
                </div>
              </section>

              <section className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                  <h3 className="text-lg font-semibold text-slate-100">가장 큰 병목</h3>
                  {viewModel.topBottleneck ? (
                    <div className="mt-3 space-y-1 text-sm text-slate-300">
                      <p>
                        가장 큰 병목: <span className="font-semibold text-amber-200">{viewModel.topBottleneck.label}</span>
                      </p>
                      <p className="text-slate-500">
                        이탈 {formatCount(viewModel.topBottleneck.dropoffCount)}명
                        {' · '}
                        {formatRate(viewModel.topBottleneck.dropoffRate)}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">아직 병목을 계산할 데이터가 없습니다.</p>
                  )}
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                  <h3 className="text-lg font-semibold text-slate-100">다음 액션</h3>
                  <ul className="mt-3 space-y-2 text-sm text-slate-300">
                    {viewModel.recommendedActions.slice(0, 3).map((action) => (
                      <li key={action} className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2">
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">해석 주의</p>
                <ul className="mt-2 space-y-1 text-xs leading-snug text-slate-500">
                  {viewModel.limitations.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                {viewModel.generatedAt ? (
                  <p className="mt-2 text-xs text-slate-600">API 생성: {formatDateTime(viewModel.generatedAt)}</p>
                ) : null}
              </section>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
