'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PlayerHeader from '../../_components/PlayerHeader';
import PlayerTimer from '../../_components/PlayerTimer';
import BreathToggle from '../../_components/BreathToggle';
import VideoFrame from '../../_components/VideoFrame';
import CueChips from '../../_components/CueChips';
import ProgressFooter from '../../_components/ProgressFooter';
import BottomNav from '../../_components/BottomNav';
import { Button } from '@/components/ui/button';
import { PLAYER_EXERCISES } from '../../_data/routine';

type BreathMode = 'inhale' | 'exhale';

export default function RoutinePlayerPage() {
  const router = useRouter();
  const [moveIndex, setMoveIndex] = useState(0);
  const [breathMode, setBreathMode] = useState<BreathMode>('exhale');
  const [remainingSeconds, setRemainingSeconds] = useState(
    PLAYER_EXERCISES[0]?.durationSeconds ?? 45
  );

  const current = PLAYER_EXERCISES[moveIndex];
  const total = PLAYER_EXERCISES.length;
  const isLast = moveIndex >= total - 1;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  const handleNext = () => {
    if (isLast) {
      router.push('/app/checkin');
    } else {
      setMoveIndex((i) => i + 1);
      const next = PLAYER_EXERCISES[moveIndex + 1];
      setRemainingSeconds(next?.durationSeconds ?? 45);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-24">
      <PlayerHeader />
      <main className="container mx-auto px-4 py-6 space-y-6">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          EXERCISE {moveIndex + 1} OF {total}
        </p>
        <h2
          className="text-xl font-semibold text-[var(--text)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {current?.title ?? 'V1 90/90 벽 호흡'}
        </h2>

        <PlayerTimer minutes={minutes} seconds={seconds} />

        <BreathToggle value={breathMode} onChange={setBreathMode} />

        <VideoFrame />

        <CueChips chips={current?.cueChips ?? ['갈비뼈 아래로', '긴 날숨']} />

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 rounded-[var(--radius)]">
            쉬운 버전
          </Button>
          <Button variant="outline" className="flex-1 rounded-[var(--radius)]">
            어려운 버전
          </Button>
        </div>

        <Button
          onClick={handleNext}
          className="w-full rounded-[var(--radius)] py-6 text-base font-semibold bg-[var(--brand)]"
        >
          다음 동작
        </Button>

        <div className="pt-4">
          <ProgressFooter current={moveIndex + 1} total={total} />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
