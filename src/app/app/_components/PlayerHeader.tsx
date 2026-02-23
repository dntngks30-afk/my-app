'use client';

import Link from 'next/link';

export default function PlayerHeader() {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-[color:var(--border)] bg-[var(--surface)] px-4">
      <Link
        href="/app"
        className="flex size-10 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--surface-2)]"
        aria-label="뒤로가기"
      >
        <svg className="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </Link>
      <h1
        className="text-lg font-semibold text-[var(--text)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Move Re
      </h1>
      <button
        type="button"
        aria-label="설정"
        className="flex size-10 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--surface-2)]"
      >
        <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.296-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </button>
    </header>
  );
}
