/**
 * MOVE RE - Media Payload (Mux SSOT)
 *
 * media_ref (JSONB) → media_payload (클라이언트 소비)
 * Mux signed playback: 유료 사용자만 토큰 발급
 *
 * Required env for Mux: MUX_SIGNING_KEY, MUX_PRIVATE_KEY
 * Optional: MUX_TOKEN_ID, MUX_TOKEN_SECRET (API용)
 *
 * @module media/media-payload
 */

import Mux from '@mux/mux-node';

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

export type MediaRef = MediaRefMux | MediaRefLegacy | null;

export interface MediaPayload {
  kind: 'embed' | 'hls' | 'placeholder';
  provider?: 'mux' | 'youtube' | 'vimeo';
  streamUrl?: string;
  embedUrl?: string;
  posterUrl?: string;
  durationSec?: number;
  autoplayAllowed: boolean;
  notes?: string[];
}

const TOKEN_EXPIRY = '1h';

function getMuxClient(): Mux | null {
  const signingKey = process.env.MUX_SIGNING_KEY;
  const privateKey = process.env.MUX_PRIVATE_KEY;
  if (!signingKey || !privateKey) return null;

  return new Mux({
    tokenId: process.env.MUX_TOKEN_ID ?? 'dummy',
    tokenSecret: process.env.MUX_TOKEN_SECRET ?? 'dummy',
    jwtSigningKey: signingKey,
    jwtPrivateKey: privateKey,
  });
}

async function signMuxPlaybackId(playbackId: string, type: 'video' | 'thumbnail'): Promise<string | null> {
  const mux = getMuxClient();
  if (!mux?.jwt) return null;

  try {
    const opts: { type: string; expiration: string } = {
      type: type === 'video' ? 'video' : 'thumbnail',
      expiration: TOKEN_EXPIRY,
    };
    const token = await mux.jwt.signPlaybackId(playbackId, opts);
    return typeof token === 'string' ? token : null;
  } catch {
    return null;
  }
}

export async function buildMediaPayload(
  mediaRef: unknown,
  durationSec?: number
): Promise<MediaPayload> {
  const placeholder: MediaPayload = {
    kind: 'placeholder',
    autoplayAllowed: false,
    notes: ['영상 준비 중입니다. 텍스트 가이드를 참고해 주세요.'],
  };

  if (!mediaRef || typeof mediaRef !== 'object') {
    return placeholder;
  }

  const ref = mediaRef as Record<string, unknown>;
  const provider = ref.provider as string | undefined;

  if (provider === 'mux') {
    const playbackId = ref.playback_id as string | undefined;
    if (!playbackId) return placeholder;

    const [videoToken, thumbToken] = await Promise.all([
      signMuxPlaybackId(playbackId, 'video'),
      signMuxPlaybackId(playbackId, 'thumbnail'),
    ]);

    if (!videoToken) {
      return {
        ...placeholder,
        notes: ['재생 준비 중입니다. 잠시 후 다시 시도해 주세요.'],
      };
    }

    const streamUrl = `https://stream.mux.com/${playbackId}.m3u8?token=${videoToken}`;
    const posterUrl = thumbToken
      ? `https://image.mux.com/${playbackId}/thumbnail.jpg?token=${thumbToken}`
      : `https://image.mux.com/${playbackId}/thumbnail.jpg`;

    return {
      kind: 'hls',
      provider: 'mux',
      streamUrl,
      posterUrl,
      durationSec: durationSec ?? 300,
      autoplayAllowed: false,
    };
  }

  if (provider === 'legacy') {
    const url = ref.url as string | undefined;
    if (!url) return placeholder;
    return {
      kind: 'embed',
      embedUrl: url,
      posterUrl: undefined,
      autoplayAllowed: false,
      notes: ['외부 링크로 연결됩니다.'],
    };
  }

  return placeholder;
}
