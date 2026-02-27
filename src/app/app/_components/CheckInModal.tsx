'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

type CheckInValues = {
  pain_today?: number | null;
  stiffness?: number | null;
  sleep?: number | null;
  time_available_min?: number | null;
  equipment_available?: string[];
};

type Props = {
  onSubmit: (values: CheckInValues) => Promise<void>;
  onSkip: () => void;
  onClose: () => void;
  /** '시작하기' for plan flow, '저장' for record-only (checkin tab) */
  submitLabel?: string;
  saveError?: string | null;
  saveSuccess?: boolean;
};

export function CheckInModal({
  onSubmit,
  onSkip,
  onClose,
  submitLabel = '시작하기',
  saveError = null,
  saveSuccess = false,
}: Props) {
  const [pain, setPain] = useState<number | null>(null);
  const [stiffness, setStiffness] = useState<number | null>(null);
  const [sleep, setSleep] = useState<number | null>(null);
  const [timeAvailable, setTimeAvailable] = useState<number | null>(15);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit({
        pain_today: pain === '' ? null : pain,
        stiffness: stiffness === '' ? null : stiffness,
        sleep: sleep === '' ? null : sleep,
        time_available_min: timeAvailable,
        equipment_available: [],
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkin-title"
    >
      <div
        className="w-full max-w-md rounded-2xl border-2 border-slate-900 bg-[#f8f6f0] p-6 shadow-[4px_4px_0_0_rgba(15,23,42,1)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="checkin-title" className="text-lg font-bold text-slate-800">
            오늘의 컨디션
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full border-2 border-slate-900 text-slate-600 hover:bg-slate-100"
            aria-label="닫기"
          >
            <X className="size-4" />
          </button>
        </div>

        <p className="text-sm text-slate-600 mb-4">
          오늘의 상태를 간단히 알려주세요 (선택)
        </p>

        {saveError && (
          <p className="text-sm text-red-600 mb-4" role="alert">
            {saveError}
          </p>
        )}
        {saveSuccess && (
          <p className="text-sm font-semibold text-green-600 mb-4">저장 완료!</p>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              통증 (0–10)
            </label>
            <input
              type="range"
              min={0}
              max={10}
              value={pain ?? 0}
              onChange={(e) => setPain(parseInt(e.target.value, 10))}
              className="w-full accent-orange-500"
            />
            <span className="text-xs text-slate-500 ml-2">
              {pain === null ? '-' : pain}
            </span>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              뻣뻣함 (0–10)
            </label>
            <input
              type="range"
              min={0}
              max={10}
              value={stiffness ?? 0}
              onChange={(e) => setStiffness(parseInt(e.target.value, 10))}
              className="w-full accent-orange-500"
            />
            <span className="text-xs text-slate-500 ml-2">
              {stiffness === null ? '-' : stiffness}
            </span>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              수면 (0–10)
            </label>
            <input
              type="range"
              min={0}
              max={10}
              value={sleep ?? 0}
              onChange={(e) => setSleep(parseInt(e.target.value, 10))}
              className="w-full accent-orange-500"
            />
            <span className="text-xs text-slate-500 ml-2">
              {sleep === null ? '-' : sleep}
            </span>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">
              운동 시간
            </label>
            <div className="flex gap-2">
              {([5, 10, 15] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setTimeAvailable(m)}
                  className={`flex-1 rounded-lg border-2 px-3 py-2 text-sm font-medium transition ${
                    timeAvailable === m
                      ? 'border-slate-900 bg-orange-400 text-white'
                      : 'border-slate-300 bg-white text-slate-700 hover:border-slate-500'
                  }`}
                >
                  {m}분
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onSkip}
            className="flex-1 rounded-full border-2 border-slate-300 bg-white py-3 text-sm font-medium text-slate-600 shadow-[2px_2px_0_0_rgba(15,23,42,0.3)] hover:bg-slate-50"
          >
            건너뛰기
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || saveSuccess}
            className="flex-1 rounded-full border-2 border-slate-900 bg-orange-400 py-3 text-sm font-bold text-white shadow-[4px_4px_0_0_rgba(15,23,42,1)] hover:opacity-95 disabled:opacity-70"
          >
            {submitting ? '저장 중…' : saveSuccess ? '저장 완료' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
