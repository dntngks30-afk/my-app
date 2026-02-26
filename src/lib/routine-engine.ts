/**
 * 7일 루틴 24h/48h 듀얼 타이머 상태 관리 엔진
 *
 * 기준: 서버 시간(UTC) 및 DB 타임스탬프만 사용. 클라이언트 시간은 신뢰하지 않음.
 */

import { getServerSupabaseAdmin } from '@/lib/supabase';

export type RoutineStatus = 'LOCKED' | 'READY' | 'ACTIVE' | 'COMPLETED';

const MS_24H = 24 * 60 * 60 * 1000;
const MS_48H = 48 * 60 * 60 * 1000;
const MAX_DAY = 7;

export interface RoutineState {
  id: string;
  userId: string;
  currentDay: number;
  status: RoutineStatus;
  lastActivatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RoutineEngineResult {
  state: RoutineState;
  changed: boolean;
}

/**
 * 서버 시간(UTC) 기준 현재 시각 반환
 */
function getServerNow(): Date {
  return new Date();
}

/**
 * last_activated_at 기준 경과 시간(ms)
 */
function getElapsedMs(lastActivatedAt: string | null): number | null {
  if (!lastActivatedAt) return null;
  const last = new Date(lastActivatedAt);
  return getServerNow().getTime() - last.getTime();
}

/**
 * 유저 루틴 상태 체크 및 48h 초과 시 자동 업데이트
 *
 * @param userId - 인증된 유저 ID
 * @returns 최종 RoutineState 및 변경 여부
 */
export async function checkAndUpdateRoutineStatus(
  userId: string
): Promise<RoutineEngineResult> {
  const supabase = getServerSupabaseAdmin();

  // 1. 기존 레코드 조회 또는 생성
  let { data: row, error } = await supabase
    .from('user_routines')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[routine-engine] select error:', error);
    throw new Error('루틴 상태 조회 실패');
  }

  if (!row) {
    // 신규 유저: 기본 레코드 생성
    const { data: inserted, error: insertErr } = await supabase
      .from('user_routines')
      .insert({
        user_id: userId,
        current_day: 1,
        status: 'READY',
        last_activated_at: null,
      })
      .select()
      .single();

    if (insertErr) {
      console.error('[routine-engine] insert error:', insertErr);
      throw new Error('루틴 초기화 실패');
    }

    return {
      state: mapToState(inserted),
      changed: true,
    };
  }

  // 이미 완료 상태면 그대로 반환
  if (row.status === 'COMPLETED') {
    return { state: mapToState(row), changed: false };
  }

  // current_day가 이미 7이면 완료 고정
  if (row.current_day >= MAX_DAY) {
    const { error: updateErr } = await supabase
      .from('user_routines')
      .update({ status: 'COMPLETED', updated_at: getServerNow().toISOString() })
      .eq('id', row.id);

    if (!updateErr) {
      const { data: updated } = await supabase
        .from('user_routines')
        .select()
        .eq('id', row.id)
        .single();
      return {
        state: mapToState(updated ?? row),
        changed: true,
      };
    }
  }

  const elapsed = getElapsedMs(row.last_activated_at);

  // last_activated_at이 null: 첫 시작 → READY
  if (elapsed === null) {
    return { state: mapToState(row), changed: false };
  }

  // [24h 미만] LOCKED (다음 일차 미개방)
  // ACTIVE였던 경우에도 홈으로 돌아오면 LOCKED로 전환 (타이머 노출)
  if (elapsed < MS_24H) {
    const nextStatus = row.status !== 'LOCKED' ? 'LOCKED' : row.status;
    if (nextStatus !== row.status) {
      await supabase
        .from('user_routines')
        .update({ status: 'LOCKED', updated_at: getServerNow().toISOString() })
        .eq('id', row.id);
    }
    return {
      state: mapToState({ ...row, status: 'LOCKED' }),
      changed: nextStatus !== row.status,
    };
  }

  // [24h ~ 48h] READY (수동 개방 가능)
  if (elapsed < MS_48H) {
    const nextStatus = row.status !== 'READY' ? 'READY' : row.status;
    if (nextStatus !== row.status) {
      await supabase
        .from('user_routines')
        .update({ status: 'READY', updated_at: getServerNow().toISOString() })
        .eq('id', row.id);
    }
    return {
      state: mapToState({ ...row, status: 'READY' }),
      changed: nextStatus !== row.status,
    };
  }

  // [48h 이상] 강제 개방: current_day +1 (최대 7), last_activated_at 갱신
  const newDay = Math.min(row.current_day + 1, MAX_DAY);
  const nowIso = getServerNow().toISOString();
  const nextStatus = newDay >= MAX_DAY ? 'COMPLETED' : 'READY';

  const { error: updateErr } = await supabase
    .from('user_routines')
    .update({
      current_day: newDay,
      last_activated_at: nowIso,
      status: nextStatus,
      updated_at: nowIso,
    })
    .eq('id', row.id);

  if (updateErr) {
    console.error('[routine-engine] 48h update error:', updateErr);
    throw new Error('루틴 상태 갱신 실패');
  }

  const { data: updated } = await supabase
    .from('user_routines')
    .select()
    .eq('id', row.id)
    .single();

  return {
    state: mapToState(updated ?? { ...row, current_day: newDay, status: nextStatus, last_activated_at: nowIso }),
    changed: true,
  };
}

/**
 * 루틴 활성화 (유저가 "시작" 버튼 클릭 시 호출)
 * last_activated_at을 현재 시각으로 갱신하고 status를 ACTIVE로 설정
 */
export async function activateRoutine(userId: string): Promise<RoutineState> {
  const supabase = getServerSupabaseAdmin();
  const nowIso = getServerNow().toISOString();

  const { data, error } = await supabase
    .from('user_routines')
    .update({
      last_activated_at: nowIso,
      status: 'ACTIVE',
      updated_at: nowIso,
    })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.error('[routine-engine] activate error:', error);
    throw new Error('루틴 활성화 실패');
  }

  return mapToState(data);
}

function mapToState(row: Record<string, unknown>): RoutineState {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    currentDay: row.current_day as number,
    status: row.status as RoutineStatus,
    lastActivatedAt: (row.last_activated_at as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
