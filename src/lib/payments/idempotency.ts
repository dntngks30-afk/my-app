/**
 * Webhook 멱등성 처리
 * 같은 event_id가 이미 처리되었는지 확인하고, 처리 전에 레코드 삽입
 */

import { getServerSupabaseAdmin } from '@/lib/supabase';

const PROVIDER_STRIPE = 'stripe';

/**
 * 이벤트가 이미 처리되었는지 확인
 * @returns true if already processed (skip), false if should process
 */
export async function isEventAlreadyProcessed(
  eventId: string,
  provider: string = PROVIDER_STRIPE
): Promise<boolean> {
  const supabase = getServerSupabaseAdmin();
  const { data, error } = await supabase
    .from('payment_events')
    .select('id')
    .eq('provider', provider)
    .eq('event_id', eventId)
    .maybeSingle();

  if (error) {
    console.error('Idempotency check error:', error);
    return true; // 에러 시 중복 처리 방지를 위해 skip
  }
  return !!data;
}

/**
 * 이벤트 처리 시작 시 레코드 삽입 (UNIQUE 제약으로 중복 방지)
 * @returns true if inserted (첫 호출), false if already existed (중복)
 */
export async function recordEventProcessed(
  eventId: string,
  userId: string | null,
  provider: string = PROVIDER_STRIPE
): Promise<boolean> {
  const supabase = getServerSupabaseAdmin();
  const { error } = await supabase.from('payment_events').insert({
    provider,
    event_id: eventId,
    user_id: userId,
  });

  if (error) {
    if (error.code === '23505') {
      return false; // UNIQUE violation = 이미 처리됨
    }
    console.error('Idempotency insert error:', error);
    throw error;
  }
  return true;
}
