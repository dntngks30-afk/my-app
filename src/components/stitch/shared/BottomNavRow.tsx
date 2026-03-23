'use client';

export type StitchBottomNavRowProps = {
  left?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
};

export function StitchBottomNavRow({ left, right, className = '' }: StitchBottomNavRowProps) {
  if (!left && right) {
    return <div className={`w-full ${className}`}>{right}</div>;
  }
  if (left && !right) {
    return <div className={`w-full ${className}`}>{left}</div>;
  }
  return (
    <div className={`flex w-full items-stretch justify-between gap-3 ${className}`}>
      <div className="min-w-0 flex-1">{left}</div>
      <div className="min-w-0 flex-1">{right}</div>
    </div>
  );
}
