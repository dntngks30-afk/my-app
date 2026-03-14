import type {
  LockedNextPreviewRecoveryReason,
  NextSessionPreviewPayload,
} from './next-session-preview'

export type LockedPreviewFetchState = 'idle' | 'loading' | 'failed' | 'succeeded'
export type LockedPreviewSessionStatus = 'current' | 'completed' | 'locked'

export function getSessionBootstrapFetchStrategy(
  options?: { forceRefresh?: boolean }
): 'cache-first' | 'network-first' {
  return options?.forceRefresh === true ? 'network-first' : 'cache-first'
}

export function shouldShowLockedPreviewLoadingState(input: {
  status: LockedPreviewSessionStatus
  isLockedNext?: boolean
  sessionId: number | null
  effectiveLockedPreview: NextSessionPreviewPayload | null
  recoveryReason: LockedNextPreviewRecoveryReason | null
  fallbackFetchState: LockedPreviewFetchState
}): boolean {
  return (
    input.status === 'locked' &&
    input.isLockedNext === true &&
    input.sessionId != null &&
    !input.effectiveLockedPreview &&
    input.recoveryReason !== null &&
    input.fallbackFetchState !== 'failed'
  )
}
