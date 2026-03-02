/**
 * Demo Deep Test - Run wizard (NO LOGIN)
 * 404 unless DEMO_DEEP_TEST_ENABLED=1
 */

import { notFound } from 'next/navigation';
import DemoWizard from './_components/DemoWizard';

export default function DemoDeepTestRunPage() {
  if (process.env.DEMO_DEEP_TEST_ENABLED !== '1') {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#f8f6f0]">
      <div className="p-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400 text-slate-900 text-xs font-bold mb-4">
          DEMO (NO LOGIN)
        </div>
        <DemoWizard />
      </div>
    </div>
  );
}
