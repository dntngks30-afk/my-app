import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function getServerSupabase() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Route Handler에서 set이 막혀도, 조회(getUser)는 동작하게 둠
          }
        },
      },
    }
  );
}
