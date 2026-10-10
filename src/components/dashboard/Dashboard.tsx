"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Logo } from "@/components/Logo";
import { DEMO_SCRIPT, SCRIPT_TEMPLATE } from "@/lib/demo-script";
import { CATEGORY_META, CATEGORY_ORDER, FORMAT_LABEL } from "@/lib/price-master";
import { createProject, deleteProject, useProjects } from "@/lib/store";
import { useAuth, logout } from "@/lib/auth";
import type { Project, ProjectFormat } from "@/lib/types";
import { analyzeProject, detectTitleFromScript, relativeTime, rupiah } from "@/lib/utils";

export function Dashboard() {
  const router = useRouter();
  const user = useAuth();
  const projects = useProjects();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);

  const filtered = useMemo(
    () => (projects ?? []).filter((p) => p.title.toLowerCase().includes(query.toLowerCase())),
    [projects, query],
  );

  const totals = useMemo(() => {
    const list = (projects ?? []).map(analyzeProject);
    return {
      budget: list.reduce((s, a) => s + a.budget.total, 0),
      scenes: list.reduce((s, a) => s + a.scenes.length, 0),
      days: list.reduce((s, a) => s + a.days.length, 0),
    };
  }, [projects]);

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(251,191,36,0.10),transparent)]" />

      <header className="sticky top-0 z-30 border-b border-white/5 bg-[#05070d]/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
          <Logo />
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full bg-amber-400/10 px-2.5 py-1 text-[11px] font-medium text-amber-300 ring-1 ring-amber-400/20 sm:inline">
              {user?.provider === "google" ? "Akun Google" : "Akun Email"}
            </span>
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 rounded-full p-0.5 hover:ring-2 hover:ring-amber-400/30 transition cursor-pointer"
              >
                <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-xs font-bold text-slate-950">
                  {user?.avatarText ?? "LP"}
                </div>
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-white/10 bg-[#0d121f] p-4 shadow-xl z-50 animate-pop">
                  <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-sm font-bold text-slate-950">
                      {user?.avatarText ?? "LP"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">{user?.name ?? "Line Producer"}</p>
                      <p className="truncate text-xs text-slate-400">{user?.email ?? "producer@scriptflow.ai"}</p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Metode masuk:</span>
                      <span className="font-medium text-amber-300 capitalize">{user?.provider ?? "Google"}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        logout();
                        router.push("/login");
                      }}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 py-2 text-xs font-medium text-rose-300 hover:bg-rose-500/20 transition cursor-pointer"
                    >
                      Keluar / Ganti Akun
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-10">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="animate-fade-up">
            <p className="text-sm text-slate-500">Selamat datang, {user?.name ?? "Line Producer"} 👋</p>
            <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight text-white">Proyek Anda</h1>
          </div>
          <div className="flex gap-3">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <input
                id="dashboard-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari proyek…"
                className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] pl-9 pr-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-amber-400/40 sm:w-60"
              />
            </div>
            <button
              id="dashboard-new-project"
              onClick={() => setOpen(true)}
              className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-xl bg-gradient-to-r from-amber-300 to-amber-500 px-5 text-sm font-semibold text-slate-950 glow-amber transition hover:brightness-110"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6}><path d="M12 5v14M5 12h14" /></svg>
              Proyek baru
            </button>
          </div>
        </div>

        {/* stats */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            ["Total estimasi anggaran", projects ? rupiah(totals.budget) : null, "text-gradient-amber"],
            ["Adegan terbreakdown", projects ? String(totals.scenes) : null, "text-white"],
            ["Hari syuting terjadwal", projects ? String(totals.days) : null, "text-white"],
          ].map(([label, value, cls]) => (
            <div key={label} className="glass rounded-2xl p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</p>
              {value === null ? (
                <div className="skeleton mt-3 h-8 w-40" />
              ) : (
                <p className={`mt-2 font-display text-3xl font-semibold ${cls}`}>{value}</p>
              )}
            </div>
          ))}
        </div>

        {/* grid */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects === null &&
            Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-56 rounded-2xl" />)}

          {filtered.map((p, i) => (
            <ProjectCard key={p.id} project={p} index={i} />
          ))}

          {projects !== null && (
            <button
              onClick={() => setOpen(true)}
              className="group grid min-h-56 place-items-center rounded-2xl border border-dashed border-white/10 text-slate-500 transition hover:border-amber-400/40 hover:bg-amber-400/[0.03] hover:text-amber-200"
            >
              <span className="flex flex-col items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-full border border-white/10 transition group-hover:scale-110 group-hover:border-amber-400/40">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 5v14M5 12h14" /></svg>
                </span>
                <span className="text-sm font-medium">Buat proyek baru</span>
              </span>
            </button>
          )}
        </div>
      </main>

      {open && <NewProjectDialog onClose={() => setOpen(false)} />}
    </div>
  );
}

function ProjectCard({ project, index }: { project: Project; index: number }) {
  const { scenes, days, budget } = useMemo(() => analyzeProject(project), [project]);
  const max = Math.max(1, ...Object.values(budget.byCategory).map((v) => v ?? 0));

  return (
    <div style={{ animationDelay: `${index * 70}ms` }} className="group glass relative animate-fade-up overflow-hidden rounded-2xl transition duration-300 hover:-translate-y-1 hover:border-amber-400/25">
      <Link href={`/projects/${project.id}`} className="block p-6" id={`project-card-${project.id}`}>
        <div className="flex items-start justify-between gap-3">
          <span className="rounded-md bg-white/5 px-2 py-1 text-[11px] font-medium text-slate-400">{FORMAT_LABEL[project.format]}</span>
          <span className="text-xs text-slate-600">{relativeTime(project.updatedAt)}</span>
        </div>
        <h2 className="mt-4 line-clamp-1 font-display text-xl font-semibold text-white transition group-hover:text-amber-200">{project.title}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {scenes.length} adegan · {days.length} hari syuting
          {budget.unmatchedCount > 0 && <span className="text-amber-400/80"> · {budget.unmatchedCount} tanpa harga</span>}
        </p>

        <div className="mt-5 flex h-10 items-end gap-1">
          {CATEGORY_ORDER.map((c) => (
            <div key={c} title={CATEGORY_META[c].label} className="flex-1 rounded-t bg-white/5">
              <div
                className={`rounded-t ${CATEGORY_META[c].bar} opacity-70 transition-all duration-500 group-hover:opacity-100`}
                style={{ height: `${Math.max(4, ((budget.byCategory[c] ?? 0) / max) * 40)}px` }}
              />
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-end justify-between border-t border-white/5 pt-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Estimasi</p>
            <p className="font-display text-2xl font-semibold text-gradient-amber">{rupiah(budget.total)}</p>
          </div>
          <span className="grid h-9 w-9 place-items-center rounded-full bg-white/5 text-slate-400 transition group-hover:bg-amber-400 group-hover:text-slate-950">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </span>
        </div>
      </Link>
      <button
        aria-label={`Hapus ${project.title}`}
        onClick={() => {
          if (confirm(`Hapus proyek "${project.title}"?`)) deleteProject(project.id);
        }}
        className="absolute right-3 top-12 rounded-md p-1.5 text-slate-600 opacity-0 transition hover:bg-rose-500/10 hover:text-rose-300 group-hover:opacity-100"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>
      </button>
    </div>
  );
}

function NewProjectDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [uploadedText, setUploadedText] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const ext = file.name.split(".").pop()?.toLowerCase() || "";

    if (ext === "docx" || ext === "doc" || ext === "pdf") {
      setIsParsing(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/parse-document", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (res.ok && data.text) {
          setUploadedText(data.text);
          const autoTitle = detectTitleFromScript(data.text, file.name);
          setTitle(autoTitle);
        } else {
          alert(data.error || "Gagal membaca isi dokumen.");
        }
      } catch (err) {
        console.error("Gagal parse file:", err);
        alert("Terjadi kesalahan saat memproses file dokumen.");
      } finally {
        setIsParsing(false);
      }
    } else {
      // Plain text / Markdown / Fountain
      const reader = new FileReader();
      reader.onload = (event) => {
        const res = event.target?.result;
        if (typeof res === "string") {
          setUploadedText(res);
          const autoTitle = detectTitleFromScript(res, file.name);
          setTitle(autoTitle);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadedText) {
      alert("Silakan unggah berkas naskah Anda terlebih dahulu.");
      return;
    }

    const finalTitle = title || (fileName ? fileName.replace(/\.[^/.]+$/, "") : "Naskah Baru");
    const p = createProject(finalTitle, "film_pendek", uploadedText);
    router.push(`/projects/${p.id}`);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal aria-labelledby="new-project-title">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-lg animate-pop rounded-2xl border border-white/10 bg-[#0a0d16] p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 id="new-project-title" className="font-display text-2xl font-semibold text-white">Unggah Naskah Baru</h2>
            <p className="mt-1 text-sm text-slate-400">Judul naskah akan langsung terbaca otomatis dari isi dokumen.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Upload File Box */}
        <div className="mt-6">
          <label className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.02] p-8 text-center cursor-pointer transition hover:border-amber-400/50 hover:bg-white/[0.04]">
            <input
              type="file"
              accept=".docx,.doc,.pdf,.txt,.fountain,.md"
              onChange={handleFileUpload}
              className="hidden"
            />
            {isParsing ? (
              <div className="flex flex-col items-center gap-2 py-3">
                <span className="h-7 w-7 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                <span className="text-sm font-medium text-amber-300">Mengekstrak teks & membaca judul dari naskah…</span>
                <span className="text-xs text-slate-500">Mendukung format Word (.docx) & PDF</span>
              </div>
            ) : (
              <>
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-400/10 text-amber-400 ring-1 ring-amber-400/20">
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <p className="mt-3 text-sm font-semibold text-white">
                  {fileName ? `File: ${fileName}` : "Pilih atau Seret Berkas Naskah ke Sini"}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {fileName ? "Klik untuk mengganti dengan berkas lain" : "Mendukung Word (.docx, .doc), PDF (.pdf), Teks (.txt, .fountain)"}
                </p>
              </>
            )}
          </label>
        </div>

        {/* Judul Otomatis Terbaca Badge */}
        {title && (
          <div className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                Judul Terbaca Otomatis dari Naskah
              </span>
              <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 font-mono text-[10px] text-emerald-200">
                ✓ Berhasil Dibaca
              </span>
            </div>
            <p className="mt-1 font-display text-lg font-bold text-white tracking-tight">{title}</p>
            <p className="mt-0.5 text-xs text-slate-400">
              Siap di-breakdown adegan, elemen produksi, dan anggarannya.
            </p>
          </div>
        )}

        {/* Tombol Aksi */}
        <div className="mt-6 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm text-slate-400 transition hover:text-white cursor-pointer"
          >
            Batal
          </button>
          <button
            id="np-submit"
            type="submit"
            disabled={!uploadedText}
            className="rounded-xl bg-gradient-to-r from-amber-300 to-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Buka Workspace & Breakdown →
          </button>
        </div>
      </form>
    </div>
  );
}
