/**
 * Admin KPI 대시보드(/admin/kpi) 전용 한국어 라벨·설명 사전.
 * 집계 로직·API·이벤트 정의와 무관한 표시 문자열만 담습니다.
 */

export type AdminKpiSummaryMetricDef = {
  label: string;
  description: string;
  /** 카드 하단 보조 문구 (예: 재방문율 가중치 설명) */
  subtitle?: string;
};

/** 요약 카드 — API cards 필드 키와 1:1 */
export const ADMIN_KPI_SUMMARY_METRICS: Record<string, AdminKpiSummaryMetricDef> = {
  visitors: {
    label: '방문자 수',
    description: '선택한 기간 동안 MOVE RE에 들어온 고유 사용자 수입니다.',
  },
  test_start_rate: {
    label: '테스트 시작률',
    description: '방문자 중 테스트 시작 버튼을 누른 비율입니다.',
  },
  survey_completion_rate: {
    label: '설문 완료율',
    description: '설문을 시작한 사람 중 마지막 문항까지 완료한 비율입니다.',
  },
  result_view_rate: {
    label: '결과 확인율',
    description: '설문을 완료한 사람 중 결과 화면을 확인한 비율입니다.',
  },
  result_to_execution_rate: {
    label: '결과 후 실행 클릭률',
    description: '결과를 본 사람 중 실행 시작 버튼을 누른 비율입니다.',
  },
  checkout_success_rate: {
    label: '결제 완료율',
    description: '실행을 시작한 사람 중 결제 완료까지 도달한 비율입니다.',
  },
  onboarding_completion_rate: {
    label: '실행 설정 완료율',
    description: '결제 완료 후 첫 세션 실행 설정을 완료한 비율입니다.',
  },
  session_create_rate: {
    label: '첫 세션 생성률',
    description: '분석 결과가 계정에 연결된 뒤 첫 리셋맵 세션이 생성된 비율입니다.',
  },
  first_session_completion_rate: {
    label: '첫 세션 완료율',
    description: '첫 세션이 생성된 사람 중 실제로 세션을 완료한 비율입니다.',
  },
  d1_return_rate: {
    label: '1일 재방문율',
    description: '앱에 진입한 뒤 다음 날 다시 돌아온 사용자 비율입니다.',
    subtitle: '적격 코호트 가중 평균',
  },
  d3_d7_return_rate: {
    label: '3일 / 7일 재방문율',
    description:
      '앱에 진입한 뒤 3일 차에 다시 돌아온 비율과, 7일 차에 다시 돌아온 비율을 함께 표시합니다.',
    subtitle: '적격 코호트 가중 평균',
  },
};

/** 섹션 제목 */
export const ADMIN_KPI_SECTION_TITLES = {
  pageTitle: 'KPI 대시보드',
  pageSubtitle: '파일럿 퍼널 지표',
  coreSummary: '핵심 요약',
  publicFunnel: '테스트 퍼널',
  executionFunnel: '실행 전환 퍼널',
  firstSessionFunnel: '첫 세션 퍼널',
  topDropoff: '가장 큰 이탈 구간',
  sessionDropoff: '세션 이탈 진단',
  cameraRefine: '카메라 분석 진단',
  pwaInstall: 'PWA 설치',
  pushPermission: '알림 권한',
  sessionDetailTable: '세션 상세',
  cameraDetail: '카메라 상세',
  pwaPushDetail: 'PWA / 알림 상세',
  retention: '재방문율',
  rawEvents: '최근 이벤트 로그',
  dataMeta: 'Admin — 데이터 메타',
  helpGlossary: '용어 안내',
} as const;

/** 퍼널·상세 단계(event_name) 한국어 표시명 */
export const ADMIN_KPI_FUNNEL_STEP_LABELS_KO: Record<string, string> = {
  landing_viewed: '방문',
  public_cta_clicked: '테스트 시작 클릭',
  survey_started: '설문 시작',
  survey_completed: '설문 완료',
  result_viewed: '결과 확인',
  execution_cta_clicked: '실행 시작 클릭',
  auth_success: '로그인/회원가입 완료',
  checkout_success: '결제 완료',
  onboarding_completed: '실행 설정 완료',
  public_result_claim_success: '분석 결과 연결',
  session_create_success: '첫 세션 생성',
  app_home_viewed: '앱 홈 진입',
  reset_map_opened: '리셋맵 확인',
  session_panel_opened: '세션 패널 열기',
  exercise_player_opened: '운동 시작',
  session_complete_success: '세션 완료',
  exercise_logged: '운동 기록',
  exercise_next_clicked: '다음 운동 클릭',
  exercise_player_closed: '플레이어 닫기',
  session_complete_clicked: '세션 완료 클릭',
  camera_flow_started: '카메라 흐름 시작',
  camera_setup_viewed: '설정 화면',
  camera_step_started: '동작 단계 시작',
  camera_step_completed: '동작 단계 완료',
  camera_refine_completed: '카메라 분석 완료',
  camera_refine_failed_or_fallback: '카메라 분석 실패/대체',
  pwa_install_card_shown: '설치 카드 노출',
  pwa_install_cta_clicked: '설치 안내 클릭',
  pwa_install_prompt_accepted: '설치 프롬프트 수락',
  pwa_install_dismissed: '설치 안내 닫기',
  pwa_install_prompt_dismissed: '프롬프트 거절',
  push_card_shown: '알림 카드 노출',
  push_permission_requested: '권한 요청',
  push_permission_granted: '권한 허용',
  push_permission_denied: '권한 거절',
  push_subscribe_success: '구독 저장 성공',
  push_subscribe_failed: '구독 저장 실패',
};

/** 상세 블록 상단 설명 */
export const ADMIN_KPI_DETAIL_SECTION_EXPLANATIONS: Record<string, string> = {
  sessionDropoff:
    '세션을 시작한 사용자가 운동 플레이어, 기록, 완료 단계 중 어디에서 멈추는지 확인합니다.',
  cameraRefine:
    '카메라 분석을 선택한 사용자가 설정, 동작 진행, 완료 또는 fallback 중 어디에서 이탈하는지 확인합니다.',
  pwaInstall:
    '앱 설치 안내가 얼마나 노출되고, 사용자가 설치 안내를 얼마나 클릭하거나 수락했는지 확인합니다.',
  pushPermission:
    '알림 권한 카드 노출부터 권한 요청, 허용, 구독 저장까지의 흐름을 확인합니다.',
  retention:
    '사용자가 앱에 다시 돌아오는지를 D1/D3/D7 기준으로 확인합니다. 집계 대기는 아직 해당 날짜가 지나지 않았다는 뜻입니다.',
  rawEvents:
    '최근 저장된 분석 이벤트입니다. 문제 추적용이며, 실제 KPI 판단은 위의 요약과 퍼널을 우선 확인합니다.',
};

/** 혼동 방지용 짧은 도움말 */
export const ADMIN_KPI_HELP_TEXTS = {
  pending:
    '집계 대기: 아직 D1/D3/D7 판단일이 지나지 않은 코호트입니다. 0%가 아니라 아직 평가 전입니다.',
  weightedCohort:
    '적격 코호트 가중 평균: 재방문율을 계산할 수 있는 날짜가 지난 사용자 묶음만 합산해 계산합니다.',
  eventCount:
    '이벤트 건수 기준: 일부 세부 표는 사용자 수가 아니라 발생한 이벤트 횟수 기준입니다.',
} as const;

/** 원시 이벤트 테이블 컬럼 */
export const ADMIN_KPI_RAW_EVENTS_COLUMNS = {
  time: '시간',
  eventName: '이벤트 이름',
  source: '출처',
  route: '경로',
  user: '사용자',
  props: '속성',
} as const;

/** 퍼널 행 보조 라벨 */
export const ADMIN_KPI_FUNNEL_FOOTER = {
  distinctPersonKey: '사람 기준 고유 수(person_key)',
  fromStart: '시작 대비',
  dropoff: '이탈',
  funnelAxis: '퍼널',
  noData: '이 구간에 데이터가 없습니다.',
} as const;
