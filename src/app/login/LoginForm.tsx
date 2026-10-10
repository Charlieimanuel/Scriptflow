"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  signInWithGoogleSupabase,
  signInWithEmailSupabase,
  signUpWithEmailSupabase,
} from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export function LoginForm({ initialMode = "login" }: { initialMode?: "login" | "register" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedMode = searchParams?.get("tab") === "register" ? "register" : initialMode;

  const [mode, setMode] = useState<"login" | "register">(requestedMode);
  const [supabaseActive, setSupabaseActive] = useState(false);

  useEffect(() => {
    setSupabaseActive(isSupabaseConfigured());
  }, []);

  // Login with Email & Password Form State
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Register with Email Form State
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(true);

  // Status feedback
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Handler: Masuk / Daftar dengan Google via Supabase OAuth Nyata
  const handleGoogleAuth = async () => {
    setErrorMessage(null);
    setIsProcessing(true);
    setLoadingText("Membuka autentikasi Google via Supabase…");

    const { error } = await signInWithGoogleSupabase();

    if (error) {
      setIsProcessing(false);
      // Deteksi jika provider Google belum diaktifkan di dashboard Supabase
      if (
        error.message?.toLowerCase().includes("not enabled") ||
        error.message?.toLowerCase().includes("unsupported provider")
      ) {
        setErrorMessage(
          "Penyedia Google belum diaktifkan di dashboard Supabase Anda. Buka Supabase > Authentication > Providers > Google, aktifkan tombol 'Enable Sign in with Google' dan masukkan Client ID & Secret dari Google Cloud."
        );
      } else {
        setErrorMessage(`Gagal menghubungkan Google: ${error.message}`);
      }
    }
  };

  // Handler: Login dengan Email & Password via Supabase
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!loginEmail.trim() || !loginEmail.includes("@")) {
      setErrorMessage("Silakan masukkan alamat email yang valid.");
      return;
    }
    if (!loginPassword) {
      setErrorMessage("Silakan masukkan kata sandi Anda.");
      return;
    }

    setIsProcessing(true);
    setLoadingText("Memverifikasi akun di database Supabase…");
    const { user, error } = await signInWithEmailSupabase(loginEmail, loginPassword);

    if (error) {
      setIsProcessing(false);
      if (error.message?.toLowerCase().includes("invalid login credentials")) {
        setErrorMessage("Email atau kata sandi tidak sesuai. Silakan periksa kembali.");
      } else {
        setErrorMessage(error.message || "Gagal masuk ke akun.");
      }
      return;
    }

    setSuccessMessage(`Selamat datang kembali, ${user?.name || "Produser"}! Mengarahkan ke dashboard…`);
    setTimeout(() => {
      router.push("/dashboard");
    }, 700);
  };

  // Handler: Register dengan Email via Supabase
  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!regName.trim()) {
      setErrorMessage("Silakan masukkan nama lengkap Anda.");
      return;
    }
    if (!regEmail.trim() || !regEmail.includes("@")) {
      setErrorMessage("Silakan masukkan alamat email yang valid.");
      return;
    }
    if (regPassword.length < 6) {
      setErrorMessage("Kata sandi minimal harus 6 karakter.");
      return;
    }
    if (!agreedTerms) {
      setErrorMessage("Anda harus menyetujui ketentuan layanan.");
      return;
    }

    setIsProcessing(true);
    setLoadingText("Mendaftarkan akun ke database Supabase…");
    const { user, error } = await signUpWithEmailSupabase(regName, regEmail, regPassword);

    if (error) {
      setIsProcessing(false);
      setErrorMessage(error.message || "Gagal membuat akun.");
      return;
    }

    setSuccessMessage(`Akun ${user?.name || regName} berhasil didaftarkan! Mengarahkan ke dashboard…`);
    setTimeout(() => {
      router.push("/dashboard");
    }, 700);
  };

  return (
    <div className="mt-8">
      {/* Tab Switcher */}
      <div className="relative mb-6 flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
        <button
          type="button"
          onClick={() => {
            setMode("login");
            setErrorMessage(null);
          }}
          className={`flex-1 rounded-lg py-2.5 text-xs font-semibold transition cursor-pointer ${mode === "login"
            ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20"
            : "text-slate-400 hover:text-white"
            }`}
        >
          Masuk ke Akun
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("register");
            setErrorMessage(null);
          }}
          className={`flex-1 rounded-lg py-2.5 text-xs font-semibold transition cursor-pointer ${mode === "register"
            ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20"
            : "text-slate-400 hover:text-white"
            }`}
        >
          Daftar Akun Baru
        </button>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="mb-5 animate-pop rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-center text-sm text-emerald-200">
          <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-400/20 font-bold text-emerald-300">
            ✓
          </div>
          {successMessage}
        </div>
      )}

      {/* Error Notification */}
      {errorMessage && (
        <div className="mb-5 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3.5 text-left text-xs leading-relaxed text-rose-300">
          <div className="flex items-start gap-2">
            <span className="font-bold text-rose-400 shrink-0">⚠️</span>
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {/* ===================== TAB 1: LOGIN ===================== */}
      {mode === "login" && !successMessage && (
        <div className="space-y-4 animate-fade-in">
          {/* Tombol Utama Google (Langsung Supabase OAuth) */}
          <button
            id="btn-login-google"
            type="button"
            disabled={isProcessing}
            onClick={handleGoogleAuth}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/15 bg-white py-3.5 px-4 text-sm font-semibold text-slate-900 shadow-md transition hover:bg-slate-100 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 cursor-pointer"
          >
            {isProcessing ? (
              <span className="flex items-center gap-2 text-slate-700">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                {loadingText || "Menghubungkan…"}
              </span>
            ) : (
              <>
                <svg viewBox="0 0 24 24" className="h-5 w-5">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Masuk dengan Google</span>
              </>
            )}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider text-slate-500">
            <span className="h-px flex-1 bg-white/10" />
            <span>atau masuk dengan email & kata sandi</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>

          {/* Form Login Email & Password */}
          <form onSubmit={handleEmailLogin} className="space-y-3.5">
            <div>
              <label htmlFor="login-email-input" className="block text-xs font-medium text-slate-300">
                Alamat Email
              </label>
              <input
                id="login-email-input"
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="nama@studio-film.id"
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/10"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="login-password-input" className="block text-xs font-medium text-slate-300">
                  Kata Sandi
                </label>
                <button
                  type="button"
                  onClick={() => alert("Gunakan kata sandi yang telah didaftarkan atau masuk cepat dengan Google.")}
                  className="text-[11px] text-amber-400/80 hover:text-amber-300 transition cursor-pointer"
                >
                  Lupa kata sandi?
                </button>
              </div>
              <div className="relative mt-1">
                <input
                  id="login-password-input"
                  type={showLoginPassword ? "text" : "password"}
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Masukkan kata sandi Anda"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 pr-10 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/10"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                  title={showLoginPassword ? "Sembunyikan" : "Tampilkan"}
                >
                  {showLoginPassword ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-white/20 bg-white/5 text-amber-400 focus:ring-amber-400"
                />
                Ingat saya di perangkat ini
              </label>
            </div>

            <button
              id="btn-login-email"
              type="submit"
              disabled={isProcessing}
              className="mt-2 w-full rounded-xl bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 py-3 px-4 text-sm font-semibold text-slate-950 shadow-md shadow-amber-400/20 transition hover:brightness-110 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
            >
              Masuk dengan Email
            </button>
          </form>

          <div className="text-center pt-2">
            <p className="text-xs text-slate-500">
              Belum punya akun?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setErrorMessage(null);
                }}
                className="font-medium text-amber-300 underline decoration-amber-400/30 underline-offset-4 hover:text-amber-200 cursor-pointer"
              >
                Daftar akun baru sekarang
              </button>
            </p>
          </div>
        </div>
      )}

      {/* ===================== TAB 2: REGISTER ===================== */}
      {mode === "register" && !successMessage && (
        <div className="space-y-4 animate-fade-in">
          {/* Tombol Register dengan Google (Langsung Supabase OAuth) */}
          <button
            id="btn-register-google"
            type="button"
            disabled={isProcessing}
            onClick={handleGoogleAuth}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/15 bg-white py-3.5 px-4 text-sm font-semibold text-slate-900 shadow-md transition hover:bg-slate-100 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 cursor-pointer"
          >
            {isProcessing ? (
              <span className="flex items-center gap-2 text-slate-700">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                {loadingText || "Menghubungkan…"}
              </span>
            ) : (
              <>
                <svg viewBox="0 0 24 24" className="h-5 w-5">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Daftar Cepat dengan Google</span>
              </>
            )}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider text-slate-500">
            <span className="h-px flex-1 bg-white/10" />
            <span>atau daftar dengan email</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>

          {/* Form Register dengan Email & Password */}
          <form onSubmit={handleEmailRegister} className="space-y-3">
            <div>
              <label htmlFor="reg-name" className="block text-xs font-medium text-slate-300">
                Nama Lengkap
              </label>
              <input
                id="reg-name"
                type="text"
                required
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="Arya Wijaya"
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/10"
              />
            </div>

            <div>
              <label htmlFor="reg-email" className="block text-xs font-medium text-slate-300">
                Alamat Email
              </label>
              <input
                id="reg-email"
                type="email"
                required
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="arya@studio-film.id"
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/10"
              />
            </div>

            <div>
              <label htmlFor="reg-password" className="block text-xs font-medium text-slate-300">
                Kata Sandi
              </label>
              <div className="relative mt-1">
                <input
                  id="reg-password"
                  type={showRegPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 pr-10 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/10"
                />
                <button
                  type="button"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                  title={showRegPassword ? "Sembunyikan" : "Tampilkan"}
                >
                  {showRegPassword ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-start gap-2 pt-1">
              <input
                id="reg-terms"
                type="checkbox"
                checked={agreedTerms}
                onChange={(e) => setAgreedTerms(e.target.checked)}
                className="mt-1 h-3.5 w-3.5 rounded border-white/20 bg-white/5 text-amber-400 focus:ring-amber-400"
              />
              <label htmlFor="reg-terms" className="text-[11px] leading-tight text-slate-400 cursor-pointer">
                Saya menyetujui Ketentuan Layanan & Kebijakan Privasi ScriptFlow AI.
              </label>
            </div>

            <button
              id="btn-register-email"
              type="submit"
              disabled={isProcessing}
              className="mt-2 w-full rounded-xl bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 py-3 px-4 text-sm font-semibold text-slate-950 shadow-md shadow-amber-400/20 transition hover:brightness-110 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
            >
              Buat Akun dengan Email
            </button>
          </form>

          <div className="text-center pt-1">
            <p className="text-xs text-slate-500">
              Sudah punya akun?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setErrorMessage(null);
                }}
                className="font-medium text-amber-300 underline decoration-amber-400/30 underline-offset-4 hover:text-amber-200 cursor-pointer"
              >
                Masuk ke akun Anda
              </button>
            </p>
          </div>
        </div>
      )}

      {/* Database Connection Status Badge */}

    </div>
  );
}
