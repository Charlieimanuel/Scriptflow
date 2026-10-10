import { GoogleGenAI } from "@google/genai";
import { extractScene } from "../extract";
import { PRICE_MASTER } from "../price-master";
import type { Category, ParsedScene, SceneElement } from "../types";

/**
 * MICRO-PROMPT SYSTEM INSTRUCTION (Hybrid Extraction Architecture - Tahap 3)
 * LLM HANYA difokuskan pada ekstraksi semantik properti tersembunyi, kendaraan, dan efek logistik.
 * Struktur formal (Cast, Heading, Waktu, Lokasi) diproses terpisah oleh Parser Deterministik (0 ms, 0 Token).
 * Harga dicocokkan otomatis secara relasional dengan Katalog IDR (Bebas Halusinasi).
 */
const MICRO_SYSTEM_INSTRUCTION = `Anda adalah asisten AI Script Breakdown untuk produksi film Indonesia.
Tugas Anda HANYA mengekstrak kebutuhan logistik fisik & semantik tersembunyi dari teks aksi adegan:
1. "prop": Benda fisik yang dipegang/digunakan/disebut dalam aksi (senjata, dokumen, uang, laptop, ponsel, koper, alat makan, tas, dsb).
2. "costume": Kostum khusus (hanya jika spesifik: seragam dinas, pakaian polisi, gaun pengantin, jas hujan, dsb).
3. "makeup": Efek rias khusus (hanya jika spesifik: luka robek, darah buatan, memar, wajah pucat, efek penuaan).
4. "other": Kendaraan fisik (mobil, motor, ambulans, taksi) atau efek praktis/stunt fisik (hujan buatan, ledakan, tembakan, kaca pecah).

ATURAN KETAT:
- JANGAN ekstrak nama pemeran/karakter yang berbicara (sudah diproses oleh parser deterministik berbiaya 0 token).
- JANGAN ekstrak lokasi umum, lampu, atau sound standar (sudah dianalisis otomatis dari heading).
- JANGAN menyertakan estimasi harga rupiah (akan dicocokkan otomatis oleh database relasional).

Format Output Wajib JSON murni:
{
  "items": [
    {
      "category": "prop" | "costume" | "makeup" | "other",
      "name": string (nama benda spesifik & ringkas, bahasa Indonesia baku),
      "quantity": number (integer >= 1),
      "notes": string (konteks singkat pemakaian di adegan)
    }
  ]
}`;

let preferredModel = "gemini-2.5-flash";

const ALL_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-flash-lite-latest",
  "gemini-3.5-flash",
  "gemini-3.8-flash",
];

export async function analyzeSceneWithGemini(
  scene: ParsedScene,
  customApiKey?: string,
): Promise<{ elements: SceneElement[]; source: "gemini" | "local" }> {
  // 1. Ekstraksi Struktur Formal secara Deterministik (0 ms, Bebas Token)
  const baseElements = extractScene(scene);
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim() === "") {
    return {
      elements: baseElements,
      source: "local",
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    // Micro-prompt hanya mengirim heading singkat dan badan adegan (hemat token input >75%)
    const prompt = `LOKASI ADEGAN: ${scene.heading}\n\nAKSI & TEKS ADEGAN:\n${scene.body}`;

    const candidateModels = [
      preferredModel,
      ...ALL_MODELS.filter((m) => m !== preferredModel),
    ];

    let lastError: unknown = null;
    let text: string | null = null;

    for (const model of candidateModels) {
      try {
        const generatePromise = ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction: MICRO_SYSTEM_INSTRUCTION,
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout model ${model} (6s)`)), 6000)
        );

        const response = await Promise.race([generatePromise, timeoutPromise]);
        if (response.text && response.text.trim().length > 0) {
          text = response.text;
          preferredModel = model;
          break;
        }
      } catch (err: unknown) {
        lastError = err;
      }
    }

    if (!text) throw lastError || new Error("Semua kandidat model Gemini gagal merespons");

    const parsed = JSON.parse(text);
    const rawItems: Array<{
      category?: string;
      name?: string;
      quantity?: number;
      notes?: string;
    }> = Array.isArray(parsed.items)
      ? parsed.items
      : Array.isArray(parsed.elements)
        ? parsed.elements
        : [];

    // 4. Relational Matcher: Hubungkan item semantik ke Katalog Harga Relasional
    const existingKeySet = new Set(
      baseElements.map((b) => `${b.category}::${b.name.toLowerCase()}`)
    );
    const enrichedElements: SceneElement[] = [...baseElements];

    for (const item of rawItems) {
      if (!item.name || typeof item.name !== "string") continue;
      const rawCat = String(item.category || "").toLowerCase();
      const cat: Category =
        rawCat === "prop" || rawCat === "costume" || rawCat === "makeup"
          ? (rawCat as Category)
          : "other";

      const name = item.name.trim();
      const lower = name.toLowerCase();
      const key = `${cat}::${lower}`;

      // Pencocokan relasional ke Master Katalog
      const masterHit = PRICE_MASTER.find(
        (p) =>
          p.category === cat &&
          (p.name.toLowerCase() === lower ||
            p.keywords.some((k) => lower.includes(k) || k.includes(lower)))
      );

      // Estimasi harga satuan deterministik berdasarkan katalog atau standar wajar
      let unitPrice = masterHit?.unitPrice;
      let unit = masterHit?.unit;

      if (!unitPrice) {
        if (cat === "prop") {
          unitPrice = lower.includes("laptop") || lower.includes("kamera") || lower.includes("senjata") ? 150_000 : 50_000;
          unit = "item";
        } else if (cat === "costume") {
          unitPrice = lower.includes("seragam") || lower.includes("gaun") ? 200_000 : 100_000;
          unit = "set";
        } else if (cat === "makeup") {
          unitPrice = lower.includes("darah") || lower.includes("luka") ? 450_000 : 350_000;
          unit = "hari";
        } else {
          // Kendaraan atau efek khusus
          if (lower.includes("mobil") || lower.includes("taksi") || lower.includes("ambulans")) {
            unitPrice = 600_000;
            unit = "hari";
          } else if (lower.includes("motor")) {
            unitPrice = 200_000;
            unit = "hari";
          } else if (lower.includes("ledakan") || lower.includes("hujan") || lower.includes("api")) {
            unitPrice = 1_000_000;
            unit = "hari";
          } else {
            unitPrice = 150_000;
            unit = "item";
          }
        }
      }

      const qty = Math.max(1, Number(item.quantity) || 1);

      if (existingKeySet.has(key)) {
        const target = enrichedElements.find(
          (e) => `${e.category}::${e.name.toLowerCase()}` === key
        );
        if (target) {
          target.quantity = Math.max(target.quantity, qty);
          if (item.notes && !target.notes) target.notes = item.notes;
        }
      } else {
        existingKeySet.add(key);
        enrichedElements.push({
          category: cat,
          name,
          quantity: qty,
          priceId: masterHit ? masterHit.id : null,
          estimatedPrice: unitPrice,
          unit: unit || "item",
          notes: item.notes,
        });
      }
    }

    return {
      elements: enrichedElements,
      source: "gemini",
    };
  } catch (err) {
    const msg = (err as Error)?.message || String(err);
    const short = msg.includes("429")
      ? "Kuota/Rate-limit Gemini Free Tier tercapai (429) — beralih ke deterministik lokal"
      : msg.slice(0, 100);
    console.warn(`[Gemini Micro-Engine] ${short}`);
    return {
      elements: baseElements,
      source: "local",
    };
  }
}
