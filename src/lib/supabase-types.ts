// Supabase 타입 정의
// ✅ 주의: Supabase 클라이언트는 `@/lib/supabase`에서 import하세요.
// - 브라우저/클라이언트: `supabaseBrowser` from '@/lib/supabase'
// - 서버/API: `getServerSupabaseAdmin()` from '@/lib/supabase'

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
