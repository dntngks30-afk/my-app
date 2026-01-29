// Supabase 클라이언트 설정 파일입니다.
// 클라이언트(브라우저)와 서버에서 각각 사용할 수 있는 인스턴스를 제공합니다.

import { createClient } from "@supabase/supabase-js";

// 환경변수에서 Supabase URL과 키를 가져옵니다.
// 빌드 시점에 값이 없어도 에러가 나지 않도록 기본값을 제공합니다.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";

// 클라이언트(브라우저)에서 사용하는 Supabase 인스턴스입니다.
// 주로 로그인, 회원가입, 사용자 데이터 조회 등에 사용됩니다.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 서버에서 사용하는 Supabase 클라이언트를 생성하는 함수입니다.
// API 라우트에서 호출 시점에 생성하므로 빌드 타임 에러를 방지합니다.
export function getServerSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";
  
  if (!url || !key) {
    console.error("❌ Supabase 환경 변수가 설정되지 않았습니다:", { 
      has_url: !!url, 
      has_key: !!key,
      has_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      has_anon_key: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    });
    throw new Error("Supabase 환경 변수가 설정되지 않았습니다.");
  }
  
  return createClient(url, key);
}

// 데이터베이스 테이블 타입 정의 (TypeScript용)
// 실제 Supabase 스키마와 일치하도록 필요에 따라 수정하세요.
export type UserRole = "user" | "admin";

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export interface Request {
  id: string;
  user_id: string | null;
  front_url: string | null;
  side_url: string | null;
  status: "pending" | "paid" | "analyzing" | "completed";
  diagnoses: string[] | null;
  created_at: string;
  updated_at: string | null;
}

export interface Payment {
  id: string;
  user_id: string;
  request_id: string;
  amount: number;
  order_id: string;
  payment_key: string;
  status: "pending" | "completed" | "failed" | "cancelled";
  created_at: string;
}

export interface Solution {
  id: string;
  user_id: string;
  request_id: string;
  diagnoses: string[];
  inhibit_content: string;
  lengthen_content: string;
  activate_content: string;
  integrate_content: string;
  expert_notes: string;
  created_at: string;
}
