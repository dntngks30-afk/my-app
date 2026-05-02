import { ADMIN_KPI_FUNNEL_STEP_LABELS_KO } from '@/lib/analytics/admin-kpi-labels';
import type {
  KpiCohortFunnelStep,
  KpiFunnelResponse,
  KpiSummaryResponse,
} from '@/lib/analytics/admin-kpi-types';

export type BusinessKpiStatus = 'green' | 'yellow' | 'red' | 'gray';

export type BusinessKpiMetric = {
  key: string;
  axis: 'demand' | 'execution_intent' | 'first_session_quality' | 'retention_habit';
  label: string;
  valuePercent: number | null;
  displayValue: string;
  numerator: number | null;
  denominator: number | null;
  status: BusinessKpiStatus;
  interpretation: string;
  thresholdNote: string;
};

export type BusinessKpiVerdictCode =
  | 'INSUFFICIENT_SAMPLE'
  | 'GO_CONTINUE'
  | 'ITERATE_CORE_FLOW'
  | 'HOLD_BUSINESS';

export type BusinessKpiVerdict = {
  code: BusinessKpiVerdictCode;
  label: string;
  summary: string;
  reasons: string[];
  confidenceNote: string;
};

export type BusinessKpiSummaryViewModel = {
  from: string;
  to: string;
  generatedAt: string | null;
  refreshedAt: string;
  sample: {
    testStartClickers: number;
    sampleBand: 'too_low' | 'directional' | 'judgeable';
  };
  verdict: BusinessKpiVerdict;
  axisCards: Array<{
    key: string;
    title: string;
    status: BusinessKpiStatus;
    headline: string;
    supportingMetricKeys: string[];
  }>;
  metrics: BusinessKpiMetric[];
  topBottleneck: {
    label: string;
    dropoffRate: number | null;
    dropoffCount: number | null;
  } | null;
  recommendedActions: string[];
  limitations: string[];
};

type BuildBusinessKpiSummaryInput = {
  summary: KpiSummaryResponse;
  publicFunnel: KpiFunnelResponse;
  executionFunnel: KpiFunnelResponse;
  firstSessionFunnel: KpiFunnelResponse;
  from: string;
  to: string;
  refreshedAt: string;
  retentionUnavailable?: boolean;
};

function formatPercent(value: number | null): string {
  if (value == null) return '집계 대기';
  return `${value.toFixed(1)}%`;
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('ko-KR').format(value);
}

function statusForRate(value: number | null, green: number, yellow: number): BusinessKpiStatus {
  if (value == null) return 'gray';
  if (value >= green) return 'green';
  if (value >= yellow) return 'yellow';
  return 'red';
}

function sampleBandFor(count: number): 'too_low' | 'directional' | 'judgeable' {
  if (count < 30) return 'too_low';
  if (count < 100) return 'directional';
  return 'judgeable';
}

function stepByEvent(funnel: KpiFunnelResponse, eventName: string): KpiCohortFunnelStep | null {
  return funnel.cohort_steps.find((step) => step.event_name === eventName) ?? null;
}

function metricFromStep({
  key,
  axis,
  label,
  step,
  mode,
  green,
  yellow,
  interpretation,
  thresholdNote,
}: {
  key: string;
  axis: BusinessKpiMetric['axis'];
  label: string;
  step: KpiCohortFunnelStep | null;
  mode: 'previous' | 'start';
  green: number;
  yellow: number;
  interpretation: string;
  thresholdNote: string;
}): BusinessKpiMetric {
  const valuePercent = mode === 'previous'
    ? step?.conversion_from_previous ?? null
    : step?.conversion_from_start ?? null;
  const denominator = mode === 'previous'
    ? step?.previous_count ?? null
    : step?.base_count ?? null;
  const numerator = step?.count ?? null;

  return {
    key,
    axis,
    label,
    valuePercent,
    displayValue: formatPercent(valuePercent),
    numerator,
    denominator,
    status: statusForRate(valuePercent, green, yellow),
    interpretation,
    thresholdNote,
  };
}

function metricFromRate({
  key,
  axis,
  label,
  valuePercent,
  green,
  yellow,
  interpretation,
  thresholdNote,
}: {
  key: string;
  axis: BusinessKpiMetric['axis'];
  label: string;
  valuePercent: number | null;
  green: number;
  yellow: number;
  interpretation: string;
  thresholdNote: string;
}): BusinessKpiMetric {
  return {
    key,
    axis,
    label,
    valuePercent,
    displayValue: formatPercent(valuePercent),
    numerator: null,
    denominator: null,
    status: statusForRate(valuePercent, green, yellow),
    interpretation,
    thresholdNote,
  };
}

function findMetric(metrics: BusinessKpiMetric[], key: string): BusinessKpiMetric {
  const metric = metrics.find((item) => item.key === key);
  if (!metric) {
    throw new Error(`missing_business_kpi_metric:${key}`);
  }
  return metric;
}

function isGreenOrYellow(status: BusinessKpiStatus): boolean {
  return status === 'green' || status === 'yellow';
}

function mostSevereStatus(statuses: BusinessKpiStatus[]): BusinessKpiStatus {
  if (statuses.includes('red')) return 'red';
  if (statuses.includes('yellow')) return 'yellow';
  if (statuses.includes('green')) return 'green';
  return 'gray';
}

function statusHeadline(status: BusinessKpiStatus, green: string, yellow: string, red: string, gray: string): string {
  if (status === 'green') return green;
  if (status === 'yellow') return yellow;
  if (status === 'red') return red;
  return gray;
}

function eventLabel(eventName: string): string {
  return ADMIN_KPI_FUNNEL_STEP_LABELS_KO[eventName] ?? '이전 단계';
}

function bottleneckFromSummary(
  summary: KpiSummaryResponse,
  publicFunnel: KpiFunnelResponse,
  executionFunnel: KpiFunnelResponse,
  firstSessionFunnel: KpiFunnelResponse,
): BusinessKpiSummaryViewModel['topBottleneck'] {
  const top = summary.top_dropoff;
  if (top) {
    return {
      label: `${eventLabel(top.from_event)} -> ${eventLabel(top.to_event)}`,
      dropoffRate: top.dropoff_rate,
      dropoffCount: top.dropoff_count,
    };
  }

  const candidates = [publicFunnel, executionFunnel, firstSessionFunnel].flatMap((funnel) =>
    funnel.cohort_steps
      .map((step, index) => ({
        step,
        previous: index > 0 ? funnel.cohort_steps[index - 1] ?? null : null,
      }))
      .filter((item) => item.previous && item.step.dropoff_rate_from_previous != null)
  );

  candidates.sort((a, b) => {
    const byRate = (b.step.dropoff_rate_from_previous ?? -1) - (a.step.dropoff_rate_from_previous ?? -1);
    if (byRate !== 0) return byRate;
    return (b.step.dropoff_count_from_previous ?? 0) - (a.step.dropoff_count_from_previous ?? 0);
  });

  const topItem = candidates[0];
  if (!topItem?.previous) return null;

  return {
    label: `${eventLabel(topItem.previous.event_name)} -> ${eventLabel(topItem.step.event_name)}`,
    dropoffRate: topItem.step.dropoff_rate_from_previous,
    dropoffCount: topItem.step.dropoff_count_from_previous,
  };
}

function buildVerdict(metrics: BusinessKpiMetric[], sampleCount: number): BusinessKpiVerdict {
  const sampleBand = sampleBandFor(sampleCount);
  const survey = findMetric(metrics, 'survey_completion_rate');
  const result = findMetric(metrics, 'result_view_rate');
  const executionIntent = findMetric(metrics, 'execution_intent_rate');
  const firstSession = findMetric(metrics, 'first_session_completion_rate');
  const d1 = findMetric(metrics, 'd1_return_rate');
  const d7 = findMetric(metrics, 'd7_return_rate');
  const retentionOk = isGreenOrYellow(d1.status) || isGreenOrYellow(d7.status);

  if (sampleBand === 'too_low') {
    return {
      code: 'INSUFFICIENT_SAMPLE',
      label: '아직 표본 부족',
      summary: '사업화 판단을 내리기에는 표본이 부족합니다.',
      reasons: [
        `테스트 시작자가 ${formatCount(sampleCount)}명입니다.`,
        '30명 미만 구간에서는 방향성도 과하게 해석하지 않습니다.',
      ],
      confidenceNote: '표본이 쌓일 때까지 성공/실패 판단을 보류합니다.',
    };
  }

  if (
    sampleCount >= 100 &&
    isGreenOrYellow(survey.status) &&
    executionIntent.status === 'green' &&
    isGreenOrYellow(firstSession.status) &&
    retentionOk
  ) {
    return {
      code: 'GO_CONTINUE',
      label: '사업화 검증 계속',
      summary: '초기 수요와 실행 신호가 확인됩니다. 유입 확대 테스트가 가능합니다.',
      reasons: [
        '표본이 판단 가능 구간에 들어왔습니다.',
        '실행 의지와 첫 세션 신호가 기준선을 넘었습니다.',
      ],
      confidenceNote: '확정이 아니라 다음 유입 확대 실험으로 검증할 단계입니다.',
    };
  }

  if (
    sampleCount >= 100 &&
    executionIntent.status === 'red' &&
    firstSession.status === 'red' &&
    d1.status === 'red'
  ) {
    return {
      code: 'HOLD_BUSINESS',
      label: '사업화 보류',
      summary: '현재 구조로는 실행과 재방문 신호가 약합니다.',
      reasons: [
        '실행 의지, 첫 세션 완료, D1 재방문이 모두 낮습니다.',
        '유입 확대보다 핵심 흐름 재검증이 먼저입니다.',
      ],
      confidenceNote: '현재 구조 기준의 보류 판단이며, 사업화 실패를 단정하지 않습니다.',
    };
  }

  if (
    (isGreenOrYellow(survey.status) || isGreenOrYellow(result.status)) &&
    [executionIntent.status, firstSession.status, d1.status, d7.status].includes('red')
  ) {
    return {
      code: 'ITERATE_CORE_FLOW',
      label: '구조 수정 후 재검증',
      summary: '관심은 있으나 실행 또는 재방문에서 이탈이 큽니다.',
      reasons: [
        '초기 수요 신호와 실행 이후 신호 사이에 간극이 있습니다.',
        '전환 문구, 첫 세션 진입, 완료 후 다음 행동을 우선 점검하세요.',
      ],
      confidenceNote: sampleBand === 'directional'
        ? '30~99명 구간이므로 방향성 참고 수준입니다.'
        : '판단 가능 표본이지만 구조 수정 후 재측정이 필요합니다.',
    };
  }

  return {
    code: 'ITERATE_CORE_FLOW',
    label: '구조 수정 후 재검증',
    summary: '핵심 신호가 혼재되어 있어 더 좁은 병목 개선 후 다시 봐야 합니다.',
    reasons: [
      sampleBand === 'directional' ? '현재 표본은 방향성 참고 구간입니다.' : '일부 지표가 기준선에 닿지 않았습니다.',
      '가장 큰 병목과 red/yellow 지표를 먼저 줄이는 것이 안전합니다.',
    ],
    confidenceNote: sampleBand === 'directional'
      ? '사업화 가능/불가능을 단정하기에는 아직 이릅니다.'
      : '단정 대신 다음 실험의 우선순위를 정하는 판정입니다.',
  };
}

function buildAxisCards(metrics: BusinessKpiMetric[]): BusinessKpiSummaryViewModel['axisCards'] {
  const demandStatus = mostSevereStatus([
    findMetric(metrics, 'sample_size').status,
    findMetric(metrics, 'survey_completion_rate').status,
    findMetric(metrics, 'result_view_rate').status,
  ]);
  const intentStatus = mostSevereStatus([
    findMetric(metrics, 'execution_intent_rate').status,
    findMetric(metrics, 'app_home_reach_rate').status,
  ]);
  const firstSessionStatus = mostSevereStatus([
    findMetric(metrics, 'session_create_stability').status,
    findMetric(metrics, 'first_session_completion_rate').status,
  ]);
  const retentionStatus = mostSevereStatus([
    findMetric(metrics, 'd1_return_rate').status,
    findMetric(metrics, 'd7_return_rate').status,
  ]);

  return [
    {
      key: 'demand',
      title: '수요 신호',
      status: demandStatus,
      headline: statusHeadline(demandStatus, '초기 관심이 확인됩니다.', '관심은 보이나 더 봐야 합니다.', '초기 퍼널 이탈이 큽니다.', '표본 축적 중입니다.'),
      supportingMetricKeys: ['sample_size', 'survey_completion_rate', 'result_view_rate'],
    },
    {
      key: 'execution_intent',
      title: '실행 의지',
      status: intentStatus,
      headline: statusHeadline(intentStatus, '실행 CTA 이후 흐름이 좋습니다.', '실행 전환은 개선 여지가 있습니다.', '실행 시작 전 이탈이 큽니다.', '아직 판단할 데이터가 부족합니다.'),
      supportingMetricKeys: ['execution_intent_rate', 'app_home_reach_rate'],
    },
    {
      key: 'first_session_quality',
      title: '첫 세션 품질',
      status: firstSessionStatus,
      headline: statusHeadline(firstSessionStatus, '첫 세션까지 이어집니다.', '첫 세션 경험을 다듬어야 합니다.', '첫 세션 진입/완료 병목이 큽니다.', '세션 표본이 더 필요합니다.'),
      supportingMetricKeys: ['session_create_stability', 'first_session_completion_rate'],
    },
    {
      key: 'retention_habit',
      title: '재방문/습관 신호',
      status: retentionStatus,
      headline: statusHeadline(retentionStatus, '재방문 신호가 보입니다.', '재방문은 관찰 중입니다.', '재방문 신호가 약합니다.', '아직 적격 코호트 대기 중입니다.'),
      supportingMetricKeys: ['d1_return_rate', 'd7_return_rate'],
    },
  ];
}

function buildRecommendedActions(metrics: BusinessKpiMetric[]): string[] {
  const actions: string[] = [];
  const executionIntent = findMetric(metrics, 'execution_intent_rate');
  const appHome = findMetric(metrics, 'app_home_reach_rate');
  const sessionCreate = findMetric(metrics, 'session_create_stability');
  const firstSession = findMetric(metrics, 'first_session_completion_rate');
  const d1 = findMetric(metrics, 'd1_return_rate');
  const d7 = findMetric(metrics, 'd7_return_rate');

  if (executionIntent.status === 'red' || executionIntent.status === 'yellow') {
    actions.push('결과 페이지 CTA 문구와 버튼 위계를 먼저 개선하세요.');
  }
  if (appHome.status === 'red' || sessionCreate.status === 'red') {
    actions.push('실행 시작 후 앱 홈/세션 생성까지의 불안 요소와 대기 흐름을 줄이세요.');
  }
  if (firstSession.status === 'red' || firstSession.status === 'yellow') {
    actions.push('첫 세션 난이도와 시작 전 안내를 줄여 완료까지 가볍게 만드세요.');
  }
  if (d1.status === 'red' || d7.status === 'red') {
    actions.push('세션 완료 후 다음 행동 안내와 알림 루프를 강화하세요.');
  }

  return actions.slice(0, 3);
}

export function buildBusinessKpiSummary({
  summary,
  publicFunnel,
  executionFunnel,
  firstSessionFunnel,
  from,
  to,
  refreshedAt,
  retentionUnavailable,
}: BuildBusinessKpiSummaryInput): BusinessKpiSummaryViewModel {
  const sampleCount = summary.cards.test_start_clickers;
  const sampleBand = sampleBandFor(sampleCount);
  const surveyCompleted = stepByEvent(publicFunnel, 'survey_completed');
  const resultViewed = stepByEvent(publicFunnel, 'result_viewed');
  const executionClicked = stepByEvent(publicFunnel, 'execution_cta_clicked');
  const appHomeViewed = stepByEvent(executionFunnel, 'app_home_viewed');
  const sessionCreated = stepByEvent(executionFunnel, 'session_create_success');
  const firstSessionCompleted = stepByEvent(firstSessionFunnel, 'session_complete_success');

  const sampleMetric: BusinessKpiMetric = {
    key: 'sample_size',
    axis: 'demand',
    label: '테스트 시작자 수',
    valuePercent: null,
    displayValue: `${formatCount(sampleCount)}명`,
    numerator: sampleCount,
    denominator: null,
    status: sampleBand === 'too_low' ? 'gray' : sampleBand === 'directional' ? 'yellow' : 'green',
    interpretation: sampleBand === 'too_low'
      ? '사업화 판단을 내리기에는 아직 표본이 부족합니다.'
      : sampleBand === 'directional'
        ? '방향성은 볼 수 있지만 단정하기는 이릅니다.'
        : '사업화 판단에 사용할 수 있는 표본 구간입니다.',
    thresholdNote: '30명 미만 표본 부족 · 30~99명 방향성 참고 · 100명 이상 판단 가능',
  };

  const metrics: BusinessKpiMetric[] = [
    sampleMetric,
    metricFromStep({
      key: 'survey_completion_rate',
      axis: 'demand',
      label: '설문 완료율',
      step: surveyCompleted,
      mode: 'previous',
      green: 70,
      yellow: 50,
      interpretation: '테스트 시작 후 설문을 끝까지 완료하는 비율입니다.',
      thresholdNote: 'green >= 70% · yellow >= 50% · red < 50%',
    }),
    metricFromStep({
      key: 'result_view_rate',
      axis: 'demand',
      label: '결과 확인율',
      step: resultViewed,
      mode: 'previous',
      green: 85,
      yellow: 70,
      interpretation: '설문 완료 후 결과 화면까지 도달하는 비율입니다.',
      thresholdNote: 'green >= 85% · yellow >= 70% · red < 70%',
    }),
    metricFromStep({
      key: 'execution_intent_rate',
      axis: 'execution_intent',
      label: '실행 의지율',
      step: executionClicked,
      mode: 'previous',
      green: 25,
      yellow: 10,
      interpretation: '결과 확인 후 실행 시작 CTA를 누르는 비율입니다.',
      thresholdNote: 'green >= 25% · yellow >= 10% · red < 10%',
    }),
    metricFromStep({
      key: 'app_home_reach_rate',
      axis: 'execution_intent',
      label: '앱 홈 도달률',
      step: appHomeViewed,
      mode: 'start',
      green: 45,
      yellow: 25,
      interpretation: '실행 시작 클릭자 중 앱 홈까지 도달한 비율입니다.',
      thresholdNote: 'green >= 45% · yellow >= 25% · red < 25%',
    }),
    metricFromStep({
      key: 'session_create_stability',
      axis: 'first_session_quality',
      label: '세션 생성 안정성',
      step: sessionCreated,
      mode: 'previous',
      green: 80,
      yellow: 60,
      interpretation: '분석 결과 연결 후 첫 세션 생성까지 성공하는 비율입니다.',
      thresholdNote: 'green >= 80% · yellow >= 60% · red < 60%',
    }),
    metricFromStep({
      key: 'first_session_completion_rate',
      axis: 'first_session_quality',
      label: '첫 세션 완료율',
      step: firstSessionCompleted,
      mode: 'start',
      green: 45,
      yellow: 25,
      interpretation: '첫 세션 생성자 중 세션 완료까지 도달한 비율입니다.',
      thresholdNote: 'green >= 45% · yellow >= 25% · red < 25%',
    }),
    metricFromRate({
      key: 'd1_return_rate',
      axis: 'retention_habit',
      label: 'D1 재방문율',
      valuePercent: summary.cards.d1_return_rate,
      green: 25,
      yellow: 15,
      interpretation: '앱 홈 진입 후 다음 날 다시 돌아오는 비율입니다.',
      thresholdNote: 'green >= 25% · yellow >= 15% · red < 15%',
    }),
    metricFromRate({
      key: 'd7_return_rate',
      axis: 'retention_habit',
      label: 'D7 재방문율',
      valuePercent: summary.cards.d7_return_rate,
      green: 8,
      yellow: 3,
      interpretation: '앱 홈 진입 후 7일 차에 다시 돌아오는 비율입니다.',
      thresholdNote: 'green >= 8% · yellow >= 3% · red < 3%',
    }),
  ];

  const limitations = [
    '파일럿 시작일 이후 누적 범위입니다. 전체 누적 지표가 아닙니다.',
    '설문 완료율, 결과 확인율, 실행 의지율은 public funnel의 이전 단계 대비 전환율을 사용합니다.',
    'checkout_success는 파일럿/무료 실행 환경에서 왜곡될 수 있어 핵심 판정에 쓰지 않습니다.',
    ...(summary.range.range_clamped ? ['기존 KPI API range clamp가 적용되었습니다. 표시된 범위를 기준으로 해석하세요.'] : []),
    ...(retentionUnavailable ? ['retention API 조회 실패로 D1/D7은 summary 응답 기준 또는 대기 상태로 표시됩니다.'] : []),
  ];

  const recommendedActions = buildRecommendedActions(metrics);

  return {
    from,
    to,
    generatedAt: summary.generated_at ?? null,
    refreshedAt,
    sample: {
      testStartClickers: sampleCount,
      sampleBand,
    },
    verdict: buildVerdict(metrics, sampleCount),
    axisCards: buildAxisCards(metrics),
    metrics,
    topBottleneck: bottleneckFromSummary(summary, publicFunnel, executionFunnel, firstSessionFunnel),
    recommendedActions: recommendedActions.length > 0
      ? recommendedActions
      : ['현재 red/yellow 지표를 더 쌓아 병목을 좁혀 보세요.'],
    limitations,
  };
}
