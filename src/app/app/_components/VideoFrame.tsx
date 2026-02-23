'use client';

export default function VideoFrame() {
  return (
    <div className="aspect-video w-full overflow-hidden rounded-[var(--radius)] bg-[var(--surface-2)] border border-[color:var(--border)] flex items-center justify-center">
      <div className="flex flex-col items-center gap-2 text-[var(--muted)]">
        <svg
          className="size-16"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span className="text-sm">비디오 placeholder</span>
      </div>
    </div>
  );
}
