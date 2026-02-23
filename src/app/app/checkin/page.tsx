'use client';

import { useState } from 'react';
import AppHeader from '../_components/AppHeader';
import BottomNav from '../_components/BottomNav';

export default function CheckinPage() {
  const [sliderValue, setSliderValue] = useState(50);

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-20">
      <AppHeader title="출석" />
      <main className="container mx-auto px-4 py-6">
        <section className="rounded-[var(--radius)] bg-[var(--surface)] border border-[color:var(--border)] shadow-[var(--shadow-0)] p-6">
          <h2
            className="text-base font-semibold text-[var(--text)] mb-4"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            오늘 운동은 어떠셨나요?
          </h2>
          <div className="space-y-4">
            <div className="flex justify-between text-sm text-[var(--muted)]">
              <span>쉬웠어요</span>
              <span>적당해요</span>
              <span>힘들었어요</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={sliderValue}
              onChange={(e) => setSliderValue(Number(e.target.value))}
              className="w-full h-3 rounded-full appearance-none bg-[var(--surface-2)] accent-[var(--brand)]"
            />
            <p className="text-center text-sm text-[var(--muted)]">
              {sliderValue < 33 ? '쉬웠어요' : sliderValue < 66 ? '적당해요' : '힘들었어요'}
            </p>
          </div>
          <button
            type="button"
            className="mt-6 w-full rounded-[var(--radius)] bg-[var(--brand)] py-3 text-sm font-medium text-white"
          >
            출석 완료
          </button>
        </section>
      </main>
      <BottomNav />
    </div>
  );
}
