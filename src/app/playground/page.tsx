'use client';

/**
 * Playground - 디자인 프리셋 선택 및 미리보기 페이지
 * 
 * 개발 모드 전용: 프리셋을 선택하고 랜딩/설문/결과를 한 화면에서 비교
 */

import { useState, useEffect } from 'react';
import { notFound } from 'next/navigation';
import { usePreset } from '@/components/PresetProvider';
import { DESIGN_PRESETS } from '@/components/designPresets';
import Card from '@/components/Card';
import ChoiceTile from '@/components/ChoiceTile';
import ProgressMini from '@/components/ProgressMini';
import { ALL_QUESTIONS } from '@/features/movement-test/data/questions';
import type { Option } from '@/types/movement-test';
import { isMultipleQuestion } from '@/types/movement-test';

export default function PlaygroundPage() {
  const { currentPreset, setPreset, savePreset } = usePreset();
  const [mounted, setMounted] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      notFound();
      return;
    }
    setMounted(true);
  }, []);

  const handlePresetClick = (presetId: string) => {
    setPreset(presetId);
    setSavedMessage('');
  };

  const handleSave = () => {
    savePreset();
    setSavedMessage(`✓ "${currentPreset.name}" 저장됨`);
    setTimeout(() => setSavedMessage(''), 3000);
  };

  if (!mounted || process.env.NODE_ENV === 'production') {
    return null;
  }

  // 첫 번째 질문 가져오기
  const firstQuestion = ALL_QUESTIONS[0];
  const isMultiple = firstQuestion && isMultipleQuestion(firstQuestion);
  const options = isMultiple && firstQuestion.options ? firstQuestion.options.slice(0, 4) : [];

  // 목업 옵션
  const mockOptions: Option[] = [
    { id: 'mock1', text: '첫 번째 선택지', type: '담직', score: 3 },
    { id: 'mock2', text: '두 번째 선택지', type: '날림', score: 3 },
    { id: 'mock3', text: '세 번째 선택지', type: '버팀', score: 3 },
    { id: 'mock4', text: '네 번째 선택지', type: '흘림', score: 3 },
  ];

  const displayOptions = options.length > 0 ? options : mockOptions;

  // 카드 스타일 클래스
  const cardStyleClass = currentPreset.cardStyle === 'soft' 
    ? 'bg-[var(--surface-2)] shadow-[var(--shadow-0)]'
    : 'bg-[var(--surface)] border border-[var(--border)]';

  return (
    <div className="min-h-screen bg-[var(--bg)] p-6" style={{ fontFamily: 'var(--font-sans)' }}>
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--text)] mb-2" style={{ fontFamily: 'var(--font-display)' }}>
            디자인 프리셋 플레이그라운드
          </h1>
          <p className="text-[var(--muted)]">프리셋을 선택하고 즉시 적용해보세요</p>
        </div>

        {/* 프리셋 선택 그리드 */}
        <div className={`mb-8 p-6 rounded-[var(--radius)] ${cardStyleClass}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-[var(--text)]" style={{ fontFamily: 'var(--font-display)' }}>
              프리셋 선택
            </h2>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-[var(--brand)] text-white font-medium rounded-[var(--radius)] hover:brightness-95 transition-all"
              >
                Save as default
              </button>
              {savedMessage && (
                <span className="text-sm text-green-600 font-medium">{savedMessage}</span>
              )}
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {DESIGN_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handlePresetClick(preset.id)}
                className={`
                  text-left p-4 rounded-[var(--radius)] border-2 transition-all
                  ${
                    currentPreset.id === preset.id
                      ? 'border-[var(--brand)] bg-[var(--brand-soft)] shadow-[var(--shadow-1)]'
                      : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-0)]'
                  }
                `}
              >
                <div className="font-semibold text-[var(--text)] mb-1">{preset.name}</div>
                <div className="text-xs text-[var(--muted)] mb-2">{preset.description}</div>
                <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                  <span>{preset.fontSans}/{preset.fontDisplay}</span>
                  <span>•</span>
                  <span>{preset.heroVariant}</span>
                  <span>•</span>
                  <span>{preset.bgPattern}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 현재 프리셋 정보 */}
        <div className={`mb-8 p-4 rounded-[var(--radius)] ${cardStyleClass}`}>
          <div className="text-sm text-[var(--muted)]">
            <strong className="text-[var(--text)]">현재 프리셋:</strong> {currentPreset.name} ({currentPreset.id})
            {' • '}
            <strong className="text-[var(--text)]">폰트:</strong> {currentPreset.fontSans} / {currentPreset.fontDisplay}
            {' • '}
            <strong className="text-[var(--text)]">랜딩:</strong> {currentPreset.heroVariant} + {currentPreset.bgPattern}
            {' • '}
            <strong className="text-[var(--text)]">카드:</strong> {currentPreset.cardStyle}
          </div>
        </div>

        {/* 프리뷰 3종 */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* A) 랜딩 히어로 축소 프리뷰 */}
          <div className={`p-6 rounded-[var(--radius)] ${cardStyleClass}`}>
            <h3 className="text-lg font-semibold text-[var(--text)] mb-4" style={{ fontFamily: 'var(--font-display)' }}>
              A) 랜딩 히어로
            </h3>
            <div 
              className={`landing-hero p-6 rounded-[var(--radius)] bg-[var(--bg)] mb-4 relative`}
              style={{ minHeight: '200px' }}
            >
              {currentPreset.heroVariant === 'center' ? (
                <div className="text-center">
                  <h4 
                    className="text-2xl font-bold text-[var(--text)] mb-2"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    무료 움직임 테스트
                  </h4>
                  <p className="text-sm text-[var(--muted)] mb-4">
                    내 몸의 습관을 1분 만에 확인하고 바로 고칠 루틴까지
                  </p>
                  <button className="px-4 py-2 bg-[var(--brand)] text-white text-sm font-semibold rounded-[var(--radius)]">
                    테스트 시작
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 items-center">
                  <div>
                    <h4 
                      className="text-xl font-bold text-[var(--text)] mb-2"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      무료 움직임 테스트
                    </h4>
                    <p className="text-xs text-[var(--muted)] mb-2">
                      내 몸의 습관을 확인하세요
                    </p>
                    <button className="px-3 py-1.5 bg-[var(--brand)] text-white text-xs font-semibold rounded-[var(--radius)]">
                      시작
                    </button>
                  </div>
                  <div className="h-24 bg-[var(--brand-soft)] rounded-[var(--radius)] flex items-center justify-center">
                    <div className="text-2xl opacity-50">🎯</div>
                  </div>
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`p-3 rounded-[var(--radius)] ${cardStyleClass}`}
                  style={{ padding: 'var(--card-pad)' }}
                >
                  <div className="text-xs text-[var(--muted)]">카드 {i}</div>
                </div>
              ))}
            </div>
          </div>

          {/* B) 설문 1문항 프리뷰 */}
          <div className={`p-6 rounded-[var(--radius)] ${cardStyleClass}`}>
            <h3 className="text-lg font-semibold text-[var(--text)] mb-4" style={{ fontFamily: 'var(--font-display)' }}>
              B) 설문 1문항
            </h3>
            <ProgressMini current={1} total={30} />
            <div className="mt-4">
              <div className="text-xs text-[var(--muted)] mb-2">{firstQuestion?.category || '카테고리'}</div>
              <h4 className="text-base font-semibold text-[var(--text)] mb-4">
                {firstQuestion?.question || '질문 예시입니다. 어떤 선택지를 고르시겠어요?'}
              </h4>
              <div className="space-y-2">
                {displayOptions.slice(0, 4).map((option, index) => (
                  <ChoiceTile
                    key={option.id}
                    option={option}
                    isSelected={index === 0}
                    onClick={() => {}}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* C) 결과 카드 축소 프리뷰 */}
          <div className={`p-6 rounded-[var(--radius)] ${cardStyleClass}`}>
            <h3 className="text-lg font-semibold text-[var(--text)] mb-4" style={{ fontFamily: 'var(--font-display)' }}>
              C) 결과 카드
            </h3>
            
            {/* 타입 선언 */}
            <div className={`mb-3 p-4 rounded-[var(--radius)] ${cardStyleClass}`}>
              <h5 className="font-semibold text-[var(--text)] mb-1 text-sm">
                담직형 - 상체고착형
              </h5>
              <p className="text-xs text-[var(--muted)]">
                안정적이고 견고한 움직임을 특징으로 합니다.
              </p>
            </div>

            {/* 요약 */}
            <div className={`mb-3 p-4 rounded-[var(--radius)] ${cardStyleClass}`}>
              <h5 className="font-semibold text-[var(--text)] mb-1 text-sm">
                요약
              </h5>
              <p className="text-xs text-[var(--text)]">
                이 타입은 안정적인 자세 유지와 강한 지지력을 특징으로 합니다.
              </p>
            </div>

            {/* 루틴 */}
            <div className={`p-4 rounded-[var(--radius)] bg-[var(--brand-soft)] border border-[var(--brand)]`}>
              <h5 className="font-semibold text-[var(--text)] mb-1 text-sm">
                💡 오늘 10분 루틴
              </h5>
              <ul className="text-xs text-[var(--text)] space-y-1">
                <li>1. 어깨 회전 스트레칭</li>
                <li>2. 척추 회전 운동</li>
                <li>3. 호흡 운동</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
