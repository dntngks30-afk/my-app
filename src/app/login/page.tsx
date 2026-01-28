// 로그인 페이지입니다.
// 이메일/비밀번호로 Supabase Auth를 통해 로그인합니다.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  
  // 폼 상태 관리
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 로그인 처리 함수
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Supabase Auth로 로그인 시도
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        // 에러 메시지를 한국어로 변환
        if (authError.message.includes("Invalid login credentials")) {
          setError("이메일 또는 비밀번호가 올바르지 않습니다.");
        } else if (authError.message.includes("Email not confirmed")) {
          setError("이메일 인증이 완료되지 않았습니다. 이메일을 확인해주세요.");
        } else {
          setError(authError.message);
        }
        return;
      }

      if (data.session) {
        // 로그인 성공 시 메인 페이지로 이동
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      setError("로그인 중 오류가 발생했습니다.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0f172a] px-4 py-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-slate-700/80 bg-slate-900/80 p-8 shadow-[0_25px_80px_rgba(0,0,0,0.6)]">
        {/* 헤더 */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-100">로그인</h1>
          <p className="mt-2 text-sm text-slate-400">
            계정에 로그인하여 맞춤 교정 솔루션을 확인하세요.
          </p>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* 로그인 폼 */}
        <form onSubmit={handleLogin} className="space-y-6">
          {/* 이메일 입력 */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-200">
              이메일
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="example@email.com"
              className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-[#f97316] focus:outline-none focus:ring-1 focus:ring-[#f97316]"
            />
          </div>

          {/* 비밀번호 입력 */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-200">
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="비밀번호를 입력하세요"
              className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-[#f97316] focus:outline-none focus:ring-1 focus:ring-[#f97316]"
            />
          </div>

          {/* 로그인 버튼 */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#f97316] px-4 py-3 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(249,115,22,0.5)] transition hover:bg-[#fb923c] hover:shadow-[0_0_32px_rgba(249,115,22,0.6)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        {/* 회원가입 링크 */}
        <div className="text-center text-sm text-slate-400">
          계정이 없으신가요?{" "}
          <Link href="/signup" className="font-medium text-[#f97316] hover:underline">
            회원가입
          </Link>
        </div>

        {/* 메인으로 돌아가기 */}
        <div className="text-center">
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-300">
            ← 메인으로 돌아가기
          </Link>
        </div>
      </div>
    </main>
  );
}
