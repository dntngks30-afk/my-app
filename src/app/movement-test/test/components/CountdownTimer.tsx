'use client';

import { useEffect, useState } from 'react';

interface CountdownTimerProps {
  initialSeconds: number;
  onComplete: () => void;
  label?: string;
}

export default function CountdownTimer({ initialSeconds, onComplete, label }: CountdownTimerProps) {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    if (seconds <= 0) {
      onComplete();
      return;
    }

    const timer = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [seconds, onComplete]);

  const formatTime = (sec: number) => {
    return sec.toString().padStart(2, '0');
  };

  return (
    <div className="flex flex-col items-center justify-center">
      {label && <p className="text-slate-300 text-lg mb-2">{label}</p>}
      <div className="text-6xl font-bold text-[#f97316]">
        {formatTime(seconds)}
      </div>
    </div>
  );
}
