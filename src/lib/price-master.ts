import type { Category, ProcurementType, ProjectFormat } from "./types";

export type PriceItem = {
  id: string;
  category: Category;
  name: string;
  unit: string;
  unitPrice: number;
  keywords: string[];
  procurement: ProcurementType;
};

/**
 * Seed master harga (blueprint §7.2).
 * Membedakan logistik:
 * - "sewa" (Rental/Jasa): Terikat durasi hari syuting
 * - "beli" (Purchase/Consumable): Pengadaan 1x flat tanpa terpengaruh durasi hari
 */
export const PRICE_MASTER: PriceItem[] = [
  { id: "cast-utama", category: "cast", name: "Pemeran utama", unit: "hari", unitPrice: 1_500_000, keywords: ["aktor utama", "lead", "tokoh utama"], procurement: "sewa" },
  { id: "cast-pendukung", category: "cast", name: "Pemeran pendukung", unit: "hari", unitPrice: 750_000, keywords: ["pemeran pembantu", "supporting"], procurement: "sewa" },
  { id: "cast-figuran", category: "cast", name: "Figuran", unit: "hari", unitPrice: 150_000, keywords: ["extras", "pemeran tambahan", "figuran"], procurement: "sewa" },
  { id: "prop-motor", category: "prop", name: "Sepeda motor (sewa)", unit: "hari", unitPrice: 200_000, keywords: ["motor", "sepeda motor"], procurement: "sewa" },
  { id: "prop-mobil", category: "prop", name: "Mobil (sewa + sopir)", unit: "hari", unitPrice: 600_000, keywords: ["mobil", "kendaraan", "taksi"], procurement: "sewa" },
  { id: "prop-meja", category: "prop", name: "Properti meja & kursi", unit: "hari", unitPrice: 100_000, keywords: ["meja", "kursi", "furnitur", "sofa"], procurement: "sewa" },
  { id: "prop-telepon", category: "prop", name: "Sewa properti telepon/ponsel", unit: "hari", unitPrice: 30_000, keywords: ["ponsel", "handphone", "hp", "telepon"], procurement: "sewa" },
  { id: "costume-harian", category: "costume", name: "Sewa kostum modern harian", unit: "hari", unitPrice: 75_000, keywords: ["baju harian", "pakaian"], procurement: "sewa" },
  { id: "costume-seragam", category: "costume", name: "Sewa kostum seragam", unit: "hari", unitPrice: 100_000, keywords: ["seragam"], procurement: "sewa" },
  { id: "loc-interior", category: "location", name: "Sewa rumah / interior", unit: "hari", unitPrice: 500_000, keywords: ["rumah", "ruang tamu", "kamar"], procurement: "sewa" },
  { id: "loc-publik", category: "location", name: "Izin sewa lokasi publik", unit: "hari", unitPrice: 250_000, keywords: ["jalan", "taman", "pasar"], procurement: "sewa" },
  { id: "light-led", category: "lighting", name: "Paket sewa lampu LED 2 titik", unit: "hari", unitPrice: 350_000, keywords: ["lampu", "lighting", "led"], procurement: "sewa" },
  { id: "light-hmi", category: "lighting", name: "Paket sewa lampu malam (HMI)", unit: "hari", unitPrice: 900_000, keywords: ["lampu malam", "hmi"], procurement: "sewa" },
  { id: "sound-boom", category: "sound", name: "Sewa boom mic + recorder", unit: "hari", unitPrice: 300_000, keywords: ["mic", "audio", "suara"], procurement: "sewa" },
  { id: "makeup-mua", category: "makeup", name: "Jasa makeup artist", unit: "hari", unitPrice: 400_000, keywords: ["mua", "rias"], procurement: "sewa" },
  { id: "other-konsumsi", category: "other", name: "Katering konsumsi kru", unit: "orang/hari", unitPrice: 40_000, keywords: ["makan", "konsumsi"], procurement: "sewa" },
];

export const PRICE_BY_ID = new Map(PRICE_MASTER.map((p) => [p.id, p]));

export const CATEGORY_META: Record<
  Category,
  { label: string; chip: string; bar: string; dot: string }
> = {
  cast: { label: "Pemeran", chip: "bg-sky-500/10 text-sky-300 ring-sky-400/25", bar: "bg-sky-400", dot: "bg-sky-400" },
  prop: { label: "Properti", chip: "bg-amber-500/10 text-amber-300 ring-amber-400/25", bar: "bg-amber-400", dot: "bg-amber-400" },
  costume: { label: "Kostum", chip: "bg-fuchsia-500/10 text-fuchsia-300 ring-fuchsia-400/25", bar: "bg-fuchsia-400", dot: "bg-fuchsia-400" },
  location: { label: "Lokasi", chip: "bg-emerald-500/10 text-emerald-300 ring-emerald-400/25", bar: "bg-emerald-400", dot: "bg-emerald-400" },
  lighting: { label: "Pencahayaan", chip: "bg-yellow-500/10 text-yellow-200 ring-yellow-300/25", bar: "bg-yellow-300", dot: "bg-yellow-300" },
  sound: { label: "Suara", chip: "bg-violet-500/10 text-violet-300 ring-violet-400/25", bar: "bg-violet-400", dot: "bg-violet-400" },
  makeup: { label: "Rias", chip: "bg-rose-500/10 text-rose-300 ring-rose-400/25", bar: "bg-rose-400", dot: "bg-rose-400" },
  other: { label: "Lainnya", chip: "bg-slate-500/10 text-slate-300 ring-slate-400/25", bar: "bg-slate-400", dot: "bg-slate-400" },
};

export const CATEGORY_ORDER: Category[] = [
  "cast",
  "location",
  "prop",
  "costume",
  "lighting",
  "sound",
  "makeup",
  "other",
];

export const FORMAT_LABEL: Record<ProjectFormat, string> = {
  film_pendek: "Film Pendek",
  teater: "Teater",
  serial_web: "Serial Web",
  konten: "Konten",
};
