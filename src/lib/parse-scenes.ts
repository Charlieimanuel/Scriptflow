import type { ParsedScene } from "./types";

// Contoh cocok: "INT. RUMAH ARYA - MALAM", "EXT. JALAN RAYA – SORE", "ADEGAN 4: WARUNG"
const HEADING =
  /^\s*(?:(INT|EXT)\.?\s+(.+?)(?:\s+[-–—]\s+(PAGI|SIANG|SORE|MALAM|SUBUH))?|ADEGAN\s+\d+.*)\s*$/i;

/**
 * Hash ringan yang berjalan di browser (pengganti SHA-256 di server).
 * Dipakai untuk incremental re-analysis: hanya adegan dengan hash baru yang dianalisis.
 */
export function hashText(s: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = Math.imul(h2 ^ c, 2246822507);
  }
  return (h1 >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0");
}

export function parseScenes(text: string): ParsedScene[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const scenes: ParsedScene[] = [];
  let current: { heading: string; meta: RegExpMatchArray; buf: string[] } | null = null;

  const flush = () => {
    if (!current) return;
    const body = current.buf.join("\n").trim();
    const m = current.meta;
    const full = `${current.heading.trim()}\n${body}`;
    scenes.push({
      sceneNo: scenes.length + 1,
      heading: current.heading.trim().toUpperCase(),
      intExt: m[1] ? (m[1].toUpperCase() as "INT" | "EXT") : null,
      location: m[2]?.trim().toUpperCase() ?? null,
      timeOfDay: m[3]?.toUpperCase() ?? null,
      body,
      hash: hashText(full),
    });
  };

  for (const line of lines) {
    const m = line.match(HEADING);
    if (m && line.trim().length < 120) {
      flush();
      current = { heading: line, meta: m, buf: [] };
    } else if (current) {
      current.buf.push(line);
    }
  }
  flush();
  return scenes;
}
