'use client';

/**
 * SessionRecoveryModal
 *
 * 유저가 종료 버튼 없이 앱을 닫은 뒤 재방문 시 표시.
 * [이어하기] [지금 종료하기] [기록 버리기]
 */

import { RotateCcw, CheckCircle2, Trash2 } from 'lucide-react';
import { NeoButton } from '@/components/neobrutalism';

type Action = 'resume' | 'complete' | 'discard';

export default function SessionRecoveryModal({
  onAction,
  loading,
}: {
  onAction: (action: Action) => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4">
      <div
        className="w-full max-w-md rounded-t-3xl border-2 border-slate-900 bg-white p-6 shadow-[0_-4px_0_0_rgba(15,23,42,1)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-bold text-slate-800 mb-2">이전 세션이 있어요</h2>
        <p className="text-sm text-slate-600 mb-5">
          운동을 마치지 않고 나갔던 세션이 있어요. 어떻게 할까요?
        </p>

        <div className="space-y-2">
          <NeoButton
            variant="primary"
            fullWidth
            onClick={() => onAction('resume')}
            disabled={loading}
            className="py-3 flex items-center justify-center gap-2"
          >
            <RotateCcw className="size-4" />
            이어하기
          </NeoButton>

          <NeoButton
            variant="orange"
            fullWidth
            onClick={() => onAction('complete')}
            disabled={loading}
            className="py-3 flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            지금 종료하기
          </NeoButton>

          <NeoButton
            variant="secondary"
            fullWidth
            onClick={() => onAction('discard')}
            disabled={loading}
            className="py-3 flex items-center justify-center gap-2"
          >
            <Trash2 className="size-4" />
            기록 버리기
          </NeoButton>
        </div>
      </div>
    </div>
  );
}
