import { calculateBudget, planSchedule } from "./budget";
import { extractScene } from "./extract";
import { parseScenes } from "./parse-scenes";
import type { AnalyzedScene, Project } from "./types";

const rupiahFmt = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export const rupiah = (n: number) => rupiahFmt.format(n);

export const signedRupiah = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${rupiah(Math.abs(n))}`;

export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** Analisis sinkron penuh — dipakai untuk ringkasan di dashboard. */
export function analyzeProject(p: Project) {
  const parsed = parseScenes(p.scriptText);
  const scenes: AnalyzedScene[] = parsed.map((s) => ({ ...s, elements: extractScene(s) }));
  const days = planSchedule(scenes);
  const budget = calculateBudget(scenes, days, p.contingencyPct, p.overrides);
  return { scenes, days, budget };
}

export function relativeTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "baru saja";
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  return `${Math.floor(diff / 86400)} hari lalu`;
}

function cleanTitleCandidate(raw: string): string {
  return raw
    .replace(/^#+\s*/, "")
    .replace(/^["'“”‘’«»]+|["'“”‘’«»]+$/g, "")
    .replace(/^\(?\d+[\.\)\-:\s]+\s*/, "")
    .replace(/[*_~`]/g, "")
    .trim();
}

function isSceneHeading(line: string): boolean {
  return /^(?:\(?\d+[\.\)\-]?\s*)?(?:INT|EXT|INT\/EXT|I\/E|INTERIOR|EKSTERIOR|ADEGAN|SCENE)\b/i.test(line.trim());
}

function isNotTitle(line: string): boolean {
  const trimmed = line.trim();
  // 1. Terlalu pendek / panjang
  if (trimmed.length < 2 || trimmed.length > 90) return true;

  // 2. Pure angka atau penomoran seperti "1.", "1", "1)", "(1)", romawi "I."
  if (/^\(?\d+[\.\)\-]?\)?$/.test(trimmed)) return true;
  if (/^[IVXLCDM]+[\.\)\-]?$/i.test(trimmed)) return true;

  // 3. Tidak ada huruf alfabet
  if (!/[a-zA-Z]/.test(trimmed)) return true;

  // 4. Scene heading (slugline adegan skenario)
  if (isSceneHeading(trimmed)) return true;

  // 5. Metadata naskah / cover page
  if (
    /^(?:oleh|by|written\s+by|ditulis\s+oleh|draft|revisi|revision|versi|version|penulis|penulis\s+skenario|skenario\s+oleh|cerita\s+oleh|story\s+by|screenplay\s+by|author|credit|date|tanggal|halaman|page|hal\.?|kontak|contact|copyright|hak\s+cipta|produser|sutradara|director|genre)\b/i.test(
      trimmed
    )
  ) {
    return true;
  }

  // 6. Label format umum yang bukan judul spesifik
  if (
    /^(?:skenario|skenario\s+film|skenario\s+film\s+pendek|naskah|naskah\s+film|film\s+pendek|short\s+film|feature\s+film|screenplay)\s*$/i.test(
      trimmed
    )
  ) {
    return true;
  }

  // 7. Transisi teknis
  if (
    /^(?:fade\s+in|fade\s+out|cut\s+to|dissolve\s+to|smash\s+cut|black\s+screen|over\s+black|the\s+end|tamat|selesai)\b/i.test(
      trimmed
    )
  ) {
    return true;
  }

  return false;
}

/**
 * Deteksi judul asli skenario secara otomatis:
 * 1. Prioritas pola eksplisit: Title: ..., Judul: ..., Judul Naskah: ...
 * 2. Header Markdown: # Judul
 * 3. Baris judul sebelum adegan pertama (mengabaikan penomoran "1.", metadata, dll.)
 * 4. Fallback ke nama file (dibersihkan dari ekstensi & penomoran)
 */
export function detectTitleFromScript(text: string, fallbackFileName?: string): string {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // 1. Cek pola Title: atau Judul: (format Fountain atau naskah baku)
  for (const line of lines.slice(0, 25)) {
    const match = line.match(/^(?:title|judul|judul\s+naskah|judul\s+skenario|naskah)\s*[:=]\s*(.+)$/i);
    if (match && match[1]) {
      const candidate = cleanTitleCandidate(match[1]);
      if (candidate.length >= 2 && /[a-zA-Z]/.test(candidate) && !isSceneHeading(candidate)) {
        return candidate;
      }
    }
  }

  // 2. Cek baris Markdown header (# Judul)
  for (const line of lines.slice(0, 15)) {
    if (/^#+\s+/.test(line)) {
      const candidate = cleanTitleCandidate(line);
      if (candidate.length >= 2 && /[a-zA-Z]/.test(candidate) && !isSceneHeading(candidate)) {
        return candidate;
      }
    }
  }

  // 3. Cek baris judul sebelum adegan pertama
  for (const line of lines.slice(0, 15)) {
    if (isSceneHeading(line)) {
      break;
    }

    if (isNotTitle(line)) {
      continue;
    }

    const candidate = cleanTitleCandidate(line);
    if (candidate.length >= 2 && /[a-zA-Z]/.test(candidate) && !isSceneHeading(candidate)) {
      return candidate;
    }
  }

  // 4. Fallback ke nama file jika judul belum ditemukan
  if (fallbackFileName) {
    let name = fallbackFileName.replace(/\.[^/.]+$/, "").trim();
    name = name.replace(/^\(?\d+[\.\)\-\s_]+/, "").trim();
    name = name.replace(/[_-]+/g, " ").trim();
    if (name.length >= 2 && /[a-zA-Z]/.test(name)) {
      return name.replace(/\b\w/g, (c) => c.toUpperCase());
    }
  }

  return "Naskah Baru";
}
