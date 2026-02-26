'use client';

/**
 * movement-test 결과 페이지 (PR3-4)
 * v2 스코어링만 사용. localStorage KEY='movementTestSession:v2'만 읽음.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Nunito } from 'next/font/google';
import { calculateScoresV2 } from '@/features/movement-test/v2';
import type { AnimalAxis, ScoreResultV2 } from '@/features/movement-test/v2';
import { NeoButton, NeoCard, NeoPageLayout } from '@/components/neobrutalism';

const KEY = 'movementTestSession:v2';

const cuteFont = Nunito({
  subsets: ['latin'],
  weight: ['400', '600'],
});

/** 축별 라벨(alt/보조경향 표시용) */
const AXIS_LABELS: Record<AnimalAxis, string> = {
  turtle: '상부 전방화',
  hedgehog: '가슴 닫힘·등 굽음',
  kangaroo: '허리 과부하',
  penguin: '무릎·발목 불안정',
  crab: '편측 의존·비대칭',
  meerkat: '전신 긴장',
};

type ResultContentKey = AnimalAxis | 'armadillo' | 'sloth' | 'monkey';
type ResultActionContent = {
  doTodayTop1: string;
  avoidTop1: string;
  trySport: string;
};

const RESULT_CONTENT: Record<
  ResultContentKey,
  {
    displayName: string;
    cardTitle: string;
    body: string;
    image: string;
    actions: ResultActionContent;
  }
> = {
  turtle: {
    displayName: '당신은 거북이형 입니다.',
    cardTitle: '거북이형',
    body: `머리와 목이 앞쪽으로 쏠리고,
등이 둥글어지는 자세를 자주 취하는 경향이 있습니다.
상체가 먼저 힘을 쓰는 방향으로 몸을 사용하는 패턴에 가깝습니다.

거북이형은 근력이 부족해서라기보다
상체가 먼저 힘을 쓰는 사용 습관에 가깝습니다.

목·어깨 긴장을 줄이고,
등이 중심을 잡도록 만드는 것이 균형 회복의 시작점입니다.`,
    image: '/animals/turtle.png',
    actions: {
      doTodayTop1:
        '핸드폰 볼 때, 화면을 눈높이로 올리고 턱을 아주 살짝만 당긴 채 10초만 버텨요.',
      avoidTop1:
        '고개를 앞으로 쭉 빼고 화면이나 노트북에 얼굴을 가까이 들이대는 습관은 피하세요.',
      trySport:
        '수영(배영)이나 로잉 머신처럼 “등을 길게 쓰는” 운동을 가볍게 해보세요.',
    },
  },
  kangaroo: {
    displayName: '당신은 캥거루형 입니다.',
    cardTitle: '캥거루형',
    body: `골반이 앞쪽으로 기울고,
허리가 먼저 힘을 쓰는 방향으로 몸을 사용하는 패턴에 가깝습니다.

캥거루형은 하체 근력이 약해서라기보다
고관절보다 허리와 앞허벅지가 먼저 개입하는 사용 습관에 가깝습니다.

동작을 시작할 때 허리가 먼저 꺾이거나,
갈비뼈가 들리는 형태가 동반될 수 있습니다.

둔근과 햄스트링이 중심을 잡도록 만들고,
속도보다 정렬을 우선하는 것이 균형 회복의 시작점입니다.`,
    image: '/animals/kangaroo.png',
    actions: {
      doTodayTop1:
        '서 있을 때 숨을 “후—” 내쉬며 갈비뼈를 살짝 내리고, 엉덩이를 아주 조금 뒤로 보내 5번만 반복해요.',
      avoidTop1:
        '설거지·양치할 때 허리를 꺾고 배를 앞으로 내민 채 오래 서 있는 자세는 피하세요.',
      trySport:
        '파워워킹(보폭 크게)이나 자전거처럼 “엉덩이로 밀어내는” 움직임을 연습해보세요.',
    },
  },
  hedgehog: {
    displayName: '당신은 고슴도치형 입니다.',
    cardTitle: '고슴도치형',
    body: `가슴이 닫히고,
등이 둥글게 굽는 방향으로 몸을 사용하는 패턴에 가깝습니다.

고슴도치형은 목이 앞으로 빠지기보다는
상체가 안쪽으로 말리며 공간이 좁아지는 형태에 가깝습니다.

팔을 들어 올릴 때
어깨 앞쪽이나 겨드랑이 주변이 먼저 당기거나,
등이 잘 펴지지 않는 느낌이 나타날 수 있습니다.

가슴을 열고,
흉추가 부드럽게 펴지도록 만드는 것이
균형 회복의 시작점입니다.`,
    image: '/animals/hedgehog.png',
    actions: {
      doTodayTop1:
        '문틀에 팔을 걸고 가슴만 앞으로 살짝 내밀어 20초, 2번만 해요.',
      avoidTop1:
        '추울 때나 긴장할 때 어깨를 안쪽으로 말고 팔을 몸에 붙인 채 구부정하게 걷는 습관은 피하세요.',
      trySport:
        '요가(가슴 여는 동작)나 초급 클라이밍처럼 “가슴을 열고 버티는” 운동이 잘 맞아요.',
    },
  },
  meerkat: {
    displayName: '당신은 미어캣형 입니다.',
    cardTitle: '미어캣형',
    body: `몸을 똑바로 세우려는 의식이 강해,
상체를 위로 끌어올린 채 버티는 방향으로 사용하는 패턴에 가깝습니다.

미어캣형은 자세가 나빠서라기보다
갈비뼈와 허리가 먼저 긴장하며 정렬을 유지하려는 습관에 가깝습니다.

겉보기엔 곧게 서 있지만
갈비뼈가 들리거나 허리가 과하게 꺾이고,
무릎이 잠긴 상태가 함께 나타날 수 있습니다.

힘으로 버티기보다
호흡으로 중심을 만들고,
하체에서 지지가 올라오도록 만드는 것이 균형 회복의 시작점입니다.`,
    image: '/animals/meerkat.png',
    actions: {
      doTodayTop1:
        '숨을 길게 내쉬면서 갈비뼈가 내려가는 느낌을 5번만 느껴봐요. (허리에 힘 빼기!)',
      avoidTop1:
        '사진 찍을 때 일부러 가슴을 들고 허리를 꺾어서 “꼿꼿해 보이려” 버티는 자세는 피하세요.',
      trySport:
        '필라테스(호흡+중립)나 태극권/호흡 요가처럼 “힘으로 버티지 않는” 운동이 좋아요.',
    },
  },
  penguin: {
    displayName: '당신은 펭귄형 입니다.',
    cardTitle: '펭귄형',
    body: `하체는 비교적 단단한 편이지만,
발목 가동 범위가 제한된 상태에서 움직이는 패턴에 가깝습니다.

펭귄형은 근력이 부족해서라기보다
발목이 충분히 접히지 않은 채 하체가 먼저 버티는 사용 습관에 가깝습니다.

스쿼트를 깊게 내려갈 때 답답함이 있거나,
보폭이 짧고 무게 중심이 뒤로 빠지는 느낌이 나타날 수 있습니다.

발목 가동성을 회복하고,
발바닥 지지를 다시 만드는 것이 균형 회복의 시작점입니다.`,
    image: '/animals/penguin.png',
    actions: {
      doTodayTop1:
        '벽에 손을 대고, 뒤꿈치를 붙인 채 무릎을 벽 쪽으로 10번만 살짝 톡톡 움직여요.',
      avoidTop1:
        '발끝을 바깥으로 벌리고 뒤꿈치에 기대서 서 있는 습관(무게가 뒤로 가는 자세)은 피하세요.',
      trySport:
        '가벼운 등산·트레킹이나 배드민턴처럼 “발목을 잘 쓰는” 운동이 도움이 돼요.',
    },
  },
  crab: {
    displayName: '당신은 게형 입니다.',
    cardTitle: '게형',
    body: `움직일 때 체중이 한쪽으로 더 실리거나,
좌우 균형이 일정하지 않은 패턴에 가깝습니다.

게형은 힘이 부족해서라기보다
한쪽 다리가 먼저 개입하는 사용 습관에 가깝습니다.

스쿼트나 런지에서
골반이 좌우로 흔들리거나,
한쪽 무릎 정렬이 쉽게 무너질 수 있습니다.

한발 안정성을 회복하고,
양쪽 하체가 균등하게 지지하도록 만드는 것이 균형 회복의 시작점입니다.`,
    image: '/animals/crab.png',
    actions: {
      doTodayTop1:
        '양치할 때 한발로 10초 서기! 좌/우 번갈아 하고, 흔들리면 벽을 살짝 짚어요.',
      avoidTop1:
        '항상 같은 다리에만 체중을 싣고 서 있는 습관(한쪽 다리로만 서기)은 피하세요.',
      trySport:
        '인라인/스케이트(초급)나 테니스 풋워크처럼 “좌우로 균형 잡는” 운동이 잘 맞아요.',
    },
  },
  armadillo: {
    displayName: '당신은 복합형 아르마딜로 입니다.',
    cardTitle: '복합형 아르마딜로',
    body: `상체와 골반이 함께 말리며,
몸을 둥글게 보호하는 방향으로 사용하는 패턴에 가깝습니다.

아르마딜로형은 한 부위로만 설명되기보다는,
여러 부위가 동시에 긴장하며 하나의 보호 패턴을 만드는 형태에 가깝습니다.

허리가 평평해지거나 골반이 말리고,
엉덩이·햄스트링이 단단하게 굳는 느낌이 나타날 수 있습니다.

먼저 과한 긴장을 부드럽게 풀고,
가슴과 골반의 중립을 회복한 뒤
몸이 자연스럽게 연결되도록 만드는 것이 균형 회복의 시작점입니다.`,
    image: '/animals/armadillo.png',
    actions: {
      doTodayTop1:
        '벽에 등을 기대고 어깨랑 엉덩이 힘을 “조금만” 빼서 20초 쉬어줘요.',
      avoidTop1:
        '불안하거나 긴장할 때 몸을 웅크리고 배·엉덩이에 힘을 꽉 주는 습관은 피하세요.',
      trySport:
        '편한 스트레칭 요가(릴리즈 위주)나 느린 산책처럼 “긴장을 푸는” 운동이 좋아요.',
    },
  },
  sloth: {
    displayName: '당신은 복합형 나무늘보 입니다.',
    cardTitle: '복합형 나무늘보',
    body: `몸이 전체적으로 느슨하게 유지되며,
특정 부위가 강하게 개입하지 않는 패턴에 가깝습니다.

나무늘보형은 한 부위의 뚜렷한 문제라기보다,
지지 반응이 분산되어 중심이 흐릿해지는 형태에 가깝습니다.

자세가 크게 무너지지는 않지만,
움직임이 작고 힘이 흩어지며
지속적인 안정감이 부족하게 느껴질 수 있습니다.

강하게 조이기보다,
기본 지지를 천천히 깨워가며 연결을 만드는 것이
균형 회복의 시작점입니다.`,
    image: '/animals/sloth.png',
    actions: {
      doTodayTop1:
        '벽을 양손으로 10초만 밀면서, 발바닥이 바닥을 꾹 누르는 느낌을 찾아봐요.',
      avoidTop1:
        '의자에 반쯤 걸터앉아서 흐느적거리며 오래 앉아 있는 자세는 피하세요.',
      trySport:
        '수영(자유형/킥보드)이나 서핑·패들보드(초급)처럼 “몸통을 연결해서 쓰는” 운동이 잘 맞아요.',
    },
  },
  monkey: {
    displayName: '당신은 원숭이형(균형형) 입니다.',
    cardTitle: '원숭이형(균형형)',
    body: `현재 테스트 결과에서
특정 움직임 패턴이 뚜렷하게 나타나지 않았습니다.

한 가지 축으로 강하게 쏠리기보다는,
전반적으로 비교적 균형이 유지되고 있는 상태에 가깝습니다.

특정 부위의 과사용이나 반복적인 보상 패턴이
뚜렷하게 관찰되지는 않습니다.

다만 균형은 "완성"이 아니라
지금의 정렬과 사용 습관이 비교적 안정적인 구간에 있다는 의미입니다.

강한 교정보다는
현재의 기본 정렬과 호흡 리듬을 유지하는 것이 중요합니다.

과한 강도나 급격한 변화보다는
일관된 움직임 습관이 균형을 오래 유지하는 데 도움이 됩니다.`,
    image: '/animals/monkey.png',
    actions: {
      doTodayTop1:
        '바닥에 바로 누워, 코로 4초 들이마시고 6초 내쉬는 복식호흡을 10회만 반복해보세요. "몸에 힘을 더하는 것"보다 "힘을 빼는 감각"을 먼저 확인하는 게 좋습니다.',
      avoidTop1:
        '운동 전, 준비 없이 바로 강한 강도부터 시작하는 습관은 피하세요. 균형이 좋은 상태일수록 급격한 자극은 오히려 리듬을 흐트러뜨릴 수 있습니다.',
      trySport:
        '요가 플로우·가벼운 수영·클라이밍처럼 전신을 고르게 쓰는 운동이 잘 맞습니다.',
    },
  },
};

const RESULT_TYPE_LABELS: Record<string, string> = {
  MONKEY: '원숭이형(균형형)',
  COMPOSITE_ARMADILLO: '복합형 아르마딜로',
  COMPOSITE_SLOTH: '복합형 나무늘보',
  BASIC: '기본형',
};

function getResultContentKey(
  mainAnimal: AnimalAxis,
  resultType: string
): ResultContentKey | null {
  if (resultType === 'MONKEY') return 'monkey';
  if (resultType === 'COMPOSITE_ARMADILLO') return 'armadillo';
  if (resultType === 'COMPOSITE_SLOTH') return 'sloth';
  if (resultType === 'BASIC') return mainAnimal;
  return null;
}

const RESULT_FALLBACK_EMOJIS: Record<ResultContentKey, string> = {
  turtle: '🐢',
  hedgehog: '🦔',
  kangaroo: '🦘',
  penguin: '🐧',
  crab: '🦀',
  meerkat: '🦫',
  armadillo: '🦔',
  sloth: '🦥',
  monkey: '🐒',
};

interface SessionV2 {
  version: string;
  isCompleted: boolean;
  startedAt?: string;
  completedAt?: string;
  profile?: Record<string, unknown>;
  answersById: Record<string, 0 | 1 | 2 | 3 | 4>;
  finalType?: AnimalAxis | 'armadillo' | 'sloth' | 'monkey';
}

/** 모바일 전용 Hero 카드 내 이미지 (onError 시 이모지 fallback) */
function MobileHeroImage({
  contentKey,
}: {
  contentKey: ResultContentKey | null;
}) {
  const [imgError, setImgError] = useState(false);
  const emoji = contentKey ? RESULT_FALLBACK_EMOJIS[contentKey] : '⚖️';
  const imgSrc = contentKey ? RESULT_CONTENT[contentKey].image : '';

  if (!contentKey) {
    return (
      <div className="w-72 h-72 flex items-center justify-center text-7xl bg-slate-100 rounded-2xl border-2 border-slate-900 shadow-[3px_3px_0_0_rgba(15,23,42,1)]">
        ⚖️
      </div>
    );
  }

  if (imgError) {
    return (
      <div className="w-72 h-72 flex items-center justify-center text-7xl bg-slate-100 rounded-2xl border-2 border-slate-900 shadow-[3px_3px_0_0_rgba(15,23,42,1)]">
        {emoji}
      </div>
    );
  }

  return (
    <img
      src={imgSrc}
      alt={RESULT_CONTENT[contentKey].cardTitle}
      className="w-72 h-72 object-contain rounded-2xl border-2 border-slate-900 shadow-[3px_3px_0_0_rgba(15,23,42,1)]"
      onError={() => setImgError(true)}
    />
  );
}

function MainTypeImage({
  contentKey,
}: {
  contentKey: ResultContentKey | null;
}) {
  const [imgError, setImgError] = useState(false);
  const emoji = contentKey ? RESULT_FALLBACK_EMOJIS[contentKey] : '⚖️';
  const imgSrc = contentKey ? RESULT_CONTENT[contentKey].image : '';

  if (!contentKey) {
    return (
      <div className="w-full max-w-[180px] sm:max-w-[200px] md:max-w-[220px] mx-auto aspect-square flex items-center justify-center text-6xl sm:text-7xl md:text-8xl bg-slate-100 rounded-2xl border-2 border-slate-900 shadow-[3px_3px_0_0_rgba(15,23,42,1)]">
        ⚖️
      </div>
    );
  }

  if (imgError) {
    return (
      <div className="w-full max-w-[180px] sm:max-w-[200px] md:max-w-[220px] mx-auto aspect-square flex items-center justify-center text-6xl sm:text-7xl md:text-8xl bg-slate-100 rounded-2xl border-2 border-slate-900 shadow-[3px_3px_0_0_rgba(15,23,42,1)]">
        {emoji}
      </div>
    );
  }

  return (
    <img
      src={imgSrc}
      alt={RESULT_CONTENT[contentKey].cardTitle}
      className="w-full max-w-[180px] sm:max-w-[200px] md:max-w-[220px] mx-auto aspect-square object-contain rounded-2xl border-2 border-slate-900 shadow-[3px_3px_0_0_rgba(15,23,42,1)]"
      onError={() => setImgError(true)}
    />
  );
}

function TypeActionCards({
  actions,
  cuteClassName,
  cuteStyle,
}: {
  actions: ResultActionContent;
  cuteClassName: string;
  cuteStyle: { fontFamily: string };
}) {
  return (
    <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-3">
      <section className="rounded-2xl border-2 border-slate-900 bg-slate-100 p-4 shadow-[3px_3px_0_0_rgba(15,23,42,1)]">
        <h3
          className={`${cuteClassName} text-sm sm:text-base lg:text-lg font-semibold text-slate-800 mb-2`}
          style={cuteStyle}
        >
          오늘 당장 실천할 움직임 Top1
        </h3>
        <ul
          className={`${cuteClassName} text-sm sm:text-base text-slate-600 leading-relaxed list-disc list-inside min-h-[24px]`}
          style={cuteStyle}
        >
          {actions.doTodayTop1 ? <li>{actions.doTodayTop1}</li> : null}
        </ul>
      </section>
      <section className="rounded-2xl border-2 border-slate-900 bg-slate-100 p-4 shadow-[3px_3px_0_0_rgba(15,23,42,1)]">
        <h3
          className={`${cuteClassName} text-sm sm:text-base lg:text-lg font-semibold text-slate-800 mb-2`}
          style={cuteStyle}
        >
          피해야 할 움직임 Top1
        </h3>
        <ul
          className={`${cuteClassName} text-sm sm:text-base text-slate-600 leading-relaxed list-disc list-inside min-h-[24px]`}
          style={cuteStyle}
        >
          {actions.avoidTop1 ? <li>{actions.avoidTop1}</li> : null}
        </ul>
      </section>
      <section className="rounded-2xl border-2 border-slate-900 bg-slate-100 p-4 shadow-[3px_3px_0_0_rgba(15,23,42,1)]">
        <h3
          className={`${cuteClassName} text-sm sm:text-base lg:text-lg font-semibold text-slate-800 mb-2`}
          style={cuteStyle}
        >
          시도해볼만한 운동/스포츠
        </h3>
        <ul
          className={`${cuteClassName} text-sm sm:text-base text-slate-600 leading-relaxed list-disc list-inside min-h-[24px]`}
          style={cuteStyle}
        >
          {actions.trySport ? <li>{actions.trySport}</li> : null}
        </ul>
      </section>
    </div>
  );
}

function loadSession(): SessionV2 | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data?.version !== 'v2') return null;
    return {
      version: 'v2',
      isCompleted: data.isCompleted ?? false,
      startedAt: data.startedAt,
      completedAt: data.completedAt,
      profile: data.profile,
      answersById: data.answersById ?? {},
      finalType: data.finalType,
    };
  } catch {
    return null;
  }
}

const SHARE_TITLE = '무료 움직임 테스트';
const SHARE_TEXT = '무료 움직임 테스트 해봐!';

export default function ResultPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionV2 | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setSession(loadSession());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!shareOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [shareOpen]);

  useEffect(() => {
    if (!shareOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShareOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shareOpen]);

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/` : '';

  const copyLink = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setToast('링크 복사 완료!');
      setTimeout(() => setToast(null), 2000);
    } catch {
      setToast('복사에 실패했어요.');
      setTimeout(() => setToast(null), 2000);
    }
  }, [shareUrl]);

  const handleNativeShare = useCallback(
    async (fallbackMessage: string) => {
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({
            title: SHARE_TITLE,
            text: SHARE_TEXT,
            url: shareUrl,
          });
          setToast('공유 완료!');
          setTimeout(() => setToast(null), 2000);
        } catch (e) {
          if ((e as Error).name !== 'AbortError') {
            setToast('공유를 취소했어요.');
            setTimeout(() => setToast(null), 2000);
          }
        }
        return;
      }
      await copyLink();
      setToast(fallbackMessage);
      setTimeout(() => setToast(null), 3000);
    },
    [shareUrl, copyLink]
  );

  const openTwitter = useCallback(() => {
    if (typeof window === 'undefined') return;
    const u = `https://twitter.com/intent/tweet?text=${encodeURIComponent(SHARE_TEXT)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(u, '_blank', 'noopener,noreferrer');
  }, [shareUrl]);

  const scoreResult = useMemo((): ScoreResultV2 | null => {
    if (!session?.isCompleted || !session.answersById) return null;
    const answers = session.answersById as Record<string, 0 | 1 | 2 | 3 | 4>;
    return calculateScoresV2(answers);
  }, [session]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F6F0] overflow-x-hidden flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-800">결과 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!session || !session.isCompleted || !scoreResult) {
    return (
      <div className="min-h-screen bg-[#F8F6F0] overflow-x-hidden">
        <NeoPageLayout maxWidth="md">
          <div className="text-center">
            <NeoCard className="p-4 sm:p-6 md:p-8 max-w-md mx-auto">
              <div className="text-4xl mb-4">😕</div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-800 mb-2 whitespace-normal break-keep">
                테스트를 먼저 진행해주세요
              </h1>
              <p className="text-sm sm:text-base text-slate-600 mb-6 whitespace-normal break-keep">
                결과를 보려면 무료 움직임 테스트를 완료해주세요.
              </p>
              <NeoButton variant="orange" onClick={() => router.push('/')} className="w-full sm:w-auto min-h-[44px] px-8 py-4">
                테스트 하러 가기
              </NeoButton>
            </NeoCard>
          </div>
        </NeoPageLayout>
      </div>
    );
  }

  const mainAnimal = scoreResult.mainAnimal ?? scoreResult.baseType;
  const resultType = scoreResult.resultType ?? 'BASIC';
  const contentKey =
    session?.finalType && session.finalType in RESULT_CONTENT
      ? (session.finalType as ResultContentKey)
      : getResultContentKey(mainAnimal, resultType);
  const content = contentKey ? RESULT_CONTENT[contentKey] : null;
  const mainHeroTitle = content
    ? content.displayName
    : (RESULT_TYPE_LABELS[resultType] ?? resultType);
  const cardTitle = content
    ? content.cardTitle
    : (RESULT_TYPE_LABELS[resultType] ?? resultType);
  const resultBody = content
    ? content.body
    : '6축 점수가 비교적 고르게 분포되어 있어, 현재 균형이 잘 잡혀 있는 편이에요.';
  const resultActions = content ? content.actions : null;
  const resultBodyParagraphs = resultBody.split('\n\n');
  const cuteFontStyle = {
    fontFamily:
      `${cuteFont.style.fontFamily}, Pretendard, "Apple SD Gothic Neo", "Noto Sans KR", system-ui, sans-serif`,
  };

  return (
    <div className="min-h-screen bg-[#F8F6F0] overflow-x-hidden">
      <NeoPageLayout maxWidth="lg">
        {/* 모바일 전용: Animal Hero 카드 */}
        <section className="block sm:hidden mb-6">
          <div className="text-center mb-4">
            <p className="text-sm text-slate-600 mb-1 whitespace-normal break-keep">
              무료 움직임 테스트 결과
            </p>
            <h1
              className={`${cuteFont.className} text-xl sm:text-2xl lg:text-3xl font-semibold text-slate-800 whitespace-normal break-keep`}
              style={cuteFontStyle}
            >
              {mainHeroTitle}
            </h1>
          </div>
          <NeoCard className="p-6 flex flex-col items-center text-center gap-3">
              <MobileHeroImage contentKey={contentKey} />
              <h2 className="text-lg font-bold text-slate-800 whitespace-normal break-keep">
                {cardTitle}
              </h2>
              <div className="space-y-4 lg:space-y-5 text-slate-800">
                {resultBodyParagraphs.map((paragraph, idx) => (
                  <p
                    key={idx}
                    className={`${cuteFont.className} text-base sm:text-lg lg:text-xl whitespace-pre-line break-keep leading-relaxed lg:leading-8`}
                    style={cuteFontStyle}
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
              {resultActions && (
                <TypeActionCards
                  actions={resultActions}
                  cuteClassName={cuteFont.className}
                  cuteStyle={cuteFontStyle}
                />
              )}
          </NeoCard>
        </section>

        {/* 데스크톱/태블릿 전용: 기존 UI */}
        <div className="hidden sm:block">
            {/* 결과 타이틀 + 메인 히어로 */}
            <section className="mb-6 sm:mb-8">
              <div className="text-center">
                <p className="text-sm sm:text-base text-slate-600 mb-2 whitespace-normal break-keep">
                  무료 움직임 테스트 결과
                </p>
                <h1
                  className={`${cuteFont.className} text-xl sm:text-2xl lg:text-3xl font-semibold text-slate-800 whitespace-normal break-keep`}
                  style={cuteFontStyle}
                >
                  {mainHeroTitle}
                </h1>
              </div>
            </section>

          {/* 메인 타입 카드 (이미지 + 짧은 설명) */}
          <NeoCard className="p-4 sm:p-6 md:p-8 mb-4 sm:mb-6 lg:max-w-3xl lg:mx-auto">
              <h2 className="text-xl font-bold text-slate-800 text-left lg:text-center mb-3 whitespace-normal break-keep">
                {cardTitle}
              </h2>
              <MainTypeImage contentKey={contentKey} />
              <div className="mt-3 space-y-4 lg:space-y-5 text-slate-800 text-left lg:text-center">
                {resultBodyParagraphs.map((paragraph, idx) => (
                  <p
                    key={idx}
                    className={`${cuteFont.className} text-base sm:text-lg lg:text-xl whitespace-pre-line break-keep leading-relaxed lg:leading-8 text-left lg:text-center`}
                    style={cuteFontStyle}
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
              {resultActions && (
                <TypeActionCards
                  actions={resultActions}
                  cuteClassName={cuteFont.className}
                  cuteStyle={cuteFontStyle}
                />
              )}
              {scoreResult.subTendency && (
                <p className="mt-4 text-sm text-slate-600 whitespace-normal break-keep">
                  보조 경향: {AXIS_LABELS[scoreResult.subTendency]}
                </p>
              )}
          </NeoCard>
        </div>

        {/* 다시 테스트 */}
        <NeoCard className="p-4 sm:p-6 md:p-8 text-center">
            <p className="text-xs sm:text-sm text-slate-600 mb-4 whitespace-normal break-keep">
              몸 상태가 달라지면 결과도 달라질 수 있어요
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center">
              <NeoButton variant="orange" onClick={() => router.push('/movement-test/feedback')} className="w-full sm:w-auto min-h-[44px] px-8 py-4">
                테스트 평가하기
              </NeoButton>
              <NeoButton variant="orange" onClick={() => setShareOpen(true)} className="w-full sm:w-auto min-h-[44px] px-8 py-4">
                테스트 공유하기
              </NeoButton>
              <NeoButton variant="orange" onClick={() => router.push('/')} className="w-full sm:w-auto min-h-[44px] px-8 py-4">
                다시 테스트하기
              </NeoButton>
            </div>
        </NeoCard>
      </NeoPageLayout>

      {/* 공유 모달 */}
      {shareOpen && (
        <>
          <div
            role="button"
            tabIndex={0}
            aria-label="닫기"
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setShareOpen(false)}
            onKeyDown={(e) => e.key === 'Enter' && setShareOpen(false)}
          />
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            aria-modal
            aria-labelledby="share-title"
          >
            <div
              className="pointer-events-auto w-full max-w-md overflow-x-hidden rounded-2xl border-2 border-slate-900 bg-white shadow-[8px_8px_0_0_rgba(15,23,42,1)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-end p-3 border-b-2 border-slate-900">
                <button
                  type="button"
                  onClick={() => setShareOpen(false)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-2xl text-slate-600 hover:text-slate-800 font-bold"
                  aria-label="닫기"
                >
                  ✕
                </button>
              </div>
              <div className="p-4 sm:p-6">
                <h2 id="share-title" className="text-lg font-bold text-slate-800 mb-4 whitespace-normal break-keep">
                  친구에게 테스트 공유하기
                </h2>
                <div className="flex flex-wrap gap-3 mb-4">
                  <NeoButton variant="secondary" onClick={() => handleNativeShare('링크가 복사됐어요. 인스타 스토리/DM에 붙여넣어 공유하세요.')} className="flex-1 min-w-[120px] min-h-[44px] gap-2">
                    <span>📸</span>
                    <span className="text-sm sm:text-base whitespace-nowrap">인스타그램</span>
                  </NeoButton>
                  <NeoButton variant="secondary" onClick={() => handleNativeShare('링크가 복사됐어요. 카카오톡에 붙여넣어 공유하세요.')} className="flex-1 min-w-[120px] min-h-[44px] gap-2">
                    <span>💬</span>
                    <span className="text-sm sm:text-base whitespace-nowrap">카카오톡</span>
                  </NeoButton>
                  <NeoButton variant="secondary" onClick={openTwitter} className="flex-1 min-w-[120px] min-h-[44px] gap-2">
                    <span>𝕏</span>
                    <span className="text-sm sm:text-base whitespace-nowrap">트위터(X)</span>
                  </NeoButton>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="flex-1 min-w-0 min-h-[44px] rounded-2xl border-2 border-slate-900 bg-slate-100 px-3 py-2 text-sm text-slate-800 truncate shadow-[2px_2px_0_0_rgba(15,23,42,1)]"
                    aria-label="공유 링크"
                  />
                  <NeoButton variant="orange" onClick={copyLink} className="shrink-0 min-h-[44px] px-4">
                    링크 복사
                  </NeoButton>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 토스트 */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-3 rounded-2xl border-2 border-slate-900 bg-slate-800 text-white text-sm font-medium shadow-[4px_4px_0_0_rgba(15,23,42,1)] whitespace-normal break-keep max-w-[90vw]">
          {toast}
        </div>
      )}
    </div>
  );
}
