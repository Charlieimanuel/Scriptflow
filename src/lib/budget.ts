import { PRICE_BY_ID } from "./price-master";
import { findItemPrice } from "./catalog";
import type {
  AnalyzedScene,
  BudgetLine,
  BudgetResult,
  Category,
  ShootingDay,
} from "./types";

const TOD_ORDER = ["SUBUH", "PAGI", "SIANG", "SORE", "MALAM"];

/** Heuristik greedy (blueprint §12): kelompokkan per lokasi, urutkan per waktu. */
export function planSchedule(
  scenes: { sceneNo: number; location: string | null; timeOfDay: string | null }[],
  maxScenesPerDay = 5,
): ShootingDay[] {
  const byLoc = new Map<string, typeof scenes>();
  scenes.forEach((s) => {
    const k = s.location ?? "TANPA LOKASI";
    byLoc.set(k, [...(byLoc.get(k) ?? []), s]);
  });

  const days: ShootingDay[] = [];
  for (const [loc, list] of byLoc) {
    const sorted = [...list].sort(
      (a, b) => TOD_ORDER.indexOf(a.timeOfDay ?? "SIANG") - TOD_ORDER.indexOf(b.timeOfDay ?? "SIANG"),
    );
    for (let i = 0; i < sorted.length; i += maxScenesPerDay) {
      days.push({
        dayNo: days.length + 1,
        location: loc,
        sceneNos: sorted.slice(i, i + maxScenesPerDay).map((s) => s.sceneNo),
      });
    }
  }
  return days;
}

const PER_DAY = new Set<Category>(["cast", "lighting", "sound", "makeup", "location"]);
const CREW_SIZE = 8;

export const lineKey = (category: string, name: string) => `${category}::${name.toLowerCase()}`;

/**
 * Aturan MVP (blueprint §11):
 * - cast / lighting / sound / makeup / location: dibebankan per HARI SYUTING
 * - prop / costume / other: dibebankan sekali per proyek per nama
 */
export function calculateBudget(
  scenes: AnalyzedScene[],
  days: ShootingDay[],
  contingencyPct: number,
  overrides: Record<string, number>,
  procurementOverrides?: Record<string, "sewa" | "beli">,
): BudgetResult {
  const sceneToDay = new Map<number, number>();
  days.forEach((d) => d.sceneNos.forEach((n) => sceneToDay.set(n, d.dayNo)));

  // Tokoh dengan adegan terbanyak = pemeran utama
  const castCount = new Map<string, number>();
  scenes.forEach((s) =>
    s.elements
      .filter((e) => e.category === "cast" && !e.priceId)
      .forEach((e) => castCount.set(e.name, (castCount.get(e.name) ?? 0) + 1)),
  );
  let lead: string | null = null;
  castCount.forEach((n, name) => {
    if (lead === null || n > (castCount.get(lead) ?? 0)) lead = name;
  });

  const grouped = new Map<
    string,
    {
      category: Category;
      name: string;
      quantity: number;
      priceId: string | null;
      estimatedPrice?: number;
      unit?: string;
      procurement?: "sewa" | "beli";
      days: Set<number>;
      scenes: number[];
    }
  >();

  for (const s of scenes) {
    for (const e of s.elements) {
      const priceId = e.category === "cast" && !e.priceId ? (e.name === lead ? "cast-utama" : "cast-pendukung") : e.priceId;
      const key = lineKey(e.category, e.name);
      const g = grouped.get(key) ?? {
        category: e.category,
        name: e.name,
        quantity: 0,
        priceId,
        estimatedPrice: e.estimatedPrice,
        unit: e.unit,
        procurement: e.procurement,
        days: new Set<number>(),
        scenes: [],
      };
      g.quantity = Math.max(g.quantity, e.quantity);
      if (!g.estimatedPrice && e.estimatedPrice) g.estimatedPrice = e.estimatedPrice;
      if (!g.unit && e.unit) g.unit = e.unit;
      if (!g.procurement && e.procurement) g.procurement = e.procurement;
      const d = sceneToDay.get(s.sceneNo);
      if (d) g.days.add(d);
      g.scenes.push(s.sceneNo);
      grouped.set(key, g);
    }
  }

  const lines: BudgetLine[] = [];
  const deletedLines: BudgetLine[] = [];

  for (const [key, g] of grouped) {
    const isDeleted = overrides[`${key}__deleted`] === 1;

    const item = (g.priceId ? PRICE_BY_ID.get(g.priceId) : undefined) ?? findItemPrice(g.category, g.name);
    const override = overrides[key];
    const autoPrice = g.estimatedPrice ?? item?.unitPrice ?? 0;
    const unitPrice = override ?? autoPrice;

    const overrideQty = overrides[`${key}__qty`];
    const quantity = overrideQty != null && overrideQty > 0 ? overrideQty : g.quantity;

    // Seluruh elemen produksi dihitung murni berbasis SEWA / RENTAL
    const procurementType: "sewa" = "sewa";
    const d = Math.max(g.days.size, 1);
    const isAutoEstimated = override == null && item == null && (g.estimatedPrice != null && g.estimatedPrice > 0);
    const isMatched = override != null || item != null || (g.estimatedPrice != null && g.estimatedPrice > 0);

    const lineObj: BudgetLine = {
      key,
      category: g.category,
      name: g.name,
      quantity,
      unit: g.unit ?? item?.unit ?? "hari",
      unitPrice,
      days: d,
      subtotal: quantity * unitPrice * d,
      matched: isMatched,
      overridden: override != null || overrideQty != null,
      autoEstimated: isAutoEstimated,
      scenes: [...new Set(g.scenes)],
      procurementType,
      deleted: isDeleted,
    };

    if (isDeleted) {
      deletedLines.push(lineObj);
    } else {
      lines.push(lineObj);
    }
  }

  // Konsumsi kru + pemain per hari syuting (pastikan tidak ada key duplikat)
  if (days.length > 0) {
    const item = PRICE_BY_ID.get("other-konsumsi")!;
    const key = lineKey("other", item.name);
    const isDeleted = overrides[`${key}__deleted`] === 1;

    // Hapus jika ada entri konsumsi kru dari ekstraksi naskah agar key unik
    const existingIdx = lines.findIndex((l) => l.key === key);
    if (existingIdx >= 0) {
      lines.splice(existingIdx, 1);
    }
    const people =
      CREW_SIZE +
      lines.filter((l) => l.category === "cast").reduce((s, l) => s + l.quantity, 0);
    const overridePrice = overrides[key];
    const overrideQty = overrides[`${key}__qty`];
    const unitPrice = overridePrice ?? item.unitPrice;
    const quantity = overrideQty != null && overrideQty > 0 ? overrideQty : people;

    const konsumsiLine: BudgetLine = {
      key,
      category: "other",
      name: item.name,
      quantity,
      unit: item.unit,
      unitPrice,
      days: days.length,
      subtotal: quantity * unitPrice * days.length,
      matched: true,
      overridden: overridePrice != null || overrideQty != null,
      scenes: [],
      procurementType: "sewa",
      deleted: isDeleted,
    };

    if (isDeleted) {
      deletedLines.push(konsumsiLine);
    } else {
      lines.push(konsumsiLine);
    }
  }

  const byCategory: Partial<Record<Category, number>> = {};
  lines.forEach((l) => (byCategory[l.category] = (byCategory[l.category] ?? 0) + l.subtotal));
  const subtotal = lines.reduce((s, l) => s + l.subtotal, 0);
  const contingency = Math.round(subtotal * (contingencyPct / 100));

  const totalSewa = subtotal;
  const totalBeli = 0;

  return {
    lines,
    deletedLines,
    byCategory,
    subtotal,
    contingency,
    total: subtotal + contingency,
    totalSewa,
    totalBeli,
    unmatchedCount: lines.filter((l) => !l.matched).length,
  };
}
