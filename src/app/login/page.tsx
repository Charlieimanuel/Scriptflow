import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Masuk & Daftar | ScriptFlow AI",
  description: "Masuk dengan Google atau daftar akun baru dengan Google dan Email di ScriptFlow AI.",
};

export default function LoginPage() {
  return (
    <main className="relative grid min-h-screen lg:grid-cols-2">
      {/* left visual */}
      <section className="relative hidden overflow-hidden border-r border-white/5 lg:block">
        <div className="absolute inset-0 bg-grid [mask-image:radial-gradient(80%_70%_at_30%_30%,black,transparent)]" />
        <div className="absolute -left-20 top-10 h-[30rem] w-[30rem] rounded-full bg-amber-400/15 blur-3xl" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Logo />
          <div className="max-w-md">
            <p className="font-mono text-sm text-amber-300">INT. RUANG PRODUKSI - MALAM</p>
            <blockquote className="mt-5 font-display text-3xl font-medium leading-snug text-white">
              “Revisi naskah jam 11 malam, anggaran sudah siap sebelum rapat pagi.”
            </blockquote>
            <p className="mt-5 text-sm text-slate-400">— Line producer, film pendek independen</p>
          </div>
          <div className="film-perf h-6 opacity-50" />
        </div>
      </section>

      {/* form */}
      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="lg:hidden">
            <Logo />
          </div>
          <h1 className="mt-10 font-display text-3xl font-semibold tracking-tight text-white lg:mt-0">
            Akses ScriptFlow AI
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Masuk dengan Google atau buat akun baru dengan Google & email.
          </p>
          <Suspense fallback={<div className="mt-8 h-48 rounded-xl bg-white/5 animate-pulse" />}>
            <LoginForm initialMode="login" />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
