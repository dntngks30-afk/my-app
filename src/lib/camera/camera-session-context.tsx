'use client';

/**
 * PR G1: 공통 카메라 세션 - motion 간 전환 시 stream 재사용
 * funnel 내에서는 getUserMedia 1회만 호출, motion 전환 시 teardown 없음
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type CameraSessionStatus =
  | 'idle'
  | 'requesting'
  | 'ready'
  | 'error';

export interface CameraSessionValue {
  stream: MediaStream | null;
  status: CameraSessionStatus;
  error: Error | null;
  /** consumer가 stream 필요 시 호출. 이미 있으면 재사용 */
  requestStream: () => void;
}

const CameraSessionContext = createContext<CameraSessionValue | null>(null);

const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  facingMode: 'user',
  width: { ideal: 640 },
  height: { ideal: 480 },
};

/** dev-only: getUserMedia 호출 횟수 */
let gumCallCount = 0;

/** dev-only: stream 재사용 횟수 */
let streamReuseCount = 0;

export function getCameraSessionObservability() {
  if (process.env.NODE_ENV !== 'production') {
    return { gumCallCount, streamReuseCount };
  }
  return null;
}

export function CameraSessionProvider({ children }: { children: ReactNode }) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraSessionStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestingRef = useRef(false);

  const requestStream = useCallback(() => {
    if (streamRef.current && streamRef.current.active) {
      if (process.env.NODE_ENV !== 'production') {
        streamReuseCount += 1;
        console.info('[CameraSession] stream reused', {
          gumCallCount,
          streamReuseCount,
        });
      }
      setStream(streamRef.current);
      setStatus('ready');
      return;
    }

    if (requestingRef.current) return;

    requestingRef.current = true;
    setStatus('requesting');
    setError(null);

    navigator.mediaDevices
      .getUserMedia({ video: VIDEO_CONSTRAINTS, audio: false })
      .then((s) => {
        if (process.env.NODE_ENV !== 'production') {
          gumCallCount += 1;
          console.info('[CameraSession] getUserMedia success', {
            gumCallCount,
            streamReuseCount,
          });
        }
        streamRef.current = s;
        setStream(s);
        setStatus('ready');
      })
      .catch((e) => {
        const err = e instanceof Error ? e : new Error('카메라 접근 실패');
        setError(err);
        setStatus('error');
      })
      .finally(() => {
        requestingRef.current = false;
      });
  }, []);

  useEffect(() => {
    return () => {
      if (process.env.NODE_ENV !== 'production') {
        console.info('[CameraSession] layout unmount, releasing stream', {
          gumCallCount,
          streamReuseCount,
        });
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setStream(null);
      setStatus('idle');
    };
  }, []);

  const value: CameraSessionValue = {
    stream,
    status,
    error,
    requestStream,
  };

  return (
    <CameraSessionContext.Provider value={value}>
      {children}
    </CameraSessionContext.Provider>
  );
}

export function useCameraSession(): CameraSessionValue | null {
  return useContext(CameraSessionContext);
}
