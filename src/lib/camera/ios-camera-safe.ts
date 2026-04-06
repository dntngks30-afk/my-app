/**
 * PR-IOS-CAMERA-SAFE-CONSTRAINTS-01: user-facing 카메라 getUserMedia / track 제약 SSOT.
 * completion / pass / evaluator 의미론과 무관한 acquisition 레이어만 담당.
 */

export function isLikelyIOSWebKit(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return false;
  }
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return true;
  }
  // iPadOS desktop UA: MacIntel + touch
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) {
    return true;
  }
  return false;
}

export function getPreferredUserFacingCameraConstraints(): MediaTrackConstraints {
  if (isLikelyIOSWebKit()) {
    return {
      facingMode: 'user',
      width: { ideal: 640, max: 640 },
      height: { ideal: 480, max: 480 },
      frameRate: { ideal: 24, max: 24 },
    };
  }
  return {
    facingMode: 'user',
    width: { ideal: 640 },
    height: { ideal: 480 },
  };
}

const IOS_SAFE_TRACK_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 640, max: 640 },
  height: { ideal: 480, max: 480 },
  frameRate: { ideal: 24, max: 24 },
};

export async function applySafeVideoTrackConstraints(
  track: MediaStreamTrack,
): Promise<void> {
  if (track.kind !== 'video') return;
  if (typeof track.applyConstraints !== 'function') return;
  if (!isLikelyIOSWebKit()) return;

  try {
    await track.applyConstraints(IOS_SAFE_TRACK_CONSTRAINTS);
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[ios-camera-safe] applyConstraints failed (non-fatal)', e);
    }
  }
}
