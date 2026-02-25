/**
 * 운동 루틴 생성 API
 * 
 * POST /api/workout-routine/create
 * 
 * 운동 검사 결과를 기반으로 7일간의 개인맞춤 운동 루틴을 생성합니다.
 * SSOT: plan_status='active'
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseAdmin } from '@/lib/supabase';
import { requireActivePlan } from '@/lib/auth/requireActivePlan';
import { generateWorkoutRoutine, type RoutineGenerationOptions } from '@/lib/workout-routine/generator';
import { enhanceRoutineWithAI, validateEnhancedRoutine, type UserProfile } from '@/lib/workout-routine/ai-enhancer';
import type { MainTypeCode, SubTypeKey } from '@/types/movement-test';

export async function POST(req: NextRequest) {
  try {
    // 1. 인증 + plan_status='active' 확인
    const auth = await requireActivePlan(req);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;

    // 2. 요청 본문 파싱
    const body = await req.json();
    const { testResultId, userGoals, painAreas, exerciseExperience, availableTime } = body;

    if (!testResultId) {
      return NextResponse.json({ error: 'testResultId는 필수입니다.' }, { status: 400 });
    }

    // 3. Supabase 클라이언트 생성
    const supabase = getServerSupabaseAdmin();

    // 4. 운동 검사 결과 조회
    const { data: testResult, error: testError } = await supabase
      .from('movement_test_results')
      .select('*')
      .eq('id', testResultId)
      .single();

    if (testError || !testResult) {
      return NextResponse.json({ error: '운동 검사 결과를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 사용자 소유 확인 (user_id가 있는 경우)
    if (testResult.user_id && testResult.user_id !== userId) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    // 5b. 기존 루틴 확인 (멱등: 동일 user_id + testResultId당 1개)
    const { data: existingRoutine } = await supabase
      .from('workout_routines')
      .select('id')
      .eq('user_id', userId)
      .eq('movement_test_result_id', testResultId)
      .maybeSingle();

    if (existingRoutine) {
      return NextResponse.json({
        success: true,
        routineId: existingRoutine.id,
        created: false,
      });
    }

    // 6. 메인 타입 코드 변환
    const mainTypeMap: Record<string, MainTypeCode> = {
      담직: 'D',
      날림: 'N',
      버팀: 'B',
      흘림: 'H',
    };
    const mainType = mainTypeMap[testResult.main_type] || 'D';

    // 서브타입 키 변환 (한글명 → SubTypeKey)
    // TODO: 실제 매핑 로직 구현 필요
    const subType: SubTypeKey | undefined = undefined; // 임시로 undefined

    // 7. 규칙 기반 루틴 생성
    const generationOptions: RoutineGenerationOptions = {
      mainType,
      subType,
      imbalanceSeverity: (testResult.imbalance_severity as 'none' | 'mild' | 'strong') || 'none',
      confidence: testResult.confidence || 50,
      userGoals,
      availableTime: availableTime || 10,
    };

    const baseRoutine = generateWorkoutRoutine(generationOptions);

    // 8. AI 보강 (선택적, API 키가 있으면)
    const userProfile: UserProfile = {
      mainType,
      subType,
      confidence: testResult.confidence,
      imbalanceSeverity: (testResult.imbalance_severity as 'none' | 'mild' | 'strong') || 'none',
      goals: userGoals,
      painAreas,
      exerciseExperience: exerciseExperience || 'beginner',
      availableTime: availableTime || 10,
    };

    let enhancedRoutine = baseRoutine;
    try {
      enhancedRoutine = await enhanceRoutineWithAI(baseRoutine, userProfile);
      
      // AI 보강 결과 검증
      const validation = validateEnhancedRoutine(enhancedRoutine);
      if (!validation.valid) {
        console.warn('AI 보강 루틴 검증 실패:', validation.errors);
        // 검증 실패 시 기본 루틴 사용
        enhancedRoutine = baseRoutine;
      }
    } catch (aiError) {
      console.warn('AI 보강 실패, 기본 루틴 사용:', aiError);
      // AI 보강 실패 시 기본 루틴 사용
      enhancedRoutine = baseRoutine;
    }

    // 9. DB에 루틴 저장 (draft: Start 버튼으로 활성화)
    const { data: routine, error: routineError } = await supabase
      .from('workout_routines')
      .insert({
        user_id: userId,
        movement_test_result_id: testResultId,
        status: 'draft',
        started_at: null,
      })
      .select('id')
      .single();

    if (routineError) {
      // Race: 다른 요청이 먼저 생성했을 수 있음 (23505 = unique violation)
      if (routineError.code === '23505') {
        const { data: raced } = await supabase
          .from('workout_routines')
          .select('id')
          .eq('user_id', userId)
          .eq('movement_test_result_id', testResultId)
          .single();
        if (raced) {
          return NextResponse.json({
            success: true,
            routineId: raced.id,
            created: false,
          });
        }
      }
      console.error('Routine creation error:', routineError);
      return NextResponse.json(
        { error: '루틴 생성에 실패했습니다.' },
        { status: 500 }
      );
    }

    if (!routine) {
      return NextResponse.json({ error: '루틴 생성에 실패했습니다.' }, { status: 500 });
    }

    const routineId = routine.id;

    // 10. 일자별 운동 저장
    const routineDaysData = enhancedRoutine.map((day) => ({
      routine_id: routineId,
      day_number: day.dayNumber,
      exercises: day.exercises.map((ex) => ({
        id: ex.id,
        name: ex.name,
        description: ex.description,
        category: ex.category,
        duration: ex.duration,
        sets: ex.sets,
        reps: ex.reps,
        holdTime: ex.holdTime,
        difficulty: ex.difficulty,
        equipment: ex.equipment || [],
        videoUrl: ex.videoUrl,
      })),
      notes: day.notes || null,
    }));

    const { error: daysError } = await supabase
      .from('workout_routine_days')
      .insert(routineDaysData);

    if (daysError) {
      console.error('Routine days creation error:', daysError);
      // 루틴은 생성되었으므로 부분 성공으로 처리
      // TODO: 트랜잭션 처리 고려
    }

    // 11. 응답 반환
    return NextResponse.json({
      success: true,
      routineId,
      created: true,
      days: enhancedRoutine,
      summary: {
        totalDays: enhancedRoutine.length,
        averageDuration: Math.round(
          enhancedRoutine.reduce((sum, day) => sum + day.totalDuration, 0) /
            enhancedRoutine.length
        ),
      },
    });
  } catch (error) {
    console.error('Workout routine creation error:', error);
    return NextResponse.json(
      {
        error: '운동 루틴 생성에 실패했습니다.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
