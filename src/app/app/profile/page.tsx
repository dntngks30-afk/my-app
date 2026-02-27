'use client';

import BottomNav from '../_components/BottomNav';

export default function ProfilePage() {
  return (
    <div className="min-h-screen bg-[#f8f6f0] pb-20">
      <header className="px-4 pt-6">
        <h1 className="text-2xl font-bold text-slate-800">마이</h1>
        <p className="mt-1 text-sm text-stone-500">
          설정 및 프로필
        </p>
      </header>
      <BottomNav />
    </div>
  );
}
