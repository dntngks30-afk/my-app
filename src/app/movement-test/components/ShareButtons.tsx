/**
 * ShareButtons 컴포넌트
 * 
 * 테스트 결과 공유 기능
 * - URL 복사
 * - 카카오톡 공유
 * - SNS 공유 (트위터, 페이스북)
 * - 이미지 다운로드
 */

'use client';

import { useState } from 'react';

interface ShareButtonsProps {
  /** 공유할 URL */
  shareUrl: string;
  
  /** 공유 제목 */
  title: string;
  
  /** 공유 설명 */
  description: string;
  
  /** 메인 타입 */
  mainType: string;
  
  /** 서브타입 */
  subType: string;
}

export default function ShareButtons({
  shareUrl,
  title,
  description,
  mainType,
  subType
}: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  // URL 복사
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      alert('링크 복사에 실패했습니다.');
    }
  };

  // 카카오톡 공유
  const handleKakaoShare = () => {
    if (typeof window === 'undefined' || !(window as any).Kakao) {
      alert('카카오톡 공유 기능을 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    const Kakao = (window as any).Kakao;
    
    if (!Kakao.isInitialized()) {
      alert('카카오톡 SDK가 초기화되지 않았습니다.');
      return;
    }

    Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: `${title} - ${mainType} · ${subType}`,
        description: description,
        imageUrl: `${window.location.origin}/og-image-movement-test.png`,
        link: {
          mobileWebUrl: shareUrl,
          webUrl: shareUrl,
        },
      },
      buttons: [
        {
          title: '결과 확인하기',
          link: {
            mobileWebUrl: shareUrl,
            webUrl: shareUrl,
          },
        },
        {
          title: '나도 테스트하기',
          link: {
            mobileWebUrl: `${window.location.origin}/movement-test`,
            webUrl: `${window.location.origin}/movement-test`,
          },
        },
      ],
    });
  };

  // 트위터 공유
  const handleTwitterShare = () => {
    const text = `${title}\n${mainType} · ${subType}\n\n${description}`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank', 'width=550,height=420');
  };

  // 페이스북 공유
  const handleFacebookShare = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank', 'width=550,height=420');
  };

  // 네이티브 공유 (모바일)
  const handleNativeShare = async () => {
    if (!navigator.share) {
      handleCopyLink();
      return;
    }

    setIsSharing(true);
    try {
      await navigator.share({
        title: `${title} - ${mainType} · ${subType}`,
        text: description,
        url: shareUrl,
      });
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Share failed:', error);
      }
    } finally {
      setIsSharing(false);
    }
  };

  // 이미지 다운로드 (html2canvas 필요)
  const handleImageDownload = async () => {
    // TODO: html2canvas 라이브러리 설치 후 구현
    alert('이미지 다운로드 기능은 곧 추가될 예정입니다.');
  };

  return (
    <div className="space-y-4">
      {/* 제목 */}
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-white mb-2">
          결과 공유하기
        </h3>
        <p className="text-slate-400 text-sm">
          친구들에게 나의 움직임 타입을 공유해보세요
        </p>
      </div>

      {/* 공유 버튼 그리드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* URL 복사 */}
        <button
          onClick={handleCopyLink}
          className={`
            p-4 rounded-xl border-2 transition-all duration-200
            ${copied
              ? 'border-green-500 bg-green-500/20'
              : 'border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800'
            }
          `}
        >
          <div className="flex flex-col items-center gap-2">
            <span className="text-2xl">
              {copied ? '✓' : '🔗'}
            </span>
            <span className="text-sm font-semibold text-white">
              {copied ? '복사됨!' : 'URL 복사'}
            </span>
          </div>
        </button>

        {/* 카카오톡 공유 */}
        <button
          onClick={handleKakaoShare}
          className="p-4 rounded-xl border-2 border-slate-700 bg-slate-800/50 hover:border-yellow-500 hover:bg-yellow-500/10 transition-all duration-200"
        >
          <div className="flex flex-col items-center gap-2">
            <span className="text-2xl">💬</span>
            <span className="text-sm font-semibold text-white">
              카카오톡
            </span>
          </div>
        </button>

        {/* 트위터 공유 */}
        <button
          onClick={handleTwitterShare}
          className="p-4 rounded-xl border-2 border-slate-700 bg-slate-800/50 hover:border-blue-500 hover:bg-blue-500/10 transition-all duration-200"
        >
          <div className="flex flex-col items-center gap-2">
            <span className="text-2xl">🐦</span>
            <span className="text-sm font-semibold text-white">
              트위터
            </span>
          </div>
        </button>

        {/* 페이스북 공유 */}
        <button
          onClick={handleFacebookShare}
          className="p-4 rounded-xl border-2 border-slate-700 bg-slate-800/50 hover:border-blue-600 hover:bg-blue-600/10 transition-all duration-200"
        >
          <div className="flex flex-col items-center gap-2">
            <span className="text-2xl">📘</span>
            <span className="text-sm font-semibold text-white">
              페이스북
            </span>
          </div>
        </button>
      </div>

      {/* 네이티브 공유 버튼 (모바일) */}
      {typeof navigator !== 'undefined' && navigator.share && (
        <button
          onClick={handleNativeShare}
          disabled={isSharing}
          className="w-full py-3 px-6 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold transition-all duration-200"
        >
          {isSharing ? '공유 중...' : '📱 더 많은 공유 옵션'}
        </button>
      )}

      {/* 이미지 다운로드 */}
      <button
        onClick={handleImageDownload}
        className="w-full py-3 px-6 rounded-xl border-2 border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800 text-white font-semibold transition-all duration-200"
      >
        📸 이미지로 저장
      </button>
    </div>
  );
}
