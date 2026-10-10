"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Logo } from "@/components/Logo";
import { calculateBudget, planSchedule } from "@/lib/budget";
import { DEMO_SCRIPT } from "@/lib/demo-script";
import { extractScene } from "@/lib/extract";
import { parseScenes } from "@/lib/parse-scenes";
import { CATEGORY_META, FORMAT_LABEL } from "@/lib/price-master";
import { updateProject, useProject } from "@/lib/store";
import type { AnalyzedScene, BudgetResult, Project, SceneElement } from "@/lib/types";
import { cn, detectTitleFromScript, rupiah, signedRupiah } from "@/lib/utils";
import { autoLearnElementsToCatalog } from "@/lib/catalog";
import { BreakdownTable } from "@/components/workspace/BreakdownTable";
import { BudgetPanel } from "@/components/workspace/BudgetPanel";
import { ScheduleBoard } from "@/components/workspace/ScheduleBoard";

const MAX_CHARS = 60_000;
type Tab = "breakdown" | "jadwal" | "anggaran";

export function Workspace({ id }: { id: string }) {
  const project = useProject(id);

  if (project === undefined) {
    return (
      <div className="grid h-screen place-items-center">
        <div className="flex items-center gap-3 text-slate-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
          Memuat workspace…
        </div>
      </div>
    );
  }

  if (project === null) {
    return (
      <div className="grid h-screen place-items-center p-6 text-center">
        <div>
          <p className="font-mono text-sm text-amber-400">404 · ADEGAN TIDAK DITEMUKAN</p>
          <h1 className="mt-3 font-display text-3xl font-semibold text-white">Proyek tidak ada</h1>
          <Link href="/" className="mt-6 inline-block rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-950">
            Kembali ke dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <WorkspaceInner project={project} />;
}

function WorkspaceInner({ project }: { project: Project }) {
  const [text, setText] = useState(project.scriptText);
  const [committed, setCommitted] = useState(project.scriptText);
  const [tab, setTab] = useState<Tab>("breakdown");
  const [title, setTitle] = useState(project.title);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useState<{ current: HTMLInputElement | null }>({ current: null })[0];
  /** Cache hasil analisis per content hash — inti incremental re-analysis */
  const [cache, setCache] = useState<Record<string, SceneElement[]>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const stored = localStorage.getItem("scriptflow.scene_cache.v1");
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  const [lastRun, setLastRun] = useState<{ count: number; total: number; ms: number } | null>(null);

  // Gemini API Key & Engine State
  const [geminiKey, setGeminiKey] = useState<string>("");
  const [showAiModal, setShowAiModal] = useState<boolean>(false);
  const [activeEngine, setActiveEngine] = useState<"gemini" | "local">("local");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("scriptflow.gemini_key");
      if (stored) setGeminiKey(stored);
    } catch {
      // ignore
    }
  }, []);

  // Debounce 900 ms → simpan & sinkronkan (setara Server Action syncScript)
  useEffect(() => {
    if (text === committed) return;
    const t = setTimeout(() => {
      setCommitted(text);
      updateProject(project.id, { scriptText: text });
    }, 900);
    return () => clearTimeout(t);
  }, [text, committed, project.id]);

  // Sinkronkan judul jika properti project berubah
  useEffect(() => {
    setTitle(project.title);
  }, [project.title]);

  // Otomatis deteksi & perbaiki judul jika judul saat ini masih berupa angka (seperti "1.") atau placeholder
  useEffect(() => {
    const isPlaceholder =
      !title ||
      /^\(?\d+[\.\)\-]?\)?$/.test(title.trim()) ||
      title.trim() === "Proyek tanpa judul" ||
      title.trim() === "Naskah Baru";

    if (isPlaceholder && text.trim().length > 0) {
      const autoTitle = detectTitleFromScript(text);
      if (
        autoTitle &&
        autoTitle !== "Naskah Baru" &&
        !/^\(?\d+[\.\)\-]?\)?$/.test(autoTitle.trim())
      ) {
        setTitle(autoTitle);
        updateProject(project.id, { title: autoTitle });
      }
    }
  }, [text, project.id, title]);

  const parsed = useMemo(() => parseScenes(committed), [committed]);
  const pending = useMemo(() => parsed.filter((p) => !cache[p.hash]), [parsed, cache]);
  const pendingSet = useMemo(() => new Set(pending.map((p) => p.hash)), [pending]);

  // Analisis adegan baru/berubah via Gemini API (Micro-Prompt) atau Local NLP Fallback
  useEffect(() => {
    if (pending.length === 0) return;
    let cancelled = false;
    const started = performance.now();

    async function runAnalysis() {
      let usedGemini = false;

      // Jalankan ekstraksi untuk adegan pending dengan pembaruan cache progresif per adegan
      for (let i = 0; i < pending.length; i++) {
        if (cancelled) break;
        const p = pending[i];
        let elementResult: SceneElement[] | null = null;

        try {
          const res = await fetch("/api/analyze-scene", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scene: p, apiKey: geminiKey }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.elements && data.elements.length > 0) {
              elementResult = data.elements;
              if (data.source === "gemini") usedGemini = true;
            }
          }
        } catch {
          // fallback otomatis ke deterministik lokal
        }

        const resolved = elementResult && elementResult.length > 0 ? elementResult : extractScene(p);

        // Progressive per-scene update: langsung tampil di UI & simpan di storage
        if (!cancelled) {
          setCache((prev) => {
            const next = { ...prev, [p.hash]: resolved };
            try {
              localStorage.setItem("scriptflow.scene_cache.v1", JSON.stringify(next));
            } catch {}
            return next;
          });
          autoLearnElementsToCatalog(resolved);
        }

        // Beri jeda kecil jika ada banyak adegan baru sekaligus (hemat RPM)
        if (i < pending.length - 1 && pending.length > 1) {
          await new Promise((r) => setTimeout(r, 200));
        }
      }

      if (!cancelled) {
        setActiveEngine(usedGemini ? "gemini" : "local");
        setLastRun({
          count: pending.length,
          total: parsed.length,
          ms: Math.round(performance.now() - started),
        });
      }
    }

    runAnalysis();

    return () => {
      cancelled = true;
    };
  }, [pending, parsed.length, geminiKey]);

  // HYBRID LOCAL-FIRST:
  // Struktur formal skenario (Scene Heading & Karakter Utama) diproses secara instan (0 ms, 0 Token).
  // Elemen semantik dari LLM memperkaya adegan begitu analisis selesai.
  const scenes: AnalyzedScene[] = useMemo(
    () =>
      parsed.map((p) => ({
        ...p,
        elements: cache[p.hash] ?? extractScene(p),
      })),
    [parsed, cache],
  );
  const days = useMemo(() => planSchedule(scenes), [scenes]);
  const budget: BudgetResult = useMemo(
    () => calculateBudget(scenes, days, project.contingencyPct, project.overrides, project.procurementOverrides),
    [scenes, days, project.contingencyPct, project.overrides, project.procurementOverrides],
  );

  // Diff anggaran vs versi sebelumnya (pola "adjust state during render")
  const settled = pending.length === 0;
  const [prevTotal, setPrevTotal] = useState<number | null>(null);
  const [delta, setDelta] = useState<{ v: number; n: number } | null>(null);
  if (settled && prevTotal !== budget.total) {
    if (prevTotal !== null) setDelta({ v: budget.total - prevTotal, n: (delta?.n ?? 0) + 1 });
    setPrevTotal(budget.total);
  }

  const typing = text !== committed;
  const status = typing
    ? { label: "Mengetik…", tone: "text-slate-400", dot: "bg-slate-400" }
    : pending.length
      ? { label: `Menganalisis ${pending.length} adegan…`, tone: "text-amber-300", dot: "bg-amber-400" }
      : { label: "Tersinkron", tone: "text-emerald-300", dot: "bg-emerald-400" };

  const simulateRevision = () => {
    const lines = text.split("\n");
    const idx = lines.findIndex((l) => /^\s*(INT|EXT)\..*-\s*(PAGI|SIANG|SORE)\s*$/i.test(l));
    if (idx === -1) return;
    lines[idx] = lines[idx].replace(/(PAGI|SIANG|SORE)\s*$/i, "MALAM");
    lines.splice(idx + 1, 0, "", "Lima figuran berlalu-lalang di latar belakang.");
    setText(lines.join("\n"));
  };

  const [isParsingFile, setIsParsingFile] = useState(false);

  const handleFileRead = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";

    if (ext === "docx" || ext === "doc" || ext === "pdf") {
      setIsParsingFile(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/parse-document", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (res.ok && data.text) {
          setText(data.text);
          const autoTitle = detectTitleFromScript(data.text, file.name);
          if (autoTitle && autoTitle !== "Naskah Baru") {
            setTitle(autoTitle);
            updateProject(project.id, { title: autoTitle });
          }
        } else {
          alert(data.error || "Gagal membaca isi dokumen.");
        }
      } catch (err) {
        console.error("Gagal parse file:", err);
        alert("Terjadi kesalahan saat mengekstrak teks file.");
      } finally {
        setIsParsingFile(false);
      }
    } else {
      // Plain text / fountain / markdown
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result;
        if (typeof content === "string") {
          setText(content);
          const autoTitle = detectTitleFromScript(content, file.name);
          if (autoTitle && autoTitle !== "Naskah Baru") {
            setTitle(autoTitle);
            updateProject(project.id, { title: autoTitle });
          }
        }
      };
      reader.readAsText(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileRead(e.dataTransfer.files[0]);
    }
  };

  const exportCsv = () => {
    const rows = [
      ["Kategori", "Item Sewa", "Jumlah", "Satuan", "Harga Sewa / Hari", "Hari Syuting", "Subtotal Sewa"],
      ...budget.lines.map((l) => [
        CATEGORY_META[l.category].label,
        l.name,
        l.quantity,
        l.unit,
        l.unitPrice,
        l.days,
        l.subtotal,
      ]),
      [],
      ["", "", "Subtotal Anggaran Sewa", "", "", "", budget.subtotal],
      ["", "", `Kontingensi ${project.contingencyPct}%`, "", "", "", budget.contingency],
      ["", "", "TOTAL ANGGARAN SEWA", "", "", "", budget.total],
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `anggaran-${project.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tooLong = text.length > MAX_CHARS;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={(el) => { fileInputRef.current = el; }}
        accept=".txt,.fountain,.md,.text,.docx,.doc,.pdf"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFileRead(e.target.files[0]);
          }
        }}
      />

      {/* HEADER */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/5 bg-[#05070d]/80 px-4 backdrop-blur-xl">
        <Logo href="/" compact />
        <Link href="/" className="hidden items-center gap-1 text-sm text-slate-500 hover:text-white sm:flex">
          Dashboard <span className="text-slate-700">/</span>
        </Link>
        <input
          id="ws-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && title !== project.title && updateProject(project.id, { title: title.trim() })}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
          }}
          placeholder="Judul Proyek..."
          className="min-w-0 flex-1 truncate rounded-md bg-transparent px-1.5 py-1 font-display text-[15px] font-semibold text-white outline-none hover:bg-white/5 focus:bg-white/5 sm:max-w-xs"
          aria-label="Judul proyek"
        />
        <span className="hidden rounded-md bg-white/5 px-2 py-0.5 text-[11px] text-slate-400 md:inline">{FORMAT_LABEL[project.format]}</span>

        <div className="ml-auto flex items-center gap-2">
          <button
            id="ws-export"
            onClick={exportCsv}
            className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-amber-300"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" /></svg>
            Ekspor CSV
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* EDITOR */}
        <section
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className="relative flex min-h-[60vh] flex-col border-b border-white/5 lg:min-h-0 lg:border-b-0 lg:border-r"
          aria-label="Editor naskah"
        >
          {isDragging && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#05070d]/90 backdrop-blur-sm border-2 border-dashed border-amber-400">
              <span className="text-2xl">📄</span>
              <p className="mt-2 text-sm font-semibold text-amber-300">Lepaskan file naskah (Word .docx, PDF, atau .txt)</p>
            </div>
          )}

          {isParsingFile && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#05070d]/90 backdrop-blur-sm">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
              <p className="mt-3 text-xs font-medium text-amber-200">Mengekstrak teks dari dokumen Word / PDF…</p>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-2.5">
            <div className="flex items-center gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Editor naskah</h2>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isParsingFile}
                className="text-[11px] text-amber-300/80 hover:text-amber-300 hover:underline"
              >
                + Unggah file (.docx, .pdf, .txt)
              </button>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="relative flex h-2 w-2">
                {!settled || typing ? <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${status.dot} opacity-60`} /> : null}
                <span className={`relative inline-flex h-2 w-2 rounded-full ${status.dot}`} />
              </span>
              <span className={status.tone}>{status.label}</span>
            </div>
          </div>

          {/* scene strip */}
          <div className="flex gap-1.5 overflow-x-auto border-b border-white/5 px-4 py-2">
            {parsed.length === 0 && <span className="text-xs text-slate-600">Belum ada adegan terdeteksi</span>}
            {parsed.map((s) => (
              <span
                key={s.sceneNo + s.hash}
                title={s.heading}
                className={cn(
                  "shrink-0 rounded-md px-2 py-1 font-mono text-[11px] ring-1 ring-inset transition",
                  pendingSet.has(s.hash) ? "skeleton text-amber-200 ring-amber-400/30" : "bg-white/[0.03] text-slate-400 ring-white/10",
                )}
              >
                #{s.sceneNo} {s.timeOfDay === "MALAM" ? "☾" : s.timeOfDay ? "☀" : ""}
              </span>
            ))}
          </div>

          <textarea
            id="ws-editor"
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            placeholder={"INT. RUMAH ARYA - MALAM\n\nArya duduk di meja makan...\n\nARYA\nDialog..."}
            className="min-h-0 flex-1 resize-none bg-transparent px-5 py-4 font-mono text-[13.5px] leading-[1.75] text-slate-200 outline-none placeholder:text-slate-700"
          />

          <div className="flex items-center justify-between gap-3 border-t border-white/5 px-4 py-2 text-[11px] text-slate-600">
            <span className={tooLong ? "text-rose-400" : ""}>
              {text.length.toLocaleString("id-ID")} / {MAX_CHARS.toLocaleString("id-ID")} karakter
            </span>
            {lastRun && (
              <span key={lastRun.count + "-" + lastRun.ms} className="animate-pop">
                AI menganalisis <b className="text-amber-300">{lastRun.count}</b> dari {lastRun.total} adegan · {lastRun.ms} ms
              </span>
            )}
            {!text.trim() && (
              <button onClick={() => setText(DEMO_SCRIPT)} className="text-amber-300 hover:underline">
                Muat naskah contoh
              </button>
            )}
          </div>
        </section>

        {/* RIGHT PANEL */}
        <section className="flex min-h-0 flex-col" aria-label="Hasil analisis">
          {/* summary */}
          <div className="grid shrink-0 grid-cols-2 gap-px border-b border-white/5 bg-white/5 md:grid-cols-4">
            <div className="col-span-2 bg-[#05070d] px-5 py-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Total anggaran (+{project.contingencyPct}% kontingensi)</p>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <p id="ws-total" className="font-display text-3xl font-semibold text-gradient-amber tabular-nums">{rupiah(budget.total)}</p>
                {delta && delta.v !== 0 && (
                  <span
                    key={delta.n}
                    className={cn(
                      "animate-pop rounded-full px-2.5 py-1 font-mono text-xs font-semibold ring-1",
                      delta.v > 0 ? "bg-rose-500/15 text-rose-300 ring-rose-400/30" : "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30",
                    )}
                  >
                    {signedRupiah(delta.v)}
                  </span>
                )}
              </div>
            </div>
            <Stat label="Adegan" value={parsed.length} />
            <Stat label="Hari syuting" value={days.length} />
          </div>

          {/* tabs */}
          <div className="flex shrink-0 items-center gap-1 border-b border-white/5 px-3 py-2">
            {(
              [
                ["breakdown", "Breakdown"],
                ["jadwal", "Jadwal"],
                ["anggaran", "Anggaran"],
              ] as [Tab, string][]
            ).map(([k, l]) => (
              <button
                key={k}
                id={`ws-tab-${k}`}
                onClick={() => setTab(k)}
                className={cn(
                  "relative rounded-lg px-3.5 py-1.5 text-sm font-medium transition",
                  tab === k ? "bg-white/[0.07] text-white" : "text-slate-500 hover:text-slate-200",
                )}
              >
                {l}
                {k === "anggaran" && budget.unmatchedCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-slate-950">{budget.unmatchedCount}</span>
                )}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {parsed.length === 0 ? (
              <EmptyState hasText={!!committed.trim()} onLoadDemo={() => setText(DEMO_SCRIPT)} />
            ) : tab === "breakdown" ? (
              <BreakdownTable
                parsed={parsed}
                cache={cache}
                pending={pendingSet}
                overrides={project.overrides}
                onOverride={(key, v) => {
                  const next = { ...project.overrides };
                  if (v === null) delete next[key];
                  else next[key] = v;
                  updateProject(project.id, { overrides: next });
                }}
              />
            ) : tab === "jadwal" ? (
              <ScheduleBoard days={days} scenes={scenes} pendingCount={pending.length} />
            ) : (
              <BudgetPanel
                budget={budget}
                contingencyPct={project.contingencyPct}
                onContingency={(v) => updateProject(project.id, { contingencyPct: v })}
                onOverride={(key, v) => {
                  const next = { ...project.overrides };
                  if (v === null) delete next[key];
                  else next[key] = v;
                  updateProject(project.id, { overrides: next });
                }}
                onEditItem={(item, newPrice, newQty) => {
                  const next = { ...project.overrides };
                  next[item.key] = newPrice;
                  if (newQty != null && newQty > 0) {
                    next[`${item.key}__qty`] = newQty;
                  }
                  updateProject(project.id, { overrides: next });
                }}
                onDeleteItem={(key) => {
                  const next = { ...project.overrides };
                  next[`${key}__deleted`] = 1;
                  updateProject(project.id, { overrides: next });
                }}
                onRestoreItem={(key) => {
                  const next = { ...project.overrides };
                  delete next[`${key}__deleted`];
                  updateProject(project.id, { overrides: next });
                }}
              />
            )}
          </div>
        </section>
      </div>

      {showAiModal && (
        <AiConfigModal
          currentKey={geminiKey}
          activeEngine={activeEngine}
          onSave={(k) => {
            setGeminiKey(k);
            try {
              localStorage.setItem("scriptflow.gemini_key", k);
            } catch {}
            setShowAiModal(false);
          }}
          onReanalyze={() => {
            setCache({});
            try {
              localStorage.removeItem("scriptflow.scene_cache.v1");
            } catch {}
            setShowAiModal(false);
          }}
          onClose={() => setShowAiModal(false)}
        />
      )}
    </div>
  );
}

function AiConfigModal({
  currentKey,
  activeEngine,
  onSave,
  onReanalyze,
  onClose,
}: {
  currentKey: string;
  activeEngine: "gemini" | "local";
  onSave: (key: string) => void;
  onReanalyze: () => void;
  onClose: () => void;
}) {
  const [keyInput, setKeyInput] = useState(currentKey);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg animate-pop rounded-2xl border border-white/10 bg-[#0a0d16] p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <span className="rounded-md bg-amber-400/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-amber-300 ring-1 ring-amber-400/20">
              Hybrid Extraction Architecture
            </span>
            <h2 className="mt-2 font-display text-2xl font-semibold text-white">Google Gemini AI Engine</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="mt-3 space-y-2 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-[11.5px] leading-relaxed text-slate-300">
          <p className="flex items-start gap-2">
            <span className="text-emerald-400 font-bold">1.</span>
            <span><b>Parser Deterministik (0 ms, 0 Token):</b> Struktur formal (Scene Heading & Karakter Utama) diproses seketika tanpa komputasi awan.</span>
          </p>
          <p className="flex items-start gap-2">
            <span className="text-amber-400 font-bold">2.</span>
            <span><b>Micro-Prompt LLM:</b> Gemini hanya difokuskan mengekstrak properti tersembunyi, kendaraan, dan efek logistik kompleks (hemat &gt;75% token).</span>
          </p>
          <p className="flex items-start gap-2">
            <span className="text-sky-400 font-bold">3.</span>
            <span><b>Hash Tracking (SHA-256):</b> Hanya adegan yang diedit/baru yang diproses ke AI; adegan lama diambil instan dari cache.</span>
          </p>
          <p className="flex items-start gap-2">
            <span className="text-purple-400 font-bold">4.</span>
            <span><b>Relational Pricing:</b> Harga dicocokkan otomatis ke Katalog Master Rupiah (bebas halusinasi biaya).</span>
          </p>
        </div>

        <div className="mt-3 rounded-xl border border-white/5 bg-white/[0.02] p-3.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Status Engine:</span>
            <span className="font-semibold text-emerald-300">
              {activeEngine === "gemini" ? "✓ Hybrid (Deterministik + Gemini Flash)" : "● NLP Deterministik (Lokal 0-Token)"}
            </span>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(keyInput.trim());
          }}
          className="mt-5 space-y-4"
        >
          <div>
            <label htmlFor="gemini-key" className="block text-xs font-medium text-slate-300">
              Gemini API Key
            </label>
            <input
              id="gemini-key"
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="AIzaSy..."
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 font-mono text-xs text-white outline-none placeholder:text-slate-600 focus:border-amber-400/50"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Dapatkan API Key gratis di{" "}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-amber-300 hover:underline"
              >
                Google AI Studio ↗
              </a>{" "}
              atau isi di file <code className="text-slate-400">.env.local</code>.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5">
            <button
              type="button"
              onClick={onReanalyze}
              title="Hapus cache dan analisis ulang semua adegan"
              className="rounded-xl border border-white/10 px-3.5 py-2 text-xs font-medium text-slate-300 hover:bg-white/5 hover:text-white"
            >
              🔄 Analisis Ulang Adegan
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-xs text-slate-400 hover:text-white"
              >
                Batal
              </button>
              <button
                type="submit"
                className="rounded-xl bg-gradient-to-r from-amber-300 to-amber-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:brightness-110"
              >
                Simpan Konfigurasi
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[#05070d] px-5 py-4">
      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p key={value} className="mt-1 animate-pop font-display text-3xl font-semibold text-white tabular-nums">{value}</p>
    </div>
  );
}

function EmptyState({ hasText, onLoadDemo }: { hasText: boolean; onLoadDemo: () => void }) {
  return (
    <div className="mx-auto mt-10 max-w-md text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-400/10 text-amber-300 ring-1 ring-amber-400/20">
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h4" /></svg>
      </div>
      <h3 className="mt-5 font-display text-xl font-semibold text-white">
        {hasText ? "Format heading tidak terdeteksi" : "Mulai dengan menempel naskah"}
      </h3>
      <p className="mt-2 text-sm text-slate-400">Gunakan heading adegan baku agar naskah bisa dipecah otomatis:</p>
      <pre className="mt-4 rounded-xl border border-white/5 bg-black/30 p-4 text-left font-mono text-xs leading-relaxed text-slate-300">
{`INT. RUMAH ARYA - MALAM
EXT. JALAN RAYA - SORE
ADEGAN 3: WARUNG`}
      </pre>
      <button onClick={onLoadDemo} className="mt-5 rounded-xl bg-gradient-to-r from-amber-300 to-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-950">
        Muat naskah contoh
      </button>
    </div>
  );
}

export default Workspace;
