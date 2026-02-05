import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-4xl mx-auto text-center">
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 md:p-12">
          <h1 className="text-4xl font-bold text-white mb-4">아티클을 찾을 수 없습니다</h1>
          <p className="text-slate-300 mb-8">
            요청하신 아티클이 존재하지 않거나 삭제되었습니다.
          </p>
          <Link
            href="/articles"
            className="inline-block px-6 py-3 bg-[#f97316] text-white font-semibold rounded-xl hover:bg-[#ea580c] transition-all duration-200"
          >
            아티클 목록으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}
