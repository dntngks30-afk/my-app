// 회원가입 페이지입니다.
// 이메일/비밀번호로 Supabase Auth를 통해 계정을 생성합니다.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function SignupPage() {
  const router = useRouter();
  
  // 폼 상태 관리
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // 회원가입 처리 함수
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // 비밀번호 확인 체크
    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      setLoading(false);
      return;
    }

    // 비밀번호 길이 체크
    if (password.length < 6) {
      setError("비밀번호는 최소 6자 이상이어야 합니다.");
      setLoading(false);
      return;
    }

    try {
      // Supabase Auth로 회원가입 시도
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // 이메일 인증 후 리다이렉트할 URL (선택사항)
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });

      if (authError) {
        // 에러 메시지를 한국어로 변환
        if (authError.message.includes("already registered")) {
          setError("이미 가입된 이메일입니다.");
        } else if (authError.message.includes("valid email")) {
          setError("유효한 이메일 주소를 입력해주세요.");
        } else {
          setError(authError.message);
        }
        return;
      }

      if (data.user) {
        // users 테이블에 사용자 프로필 추가 (role='user'로 기본 설정)
        const { error: profileError } = await supabase.from("users").insert({
          id: data.user.id,
          email: data.user.email,
          role: "user",
          created_at: new Date().toISOString(),
        });

        if (profileError) {
          console.error("프로필 생성 에러:", profileError);
          // 프로필 생성 실패해도 계정은 생성되었으므로 계속 진행
        }

        // 회원가입 성공
        setSuccess(true);
      }
    } catch (err) {
      setError("회원가입 중 오류가 발생했습니다.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 회원가입 성공 화면
  if (success) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0f172a] px-4 py-8">
        <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-700/80 bg-slate-900/80 p-8 text-center shadow-[0_25px_80px_rgba(0,0,0,0.6)]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
            <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-100">회원가입 완료!</h1>
          <p className="text-sm text-slate-400">
            이메일 인증 메일을 발송했습니다.<br />
            이메일을 확인하여 인증을 완료해주세요.
          </p>
          <Link
            href="/login"
            className="inline-block rounded-lg bg-[#f97316] px-6 py-3 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(249,115,22,0.5)] transition hover:bg-[#fb923c]"
          >
            로그인 페이지로 이동
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0f172a] px-4 py-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-slate-700/80 bg-slate-900/80 p-8 shadow-[0_25px_80px_rgba(0,0,0,0.6)]">
        {/* 헤더 */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-100">회원가입</h1>
          <p className="mt-2 text-sm text-slate-400">
            계정을 만들고 맞춤 교정 솔루션을 받아보세요.
          </p>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* 회원가입 폼 */}
        <form onSubmit={handleSignup} className="space-y-6">
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
              placeholder="최소 6자 이상"
              className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-[#f97316] focus:outline-none focus:ring-1 focus:ring-[#f97316]"
            />
          </div>

          {/* 비밀번호 확인 */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-200">
              비밀번호 확인
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="비밀번호를 다시 입력하세요"
              className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-[#f97316] focus:outline-none focus:ring-1 focus:ring-[#f97316]"
            />
          </div>

          {/* 약관 동의 */}
          <div className="text-xs text-slate-400">
            회원가입 시{" "}
            <Link href="/terms" className="text-[#f97316] hover:underline">
              이용약관
            </Link>{" "}
            및{" "}
            <Link href="/privacy" className="text-[#f97316] hover:underline">
              개인정보처리방침
            </Link>
            에 동의하는 것으로 간주됩니다.
          </div>

          {/* 회원가입 버튼 */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#f97316] px-4 py-3 text-sm font-semibold text-slate-950 shadow-[0_0_24px_rgba(249,115,22,0.5)] transition hover:bg-[#fb923c] hover:shadow-[0_0_32px_rgba(249,115,22,0.6)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "가입 중..." : "회원가입"}
          </button>
        </form>

        {/* 로그인 링크 */}
        <div className="text-center text-sm text-slate-400">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="font-medium text-[#f97316] hover:underline">
            로그인
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
