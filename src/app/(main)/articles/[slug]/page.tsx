'use client';

/**
 * 아티클 상세 페이지
 * 
 * I5: Articles MVP 구현
 * SDD 라우트: /articles/[slug]
 */

import { use } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getArticleBySlug } from '../data/articles';

interface ArticlePageProps {
  params: Promise<{ slug: string }>;
}

export default function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = use(params);
  const article = getArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  // Markdown을 간단한 HTML로 변환
  const formatContent = (content: string) => {
    const lines = content.split('\n');
    const result: string[] = [];
    let inList = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // 빈 줄 처리
      if (trimmed === '') {
        if (inList) {
          result.push('</ul>');
          inList = false;
        }
        continue;
      }

      // 헤더 처리
      if (trimmed.startsWith('# ')) {
        if (inList) {
          result.push('</ul>');
          inList = false;
        }
        result.push(`<h1 class="text-3xl font-bold text-white mt-8 mb-4">${trimmed.substring(2)}</h1>`);
        continue;
      }
      if (trimmed.startsWith('## ')) {
        if (inList) {
          result.push('</ul>');
          inList = false;
        }
        result.push(`<h2 class="text-2xl font-bold text-white mt-6 mb-3">${trimmed.substring(3)}</h2>`);
        continue;
      }
      if (trimmed.startsWith('### ')) {
        if (inList) {
          result.push('</ul>');
          inList = false;
        }
        result.push(`<h3 class="text-xl font-semibold text-white mt-4 mb-2">${trimmed.substring(4)}</h3>`);
        continue;
      }

      // 리스트 처리
      if (trimmed.startsWith('- ')) {
        if (!inList) {
          result.push('<ul class="list-disc list-inside space-y-2 mb-4 text-slate-300">');
          inList = true;
        }
        const listContent = trimmed.substring(2).replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');
        result.push(`<li>${listContent}</li>`);
        continue;
      }

      // 일반 텍스트
      if (inList) {
        result.push('</ul>');
        inList = false;
      }
      const formatted = trimmed.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');
      result.push(`<p class="text-slate-300 leading-relaxed mb-4">${formatted}</p>`);
    }

    if (inList) {
      result.push('</ul>');
    }

    return result.join('\n');
  };

  const formattedContent = formatContent(article.content);

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-3xl mx-auto">
        {/* 뒤로가기 */}
        <Link
          href="/articles"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-8 transition-colors"
        >
          <span>←</span>
          <span>아티클 목록으로</span>
        </Link>

        {/* 헤더 */}
        <div className="mb-8">
          {article.category && (
            <span className="inline-block px-3 py-1 text-sm font-medium text-[#f97316] bg-[#f97316]/10 rounded-full mb-4">
              {article.category}
            </span>
          )}
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            {article.title}
          </h1>
          <p className="text-xl text-slate-300 mb-6">
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

        {/* 본문 */}
        <article className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 md:p-12">
          <div
            className="prose prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: formattedContent }}
          />
        </article>

        {/* 하단 네비게이션 */}
        <div className="mt-12 pt-8 border-t border-slate-700">
          <Link
            href="/articles"
            className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors"
          >
            <span>←</span>
            <span>모든 아티클 보기</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
