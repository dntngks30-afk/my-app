/**
 * PR-RESET-BE-03 — reset media 순수 검증·해석·플레이스홀더(서버 DB 의존 없음).
 * 오프라인 스모크는 본 파일만 import한다.
 */
import { RESET_ISSUE_CATALOG } from '@/lib/reset/reset-issue-catalog';
import { RESET_STRETCH_CATALOG } from '@/lib/reset/reset-stretch-catalog';
import { getResetStretchGuide } from '@/lib/reset/reset-stretch-guide';
import { durationLabelKo } from '@/lib/reset/recommend-reset';
import type { ResetStretchDefinition } from '@/lib/reset/types';
import type {
  ResolveResetMediaSelectionResult,
  ResetMediaMetaSource,
  ResetMediaResolvedSelection,
  ResetMediaResolveInput,
  ResetMediaResponse,
  ResetMediaValidationResult,
} from '@/lib/reset/types';

export const NOTES_UNMAPPED = [
  '영상 매핑 준비 중입니다. 텍스트 가이드를 참고해 주세요.',
] as const;

export const NOTES_MISSING_TEMPLATE = [
  '템플릿 정보를 불러오지 못했습니다. 텍스트 가이드를 참고해 주세요.',
] as const;

export const NOTES_MISSING_MEDIA = [
  '재생 가능한 영상 준비가 아직 불완전합니다. 텍스트 가이드를 참고해 주세요.',
] as const;

const KNOWN_ISSUE_KEYS = new Set(RESET_ISSUE_CATALOG.map((r) => r.issue_key));
const KNOWN_STRETCH_KEYS = new Set(
  RESET_STRETCH_CATALOG.map((s) => s.stretch_key)
);

const STRETCH_BY_KEY = new Map(
  RESET_STRETCH_CATALOG.map((s) => [s.stretch_key, s])
);

function getStretchDefinition(stretch_key: string): ResetStretchDefinition {
  const def = STRETCH_BY_KEY.get(stretch_key);
  if (!def) {
    throw new Error(`stretch_key unexpectedly unknown: ${stretch_key}`);
  }
  return def;
}

export function validateResetMediaRequestBody(
  raw: unknown
): ResetMediaValidationResult {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, message: '요청 본문이 유효하지 않습니다.' };
  }

  const o = raw as Record<string, unknown>;
  const hasIssue = 'issue_key' in o && o.issue_key !== undefined;
  const hasStretch = 'stretch_key' in o && o.stretch_key !== undefined;

  if (!hasIssue && !hasStretch) {
    return { ok: false, message: 'issue_key 또는 stretch_key 중 하나는 필요합니다.' };
  }

  if (hasIssue && hasStretch) {
    return {
      ok: false,
      message: 'issue_key와 stretch_key는 동시에 보낼 수 없습니다.',
    };
  }

  if (hasIssue) {
    const ik = o.issue_key;
    if (typeof ik !== 'string' || ik.trim() === '') {
      return { ok: false, message: 'issue_key가 유효하지 않습니다.' };
    }
    if (!KNOWN_ISSUE_KEYS.has(ik)) {
      return { ok: false, message: '알 수 없는 issue_key 입니다.' };
    }
    return { ok: true, input: { issue_key: ik } };
  }

  const sk = o.stretch_key;
  if (typeof sk !== 'string' || sk.trim() === '') {
    return { ok: false, message: 'stretch_key가 유효하지 않습니다.' };
  }
  if (!KNOWN_STRETCH_KEYS.has(sk)) {
    return { ok: false, message: '알 수 없는 stretch_key 입니다.' };
  }

  return { ok: true, input: { stretch_key: sk } };
}

export function resolveResetMediaSelection(
  input: ResetMediaResolveInput
): ResolveResetMediaSelectionResult {
  try {
    if ('issue_key' in input && input.issue_key) {
      const row = RESET_ISSUE_CATALOG.find((r) => r.issue_key === input.issue_key);
      if (!row) {
        return { ok: false, message: '알 수 없는 issue_key 입니다.' };
      }
      const stretch_key = row.primary_stretch_key;
      const stretchDef = getStretchDefinition(stretch_key);
      const guide = getResetStretchGuide(stretch_key);
      if (!guide) {
        return { ok: false, message: '해당 스트레칭 가이드를 찾을 수 없습니다.' };
      }
      const selection: ResetMediaResolvedSelection = {
        issue_key: row.issue_key,
        stretch_key,
        stretchDef,
        guide,
      };
      return { ok: true, selection };
    }

    const stretch_key = input.stretch_key!;
    const stretchDef = getStretchDefinition(stretch_key);
    const guide = getResetStretchGuide(stretch_key);
    if (!guide) {
      return { ok: false, message: '해당 스트레칭 가이드를 찾을 수 없습니다.' };
    }
    const selection: ResetMediaResolvedSelection = { stretch_key, stretchDef, guide };
    return { ok: true, selection };
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof Error ? e.message : '선택값을 처리하는 중 문제가 발생했습니다.',
    };
  }
}

export function buildPlaceholderResetMediaResponse(
  selection: ResetMediaResolvedSelection,
  metaSource: ResetMediaMetaSource,
  resolvedTemplateId: string | null
): ResetMediaResponse {
  const g = selection.guide;
  const duration_label = durationLabelKo(selection.stretchDef.duration_sec);

  let notes: string[];
  if (metaSource === 'placeholder_unmapped') {
    notes = [...NOTES_UNMAPPED];
  } else if (metaSource === 'placeholder_missing_template') {
    notes = [...NOTES_MISSING_TEMPLATE];
  } else {
    notes = [...NOTES_MISSING_MEDIA];
  }

  const display = {
    title: g.title,
    description: g.description,
    how_to: [...g.how_to],
    safety_note: g.safety_note ?? null,
    duration_label,
  };

  return {
    ...(selection.issue_key ? { issue_key: selection.issue_key } : {}),
    stretch_key: selection.stretch_key,
    template_id: resolvedTemplateId,
    media: {
      kind: 'placeholder',
      autoplayAllowed: false,
      notes,
    },
    display,
    meta: { source: metaSource },
  };
}

export function buildDisplayFromSelection(
  selection: ResetMediaResolvedSelection
): ResetMediaResponse['display'] {
  const g = selection.guide;
  return {
    title: g.title,
    description: g.description,
    how_to: [...g.how_to],
    safety_note: g.safety_note ?? null,
    duration_label: durationLabelKo(selection.stretchDef.duration_sec),
  };
}
