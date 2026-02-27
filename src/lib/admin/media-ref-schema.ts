/**
 * media_ref JSON 규격 검증 (Admin 템플릿 수정용)
 * provider=mux: playback_id 필수
 * provider=legacy: url 필수
 */

export interface MediaRefMux {
  provider: 'mux';
  playback_id: string;
  thumb?: string;
  start?: number;
  end?: number;
}

export interface MediaRefLegacy {
  provider: 'legacy';
  url: string;
}

export type MediaRefJson = MediaRefMux | MediaRefLegacy | null;

export interface MediaRefValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateMediaRef(val: unknown): MediaRefValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (val === null || val === undefined) {
    return { valid: true, errors: [], warnings: [] };
  }

  if (typeof val !== 'object' || Array.isArray(val)) {
    return { valid: false, errors: ['media_ref must be an object or null'], warnings: [] };
  }

  const obj = val as Record<string, unknown>;
  const provider = obj.provider as string | undefined;

  if (!provider || typeof provider !== 'string') {
    errors.push('provider is required and must be a string');
    return { valid: false, errors, warnings };
  }

  if (provider === 'mux') {
    const playbackId = obj.playback_id;
    if (!playbackId || typeof playbackId !== 'string' || !playbackId.trim()) {
      errors.push('provider=mux requires playback_id (non-empty string)');
    }
  } else if (provider === 'legacy') {
    const url = obj.url;
    if (!url || typeof url !== 'string' || !url.trim()) {
      errors.push('provider=legacy requires url (non-empty string)');
    } else if (!/^https?:\/\//i.test(url.trim())) {
      errors.push('legacy url must start with http:// or https://');
    }
  } else {
    errors.push(`provider must be 'mux' or 'legacy', got: ${provider}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
