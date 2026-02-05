'use client';

import { useState } from 'react';
import type { PoseGuide } from '../data/types';

interface GuidePanelProps {
  guide: PoseGuide;
}

export default function GuidePanel({ guide }: GuidePanelProps) {
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [expandedTips, setExpandedTips] = useState<Set<string>>(new Set());

  const toggleCheck = (id: string) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleTip = (id: string) => {
    setExpandedTips((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const renderMedia = () => {
    if (guide.media.kind === 'gif' || guide.media.kind === 'image') {
      return (
        <img
          src={guide.media.src}
          alt={guide.media.alt}
          className="w-full rounded-lg object-cover"
        />
      );
    } else if (guide.media.kind === 'video') {
      return (
        <video
          src={guide.media.src}
          controls
          className="w-full rounded-lg"
        >
          브라우저가 비디오를 지원하지 않습니다.
        </video>
      );
    }
    return null;
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 shadow-2xl space-y-6">
      {/* 제목 */}
      <div>
        <h2 className="text-3xl font-bold text-white mb-2">{guide.title}</h2>
        <p className="text-slate-300">{guide.intent}</p>
      </div>

      {/* 미디어 */}
      {guide.media && (
        <div className="bg-slate-900/50 rounded-lg p-4">
          {renderMedia()}
        </div>
      )}

      {/* 카메라 설정 안내 */}
      <div className="flex flex-wrap gap-2">
        <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-lg text-sm">
          {guide.camera.recommendedDistanceText}
        </span>
        <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-lg text-sm">
          {guide.camera.framingHint}
        </span>
      </div>

      {/* 지시사항 */}
      <div>
        <h3 className="text-xl font-semibold text-white mb-3">지시사항</h3>
        <ul className="space-y-2">
          {guide.instructions.map((instruction, index) => (
            <li key={index} className="text-slate-300 flex items-start gap-2">
              <span className="text-[#f97316] mt-1">•</span>
              <span>{instruction}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 체크리스트 */}
      <div>
        <h3 className="text-xl font-semibold text-white mb-3">체크리스트</h3>
        <div className="space-y-3">
          {guide.checklist.map((item) => (
            <div key={item.id} className="bg-slate-900/50 rounded-lg p-4">
              <label className="flex items-start gap-3 text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checkedItems.has(item.id)}
                  onChange={() => toggleCheck(item.id)}
                  className="mt-1 w-5 h-5 rounded border-slate-600 bg-slate-800 text-[#f97316] focus:ring-[#f97316] focus:ring-2"
                />
                <div className="flex-1">
                  <span className={checkedItems.has(item.id) ? 'line-through text-slate-500' : ''}>
                    {item.label}
                  </span>
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => toggleTip(item.id)}
                      className="text-sm text-slate-400 hover:text-slate-300 transition-colors"
                    >
                      {expandedTips.has(item.id) ? '팁 숨기기' : '팁 보기'}
                    </button>
                    {expandedTips.has(item.id) && (
                      <p className="text-slate-400 text-sm mt-1 pl-4 border-l-2 border-slate-700">
                        {item.tip}
                      </p>
                    )}
                  </div>
                </div>
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* 안전 주의사항 */}
      {guide.safetyNotes && guide.safetyNotes.length > 0 && (
        <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-4">
          <h4 className="text-amber-300 font-semibold mb-2">⚠️ 안전 주의사항</h4>
          <ul className="space-y-1">
            {guide.safetyNotes.map((note, index) => (
              <li key={index} className="text-amber-200 text-sm">
                • {note}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
