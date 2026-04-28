/**
 * PR-RESET-BE-01 — 10 issue catalog (SSOT code).
 * issue_key ↔ stretch_key 참조 무결성은 reset-catalog-contract-smoke.mjs로 검증한다.
 */
import type { ResetIssueDefinition } from '@/lib/reset/types';

export const RESET_ISSUE_CATALOG: readonly ResetIssueDefinition[] = [
  {
    issue_key: 'forward_head',
    issue_label: '거북목',
    short_goal: '목 앞쪽 리셋',
    card_title: '거북목이 신경 쓰인다면',
    card_summary: '목 앞쪽 긴장과 등 상부 굳음을 먼저 풀어보세요.',
    primary_stretch_key: 'sternocleidomastoid_stretch',
    alternative_stretch_keys: [
      'levator_scapulae_upper_trap_stretch',
      'longitudinal_foam_roller_chest_opener',
    ] as [string, string],
    recommended_for: {
      primary_types: ['UPPER_IMMOBILITY'],
      priority_axes: ['upper_mobility'],
    },
  },
  {
    issue_key: 'rounded_shoulder',
    issue_label: '라운드숄더',
    short_goal: '가슴·흉곽 열기',
    card_title: '어깨가 앞으로 말리는 느낌이 있다면',
    card_summary: '가슴과 흉곽을 열어 상체 앞쪽 긴장을 줄여보세요.',
    primary_stretch_key: 'longitudinal_foam_roller_chest_opener',
    alternative_stretch_keys: ['foam_roller_lat_stretch', 'levator_scapulae_upper_trap_stretch'] as [
      string,
      string,
    ],
    recommended_for: {
      primary_types: ['UPPER_IMMOBILITY'],
      priority_axes: ['upper_mobility'],
    },
  },
  {
    issue_key: 'thoracic_stiffness',
    issue_label: '등이 뻣뻣함',
    short_goal: '척추 움직임 리셋',
    card_title: '등이 뻣뻣하게 굳은 느낌이라면',
    card_summary: '굳은 등과 갈비뼈 주변을 부드럽게 움직여보세요.',
    primary_stretch_key: 'cat_cow_spine_stretch',
    alternative_stretch_keys: [
      'foam_roller_lat_stretch',
      'longitudinal_foam_roller_chest_opener',
    ] as [string, string],
    recommended_for: {
      primary_types: ['UPPER_IMMOBILITY', 'CORE_CONTROL_DEFICIT'],
      priority_axes: ['upper_mobility', 'trunk_control'],
    },
  },
  {
    issue_key: 'low_back_tightness',
    issue_label: '허리 뻐근함',
    short_goal: '골반·허리 이완',
    card_title: '허리가 뻐근하게 느껴진다면',
    card_summary: '허리만 늘리기보다 골반 앞뒤 긴장을 함께 풀어보세요.',
    primary_stretch_key: 'cat_cow_spine_stretch',
    alternative_stretch_keys: ['quadriceps_stretch', 'hamstring_stretch'] as [string, string],
    recommended_for: {
      primary_types: ['CORE_CONTROL_DEFICIT', 'LOWER_MOBILITY_RESTRICTION'],
      priority_axes: ['trunk_control', 'lower_mobility'],
    },
  },
  {
    issue_key: 'hip_tightness',
    issue_label: '고관절 답답함',
    short_goal: '고관절 주변 이완',
    card_title: '고관절이 답답하게 느껴진다면',
    card_summary: '엉덩이와 고관절 주변 긴장을 먼저 풀어보세요.',
    primary_stretch_key: 'seated_piriformis_stretch',
    alternative_stretch_keys: ['gluteus_maximus_stretch', 'quadriceps_stretch'] as [string, string],
    recommended_for: {
      primary_types: ['LOWER_MOBILITY_RESTRICTION', 'LOWER_INSTABILITY'],
      priority_axes: ['lower_mobility', 'lower_stability'],
    },
  },
  {
    issue_key: 'deep_glute_tightness',
    issue_label: '엉덩이 깊은 뻐근함',
    short_goal: '둔부 깊은 긴장 완화',
    card_title: '엉덩이 깊은 곳이 뻐근하다면',
    card_summary: '이상근과 둔부 깊은 긴장을 편안하게 줄여보세요.',
    primary_stretch_key: 'supine_piriformis_stretch',
    alternative_stretch_keys: ['seated_piriformis_stretch', 'gluteus_maximus_stretch'] as [string, string],
    recommended_for: {
      primary_types: ['LOWER_MOBILITY_RESTRICTION', 'CORE_CONTROL_DEFICIT'],
      priority_axes: ['lower_mobility', 'asymmetry'],
    },
  },
  {
    issue_key: 'knee_discomfort',
    issue_label: '무릎 불편감',
    short_goal: '허벅지 긴장 완화',
    card_title: '무릎 주변이 불편하다면',
    card_summary: '앞뒤 허벅지와 엉덩이 긴장을 가볍게 줄여보세요.',
    primary_stretch_key: 'quadriceps_stretch',
    alternative_stretch_keys: ['hamstring_stretch', 'gluteus_maximus_stretch'] as [string, string],
    recommended_for: {
      primary_types: ['LOWER_INSTABILITY', 'LOWER_MOBILITY_RESTRICTION'],
      priority_axes: ['lower_stability', 'lower_mobility'],
    },
  },
  {
    issue_key: 'neck_shoulder_tightness',
    issue_label: '목·어깨 뻐근함',
    short_goal: '목 뒤쪽 긴장 완화',
    card_title: '목과 어깨가 뻐근하다면',
    card_summary: '견갑거근과 상부 승모근 긴장을 먼저 풀어보세요.',
    primary_stretch_key: 'levator_scapulae_upper_trap_stretch',
    alternative_stretch_keys: ['sternocleidomastoid_stretch', 'longitudinal_foam_roller_chest_opener'] as [
      string,
      string,
    ],
    recommended_for: {
      primary_types: ['UPPER_IMMOBILITY'],
      priority_axes: ['upper_mobility'],
    },
  },
  {
    issue_key: 'shoulder_armpit_tightness',
    issue_label: '어깨·겨드랑이 답답함',
    short_goal: '광배근·겨드랑이 라인 이완',
    card_title: '어깨와 겨드랑이 라인이 답답하다면',
    card_summary: '광배근과 흉곽 측면 긴장을 부드럽게 풀어보세요.',
    primary_stretch_key: 'foam_roller_lat_stretch',
    alternative_stretch_keys: [
      'longitudinal_foam_roller_chest_opener',
      'levator_scapulae_upper_trap_stretch',
    ] as [string, string],
    recommended_for: {
      primary_types: ['UPPER_IMMOBILITY'],
      priority_axes: ['upper_mobility'],
    },
  },
  {
    issue_key: 'pelvis_lowback_tension',
    issue_label: '골반-허리 긴장',
    short_goal: '골반 주변 리셋',
    card_title: '골반과 허리 사이가 긴장된다면',
    card_summary: '척추 움직임과 둔부 긴장을 함께 정리해보세요.',
    primary_stretch_key: 'cat_cow_spine_stretch',
    alternative_stretch_keys: ['gluteus_maximus_stretch', 'supine_piriformis_stretch'] as [string, string],
    recommended_for: {
      primary_types: ['CORE_CONTROL_DEFICIT', 'LOWER_MOBILITY_RESTRICTION'],
      priority_axes: ['trunk_control', 'lower_mobility'],
    },
  },
];
