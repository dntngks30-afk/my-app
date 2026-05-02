'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { JourneySummaryResponse } from '@/lib/journey/types';
import {
  getCachedJourneySummary,
  getJourneySummaryCacheSnapshot,
} from '@/lib/journey/client';
import {
  ChevronRight,
  LogOut,
  HelpCircle,
  Shield,
  FileText,
  MessageCircle,
  X,
  Info,
  Camera,
  Stethoscope,
} from 'lucide-react';
import { performAppLogout } from '@/lib/auth/performAppLogout';
import {
  appTabCard,
  appTabMuted,
  appTabModalSurface,
  appTabModalBody,
  appTabModalClose,
  appTabSubtle,
  appTabAccent,
} from './appTabTheme';
import { normalizeJourneyResetMapProgress } from '@/lib/journey/resolveJourneyResetMapTotal';

/** 여정 탭 FAQ — MOVE RE 신규 사용자 안내 (production Journey sheet) */
const JOURNEY_FAQ_ITEMS = [
  {
    question: 'MOVE RE는 어떤 서비스인가요?',
    answer: [
      'MOVE RE는 운동 영상을 골라보는 앱이 아닙니다.',
      '처음 테스트한 몸 상태를 바탕으로, 지금 나에게 필요한 운동 세션을 만들고 리셋맵을 따라 실행하게 돕는 상태 기반 운동 실행 시스템입니다.',
      '핵심은 “무슨 운동을 할까?”가 아니라, 내 몸 상태에 맞는 순서로 꾸준히 실행할 수 있게 만드는 것입니다.',
    ],
  },
  {
    question: '테스트 결과는 무엇을 의미하나요?',
    answer: [
      '테스트 결과는 병명이나 진단명이 아니라, 현재 움직임에서 반복되기 쉬운 패턴을 정리한 것입니다.',
      '예를 들어 하체 안정성, 상체 가동성, 코어 조절, 좌우 차이, 운동 부족 상태 같은 요소를 바탕으로 지금 어떤 방향의 운동부터 시작하면 좋을지 보여줍니다.',
    ],
  },
  {
    question: 'MOVE RE는 병원 진단이나 치료를 대신하나요?',
    answer: [
      '아니요. MOVE RE는 병원 진단이나 치료를 대신하지 않습니다.',
      'MOVE RE는 사용자의 테스트 결과와 운동 기록을 바탕으로 일상에서 무리 없이 시작할 수 있는 운동 방향을 제안하는 서비스입니다.',
      '통증이 심하거나, 저림·날카로운 통증·부상 의심 증상이 있다면 운동을 중단하고 전문가의 상담을 받는 것이 좋습니다.',
    ],
  },
  {
    question: '왜 처음에 몸 상태 테스트를 하나요?',
    answer: [
      '처음 테스트는 단순 설문이 아니라, 첫 운동 세션을 만들기 위한 기준입니다.',
      'MOVE RE는 테스트 결과를 바탕으로 어떤 움직임을 먼저 깨울지, 어떤 동작은 조심해야 할지, 첫 세션을 어느 정도 강도로 시작할지 정합니다.',
      '즉, 테스트는 결과를 보기 위한 단계가 아니라 내 리셋맵과 첫 운동 세션을 만들기 위한 출발점입니다.',
    ],
  },
  {
    question: '리셋맵은 무엇인가요?',
    answer: [
      '리셋맵은 오늘 어떤 운동을 하면 되는지 보여주는 나만의 진행 지도입니다.',
      'MOVE RE가 만든 세션을 순서대로 따라가면서 완료한 세션, 다음에 해야 할 세션, 현재 진행률을 확인할 수 있습니다.',
      '복잡하게 운동을 고를 필요 없이, 지금 내 몸 상태에 맞는 다음 행동을 바로 확인하는 곳입니다.',
    ],
  },
  {
    question: '여정 탭에서는 무엇을 확인할 수 있나요?',
    answer: [
      '여정 탭은 내가 어디까지 왔는지 확인하는 공간입니다.',
      '현재 내 몸 상태 타입, 리셋맵 진행률, 최근 운동 기록, 수행 체감 등을 통해 내가 꾸준히 진행하고 있는지, 세션 강도가 나에게 맞는지 확인할 수 있습니다.',
      '운동을 “했는지”뿐 아니라, 내 몸이 어떻게 반응하고 있는지 보는 곳입니다.',
    ],
  },
  {
    question: '내 결과에 따라 운동이 어떻게 달라지나요?',
    answer: [
      'MOVE RE는 테스트 결과, 운동 경험, 불편감 여부, 주간 운동 빈도, 운동 기록을 함께 참고합니다.',
      '그래서 같은 테스트 결과를 가진 사용자라도 운동 경험이 적거나 불편감이 있는 경우에는 더 보수적인 세션으로 시작할 수 있습니다.',
      '목표는 어려운 운동을 많이 시키는 것이 아니라, 내 몸이 받아들일 수 있는 순서로 실행을 이어가게 만드는 것입니다.',
    ],
  },
  {
    question: '운동이 너무 쉽거나 어려우면 어떻게 되나요?',
    answer: [
      '운동 후 남기는 난이도와 몸 상태 기록이 다음 세션 조정에 참고됩니다.',
      '너무 어렵거나 불편감이 있었다면 이후 세션이 더 보수적으로 조정될 수 있고, 반대로 안정적으로 잘 수행했다면 점진적으로 다음 단계로 이어질 수 있습니다.',
      'MOVE RE는 한 번 만든 루틴을 고정해서 반복시키는 것이 아니라, 실행 기록을 바탕으로 다음 세션을 더 맞춰가는 구조입니다.',
    ],
  },
  {
    question: '운동 후 기록은 왜 필요한가요?',
    answer: [
      '운동 후 기록은 단순 체크가 아닙니다.',
      '완료 여부, 체감 난이도, 몸 상태 변화, 불편감 기록은 다음 세션을 너무 쉽거나 어렵지 않게 조정하는 데 사용됩니다.',
      '짧게라도 기록을 남길수록 MOVE RE가 지금 내 몸에 맞는 실행 흐름을 더 잘 이어갈 수 있습니다.',
    ],
  },
  {
    question: '카메라 영상이 저장되나요?',
    answer: [
      '아니요. 카메라 영상은 저장하지 않습니다.',
      '카메라 분석은 동작을 확인하는 동안 화면 속 주요 관절 위치를 읽어 움직임 흐름을 분석하는 방식입니다.',
      '쉽게 말하면 영상 자체를 보관하는 것이 아니라, 어깨·골반·무릎처럼 움직임을 파악하는 데 필요한 지점의 흐름만 분석에 사용합니다.',
    ],
  },
  {
    question: '카메라 분석은 꼭 해야 하나요?',
    answer: [
      '꼭 해야 하는 것은 아닙니다.',
      'MOVE RE는 기본 테스트 결과만으로도 시작할 수 있고, 카메라 분석은 움직임 정보를 조금 더 보완하기 위한 선택 기능입니다.',
      '카메라 분석을 하면 설문만으로 알기 어려운 움직임 신호를 참고해 결과 해석을 더 보완할 수 있습니다.',
    ],
  },
  {
    question: '운동 중 통증이 생기면 어떻게 해야 하나요?',
    answer: [
      '운동 중 날카로운 통증, 저림, 찌릿한 느낌, 심한 불편감이 생기면 즉시 중단하는 것이 좋습니다.',
      '가벼운 당김이나 운동감은 있을 수 있지만, 통증을 참고 끝까지 하는 것은 MOVE RE가 권장하는 방식이 아닙니다.',
      'MOVE RE의 원칙은 더 많이 하는 것이 아니라, 무리하지 않고 지속 가능한 방향으로 회복 흐름을 만드는 것입니다.',
    ],
  },
  {
    question: '결과 타입은 나중에 바뀔 수 있나요?',
    answer: [
      '네. 결과 타입은 고정된 성격표가 아닙니다.',
      '현재 테스트와 기록을 바탕으로 한 상태 해석이기 때문에, 운동을 이어가거나 다시 테스트하면 결과 해석이 달라질 수 있습니다.',
      'MOVE RE에서 중요한 것은 타입 이름 자체보다 지금 어떤 방향으로 운동을 시작하고 이어갈지입니다.',
    ],
  },
  {
    question: '앱 설치는 꼭 해야 하나요?',
    answer: [
      '반드시 설치해야 하는 것은 아니지만, 홈 화면에 추가하는 것을 권장합니다.',
      'MOVE RE는 한 번 보고 끝나는 서비스가 아니라 리셋맵을 따라 여러 번 다시 들어와야 하는 실행형 서비스입니다.',
      '홈 화면에 추가해두면 브라우저를 다시 찾지 않아도 바로 오늘의 세션으로 들어올 수 있어 운동을 이어가기 훨씬 쉽습니다.',
    ],
  },
] as const;

export interface JourneyTabViewV2Props {
  isVisible?: boolean;
  completedSessions?: number | null;
  totalSessions?: number | null;
}

type SheetId = 'faq' | 'ops' | 'privacy' | 'terms' | 'feedback' | null;

type FeedbackCategory = 'general' | 'bug' | 'question' | 'improvement';

export function JourneyTabViewV2({
  isVisible = true,
  completedSessions = 0,
  totalSessions = null,
}: JourneyTabViewV2Props) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [sheet, setSheet] = useState<SheetId>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackCategory, setFeedbackCategory] =
    useState<FeedbackCategory>('general');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState<
    'idle' | 'success' | 'error'
  >('idle');
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [journeySummary, setJourneySummary] = useState<JourneySummaryResponse | null>(null);
  const [journeyLoad, setJourneyLoad] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle');
  const journeySummaryRequestedRef = useRef(false);

  useEffect(() => {
    if (!isVisible) return;
    if (journeySummaryRequestedRef.current) return;

    const cached = getJourneySummaryCacheSnapshot();
    if (cached) {
      journeySummaryRequestedRef.current = true;
      setJourneySummary(cached);
      setJourneyLoad('ok');
      return;
    }

    journeySummaryRequestedRef.current = true;
    let cancelled = false;
    (async () => {
      setJourneyLoad('loading');
      const result = await getCachedJourneySummary();
      if (cancelled) return;
      if (result.ok) {
        setJourneySummary(result.data);
        setJourneyLoad('ok');
        return;
      }
      setJourneyLoad('err');
    })();
    return () => {
      cancelled = true;
    };
  }, [isVisible]);

  useEffect(() => {
    if (sheet !== 'faq') {
      setOpenFaqIndex(null);
    }
    if (sheet !== 'feedback') {
      setFeedbackStatus('idle');
      setFeedbackError(null);
    }
  }, [sheet]);

  async function handleFeedbackSubmit() {
    const message = feedbackMessage.trim();

    if (message.length < 5) {
      setFeedbackStatus('error');
      setFeedbackError('피드백을 5자 이상 입력해주세요.');
      return;
    }

    if (message.length > 2000) {
      setFeedbackStatus('error');
      setFeedbackError('피드백은 2000자 이내로 입력해주세요.');
      return;
    }

    setFeedbackSubmitting(true);
    setFeedbackStatus('idle');
    setFeedbackError(null);

    try {
      const { getSessionSafe } = await import('@/lib/supabase');
      const { session } = await getSessionSafe();
      const token = session?.access_token;

      if (!token) {
        setFeedbackStatus('error');
        setFeedbackError('로그인이 필요해요. 다시 로그인한 뒤 시도해주세요.');
        return;
      }

      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message,
          category: feedbackCategory,
        }),
      });

      if (!res.ok) {
        let code: string | undefined;
        try {
          const errBody = (await res.json()) as { code?: string };
          code = errBody.code;
        } catch {
          code = undefined;
        }
        setFeedbackStatus('error');
        if (code === 'UNAUTHORIZED') {
          setFeedbackError('로그인이 필요해요. 다시 로그인한 뒤 시도해주세요.');
        } else if (code === 'MESSAGE_TOO_SHORT') {
          setFeedbackError('피드백을 5자 이상 입력해주세요.');
        } else if (code === 'MESSAGE_TOO_LONG') {
          setFeedbackError('피드백은 2000자 이내로 입력해주세요.');
        } else {
          setFeedbackError('전송에 실패했어요. 잠시 후 다시 시도해주세요.');
        }
        return;
      }

      const data = (await res.json()) as { ok?: boolean };
      if (!data.ok) {
        setFeedbackStatus('error');
        setFeedbackError('전송에 실패했어요. 잠시 후 다시 시도해주세요.');
        return;
      }

      setFeedbackStatus('success');
      setFeedbackMessage('');
      setFeedbackCategory('general');
    } catch {
      setFeedbackStatus('error');
      setFeedbackError('전송에 실패했어요. 네트워크 상태를 확인해주세요.');
    } finally {
      setFeedbackSubmitting(false);
    }
  }

  const resetMap = normalizeJourneyResetMapProgress({
    total: totalSessions,
    completed: completedSessions,
  });

  const sheetRows: { id: SheetId; label: string; icon: typeof HelpCircle }[] = [
    { id: 'faq', label: 'FAQ', icon: HelpCircle },
    { id: 'ops', label: '운영 지침', icon: Info },
    { id: 'privacy', label: '개인정보 처리방침', icon: Shield },
    { id: 'terms', label: '서비스 이용약관', icon: FileText },
  ];

  return (
    <div className="px-4 pb-8 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-white">나의 여정</h1>
        <p className={`mt-2 text-[15px] leading-relaxed ${appTabMuted}`}>
          몸의 변화는 작은 실행이 쌓이며 만들어집니다.
        </p>
      </header>

      {/* B — movement type */}
      <div className={`${appTabCard} mb-4 p-5`}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className={`text-xs font-medium uppercase tracking-wide ${appTabSubtle}`}>
            현재 움직임 타입
          </span>
          <span className="rounded-full border border-orange-500/25 bg-orange-500/10 px-2 py-0.5 text-[10px] font-medium text-orange-400/95">
            분석 기반
          </span>
        </div>
        <p className="text-lg font-semibold text-white">
          {journeyLoad === 'loading'
            ? '불러오는 중…'
            : journeyLoad === 'err'
              ? '기록을 불러오지 못했어요'
              : journeySummary?.movement_type.label ?? '기록을 불러오지 못했어요'}
        </p>
        <p className={`mt-2 text-sm leading-relaxed ${appTabMuted}`}>
          {journeyLoad === 'loading'
            ? '잠깐만요, 데이터를 준비하고 있어요.'
            : journeyLoad === 'err'
              ? '잠시 후 다시 확인해주세요.'
              : journeySummary?.movement_type.summary ??
                '잠시 후 다시 확인해주세요.'}
        </p>
      </div>

      {/* C — reset map progress (SSOT: activeLite.progress.total_sessions) */}
      <div className={`${appTabCard} mb-4 p-5`}>
        <h2 className="text-sm font-semibold text-white">리셋맵 진행도</h2>
        {resetMap.empty ? (
          <p className={`mt-1 text-sm ${appTabMuted}`}>
            아직 리셋맵 진행 정보가 없어요. 홈에서 첫 세션을 시작하면 여기에 표시돼요.
          </p>
        ) : (
          <p className={`mt-1 text-sm ${appTabMuted}`}>
            총 {resetMap.totalSessions}개 세션 중 {resetMap.completedSafe}개 완료
          </p>
        )}
        <div className="mt-3 flex items-baseline justify-between gap-2">
          <span className={`text-2xl font-semibold ${appTabAccent}`}>{resetMap.pct}%</span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-orange-500/90 transition-all"
            style={{ width: `${resetMap.empty ? 0 : resetMap.pct}%` }}
          />
        </div>
        <p className={`mt-3 text-xs leading-relaxed ${appTabSubtle}`}>
          오늘은 무리보다 꾸준함이 더 중요해요.
        </p>
      </div>

      {/* D — 7-day metrics */}
      <div className={`${appTabCard} mb-4 p-5`}>
        <h2 className="mb-3 text-sm font-semibold text-white">최근 7일 운동 상태</h2>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              {
                k: '수행률',
                v:
                  journeyLoad === 'loading'
                    ? '…'
                    : journeyLoad === 'err'
                      ? '—'
                      : journeySummary?.recent_7d.completion_label ?? '—',
              },
              {
                k: '난이도 체감',
                v:
                  journeyLoad === 'loading'
                    ? '…'
                    : journeyLoad === 'err'
                      ? '—'
                      : journeySummary?.recent_7d.difficulty.label ?? '—',
              },
              {
                k: '수행 퀄리티',
                v:
                  journeyLoad === 'loading'
                    ? '…'
                    : journeyLoad === 'err'
                      ? '—'
                      : journeySummary?.recent_7d.quality.label ?? '—',
              },
            ] as const
          ).map((m) => (
            <div
              key={m.k}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-2 py-3 text-center"
            >
              <p className={`text-[10px] uppercase tracking-wide ${appTabSubtle}`}>{m.k}</p>
              <p className="mt-1 text-sm font-medium text-white">{m.v}</p>
            </div>
          ))}
        </div>
        <p className={`mt-4 text-sm leading-relaxed ${appTabMuted}`}>
          {journeyLoad === 'loading'
            ? '최근 활동 요약을 불러오는 중이에요.'
            : journeyLoad === 'err'
              ? '요약을 불러오지 못했어요. 잠시 후 다시 확인해주세요.'
              : journeySummary?.recent_7d.summary ??
                '요약을 불러오지 못했어요. 잠시 후 다시 확인해주세요.'}
        </p>
      </div>

      {/* Privacy + medical disclaimer */}
      <div className={`${appTabCard} mb-6 space-y-3 p-4`}>
        <div className="flex gap-3">
          <Camera className="mt-0.5 size-4 shrink-0 text-white/45" aria-hidden />
          <p className={`text-xs leading-relaxed ${appTabMuted}`}>
            카메라 모션 분석 시 영상은 저장하지 않으며, 분석에 필요한 움직임 신호만 사용됩니다.
          </p>
        </div>
        <div className="flex gap-3 border-t border-white/10 pt-3">
          <Stethoscope className="mt-0.5 size-4 shrink-0 text-white/45" aria-hidden />
          <p className={`text-xs leading-relaxed ${appTabSubtle}`}>
            본 기능은 의료 진단이 아니며, 통증이나 질환이 있는 경우 전문가 상담을 권장합니다.
          </p>
        </div>
      </div>

      {/* E — menu */}
      <section>
        <h2 className={`mb-2 text-xs font-medium uppercase tracking-wide ${appTabSubtle}`}>
          도움말 · 설정
        </h2>
        <div className="flex flex-col gap-1">
          {sheetRows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => setSheet(row.id)}
              className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-left transition hover:bg-white/[0.06]"
            >
              <span className="flex items-center gap-3">
                <row.icon className="size-4 text-white/50" aria-hidden />
                <span className="text-sm text-white">{row.label}</span>
              </span>
              <ChevronRight className="size-4 text-white/30" aria-hidden />
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSheet('feedback')}
            className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-left transition hover:bg-white/[0.06]"
            aria-label="피드백 및 질문 보내기"
          >
            <span className="flex items-center gap-3">
              <MessageCircle className="size-4 text-white/50" aria-hidden />
              <span className="text-sm text-white">피드백 및 질문 보내기</span>
            </span>
            <ChevronRight className="size-4 text-white/30" aria-hidden />
          </button>
        </div>

        {/* Direct links duplicate for 페이지 이동 선호 시 — 상단 버튼은 모달 우선 */}
        <div className="mt-2 flex flex-wrap gap-2">
          <Link
            href="/privacy"
            className={`text-xs underline-offset-2 ${appTabSubtle} hover:text-white/70`}
          >
            개인정보 (전체)
          </Link>
          <span className={appTabSubtle}>·</span>
          <Link
            href="/terms"
            className={`text-xs underline-offset-2 ${appTabSubtle} hover:text-white/70`}
          >
            이용약관 (전체)
          </Link>
        </div>
      </section>

      <div className="mt-8 border-t border-white/10 pt-6">
        <button
          type="button"
          disabled={loggingOut}
          onClick={() => {
            if (loggingOut) return;
            setLoggingOut(true);
            void performAppLogout(router).finally(() => setLoggingOut(false));
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white/75 transition hover:bg-white/[0.08] disabled:opacity-50"
        >
          <LogOut className="size-4 shrink-0 opacity-70" aria-hidden />
          {loggingOut ? '로그아웃 중…' : '로그아웃'}
        </button>
      </div>

      {/* Lightweight sheets */}
      {sheet ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-[#020617]/75 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSheet(null);
          }}
        >
          <div
            className={`max-h-[70vh] w-full max-w-md overflow-y-auto ${appTabModalSurface} p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]`}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-white">
                {sheet === 'faq' && 'FAQ'}
                {sheet === 'feedback' && '피드백 및 질문 보내기'}
                {sheet === 'ops' && '운영 지침'}
                {sheet === 'privacy' && '개인정보 안내'}
                {sheet === 'terms' && '이용약관 안내'}
              </h3>
              <button
                type="button"
                className={appTabModalClose}
                onClick={() => setSheet(null)}
                aria-label="닫기"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className={`space-y-3 text-sm leading-relaxed ${appTabModalBody}`}>
              {sheet === 'faq' && (
                <div className="space-y-2">
                  {JOURNEY_FAQ_ITEMS.map((item, index) => {
                    const isOpen = openFaqIndex === index;

                    return (
                      <section
                        key={item.question}
                        className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setOpenFaqIndex(isOpen ? null : index)
                          }
                          className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition hover:bg-white/[0.05]"
                          aria-expanded={isOpen}
                        >
                          <span className="text-sm font-semibold text-white">
                            {item.question}
                          </span>
                          <ChevronRight
                            className={`size-4 shrink-0 text-white/35 transition-transform ${
                              isOpen ? 'rotate-90 text-orange-400/80' : ''
                            }`}
                            aria-hidden
                          />
                        </button>

                        {isOpen && (
                          <div
                            className={`space-y-2 border-t border-white/10 px-3 pb-3 pt-2 text-sm leading-relaxed ${appTabModalBody}`}
                          >
                            {item.answer.map((paragraph, pIdx) => (
                              <p key={`${item.question}-${pIdx}`}>{paragraph}</p>
                            ))}
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>
              )}
              {sheet === 'feedback' && (
                <div className="space-y-4">
                  <p className={`text-sm leading-relaxed ${appTabModalBody}`}>
                    사용 중 불편한 점이나 궁금한 점을 남겨주세요. 확인 후 개선에 반영할게요.
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        ['general', '일반'],
                        ['bug', '오류'],
                        ['question', '질문'],
                        ['improvement', '개선 제안'],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setFeedbackCategory(value)}
                        className={`rounded-xl border px-3 py-2 text-sm transition ${
                          feedbackCategory === value
                            ? 'border-orange-500/50 bg-orange-500/15 font-medium text-white'
                            : 'border-white/10 bg-white/[0.03] text-white/85 hover:bg-white/[0.06]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={feedbackMessage}
                    onChange={(e) => setFeedbackMessage(e.target.value)}
                    maxLength={2000}
                    rows={6}
                    placeholder="예: 알림을 눌렀는데 로그인 화면으로 이동했어요."
                    className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm leading-relaxed text-white placeholder:text-white/35 outline-none focus:border-orange-500/40"
                  />

                  <div className="flex items-center justify-between text-xs text-white/40">
                    <span>{feedbackMessage.trim().length}/2000</span>
                  </div>

                  {feedbackStatus === 'success' && (
                    <p className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200">
                      피드백이 전송됐어요. 확인 후 개선에 반영할게요.
                    </p>
                  )}

                  {feedbackStatus === 'error' && feedbackError && (
                    <p className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-200">
                      {feedbackError}
                    </p>
                  )}

                  <button
                    type="button"
                    disabled={
                      feedbackSubmitting || feedbackMessage.trim().length < 5
                    }
                    onClick={() => void handleFeedbackSubmit()}
                    className="w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-500/90 disabled:opacity-50"
                  >
                    {feedbackSubmitting ? '전송 중…' : '피드백 보내기'}
                  </button>
                </div>
              )}
              {sheet === 'ops' && (
                <>
                  <p>MOVE RE는 움직임 습관을 돕는 실행 도구입니다. 의학적 처방이나 진단을 대체하지 않습니다.</p>
                  <p>서비스는 정책에 따라 사전 고지 후 변경될 수 있습니다.</p>
                </>
              )}
              {sheet === 'privacy' && (
                <p>
                  자세한 처리 방침은{' '}
                  <Link href="/privacy" className="text-orange-400 underline-offset-2 hover:underline">
                    개인정보 처리방침 페이지
                  </Link>
                  를 확인해 주세요.
                </p>
              )}
              {sheet === 'terms' && (
                <p>
                  약관 전문은{' '}
                  <Link href="/terms" className="text-orange-400 underline-offset-2 hover:underline">
                    서비스 이용약관
                  </Link>
                  에서 보실 수 있습니다.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
