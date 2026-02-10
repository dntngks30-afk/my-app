import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase'; // 네 프로젝트에 맞는 서버용 클라로

export async function POST(req: Request) {
  const body = await req.json();
  const { animalType, oneLiner } = body ?? {};

  if (!animalType || !oneLiner) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('share_cards')
    .insert([{ animal_type: animalType, one_liner: oneLiner }])
    .select('id')
    .single();

  if (error || !data?.id) {
    return NextResponse.json({ error: 'db_error' }, { status: 500 });
  }

  return NextResponse.json({ shareId: data.id });
}
