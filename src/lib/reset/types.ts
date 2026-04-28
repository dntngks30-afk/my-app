/**
 * PR-RESET-BE-01 — Reset tab catalog SSOT types.
 *
 * SSOT 문서 참고: docs/ssot/RESET_TAB_2026_04.md / PR-RESET-00
 *
 * **`issue_key`는 PR-RESET-00 및 RESET_TAB_2026_04에서 사용자 이슈를 식별하는 `reset_key` 개념과 동일한 식별자 집합(10종)**이다.
 * 이름만 코드에서 `issue_key`로 통일했다.
 */

export type ResetRegion =
  | 'neck'
  | 'shoulder'
  | 'thoracic'
  | 'lumbar'
  | 'hip'
  | 'glute'
  | 'knee'
  | 'hamstring'
  | 'quad'
  | 'lat'
  | 'pelvis';

/** 후속 BE-02 또는 ViewModel에서 `template_id` 기준 파생 가능. 카탈로그 행에는 저장하지 않음. */
export type ResetMediaStatus = 'ready' | 'unmapped';

export type ResetStretchDefinition = {
  stretch_key: string;
  name_ko: string;
  name_en: string;
  asset_slug: string;
  target_body_parts: string[];
  primary_regions: ResetRegion[];
  duration_sec: number;
  template_id: string | null;
};

export type ResetIssueDefinition = {
  issue_key: string;
  issue_label: string;
  short_goal: string;

  card_title: string;
  card_summary: string;

  primary_stretch_key: string;
  /** 정확히 2개( primary와 중복 없음은 스모크로 검증). */
  alternative_stretch_keys: [string, string];

  recommended_for: {
    primary_types: string[];
    priority_axes: string[];
  };

  safety_note?: string | null;
};
