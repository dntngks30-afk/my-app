'use client';

import { useState } from 'react';

interface PhotoGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * 사진 촬영 가이드 모달
 * 
 * 목적:
 * - 분석 정확도 향상
 * - 고객 불만 감소
 * - 재촬영 요청 감소
 */
export default function PhotoGuideModal({ isOpen, onClose, onConfirm }: PhotoGuideModalProps) {
  const [hasRead, setHasRead] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950 p-6">
        {/* 헤더 */}
        <div className="mb-6 text-center">
          <span className="text-5xl">📸</span>
          <h2 className="mt-4 text-2xl font-bold text-slate-100">
            사진 촬영 가이드
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            정확한 분석을 위해 아래 가이드를 확인해주세요
          </p>
        </div>

        {/* 촬영 가이드 */}
        <div className="space-y-6">
          {/* 정면 사진 가이드 */}
          <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f97316] text-lg font-bold text-white">
                1
              </div>
              <h3 className="text-lg font-bold text-slate-100">정면 사진</h3>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2">
              {/* 예시 이미지 영역 */}
              <div className="rounded-lg bg-slate-800 p-4">
                <div className="mb-3 flex h-40 items-center justify-center rounded-lg border-2 border-dashed border-slate-600 bg-slate-900">
                  <div className="text-center">
                    <span className="text-4xl">🧍</span>
                    <p className="mt-2 text-xs text-slate-500">정면 예시</p>
                  </div>
                </div>
                <div className="space-y-1 text-xs text-slate-400">
                  <p>• 카메라를 정면으로 바라봅니다</p>
                  <p>• 양팔은 자연스럽게 내립니다</p>
                  <p>• 발은 어깨 너비로 벌립니다</p>
                </div>
              </div>

              {/* 체크리스트 */}
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span className="text-sm text-slate-300">머리부터 발끝까지 전신이 보이게</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span className="text-sm text-slate-300">밝은 조명에서 촬영</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span className="text-sm text-slate-300">몸에 딱 맞는 옷 착용</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-red-400">✗</span>
                  <span className="text-sm text-slate-400">헐렁한 옷, 외투 X</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-red-400">✗</span>
                  <span className="text-sm text-slate-400">어두운 곳 X</span>
                </div>
              </div>
            </div>
          </div>

          {/* 측면 사진 가이드 */}
          <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f97316] text-lg font-bold text-white">
                2
              </div>
              <h3 className="text-lg font-bold text-slate-100">측면 사진</h3>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2">
              {/* 예시 이미지 영역 */}
              <div className="rounded-lg bg-slate-800 p-4">
                <div className="mb-3 flex h-40 items-center justify-center rounded-lg border-2 border-dashed border-slate-600 bg-slate-900">
                  <div className="text-center">
                    <span className="text-4xl">🧍‍♂️</span>
                    <p className="mt-2 text-xs text-slate-500">측면 예시</p>
                  </div>
                </div>
                <div className="space-y-1 text-xs text-slate-400">
                  <p>• 왼쪽 또는 오른쪽 측면</p>
                  <p>• 자연스러운 자세 유지</p>
                  <p>• 정면 사진과 같은 위치에서</p>
                </div>
              </div>

              {/* 체크리스트 */}
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span className="text-sm text-slate-300">90도 측면에서 촬영</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span className="text-sm text-slate-300">귀-어깨-골반-발목 라인이 보이게</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span className="text-sm text-slate-300">평소 자세 그대로 유지</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-red-400">✗</span>
                  <span className="text-sm text-slate-400">억지로 자세 교정 X</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-red-400">✗</span>
                  <span className="text-sm text-slate-400">비스듬한 각도 X</span>
                </div>
              </div>
            </div>
          </div>

          {/* 추가 팁 */}
          <div className="rounded-xl border border-[#f97316]/50 bg-[#f97316]/10 p-4">
            <h4 className="mb-3 font-bold text-[#f97316]">💡 분석 정확도를 높이는 팁</h4>
            <div className="grid gap-2 text-sm text-slate-300 md:grid-cols-2">
              <div className="flex items-start gap-2">
                <span>📱</span>
                <span>스마트폰을 허리 높이에 고정</span>
              </div>
              <div className="flex items-start gap-2">
                <span>⏱️</span>
                <span>타이머 기능 활용 (3초)</span>
              </div>
              <div className="flex items-start gap-2">
                <span>🪞</span>
                <span>거울 앞에서 확인 후 촬영</span>
              </div>
              <div className="flex items-start gap-2">
                <span>👟</span>
                <span>맨발 또는 얇은 양말 착용</span>
              </div>
            </div>
          </div>
        </div>

        {/* 확인 체크박스 */}
        <div className="mt-6 rounded-lg bg-slate-900 p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={hasRead}
              onChange={(e) => setHasRead(e.target.checked)}
              className="mt-1 h-5 w-5 rounded border-slate-600 bg-slate-800 text-[#f97316] focus:ring-[#f97316]"
            />
            <span className="text-sm text-slate-300">
              위 가이드를 확인했으며, 가이드에 맞게 사진을 촬영하겠습니다.
              <span className="block text-xs text-slate-500 mt-1">
                가이드를 따르지 않은 사진은 정확한 분석이 어려울 수 있습니다.
              </span>
            </span>
          </label>
        </div>

        {/* 버튼 */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-700 py-3 text-slate-300 transition hover:bg-slate-800"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={!hasRead}
            className="flex-1 rounded-xl bg-gradient-to-r from-[#f97316] to-[#fb923c] py-3 font-bold text-white transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
          >
            확인하고 사진 업로드
          </button>
        </div>
      </div>
    </div>
  );
}
