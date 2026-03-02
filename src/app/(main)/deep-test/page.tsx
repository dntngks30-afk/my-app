/**
 * Demo Deep Test - Landing (NO LOGIN)
 * 404 unless DEMO_DEEP_TEST_ENABLED=1
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';

const nbCard =
  'rounded-2xl border-2 border-slate-950 bg-white p-6 shadow-[4px_4px_0px_0px_rgba(2,6,23,1)]';
const nbBtnPrimary =
  'block w-full rounded-full border-2 border-slate-950 bg-slate-800 py-4 text-center text-base font-bold text-white shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition hover:opacity-95';

export default function DemoDeepTestPage() {
  if (process.env.DEMO_DEEP_TEST_ENABLED !== '1') {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#f8f6f0] p-6">
      <div className="max-w-md mx-auto space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400 text-slate-900 text-xs font-bold">
          DEMO (NO LOGIN)
        </div>

        <h1 className="text-xl font-bold text-slate-800">
          심화 테스트 데모
        </h1>

        <div className={nbCard}>
          <p className="text-sm text-stone-600 mb-4">
            로그인 없이 심화 테스트를 체험해 보세요. 결과는 브라우저에만 저장됩니다.
          </p>
          <Link href="/deep-test/run" className={nbBtnPrimary}>
            데모 테스트 시작
          </Link>
        </div>
      </div>
    </div>
  );
}
