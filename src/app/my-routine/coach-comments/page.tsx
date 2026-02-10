/**
 * 코치 코멘트 표시 페이지
 * 
 * 사용자에게 코치 코멘트를 표시합니다.
 * AI 생성 여부 및 코치 수정 내역을 포함합니다.
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { CoachCommentResponse } from '@/lib/coach-comments/ai-generator';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface CoachComment {
  id: string;
  userId: string;
  originalResultId: string;
  retestResultId: string;
  commentData: CoachCommentResponse;
  createdAt: string;
  updatedAt: string | null;
}

export default function CoachCommentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<CoachComment[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const loadComments = async () => {
      try {
        // 로그인 확인
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.push('/login');
          return;
        }

        const currentUserId = session.user.id;
        setUserId(currentUserId);

        // 코치 코멘트 조회
        const res = await fetch(`/api/coach-comments/user/${currentUserId}`);

        if (!res.ok) {
          if (res.status === 404) {
            setComments([]);
            return;
          }
          throw new Error('코치 코멘트 조회 실패');
        }

        const data = await res.json();
        setComments(data.comments || []);
      } catch (error) {
        console.error('코치 코멘트 로드 에러:', error);
      } finally {
        setLoading(false);
      }
    };

    loadComments();
  }, [router]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[var(--brand)] border-t-transparent" />
          <p className="text-lg font-medium text-[var(--text)]">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] px-4 py-8 md:py-16">
      <div className="mx-auto max-w-4xl">
        {/* 헤더 */}
        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="mb-2 text-3xl font-bold text-[var(--text)]">코치 코멘트</h1>
              <p className="text-[var(--muted)]">재검사 결과에 대한 개인화된 피드백</p>
            </div>
            <Button
              onClick={() => router.push('/my-routine')}
              variant="outline"
              className="border-[var(--border)] text-[var(--text)]"
            >
              루틴으로 돌아가기
            </Button>
          </div>
        </div>

        {/* 코치 코멘트 목록 */}
        {comments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="mb-4 text-lg text-[var(--muted)]">
                아직 코치 코멘트가 없습니다.
              </p>
              <p className="text-sm text-[var(--muted)]">
                7일 운동 루틴을 완료하고 재검사를 받으면 코치 코멘트를 받을 수 있습니다.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {comments.map((comment) => (
              <Card key={comment.id} className="border-[var(--border)] bg-[var(--surface)]">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="mb-2 text-xl text-[var(--text)]">
                        재검사 피드백
                      </CardTitle>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {formatDate(comment.createdAt)}
                        </Badge>
                        {comment.updatedAt && comment.updatedAt !== comment.createdAt && (
                          <Badge variant="outline" className="text-xs">
                            코치 수정됨
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* 인사 및 격려 */}
                  <div className="rounded-lg bg-[var(--brand-soft)] p-4">
                    <p className="text-base font-medium text-[var(--text)]">
                      {comment.commentData.greeting}
                    </p>
                  </div>

                  {/* 주요 변화 요약 */}
                  <div>
                    <h3 className="mb-2 text-lg font-semibold text-[var(--text)]">주요 변화 요약</h3>
                    <p className="text-[var(--text)] leading-relaxed">
                      {comment.commentData.summary}
                    </p>
                  </div>

                  {/* 개선 포인트 */}
                  {comment.commentData.improvements && comment.commentData.improvements.length > 0 && (
                    <div>
                      <h3 className="mb-3 text-lg font-semibold text-[var(--text)]">
                        개선 포인트
                      </h3>
                      <ul className="space-y-2">
                        {comment.commentData.improvements.map((improvement, index) => (
                          <li
                            key={index}
                            className="flex items-start gap-2 text-[var(--text)]"
                          >
                            <span className="mt-1 text-[var(--brand)]">✓</span>
                            <span className="flex-1 leading-relaxed">{improvement}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 주의 영역 및 개선 방안 */}
                  {comment.commentData.focusAreas && comment.commentData.focusAreas.length > 0 && (
                    <div>
                      <h3 className="mb-3 text-lg font-semibold text-[var(--text)]">
                        주의 영역 및 개선 방안
                      </h3>
                      <ul className="space-y-2">
                        {comment.commentData.focusAreas.map((area, index) => (
                          <li
                            key={index}
                            className="flex items-start gap-2 text-[var(--text)]"
                          >
                            <span className="mt-1 text-[var(--warn)]">⚠</span>
                            <span className="flex-1 leading-relaxed">{area}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 다음 단계 조언 */}
                  {comment.commentData.nextSteps && comment.commentData.nextSteps.length > 0 && (
                    <div>
                      <h3 className="mb-3 text-lg font-semibold text-[var(--text)]">
                        다음 단계 조언
                      </h3>
                      <ul className="space-y-2">
                        {comment.commentData.nextSteps.map((step, index) => (
                          <li
                            key={index}
                            className="flex items-start gap-2 text-[var(--text)]"
                          >
                            <span className="mt-1 text-[var(--brand)]">{index + 1}.</span>
                            <span className="flex-1 leading-relaxed">{step}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 마무리 격려 */}
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4">
                    <p className="text-center text-base font-medium text-[var(--text)]">
                      {comment.commentData.encouragement}
                    </p>
                  </div>

                  {/* 코멘트 메타 정보 */}
                  <div className="border-t border-[var(--border)] pt-4">
                    <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                      <span>작성일: {formatDate(comment.createdAt)}</span>
                      {comment.updatedAt && comment.updatedAt !== comment.createdAt && (
                        <span>수정일: {formatDate(comment.updatedAt)}</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
