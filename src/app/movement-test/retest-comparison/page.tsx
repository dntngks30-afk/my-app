import { Suspense } from "react";
import RetestComparisonClient from "./RetestComparisonClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6">로딩 중...</div>}>
      <RetestComparisonClient />
    </Suspense>
  );
}
