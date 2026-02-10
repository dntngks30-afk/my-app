'use client';

/**
 * 재검사 결과 비교 페이지 (Client)
 *
 * ✅ useSearchParams() 사용 → page.tsx에서 Suspense로 감싸야 빌드 통과
 */

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser as supabase } from '@/lib/supabase';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import {
  generateComparisonReport,
  type ComparisonReport,
} from '@/lib/movement-test/result-comparison';

export default function RetestComparisonClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<ComparisonReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadComparison = async () => {
      try {
        const originalTestId = searchParams.get('original');
        const retestId = searchParams.get('retest');

        if (!originalTestId || !retestId) {
          setError('비교할 검사 결과가 없습니다.');
          setLoading(false);
          return;
        }

        // 로그인 확인
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.push('/login');
          return;
        }

        // 검사 결과 조회
        const { data: original, error: originalError } = await supabase
          .from('movement_test_results')
          .select('*')
          .eq('id', originalTestId)
          .single();

        const { data: retest, error: retestError } = await supabase
          .from('movement_test_results')
          .select('*')
          .eq('id', retestId)
          .single();

        if (originalError || retestError || !original || !retest) {
          setError('검사 결과를 찾을 수 없습니다.');
          setLoading(false);
          return;
        }

        // 사용자 소유 확인
        if (
          (original.user_id && original.user_id !== session.user.id) ||
          (retest.user_id && retest.user_id !== session.user.id)
        ) {
          setError('권한이 없습니다.');
          setLoading(false);
          return;
        }

        // 비교 리포트 생성
        const comparisonReport = generateComparisonReport(original, retest);
        setReport(comparisonReport);
      } catch (err) {
        console.error('비교 로드 에러:', err);
        setError('비교 결과를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    loadComparison();
  }, [router, searchParams]);

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

  if (error || !report) {
    return (
      <div className="min-h-screen bg-[var(--bg)] px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <Card className="text-center">
            <CardHeader>
              <CardTitle className="text-2xl text-[var(--text)]">오류</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-6 text-[var(--muted)]">
                {error || '비교 결과를 불러올 수 없습니다.'}
              </p>
              <Button
                onClick={() => router.push('/my-routine')}
                className="bg-[var(--brand)] text-white"
              >
                내 루틴으로 돌아가기
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const { comparison } = report;

  return (
    <div className="min-h-screen bg-[var(--bg)] px-4 py-8 md:py-16">
      <div className="mx-auto max-w-5xl">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-[var(--text)]">
            재검사 결과 비교
          </h1>
          <p className="text-[var(--muted)]">원본 검사와 재검사 결과를 비교합니다</p>
        </div>

        {/* 전체 추세 카드 */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-xl text-[var(--text)]">전체 추세</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Badge
                className={
                  comparison.overallTrend === 'improved'
                    ? 'bg-green-500 text-white'
                    : comparison.overallTrend === 'worsened'
                      ? 'bg-red-500 text-white'
                      : 'bg-blue-500 text-white'
                }
              >
                {comparison.overallTrend === 'improved'
                  ? '개선됨'
                  : comparison.overallTrend === 'worsened'
                    ? '주의 필요'
                    : '안정적'}
              </Badge>
              <p className="text-[var(--text)]">{comparison.summary}</p>
            </div>
          </CardContent>
        </Card>

        {/* 타입 변화 */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-xl text-[var(--text)]">타입 변화</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <p className="mb-2 text-sm text-[var(--muted)]">원본 검사</p>
                <Badge variant="outline" className="text-lg">
                  {comparison.originalMainType}
                </Badge>
              </div>
              <div>
                <p className="mb-2 text-sm text-[var(--muted)]">재검사</p>
                <Badge variant="outline" className="text-lg">
                  {comparison.newMainType}
                </Badge>
              </div>
            </div>
            {comparison.typeChanged && comparison.typeChangeDirection && (
              <div className="mt-4">
                <Badge
                  className={
                    comparison.typeChangeDirection === 'improved'
                      ? 'bg-green-500 text-white'
                      : comparison.typeChangeDirection === 'worsened'
                        ? 'bg-yellow-500 text-white'
                        : 'bg-gray-500 text-white'
                  }
                >
                  {comparison.typeChangeDirection === 'improved'
                    ? '✓ 개선됨'
                    : comparison.typeChangeDirection === 'worsened'
                      ? '⚠ 주의 필요'
                      : '→ 변화 없음'}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 점수 변화 */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-xl text-[var(--text)]">점수 변화</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {comparison.scoreChanges.map((change) => {
                const typeNames: Record<string, string> = {
                  D: '담직형',
                  N: '날림형',
                  B: '버팀형',
                  H: '흘림형',
                };
                const typeName = typeNames[change.type] || change.type;
                const isPositive = change.change < 0; // 점수 감소 = 개선

                return (
                  <div
                    key={change.type}
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-[var(--text)]">
                          {typeName}
                        </h3>
                        <div className="mt-1 flex items-center gap-4 text-sm text-[var(--muted)]">
                          <span>
                            {change.original}점 → {change.new}점
                          </span>
                          <span
                            className={
                              isPositive
                                ? 'text-green-600'
                                : change.change > 0
                                  ? 'text-red-600'
                                  : 'text-[var(--muted)]'
                            }
                          >
                            {change.change > 0 ? '+' : ''}
                            {change.change}점 ({change.changePercent > 0 ? '+' : ''}
                            {change.changePercent}%)
                          </span>
                        </div>
                      </div>
                      <Badge
                        variant={isPositive ? 'default' : 'destructive'}
                        className={isPositive ? 'bg-green-500 text-white' : ''}
                      >
                        {isPositive ? '개선' : change.change > 0 ? '증가' : '변화 없음'}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Confidence 변화 */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-xl text-[var(--text)]">신뢰도 변화</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-sm text-[var(--muted)]">원본</p>
                <p className="text-2xl font-bold text-[var(--text)]">
                  {comparison.confidenceChange.original}%
                </p>
              </div>
              <div className="flex-1">
                <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
                  <div
                    className="h-full bg-[var(--brand)] transition-all"
                    style={{
                      width: `${Math.max(
                        comparison.confidenceChange.original,
                        comparison.confidenceChange.new
                      )}%`,
                    }}
                  />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm text-[var(--muted)]">재검사</p>
                <p className="text-2xl font-bold text-[var(--text)]">
                  {comparison.confidenceChange.new}%
                </p>
              </div>
            </div>
            <div className="mt-4 text-center">
              <span
                className={
                  comparison.confidenceChange.change > 0
                    ? 'text-green-600'
                    : comparison.confidenceChange.change < 0
                      ? 'text-red-600'
                      : 'text-[var(--muted)]'
                }
              >
                {comparison.confidenceChange.change > 0 ? '+' : ''}
                {comparison.confidenceChange.change}% 변화
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 개선 포인트 */}
        {comparison.improvementPoints.length > 0 && (
          <Card className="mb-8 border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="text-xl text-green-800">개선 포인트</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {comparison.improvementPoints.map((point, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-green-800">
                    <span>✓</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* 주의 영역 */}
        {comparison.areasToFocus.length > 0 && (
          <Card className="mb-8 border-yellow-200 bg-yellow-50">
            <CardHeader>
              <CardTitle className="text-xl text-yellow-800">주의 영역</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {comparison.areasToFocus.map((area, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-yellow-800">
                    <span>⚠</span>
                    <span>{area}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* 권장사항 */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-xl text-[var(--text)]">권장사항</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {report.recommendations.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-2 text-[var(--text)]">
                  <span>•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* 다음 단계 */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-xl text-[var(--text)]">다음 단계</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {report.nextSteps.map((step, idx) => (
                <li key={idx} className="flex items-start gap-2 text-[var(--text)]">
                  <span>→</span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* 액션 버튼 */}
        <div className="flex gap-4">
          <Button
            onClick={() => router.push('/my-routine')}
            className="flex-1 bg-[var(--brand)] text-white"
          >
            내 루틴 보기
          </Button>
          <Button
            onClick={() => router.push('/movement-test/result')}
            variant="outline"
            className="flex-1"
          >
            재검사 결과 상세보기
          </Button>
        </div>
      </div>
    </div>
  );
}
