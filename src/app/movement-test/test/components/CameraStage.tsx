'use client';

import { useState, useEffect, useRef } from 'react';
import GuidePanel from './GuidePanel';
import CountdownTimer from './CountdownTimer';
import { POSE_GUIDES } from '../data/poseGuides';
import type { PoseGuide } from '../data/types';

interface CameraStageProps {
  guideId: string;
  stream: MediaStream | null;
  mirror: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

type Stage = 'prep' | 'recording' | 'completed';

export default function CameraStage({ guideId, stream, mirror, onComplete, onSkip }: CameraStageProps) {
  const [guide, setGuide] = useState<PoseGuide | null>(null);
  const [stage, setStage] = useState<Stage>('prep');
  const [prepComplete, setPrepComplete] = useState(false);
  const [durationComplete, setDurationComplete] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const found = POSE_GUIDES.find((g) => g.id === guideId);
    if (found) {
      setGuide(found);
    }
  }, [guideId]);

  // stream을 video 엘리먼트에 연결
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    } else if (videoRef.current && !stream) {
      videoRef.current.srcObject = null;
    }
  }, [stream]);

  useEffect(() => {
    if (prepComplete && stage === 'prep') {
      setStage('recording');
    }
  }, [prepComplete, stage]);

  useEffect(() => {
    if (durationComplete && stage === 'recording') {
      setStage('completed');
    }
  }, [durationComplete, stage]);

  const handlePrepComplete = () => {
    setPrepComplete(true);
  };

  const handleDurationComplete = () => {
    setDurationComplete(true);
  };

  if (!guide) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 shadow-2xl">
          <p className="text-red-400 text-center">가이드를 찾을 수 없습니다.</p>
        </div>
      </div>
    );
  }

  // stream이 없으면 안내 메시지 표시
  if (!stream) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 shadow-2xl">
              <h2 className="text-2xl font-bold text-white mb-4">카메라가 필요합니다</h2>
              <p className="text-slate-300 mb-6">
                상단 우측의 카메라 패널에서 카메라를 켜고 다시 시도해주세요.
              </p>
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={onSkip}
                  className="px-6 py-3 bg-slate-700 text-white rounded-xl font-semibold hover:bg-slate-600 transition-all duration-200"
                >
                  스킵
                </button>
                <button
                  onClick={onSkip}
                  className="px-6 py-3 bg-slate-700 text-white rounded-xl font-semibold hover:bg-slate-600 transition-all duration-200"
                >
                  뒤로
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* 가이드 패널 */}
          <GuidePanel guide={guide} />

          {/* 카메라 프리뷰 */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-4 shadow-2xl">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full aspect-video object-cover rounded-lg"
              style={{ transform: mirror ? 'scaleX(-1)' : 'none' }}
            />
          </div>

          {/* 타이머 및 상태 */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 shadow-2xl">
            {stage === 'prep' && (
              <div className="space-y-6">
                <p className="text-slate-300 text-center text-lg">준비 카운트다운</p>
                <CountdownTimer
                  initialSeconds={guide.prepCountdownSec}
                  onComplete={handlePrepComplete}
                  label="준비하세요"
                />
              </div>
            )}

            {stage === 'recording' && (
              <div className="space-y-6">
                <p className="text-slate-300 text-center text-lg">동작 유지 시간</p>
                <CountdownTimer
                  initialSeconds={guide.durationSec}
                  onComplete={handleDurationComplete}
                  label="동작을 유지하세요"
                />
              </div>
            )}

            {stage === 'completed' && (
              <div className="space-y-6">
                <p className="text-green-400 text-center text-xl font-semibold">
                  완료되었습니다!
                </p>
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={onComplete}
                    className="px-8 py-4 bg-[#f97316] text-white rounded-xl font-semibold hover:bg-[#ea580c] transition-all duration-200"
                  >
                    완료
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 스킵 버튼 */}
          <div className="flex items-center justify-center">
            <button
              onClick={onSkip}
              className="px-6 py-3 bg-slate-700 text-white rounded-xl font-semibold hover:bg-slate-600 transition-all duration-200"
            >
              스킵
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
