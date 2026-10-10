"use client";

import { useState, type ReactNode } from "react";
import { CATEGORY_META, CATEGORY_ORDER, PRICE_BY_ID } from "@/lib/price-master";
import { extractScene } from "@/lib/extract";
import type { ParsedScene, SceneElement } from "@/lib/types";
import { cn, rupiah } from "@/lib/utils";

type Props = {
  parsed: ParsedScene[];
  cache: Record<string, SceneElement[]>;
  pending: Set<string>;
  overrides?: Record<string, number>;
  onOverride?: (key: string, value: number | null) => void;
};

export function BreakdownTable({ parsed, cache, pending, overrides = {}, onOverride }: Props) {
  const [selectedEl, setSelectedEl] = useState<{
    element: SceneElement;
    sceneNo: number;
    sceneHeading: string;
  } | null>(null);

  const [overrideInput, setOverrideInput] = useState("");

  const handleSelect = (el: SceneElement, sceneNo: number, sceneHeading: string) => {
    setSelectedEl({ element: el, sceneNo, sceneHeading });
    const key = `${el.category}::${el.name.toLowerCase()}`;
    const curOverride = overrides[key];
    setOverrideInput(curOverride ? String(curOverride) : "");
  };

  const handleSaveOverride = () => {
    if (!selectedEl || !onOverride) return;
    const key = `${selectedEl.element.category}::${selectedEl.element.name.toLowerCase()}`;
    const n = Number(overrideInput.replace(/[^\d]/g, ""));
    onOverride(key, overrideInput.trim() === "" || Number.isNaN(n) ? null : n);
    setSelectedEl(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-1 pb-1">
        {CATEGORY_ORDER.map((c) => (
          <span key={c} className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className={`h-1.5 w-1.5 rounded-full ${CATEGORY_META[c].dot}`} />
            {CATEGORY_META[c].label}
          </span>
        ))}
      </div>

      {parsed.map((s) => {
        const fallbackEls = extractScene(s);
        const isAnalyzing = pending.has(s.hash);
        const els = cache[s.hash] || fallbackEls;
        return (
          <article
            key={s.sceneNo + s.hash}
            className={cn(
              "group rounded-xl border bg-white/[0.02] p-4 transition",
              isAnalyzing ? "border-amber-400/20" : "border-white/5 hover:border-white/10",
            )}
          >
            <header className="flex items-start gap-3">
              <span className="grid h-8 min-w-8 place-items-center rounded-lg bg-white/5 px-1.5 font-mono text-xs font-semibold text-slate-300">
                {s.sceneNo}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-mono text-[13px] font-semibold text-amber-200/90">{s.heading}</h3>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {s.intExt && <Tag>{s.intExt === "INT" ? "Interior" : "Eksterior"}</Tag>}
                  {s.timeOfDay && <Tag tone={s.timeOfDay === "MALAM" || s.timeOfDay === "SUBUH" ? "night" : "day"}>{s.timeOfDay}</Tag>}
                  {isAnalyzing ? (
                    <Tag tone="busy">AI Semantik…</Tag>
                  ) : (
                    <Tag tone="ok">{els.length} elemen</Tag>
                  )}
                </div>
              </div>
            </header>

            <div className="mt-3.5">
              <div className="flex flex-wrap gap-1.5">
                  {CATEGORY_ORDER.flatMap((c) =>
                    els
                      .filter((e) => e.category === c)
                      .map((e, i) => {
                        const key = `${c}::${e.name.toLowerCase()}`;
                        const isOverridden = overrides[key] != null;
                        return (
                          <button
                            type="button"
                            key={`${c}-${e.name}-${i}`}
                            onClick={() => handleSelect(e, s.sceneNo, s.heading)}
                            style={{ animationDelay: `${i * 40}ms` }}
                            title={`Klik untuk inspeksi & edit: ${CATEGORY_META[c].label} - ${e.name}`}
                            className={cn(
                              "inline-flex animate-pop items-center gap-1 rounded-md px-2 py-1 text-xs ring-1 ring-inset transition cursor-pointer hover:brightness-125 hover:scale-[1.03]",
                              CATEGORY_META[c].chip,
                              !e.priceId && c !== "cast" && "outline outline-1 outline-dashed outline-amber-400/50",
                              isOverridden && "ring-2 ring-sky-400",
                            )}
                          >
                            <span>{e.name}</span>
                            {e.quantity > 1 && <span className="font-mono opacity-70">×{e.quantity}</span>}
                            {!e.priceId && c !== "cast" && <span className="text-amber-300 font-bold">?</span>}
                            {isOverridden && <span className="text-[9px] text-sky-300 font-semibold">•</span>}
                          </button>
                        );
                      }),
                  )}
                </div>
            </div>
          </article>
        );
      })}

      {/* MODAL INSPECTOR ELEMEN */}
      {selectedEl && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal>
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setSelectedEl(null)} />
          <div className="relative w-full max-w-md animate-pop rounded-2xl border border-white/10 bg-[#0a0d16] p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <span className={cn("inline-block rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset", CATEGORY_META[selectedEl.element.category].chip)}>
                  {CATEGORY_META[selectedEl.element.category].label}
                </span>
                <h3 className="mt-2 font-display text-xl font-semibold text-white">{selectedEl.element.name}</h3>
                <p className="mt-0.5 font-mono text-xs text-slate-400">
                  Adegan #{selectedEl.sceneNo} · {selectedEl.sceneHeading}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEl(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 space-y-3 rounded-xl border border-white/5 bg-white/[0.02] p-4 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Jumlah (Kuantitas)</span>
                <span className="font-mono text-slate-200">{selectedEl.element.quantity} unit</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Model Pengadaan</span>
                <span className="font-semibold">
                  <span className="inline-flex items-center gap-1 rounded bg-sky-500/15 px-1.5 py-0.5 text-sky-300 ring-1 ring-sky-400/30">
                    🔄 SEWA (Rental / Harian)
                  </span>
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Status Master Harga</span>
                <span className="text-slate-200">
                  {selectedEl.element.priceId ? (
                    <span className="text-emerald-300">✓ Terpetakan ({PRICE_BY_ID.get(selectedEl.element.priceId)?.name})</span>
                  ) : (
                    <span className="text-amber-300">Perlu penentuan manual</span>
                  )}
                </span>
              </div>
              {selectedEl.element.priceId && (
                <div className="flex justify-between text-slate-400">
                  <span>Harga Standar Database</span>
                  <span className="font-mono text-slate-200">
                    {rupiah(PRICE_BY_ID.get(selectedEl.element.priceId)?.unitPrice ?? 0)} / {PRICE_BY_ID.get(selectedEl.element.priceId)?.unit}
                  </span>
                </div>
              )}
              {selectedEl.element.notes && (
                <div className="border-t border-white/5 pt-2 text-slate-400">
                  <span className="block text-[11px] text-slate-500 uppercase tracking-wider">Catatan Ekstraksi AI</span>
                  <p className="mt-1 text-slate-300 italic">{selectedEl.element.notes}</p>
                </div>
              )}
            </div>

            {/* Manual Price Override */}
            {onOverride && (
              <div className="mt-5">
                <label className="block text-xs font-medium text-slate-300">
                  Override Harga Manual (Rp / Satuan)
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={overrideInput}
                    onChange={(e) => setOverrideInput(e.target.value)}
                    placeholder="mis. 500000"
                    className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-sm text-white font-mono outline-none focus:border-amber-400/50"
                  />
                  <button
                    type="button"
                    onClick={handleSaveOverride}
                    className="rounded-xl bg-gradient-to-r from-amber-300 to-amber-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:brightness-110"
                  >
                    Simpan
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Kosongkan dan klik simpan untuk kembali ke harga default sistem.
                </p>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedEl(null)}
                className="rounded-xl border border-white/10 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-white/5"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Tag({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "day" | "night" | "busy" | "ok" }) {
  const cls = {
    plain: "bg-white/5 text-slate-400",
    day: "bg-sky-400/10 text-sky-300",
    night: "bg-indigo-400/15 text-indigo-200",
    busy: "bg-amber-400/10 text-amber-300",
    ok: "bg-emerald-400/10 text-emerald-300",
  }[tone];
  return <span className={`rounded px-1.5 py-0.5 text-[10.5px] font-medium ${cls}`}>{children}</span>;
}

export default BreakdownTable;
