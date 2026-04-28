'use client';

/**
 * Midnight base + subtle radial glow (no external assets).
 */
export default function MoveReAuthBackground() {
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      aria-hidden
    >
      <div className="absolute inset-0 bg-[#0c1324]" />
      <div
        className="absolute left-1/2 top-[-20%] h-[min(70vh,520px)] w-[min(120vw,720px)] -translate-x-1/2 rounded-full opacity-40 blur-[100px]"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(255, 183, 125, 0.12) 0%, transparent 55%)',
        }}
      />
      <div
        className="absolute bottom-[-30%] right-[-20%] h-[min(50vh,400px)] w-[min(80vw,480px)] rounded-full opacity-25 blur-[90px]"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(35, 41, 60, 0.9) 0%, transparent 60%)',
        }}
      />
    </div>
  );
}
