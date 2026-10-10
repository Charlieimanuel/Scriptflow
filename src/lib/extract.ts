import { PRICE_MASTER } from "./price-master";
import type { ParsedScene, SceneElement } from "./types";

/**
 * EKSTRAKSI SIMULASI (rule-based) untuk mode demo tanpa backend.
 * Di versi produksi, fungsi ini diganti panggilan LLM via Server Action
 * (blueprint §10 `extractScene`) dengan output yang sama: SceneElement[].
 */

const NOT_CAST = new Set(["CUT TO", "FADE IN", "FADE OUT", "POTONG KE", "BERSAMBUNG", "SELESAI", "TAMAT"]);

const NUMBER_WORDS: Record<string, number> = {
  satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7,
  delapan: 8, sembilan: 9, sepuluh: 10, beberapa: 3, banyak: 8, puluhan: 20,
};

const CROWD = /(\d+|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|beberapa|banyak|puluhan)\s+(figuran|pengunjung|warga|penonton|pembeli|pelanggan|siswa|mahasiswa|pejalan kaki|karyawan)/g;

/** Benda berdampak biaya yang diestimasi secara heuristik otomatis jika belum ada di katalog standar */
const UNPRICED: { word: string; category: SceneElement["category"]; name: string; price: number; unit: string }[] = [
  { word: "gitar", category: "prop", name: "gitar", price: 150_000, unit: "item" },
  { word: "payung", category: "prop", name: "payung", price: 35_000, unit: "item" },
  { word: "kamera", category: "prop", name: "kamera (properti)", price: 250_000, unit: "item" },
  { word: "pisau", category: "prop", name: "pisau properti", price: 40_000, unit: "item" },
  { word: "kue", category: "other", name: "kue di layar", price: 50_000, unit: "item" },
  { word: "kopi", category: "other", name: "kopi di layar", price: 30_000, unit: "item" },
  { word: "kucing", category: "other", name: "hewan: kucing", price: 350_000, unit: "hari" },
  { word: "anjing", category: "other", name: "hewan: anjing", price: 350_000, unit: "hari" },
  { word: "hujan", category: "other", name: "efek hujan buatan", price: 1_500_000, unit: "hari" },
  { word: "musik live", category: "sound", name: "musik live", price: 500_000, unit: "hari" },
  { word: "bernyanyi", category: "sound", name: "rekaman vokal live", price: 400_000, unit: "hari" },
];

const has = (text: string, word: string) =>
  new RegExp(`(^|[^a-z])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`, "i").test(text);

const titleCase = (s: string) =>
  s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

export function extractScene(scene: ParsedScene): SceneElement[] {
  const out = new Map<string, SceneElement>();
  const add = (el: SceneElement) => {
    const key = `${el.category}::${el.name.toLowerCase()}`;
    const prev = out.get(key);
    out.set(key, prev ? { ...prev, quantity: Math.max(prev.quantity, el.quantity) } : el);
  };

  const body = scene.body;
  const lower = body.toLowerCase();

  // 1. Pemeran: nama tokoh dalam huruf kapital di atas dialog
  const cast = new Set<string>();
  for (const raw of body.split("\n")) {
    const t = raw.trim().replace(/\s*\(.*?\)\s*$/, "");
    if (/^[A-Z][A-Z .'-]{1,28}$/.test(t) && !NOT_CAST.has(t)) cast.add(titleCase(t));
  }
  cast.forEach((name) => add({ category: "cast", name, quantity: 1, priceId: null }));

  // 2. Figuran / kerumunan
  let crowd = 0;
  for (const m of lower.matchAll(CROWD)) {
    const n = Number.isNaN(Number(m[1])) ? NUMBER_WORDS[m[1]] ?? 1 : Number(m[1]);
    crowd += n;
  }
  if (crowd > 0) add({ category: "cast", name: "Figuran", quantity: crowd, priceId: "cast-figuran", notes: "kerumunan / pemeran tambahan" });

  // 3. Properti dari master harga
  for (const p of PRICE_MASTER.filter((x) => x.category === "prop")) {
    if (p.keywords.some((k) => has(lower, k))) add({ category: "prop", name: p.name, quantity: 1, priceId: p.id });
  }

  // 4. Kostum
  const castN = Math.max(cast.size, 1);
  if (has(lower, "seragam")) add({ category: "costume", name: "Kostum seragam", quantity: 1, priceId: "costume-seragam" });
  if (cast.size > 0) add({ category: "costume", name: "Kostum modern harian", quantity: castN, priceId: "costume-harian" });

  // 5. Lokasi
  const locName = scene.location ?? scene.heading;
  const locLower = locName.toLowerCase();
  const locHit = PRICE_MASTER.find((p) => p.category === "location" && p.keywords.some((k) => has(locLower, k)));
  const locId = locHit?.id ?? (scene.intExt === "EXT" ? "loc-publik" : "loc-interior");
  add({ category: "location", name: titleCase(locName), quantity: 1, priceId: locId, notes: scene.intExt ?? undefined });

  // 6. Pencahayaan (tersirat dari waktu)
  const night = scene.timeOfDay === "MALAM" || scene.timeOfDay === "SUBUH" || has(lower, "gelap");
  add(
    night
      ? { category: "lighting", name: "Paket lampu malam (HMI)", quantity: 1, priceId: "light-hmi" }
      : { category: "lighting", name: "Paket lampu LED 2 titik", quantity: 1, priceId: "light-led" },
  );

  // 7. Suara
  if (cast.size > 0) add({ category: "sound", name: "Boom mic + recorder", quantity: 1, priceId: "sound-boom" });

  // 8. Rias khusus
  if (/(luka|darah|memar|lebam|keriput|pucat|penuaan)/.test(lower))
    add({ category: "makeup", name: "Makeup artist", quantity: 1, priceId: "makeup-mua", notes: "rias khusus (luka/efek)" });

  // 9. Elemen dengan estimasi harga otomatis
  for (const u of UNPRICED) {
    if (has(lower, u.word)) {
      add({
        category: u.category,
        name: u.name,
        quantity: 1,
        priceId: null,
        estimatedPrice: u.price,
        unit: u.unit,
      });
    }
  }

  return [...out.values()];
}
