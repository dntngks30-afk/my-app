'use client';

/**
 * 주당 목표 빈도 선택 (2/3/4/5)
 * Deep Test 마지막 화면에서 사용. answers에 포함하지 않음.
 * value=null 상태는 아직 선택 전(필수 입력 필드).
 */

export type TargetFrequency = 2 | 3 | 4 | 5;

const OPTIONS: { value: TargetFrequency; label: string }[] = [
  { value: 2, label: '주 2회' },
  { value: 3, label: '주 3회' },
  { value: 4, label: '주 4회' },
  { value: 5, label: '주 5회' },
];

export type TargetFrequencyPickerProps = {
  value: TargetFrequency | null;
  onChange: (v: TargetFrequency) => void;
};

export default function TargetFrequencyPicker({ value, onChange }: TargetFrequencyPickerProps) {
  return (
    <div className="rounded-2xl border-2 border-slate-900 bg-white p-4 shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
      <p className="text-sm font-semibold text-slate-800 mb-1">
        주 몇 회 운동 가능하신가요?
      </p>
      {value === null && (
        <p className="text-xs text-amber-600 mb-2">선택해주세요 (필수)</p>
      )}
      <div className="flex flex-wrap gap-2 mt-2">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-full border-2 px-4 py-2.5 text-sm font-medium transition ${
              value === opt.value
                ? 'border-slate-900 bg-slate-800 text-white shadow-[3px_3px_0_0_rgba(15,23,42,1)]'
                : 'border-slate-900 bg-white text-slate-800 hover:bg-slate-100'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
