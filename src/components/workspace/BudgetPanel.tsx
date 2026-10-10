"use client";

import { useState } from "react";
import { CATEGORY_META, CATEGORY_ORDER } from "@/lib/price-master";
import type { BudgetLine, BudgetResult } from "@/lib/types";
import { cn, rupiah } from "@/lib/utils";

type Props = {
  budget: BudgetResult;
  contingencyPct: number;
  onContingency: (v: number) => void;
  onOverride: (key: string, value: number | null) => void;
  onEditItem?: (item: BudgetLine, newPrice: number, newQty?: number) => void;
  onDeleteItem?: (key: string) => void;
  onRestoreItem?: (key: string) => void;
};

export function BudgetPanel({
  budget,
  contingencyPct,
  onContingency,
  onOverride,
  onEditItem,
  onDeleteItem,
  onRestoreItem,
}: Props) {
  const max = Math.max(1, ...Object.values(budget.byCategory).map((v) => v ?? 0));
  const unmatched = budget.lines.filter((l) => !l.matched);

  // State untuk modal edit item
  const [editingItem, setEditingItem] = useState<BudgetLine | null>(null);
  const [editPriceInput, setEditPriceInput] = useState<string>("");
  const [editQtyInput, setEditQtyInput] = useState<number>(1);

  // State untuk modal konfirmasi hapus
  const [deletingItem, setDeletingItem] = useState<BudgetLine | null>(null);

  // Buka modal edit
  const handleOpenEdit = (l: BudgetLine) => {
    setEditingItem(l);
    setEditPriceInput(String(l.unitPrice));
    setEditQtyInput(l.quantity || 1);
  };

  // Simpan perubahan dari modal edit
  const handleSaveEdit = () => {
    if (!editingItem) return;
    const cleanNum = Number(editPriceInput.replace(/[^\d]/g, ""));
    const finalPrice = Number.isNaN(cleanNum) ? 0 : cleanNum;
    const finalQty = Math.max(1, Number(editQtyInput) || 1);

    if (onEditItem) {
      onEditItem(editingItem, finalPrice, finalQty);
    } else {
      onOverride(editingItem.key, finalPrice);
    }
    setEditingItem(null);
  };

  // Reset harga ke standar
  const handleResetEdit = () => {
    if (!editingItem) return;
    onOverride(editingItem.key, null);
    if (onEditItem) {
      onEditItem(editingItem, 0, 1);
    }
    setEditingItem(null);
  };

  // Konfirmasi hapus item
  const handleConfirmDelete = () => {
    if (!deletingItem) return;
    if (onDeleteItem) {
      onDeleteItem(deletingItem.key);
    } else {
      onOverride(`${deletingItem.key}__deleted`, 1);
    }
    setDeletingItem(null);
  };

  return (
    <div className="space-y-5">
      {/* RINGKASAN LOGISTIK: BIAYA SEWA & RENTAL (OPEX) */}
      <section className="relative overflow-hidden rounded-2xl border border-sky-400/25 bg-sky-500/[0.04] p-5 transition hover:border-sky-400/40">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-400">
            <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
            Total Estimasi Biaya Sewa & Jasa Produksi
          </span>
          <span className="rounded-full bg-sky-400/15 px-2.5 py-0.5 font-mono text-[11px] font-bold text-sky-300">
            100% Berbasis Sewa Harian
          </span>
        </div>
        <p className="mt-2.5 font-display text-3xl font-bold text-sky-100 tabular-nums">
          {rupiah(budget.subtotal)}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Seluruh kebutuhan produksi dihitung murni berbasis sewa harian (pemeran, properti, kostum, lokasi, pencahayaan, audio, & konsumsi) terikat durasi hari syuting adegan.
        </p>
      </section>

      {unmatched.length > 0 && (
        <div className="rounded-xl border border-amber-400/25 bg-amber-400/[0.06] p-4">
          <p className="text-sm font-semibold text-amber-200">{unmatched.length} item: harga sewa belum ditemukan</p>
          <p className="mt-0.5 text-xs text-amber-200/60">Isi harga sewa harian manual — total akan langsung diperbarui.</p>
          <div className="mt-3 space-y-2">
            {unmatched.map((l) => (
              <PriceRow key={l.key} line={l} onOverride={onOverride} />
            ))}
          </div>
        </div>
      )}

      {budget.lines.some((l) => l.autoEstimated) && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-400/25 bg-emerald-400/[0.05] px-3.5 py-2.5 text-xs text-emerald-200">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>AI Otomatis Menghitung Estimasi Tarif Sewa Pasar & Menyimpannya ke Database Katalog.</span>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-400/80">Auto-learned</span>
        </div>
      )}

      {/* per kategori */}
      <section className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
        <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Per kategori (Biaya Sewa)</h3>
        <div className="mt-4 space-y-3">
          {CATEGORY_ORDER.filter((c) => budget.byCategory[c]).map((c) => {
            const v = budget.byCategory[c] ?? 0;
            return (
              <div key={c} className="flex items-center gap-3 text-sm">
                <span className="w-24 shrink-0 text-slate-400">{CATEGORY_META[c].label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                  <div className={`h-full rounded-full ${CATEGORY_META[c].bar} transition-all duration-700`} style={{ width: `${(v / max) * 100}%` }} />
                </div>
                <span className="w-28 shrink-0 text-right font-mono text-xs text-slate-300 tabular-nums">{rupiah(v)}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* TABEL RINCIAN ANGGARAN & AKSI EDIT / HAPUS */}
      <section className="overflow-hidden rounded-xl border border-white/5">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-white/[0.03] text-left text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Item Sewa / Jasa</th>
                <th className="px-2 py-2.5 text-right font-medium">Qty</th>
                <th className="px-2 py-2.5 text-right font-medium">Harga sewa / hari</th>
                <th className="px-2 py-2.5 text-right font-medium">Hari syuting</th>
                <th className="px-4 py-2.5 text-right font-medium">Subtotal</th>
                <th className="px-4 py-2.5 text-center font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {CATEGORY_ORDER.flatMap((c) =>
                budget.lines
                  .filter((l) => l.category === c)
                  .map((l) => (
                    <tr key={l.key} className="transition hover:bg-white/[0.02] group">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${CATEGORY_META[c].dot}`} />
                          <span className="text-slate-200 font-medium">{l.name}</span>
                          {l.overridden && <span className="rounded bg-sky-400/10 px-1 text-[10px] text-sky-300">diedit</span>}
                          {l.autoEstimated && <span className="rounded bg-emerald-400/10 px-1 text-[10px] text-emerald-300">🤖 AI auto</span>}
                          {!l.matched && <span className="rounded bg-amber-400/15 px-1 text-[10px] text-amber-300">tanpa harga</span>}
                        </div>
                        {l.scenes.length > 0 && <p className="ml-3.5 text-[11px] text-slate-500">Adegan {l.scenes.join(", ")}</p>}
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono text-xs text-slate-400">{l.quantity}</td>
                      <td className="px-2 py-2.5 text-right font-mono text-xs text-slate-400">
                        {rupiah(l.unitPrice)}
                        <span className="text-slate-600">/hari</span>
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono text-xs text-sky-300">
                        {l.days} hari
                      </td>
                      <td className={cn("px-4 py-2.5 text-right font-mono text-xs tabular-nums font-semibold", l.subtotal ? "text-white" : "text-slate-600")}>
                        {rupiah(l.subtotal)}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(l)}
                            title="Ubah harga & jumlah item"
                            className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-1 text-[11px] font-medium text-slate-300 transition hover:bg-amber-400/20 hover:text-amber-200 cursor-pointer"
                          >
                            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                            </svg>
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingItem(l)}
                            title="Hapus item dari anggaran"
                            className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-1 text-[11px] font-medium text-slate-400 transition hover:bg-rose-500/20 hover:text-rose-300 cursor-pointer"
                          >
                            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  )),
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-2 border-t border-white/10 bg-white/[0.02] px-4 py-4 text-sm">
          <div className="flex justify-between text-slate-300">
            <span>Subtotal Anggaran Sewa</span>
            <span className="font-mono tabular-nums font-semibold">{rupiah(budget.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-2">
              Kontingensi
              <select
                id="budget-contingency"
                value={contingencyPct}
                onChange={(e) => onContingency(Number(e.target.value))}
                className="rounded-md border border-white/10 bg-[#0a0d16] px-1.5 py-0.5 text-xs text-white outline-none focus:border-amber-400/50"
              >
                {[0, 5, 10, 15, 20].map((v) => (
                  <option key={v} value={v}>{v}%</option>
                ))}
              </select>
            </span>
            <span className="font-mono tabular-nums">{rupiah(budget.contingency)}</span>
          </div>
          <div className="flex items-end justify-between border-t border-white/5 pt-3">
            <span className="font-semibold text-white">Total Anggaran Sewa</span>
            <span className="font-display text-2xl font-semibold text-gradient-amber tabular-nums">{rupiah(budget.total)}</span>
          </div>
        </div>
      </section>

      {/* DAFTAR ITEM YANG DIHAPUS (BISA DIPULIHKAN KEMBALI) */}
      {budget.deletedLines && budget.deletedLines.length > 0 && (
        <section className="rounded-xl border border-dashed border-rose-500/20 bg-rose-500/[0.02] p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-rose-400" />
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Item Dihapus dari Anggaran ({budget.deletedLines.length})
              </h3>
            </div>
            <span className="text-[11px] text-slate-500">Dapat dipulihkan kapan saja</span>
          </div>
          <div className="mt-3 divide-y divide-white/5">
            {budget.deletedLines.map((l) => (
              <div key={l.key} className="flex items-center justify-between py-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${CATEGORY_META[l.category].dot}`} />
                  <span className="text-slate-400 line-through truncate">{l.name}</span>
                  <span className="text-slate-600 shrink-0">({CATEGORY_META[l.category].label})</span>
                </div>
                <button
                  type="button"
                  onClick={() => onRestoreItem?.(l.key)}
                  className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300 transition hover:bg-emerald-500/20 cursor-pointer shrink-0"
                >
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                  Pulihkan ke Anggaran
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* MODAL EDIT ITEM */}
      {editingItem && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal aria-labelledby="edit-item-title">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setEditingItem(null)} />
          <div className="relative w-full max-w-md animate-pop rounded-2xl border border-white/10 bg-[#0a0d16] p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${CATEGORY_META[editingItem.category].dot}`} />
                <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                  {CATEGORY_META[editingItem.category].label}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <h2 id="edit-item-title" className="mt-3 font-display text-xl font-bold text-white">
              {editingItem.name}
            </h2>
            {editingItem.scenes.length > 0 && (
              <p className="mt-0.5 text-xs text-slate-400">
                Digunakan pada Adegan: <span className="text-slate-300">{editingItem.scenes.join(", ")}</span>
              </p>
            )}

            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300">
                  Harga Sewa / Hari (Rp)
                </label>
                <div className="relative mt-1.5">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-slate-500">Rp</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={editPriceInput}
                    onChange={(e) => setEditPriceInput(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-xl border border-white/15 bg-white/[0.04] py-2.5 pl-10 pr-3 font-mono text-sm text-white outline-none focus:border-amber-400/60 focus:bg-white/[0.06]"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300">
                  Jumlah / Kuantitas (Qty)
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={editQtyInput}
                  onChange={(e) => setEditQtyInput(Math.max(1, parseInt(e.target.value) || 1))}
                  className="mt-1.5 w-full rounded-xl border border-white/15 bg-white/[0.04] py-2.5 px-3 font-mono text-sm text-white outline-none focus:border-amber-400/60 focus:bg-white/[0.06]"
                />
              </div>

              {/* Preview Kalkulasi */}
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs text-slate-400">
                <div className="flex justify-between">
                  <span>Durasi syuting:</span>
                  <span className="font-mono text-slate-300">{editingItem.days} hari</span>
                </div>
                <div className="mt-1 flex justify-between font-medium">
                  <span>Subtotal baru:</span>
                  <span className="font-mono text-amber-300">
                    {rupiah((Math.max(1, Number(editQtyInput) || 1)) * (Number(editPriceInput.replace(/[^\d]/g, "")) || 0) * editingItem.days)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-2">
              {editingItem.overridden ? (
                <button
                  type="button"
                  onClick={handleResetEdit}
                  className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-400 transition hover:bg-white/5 hover:text-white cursor-pointer"
                >
                  Reset Standar
                </button>
              ) : <div />}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="rounded-xl px-4 py-2 text-xs text-slate-400 transition hover:text-white cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="rounded-xl bg-gradient-to-r from-amber-300 to-amber-500 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:brightness-110 cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS */}
      {deletingItem && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal aria-labelledby="delete-item-title">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setDeletingItem(null)} />
          <div className="relative w-full max-w-sm animate-pop rounded-2xl border border-rose-500/20 bg-[#0a0d16] p-6 shadow-2xl">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-rose-500/10 text-rose-400">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </div>

            <h2 id="delete-item-title" className="mt-3 font-display text-lg font-bold text-white">
              Hapus dari Anggaran?
            </h2>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
              Item <span className="font-semibold text-white">“{deletingItem.name}”</span> ({CATEGORY_META[deletingItem.category].label}) akan dihilangkan dari anggaran sewa produksi.
            </p>
            <p className="mt-1 text-xs text-rose-300/80">
              Anggaran akan berkurang sebesar <span className="font-mono font-semibold">{rupiah(deletingItem.subtotal)}</span>.
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="rounded-xl px-4 py-2 text-xs text-slate-400 transition hover:text-white cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="rounded-xl bg-rose-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-600 cursor-pointer"
              >
                Hapus Item
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="px-1 text-[11px] leading-relaxed text-slate-600">
        Seluruh elemen produksi dihitung murni berbasis sewa harian (pemeran, lokasi, properti, kostum, pencahayaan, suara, konsumsi) berdasarkan hari syuting adegan.
      </p>
    </div>
  );
}

function PriceRow({ line, onOverride }: { line: BudgetLine; onOverride: (key: string, v: number | null) => void }) {
  const [val, setVal] = useState(line.overridden ? String(line.unitPrice) : "");
  const commit = () => {
    const n = Number(val.replace(/[^\d]/g, ""));
    onOverride(line.key, val.trim() === "" || Number.isNaN(n) ? null : n);
  };
  return (
    <div className="flex items-center gap-2">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${CATEGORY_META[line.category].dot}`} />
      <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{line.name}</span>
      <div className="relative">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">Rp</span>
        <input
          id={`price-${line.key}`}
          inputMode="numeric"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
          placeholder="0"
          className="w-32 rounded-lg border border-white/10 bg-[#0a0d16] py-1.5 pl-8 pr-2 text-right font-mono text-xs text-white outline-none focus:border-amber-400/50"
        />
      </div>
      {line.overridden && (
        <button onClick={() => { setVal(""); onOverride(line.key, null); }} className="text-xs text-slate-500 hover:text-rose-300" aria-label="Reset harga">
          ✕
        </button>
      )}
    </div>
  );
}

export default BudgetPanel;
