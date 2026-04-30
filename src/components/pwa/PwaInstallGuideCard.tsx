'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePwaInstallGuideState } from '@/lib/pwa/usePwaInstallGuideState';

const DISMISS_KEY = 'move-re:pwa-install-guide-dismissed-at';
const DISMISS_TTL_MS = 72 * 60 * 60 * 1000;

export function PwaInstallGuideCard({ className }: { className?: string }) {
  const guide = usePwaInstallGuideState();
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      const ts = raw ? Number(raw) : 0;
      setDismissed(ts > 0 && Date.now() - ts < DISMISS_TTL_MS);
    } catch {
      setDismissed(false);
    }
  }, []);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    setDismissed(true);
  }, []);

  const copyLink = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const href = window.location.href;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(href);
      } else {
        const ta = document.createElement('textarea');
        ta.value = href;
        ta.setAttribute('readonly', '');
        ta.style.position = 'absolute';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }, []);

  const isVisible = useMemo(() => {
    if (!guide.hydrated || dismissed) return false;
    if (guide.state === 'already_standalone') return false;
    return guide.state !== 'desktop_or_unknown';
  }, [dismissed, guide.hydrated, guide.state]);

  if (!isVisible) return null;

  const isPrompt = guide.state === 'android_install_prompt_available';

  return (
    <section className={`rounded-xl border border-amber-500/20 bg-[rgba(251,191,36,0.07)] px-4 py-4 backdrop-blur-xl ${className ?? ''}`} style={{ fontFamily: 'var(--font-sans-noto)' }}>
      <p className="text-xs font-medium uppercase tracking-wide text-amber-200/80">홈 화면에 저장</p>
      <p className="mt-2 text-sm font-light leading-relaxed text-[#c6c6cd]">
        {guide.state === 'ios_safari' && '공유 버튼에서 홈 화면에 추가를 선택해 주세요.'}
        {guide.state === 'ios_in_app_browser' && '지금은 인앱 브라우저예요. Safari로 열면 홈 화면에 저장할 수 있어요.'}
        {guide.state === 'android_in_app_browser' && '지금은 인앱 브라우저예요. Chrome으로 열면 홈 화면에 저장할 수 있어요.'}
        {(guide.state === 'android_install_prompt_unavailable' || guide.state === 'android_install_prompt_available') && '홈 화면에 저장하면 Move Re를 더 빠르게 이어갈 수 있어요.'}
      </p>
      <div className="mt-3 flex gap-2">
        {isPrompt ? (
          <button type="button" onClick={() => void guide.promptInstall()} className="flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-amber-500/35 bg-[rgba(171,76,0,0.25)] px-3 text-sm font-semibold text-[#ffb77d]">홈 화면에 저장</button>
        ) : (
          <button type="button" onClick={() => void copyLink()} className="flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-[#dce1fb]">{copied ? '복사됐어요' : '링크 복사'}</button>
        )}
        <button type="button" onClick={dismiss} className="flex min-h-[44px] items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-[#dce1fb]">나중에</button>
      </div>
    </section>
  );
}
