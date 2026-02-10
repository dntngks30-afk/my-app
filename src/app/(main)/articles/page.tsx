'use client';

/**
 * 아티클 리스트 페이지
 * 
 * I5: Articles MVP 구현
 * SDD 라우트: /articles
 */

import Link from 'next/link';
import { getAllArticles } from './data/articles';

export default function ArticlesPage() {
  const articles = getAllArticles();

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            아티클
          </h1>
          <p className="text-slate-300 text-lg">
            움직임과 자세에 관한 유용한 정보를 만나보세요
          </p>
        </div>

        {/* 아티클 리스트 */}
        <div className="space-y-6">
          {articles.map((article) => (
            <Link
              key={article.slug}
              href={`/articles/${article.slug}`}
              className="block bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 md:p-8 hover:border-slate-600 transition-all duration-200 hover:shadow-xl"
            >
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="flex-1">
                  {article.category && (
                    <span className="inline-block px-3 py-1 text-xs font-medium text-[#f97316] bg-[#f97316]/10 rounded-full mb-3">
                      {article.category}
                    </span>
                  )}
                  <h2 className="text-2xl font-bold text-white mb-3 hover:text-[#f97316] transition-colors">
                    {article.title}
                  </h2>
                  <p className="text-slate-300 mb-4 line-clamp-2">
                    {article.description}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-slate-400">
                    <time dateTime={article.publishedAt}>
                      {new Date(article.publishedAt).toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </time>
                    {article.readTime && (
                      <>
                        <span>•</span>
                        <span>{article.readTime}분 읽기</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <span className="text-slate-400 text-sm md:text-base">→</span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* 빈 상태 */}
        {articles.length === 0 && (
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 md:p-12 text-center">
            <p className="text-slate-300 text-lg">
              아직 등록된 아티클이 없습니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
