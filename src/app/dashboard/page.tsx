"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Dashboard } from "@/components/dashboard/Dashboard";

export default function DashboardPage() {
  const user = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && user === null) {
      router.replace("/login");
    }
  }, [mounted, user, router]);

  if (!mounted || user === null) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#05070d]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
          <p className="text-xs text-slate-400">Mengarahkan ke menu masuk / daftar…</p>
        </div>
      </div>
    );
  }

  return <Dashboard />;
}
