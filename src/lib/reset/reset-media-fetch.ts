/**
 * PR-RESET-BE-03 — 템플릿 조회 및 buildMediaPayload 경로(route 전용).
 */
import { buildMediaPayload } from '@/lib/media/media-payload';
import { getTemplatesForMediaByIds } from '@/lib/workout-routine/exercise-templates-db';
import {
  buildDisplayFromSelection,
  buildPlaceholderResetMediaResponse,
  NOTES_MISSING_MEDIA,
} from '@/lib/reset/reset-media-core';
import type { ResetMediaResolvedSelection, ResetMediaResponse } from '@/lib/reset/types';

export async function buildResetMediaResponseForSelection(
  selection: ResetMediaResolvedSelection
): Promise<ResetMediaResponse> {
  const tid = selection.stretchDef.template_id;

  if (tid == null) {
    return buildPlaceholderResetMediaResponse(
      selection,
      'placeholder_unmapped',
      null
    );
  }

  const rows = await getTemplatesForMediaByIds([tid]);
  if (rows.length === 0) {
    return buildPlaceholderResetMediaResponse(
      selection,
      'placeholder_missing_template',
      tid
    );
  }

  const row = rows[0];
  const display = buildDisplayFromSelection(selection);

  if (row.media_ref === null || row.media_ref === undefined) {
    return {
      ...(selection.issue_key ? { issue_key: selection.issue_key } : {}),
      stretch_key: selection.stretch_key,
      template_id: row.id,
      media: {
        kind: 'placeholder',
        autoplayAllowed: false,
        notes: [...NOTES_MISSING_MEDIA],
      },
      display,
      meta: { source: 'placeholder_missing_media' },
    };
  }

  const payload = await buildMediaPayload(
    row.media_ref,
    typeof row.duration_sec === 'number' ? row.duration_sec : undefined
  );

  if (payload.kind === 'placeholder') {
    return {
      ...(selection.issue_key ? { issue_key: selection.issue_key } : {}),
      stretch_key: selection.stretch_key,
      template_id: row.id,
      media: payload,
      display,
      meta: { source: 'placeholder_missing_media' },
    };
  }

  return {
    ...(selection.issue_key ? { issue_key: selection.issue_key } : {}),
    stretch_key: selection.stretch_key,
    template_id: row.id,
    media: payload,
    display,
    meta: { source: 'mapped_template' },
  };
}
