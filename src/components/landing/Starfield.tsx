'use client';

/**
 * Landing 전용 별 배경 오버레이
 * 시안: 미세한 별/우주 느낌
 */
export function Starfield() {
  const stars = [
    { top: '10%', left: '20%', size: 2 },
    { top: '30%', left: '80%', size: 1 },
    { top: '70%', left: '40%', size: 2 },
    { top: '50%', left: '10%', size: 1 },
    { top: '85%', left: '90%', size: 2 },
    { top: '25%', left: '55%', size: 1 },
    { top: '65%', left: '15%', size: 2 },
  ];

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      {stars.map((s, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white opacity-30"
          style={{
            top: s.top,
            left: s.left,
            width: s.size,
            height: s.size,
          }}
        />
      ))}
    </div>
  );
}
