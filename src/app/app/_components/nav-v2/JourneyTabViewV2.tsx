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

/** 피드백 수신 메일 — 운영 시 교체 */
const SUPPORT_FEEDBACK_MAILTO = 'mailto:support@posturelab.com?subject=MOVE%20RE%20피드백';

export interface JourneyTabViewV2Props {
  isVisible?: boolean;
  completedSessions?: number | null;
  totalSessions?: number | null;
}

type SheetId = 'faq' | 'ops' | 'privacy' | 'terms' | null;

export function JourneyTabViewV2({
  isVisible = true,
  completedSessions = 0,
  totalSessions = null,
}: JourneyTabViewV2Props) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [sheet, setSheet] = useState<SheetId>(null);
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
          <a
            href={SUPPORT_FEEDBACK_MAILTO}
            className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-left transition hover:bg-white/[0.06]"
          >
            <span className="flex items-center gap-3">
              <MessageCircle className="size-4 text-white/50" aria-hidden />
              <span className="text-sm text-white">피드백 및 질문 보내기</span>
            </span>
            <ChevronRight className="size-4 text-white/30" aria-hidden />
          </a>
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
                <>
                  <p>• 세션은 하루 권장 횟수 안에서 선택해 진행할 수 있습니다.</p>
                  <p>• 몸이 무겁게 느껴지면 난이도를 낮추거나 휴식을 권장합니다.</p>
                  <p>• 앱 내 수치는 참고용이며 개인 상황에 따라 다를 수 있습니다.</p>
                </>
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
