/**
 * Demo Deep Test - Result (NO LOGIN)
 * 404 unless DEMO_DEEP_TEST_ENABLED=1
 */

export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import DemoResultClient from './DemoResultClient';

export default function DemoDeepTestResultPage() {
  if (process.env.DEMO_DEEP_TEST_ENABLED !== '1') {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#f8f6f0]">
      <div className="p-4">
        <DemoResultClient />
      </div>
    </div>
  );
}
