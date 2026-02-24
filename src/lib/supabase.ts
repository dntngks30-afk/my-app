// Supabase 클라이언트 설정 파일
// - 브라우저(클라): supabaseBrowser / supabase
// - 서버(API/Admin): getServerSupabaseAdmin()

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// 브라우저용(anon) env
const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const publicAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// 서버용(service role) env  (절대 NEXT_PUBLIC로 두면 안 됨)
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// ------------------------------
// 1) 브라우저/클라이언트용
// ------------------------------
// ⚠️ 빌드타임에 env가 비어있을 수 있어서, "더미 키"로 속이는 대신
//    런타임에 실제 env가 없으면 에러를 내게 한다.
//    (더미로 만들면 조용히 잘못된 동작을 함)
declare global {
  // eslint-disable-next-line no-var
  var __supabaseBrowser__: SupabaseClient | undefined;
}

function createBrowserClient() {
  if (!publicUrl || !publicAnon) {
    // 브라우저에서 실제로 auth/query 시점에 바로 원인이 보이도록
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return createClient(publicUrl, publicAnon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      flowType: 'pkce',
      detectSessionInUrl: false,
    },
  });
}

// ✅ 너의 기존 코드들이 기대하는 export 이름
export const supabaseBrowser: SupabaseClient =
  typeof window === "undefined"
    ? // SSR에서도 anon으로 생성 (단, env 없으면 throw)
      createBrowserClient()
    : (globalThis.__supabaseBrowser__ ?? createBrowserClient());

if (typeof window !== "undefined") {
  globalThis.__supabaseBrowser__ = supabaseBrowser;
}

// ✅ 기존에 import { supabase } 쓰던 코드 호환 유지
export const supabase = supabaseBrowser;

// ------------------------------
// 2) 서버/API/Admin용 (service role)
// ------------------------------
export function getServerSupabaseAdmin(): SupabaseClient {
  const url = publicUrl || process.env.SUPABASE_URL || "";
  if (!url || !serviceRole) {
    console.error("❌ Missing Supabase Server env", {
      hasUrl: !!url,
      hasServiceRole: !!serviceRole,
      hasPublicUrl: !!publicUrl,
      hasPublicAnon: !!publicAnon,
    });
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY (server/admin)");
  }

  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ------------------------------
// (옵션) 기존 코드 호환용: getServerSupabase()
// ------------------------------
// 네 프로젝트 어딘가에서 getServerSupabase()를 쓰고 있을 수도 있어서 유지
export function getServerSupabase() {
  // server/admin 의도면 service role, 아니면 anon fallback은 하지 않는 게 안전
  return getServerSupabaseAdmin();
}
