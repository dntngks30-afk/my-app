/**
 * 운동 루틴 대시보드 페이지
 * 
 * 사용자의 현재 활성 루틴을 표시하고 관리합니다.
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface Exercise {
  id: string;
  name: string;
  description: string;
  category: string;
  duration: number;
  sets?: number;
  reps?: number;
  holdTime?: number;
  difficulty: string;
}

interface RoutineDay {
  id: string;
  day_number: number;
  exercises: Exercise[];
  completed_at: string | null;
  notes: string | null;
  totalDuration?: number;
}

interface Routine {
  id: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  progress: number;
  completedDays: number;
  totalDays: number;
}

export default function MyRoutinePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [days, setDays] = useState<RoutineDay[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [completingDay, setCompletingDay] = useState<number | null>(null);
  const [startingRoutine, setStartingRoutine] = useState(false);

  useEffect(() => {
    const loadRoutine = async () => {
      try {
        // 로그인 확인
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.push('/app/auth?next=' + encodeURIComponent('/my-routine'));
          return;
        }

        // 루틴 조회 (세션 토큰 사용)
        const token = session.access_token;
        const res = await fetch('/api/workout-routine/get', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          if (res.status === 404) {
            // 루틴이 없음
            setRoutine(null);
            setDays([]);
            return;
          }
          throw new Error('루틴 조회 실패');
        }

        const data = await res.json();
        setRoutine(data.routine);
        setDays(data.days || []);

        // 첫 번째 미완료 일자 선택 (또는 첫 번째 일자)
        const firstIncomplete = data.days?.find((d: RoutineDay) => !d.completed_at);
        if (firstIncomplete) {
          setSelectedDay(firstIncomplete.day_number);
        } else if (data.days && data.days.length > 0) {
          setSelectedDay(data.days[0].day_number);
        }
      } catch (error) {
        console.error('루틴 로드 에러:', error);
      } finally {
        setLoading(false);
      }
    };

    loadRoutine();
  }, [router]);

  const handleStartRoutine = async () => {
    if (!routine) return;
    setStartingRoutine(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/app/auth?next=' + encodeURIComponent('/my-routine'));
        return;
      }
      const res = await fetch('/api/workout-routine/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ routineId: routine.id }),
      });
      if (!res.ok) throw new Error('시작 처리 실패');
      const data = await res.json();
      setRoutine((prev) =>
        prev
          ? {
              ...prev,
              status: 'active',
              started_at: data.startedAt,
            }
          : null
      );
    } catch (error) {
      console.error('시작 에러:', error);
      alert('시작 처리에 실패했습니다.');
    } finally {
      setStartingRoutine(false);
    }
  };

  const handleCompleteDay = async (dayNumber: number) => {
    if (!routine) return;

    setCompletingDay(dayNumber);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push('/app/auth?next=' + encodeURIComponent('/my-routine'));
        return;
      }

      const token = session.access_token;
      const res = await fetch('/api/workout-routine/complete-day', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          routineId: routine.id,
          dayNumber,
        }),
      });

      if (!res.ok) {
        throw new Error('완료 처리 실패');
      }

      const data = await res.json();

      // 로컬 상태 업데이트
      setDays((prev) =>
        prev.map((day) =>
          day.day_number === dayNumber
            ? {
                ...day,
                completed_at: new Date().toISOString(),
              }
            : day
        )
      );

      // 루틴 진행률 업데이트
      if (routine) {
        const newCompletedDays = days.filter((d) => d.completed_at || d.day_number === dayNumber).length;
        setRoutine({
          ...routine,
          progress: Math.round((newCompletedDays / days.length) * 100),
          completedDays: newCompletedDays,
        });
      }

      if (data.allCompleted) {
        // 모든 일자 완료
        setRoutine((prev) =>
          prev
            ? {
                ...prev,
                status: 'completed',
                completed_at: new Date().toISOString(),
                progress: 100,
              }
            : null
        );
      }
    } catch (error) {
      console.error('완료 처리 에러:', error);
      alert('완료 처리에 실패했습니다.');
    } finally {
      setCompletingDay(null);
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      inhibit: '억제',
      lengthen: '연장',
      activate: '활성화',
      integrate: '통합',
    };
    return labels[category] || category;
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      inhibit: 'bg-blue-100 text-blue-800',
      lengthen: 'bg-green-100 text-green-800',
      activate: 'bg-orange-100 text-orange-800',
      integrate: 'bg-purple-100 text-purple-800',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  const getDifficultyColor = (difficulty: string) => {
    const colors: Record<string, string> = {
      beginner: 'bg-green-100 text-green-800',
      intermediate: 'bg-yellow-100 text-yellow-800',
      advanced: 'bg-red-100 text-red-800',
    };
    return colors[difficulty] || 'bg-gray-100 text-gray-800';
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

  if (!routine) {
    return (
      <div className="min-h-screen bg-[var(--bg)] px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <Card className="text-center">
            <CardHeader>
              <CardTitle className="text-2xl text-[var(--text)]">운동 루틴이 없습니다</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-6 text-[var(--muted)]">
                운동 검사를 완료하고 맞춤 루틴을 생성하세요.
              </p>
              <Button onClick={() => router.push('/')} className="bg-[var(--brand)] text-white">
                운동 검사 시작하기
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const isDraft = routine.status === 'draft' || !routine.started_at;
  const currentDay = days.find((d) => d.day_number === selectedDay);

  if (isDraft) {
    return (
      <div className="min-h-screen bg-[var(--bg)] px-4 py-8 md:py-16">
        <div className="mx-auto max-w-2xl">
          <h1 className="mb-2 text-3xl font-bold text-[var(--text)]">내 운동 루틴</h1>
          <p className="mb-8 text-[var(--muted)]">7일 개인맞춤 운동 프로그램</p>
          <Card className="text-center">
            <CardHeader>
              <CardTitle className="text-xl text-[var(--text)]">7일 루틴 시작하기</CardTitle>
              <p className="text-[var(--muted)]">준비가 완료되었습니다. 시작 버튼을 눌러 운동을 시작하세요.</p>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleStartRoutine}
                disabled={startingRoutine}
                className="bg-[var(--brand)] text-white"
              >
                {startingRoutine ? '처리 중...' : '시작하기'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] px-4 py-8 md:py-16">
      <div className="mx-auto max-w-6xl">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-[var(--text)]">내 운동 루틴</h1>
          <p className="text-[var(--muted)]">7일 개인맞춤 운동 프로그램</p>
        </div>

        {/* 진행률 카드 */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl text-[var(--text)]">전체 진행률</CardTitle>
              <Badge variant="secondary" className="text-lg">
                {routine.completedDays} / {routine.totalDays}일 완료
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Progress value={routine.progress} className="mb-4 h-3" />
            <div className="flex items-center justify-between text-sm text-[var(--muted)]">
              <span>{routine.progress}% 완료</span>
              <span>
                시작일: {new Date(routine.started_at).toLocaleDateString('ko-KR')}
              </span>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* 일자 목록 (좌측) */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-[var(--text)]">7일 루틴</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {days.map((day) => (
                  <button
                    key={day.id}
                    onClick={() => setSelectedDay(day.day_number)}
                    className={`w-full rounded-lg border p-4 text-left transition ${
                      selectedDay === day.day_number
                        ? 'border-[var(--brand)] bg-[var(--brand-soft)]'
                        : 'border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-[var(--text)]">
                          Day {day.day_number}
                        </div>
                        <div className="text-sm text-[var(--muted)]">
                          {day.exercises?.length || 0}개 운동
                        </div>
                      </div>
                      {day.completed_at ? (
                        <Badge className="bg-green-500 text-white">완료</Badge>
                      ) : (
                        <Badge variant="outline">진행중</Badge>
                      )}
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* 선택된 일자 상세 (우측) */}
          <div className="lg:col-span-2">
            {currentDay ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl text-[var(--text)]">
                      Day {currentDay.day_number}
                    </CardTitle>
                    {currentDay.completed_at ? (
                      <Badge className="bg-green-500 text-white">완료</Badge>
                    ) : (
                      <Button
                        onClick={() => handleCompleteDay(currentDay.day_number)}
                        disabled={completingDay === currentDay.day_number}
                        className="bg-[var(--brand)] text-white"
                      >
                        {completingDay === currentDay.day_number ? '처리 중...' : '완료하기'}
                      </Button>
                    )}
                  </div>
                  {currentDay.completed_at && (
                    <p className="text-sm text-[var(--muted)]">
                      완료일: {new Date(currentDay.completed_at).toLocaleDateString('ko-KR')}
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {currentDay.exercises?.map((exercise, index) => (
                      <div
                        key={exercise.id || index}
                        className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
                      >
                        <div className="mb-2 flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-[var(--text)]">{exercise.name}</h3>
                            <p className="text-sm text-[var(--muted)]">{exercise.description}</p>
                          </div>
                          <Badge className={getCategoryColor(exercise.category)}>
                            {getCategoryLabel(exercise.category)}
                          </Badge>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-sm">
                          {exercise.sets && exercise.reps && (
                            <span className="text-[var(--muted)]">
                              {exercise.sets}세트 × {exercise.reps}회
                            </span>
                          )}
                          {exercise.holdTime && (
                            <span className="text-[var(--muted)]">
                              {exercise.holdTime}초 유지
                            </span>
                          )}
                          <span className="text-[var(--muted)]">{exercise.duration}분</span>
                          <Badge variant="outline" className={getDifficultyColor(exercise.difficulty)}>
                            {exercise.difficulty === 'beginner'
                              ? '초급'
                              : exercise.difficulty === 'intermediate'
                                ? '중급'
                                : '고급'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>

                  {currentDay.notes && (
                    <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4">
                      <p className="text-sm text-[var(--muted)]">{currentDay.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-[var(--muted)]">
                  일자를 선택하세요
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
