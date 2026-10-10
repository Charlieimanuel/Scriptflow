import { PRICE_MASTER, type PriceItem } from "./price-master";
import type { Category, SceneElement } from "./types";

const CATALOG_KEY = "scriptflow.custom_catalog.v1";

/**
 * Membaca katalog tambahan (custom/learned) dari localStorage.
 */
export function getStoredCatalog(): PriceItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    return raw ? (JSON.parse(raw) as PriceItem[]) : [];
  } catch {
    return [];
  }
}

/**
 * Menyimpan katalog tambahan ke localStorage.
 */
export function saveStoredCatalog(items: PriceItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CATALOG_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event("scriptflow_catalog_updated"));
  } catch (err) {
    console.warn("Gagal menyimpan katalog ke localStorage:", err);
  }
}

/**
 * Menambahkan atau memperbarui item dalam katalog otomatis.
 */
export function registerCatalogItem(item: PriceItem): void {
  const current = getStoredCatalog();
  const existingIdx = current.findIndex(
    (c) => c.category === item.category && c.name.toLowerCase() === item.name.toLowerCase()
  );

  if (existingIdx >= 0) {
    current[existingIdx] = { ...current[existingIdx], ...item };
  } else {
    current.push(item);
  }

  saveStoredCatalog(current);
}

/**
 * Secara otomatis menyimpan semua elemen yang baru dianalisis oleh AI
 * ke dalam database katalog lokal jika belum ada di master data standar.
 */
export function autoLearnElementsToCatalog(elements: SceneElement[]): number {
  if (typeof window === "undefined" || !elements || elements.length === 0) return 0;

  const stored = getStoredCatalog();
  let addedCount = 0;

  for (const el of elements) {
    const nameLower = el.name.trim().toLowerCase();
    if (!nameLower) continue;

    // Cek apakah sudah ada di master bawaan
    const existsInMaster = PRICE_MASTER.some(
      (p) => p.category === el.category && p.name.toLowerCase() === nameLower
    );
    if (existsInMaster) continue;

    // Cek apakah sudah ada di custom catalog
    const existsInStored = stored.some(
      (c) => c.category === el.category && c.name.toLowerCase() === nameLower
    );

    const price = el.estimatedPrice ?? 0;
    if (price > 0 && !existsInStored) {
      stored.push({
        id: `auto-${el.category}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        category: el.category as Category,
        name: el.name.trim(),
        unit: el.unit || (el.unit === "hari" ? "hari" : "hari"),
        unitPrice: price,
        keywords: [nameLower],
        procurement: "sewa",
      });
      addedCount++;
    }
  }

  if (addedCount > 0) {
    saveStoredCatalog(stored);
  }

  return addedCount;
}

/**
 * Mencari harga item dari katalog standar maupun katalog dinamis (learned).
 */
export function findItemPrice(category: string, name: string): PriceItem | undefined {
  const nameLower = name.trim().toLowerCase();
  const masterHit = PRICE_MASTER.find(
    (p) =>
      p.category === category &&
      (p.name.toLowerCase() === nameLower ||
        p.keywords.some((k) => nameLower.includes(k) || k.includes(nameLower)))
  );
  if (masterHit) return masterHit;

  const stored = getStoredCatalog();
  return stored.find(
    (c) =>
      c.category === category &&
      (c.name.toLowerCase() === nameLower ||
        c.keywords.some((k) => nameLower.includes(k) || k.includes(nameLower)))
  );
}

