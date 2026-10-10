import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";

function getApiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  try {
    const envPath = path.resolve(process.cwd(), ".env.local");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      const match = content.match(/GEMINI_API_KEY=([^\r\n]+)/);
      if (match && match[1]) return match[1].trim();
    }
  } catch {}
  return "";
}

const OUTPUT_DIR = path.resolve(process.cwd(), "dataset");
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}
const OUTPUT_FILE = path.join(OUTPUT_DIR, "script_breakdown_train.jsonl");

// ==========================================
// 1. GENERATOR CEPAT BERBASIS TEMPLATE VARIATIF
// ==========================================
const CHARACTERS = [
  ["ARYA", "DIMAS"],
  ["BUDI", "SITI"],
  ["INSPEKTUR REZA", "TERSANGKA HENDRA"],
  ["DOKTER MAYA", "SUSTER RINI"],
  ["PAK RT", "WARGA JOKO"],
  ["KAPTEN SURYA", "SERIKAT FAJAR"],
  ["RARA", "IBU"],
];

const LOCATIONS = [
  { slug: "INT. RUANG TAMU - MALAM", name: "Ruang Tamu", time: "MALAM", light: "Paket lampu malam (HMI)", ext: false },
  { slug: "EXT. GANG SEMPIT - MALAM", name: "Gang Sempit", time: "MALAM", light: "Paket lampu malam (HMI)", ext: true },
  { slug: "INT. RUANG INTEROGASI - SIANG", name: "Ruang Interogasi", time: "SIANG", light: "Paket lampu LED 2 titik", ext: false },
  { slug: "EXT. PASAR TRADISIONAL - PAGI", name: "Pasar Tradisional", time: "PAGI", light: "Paket lampu LED 2 titik", ext: true },
  { slug: "INT. RUMAH SAKIT - SORE", name: "Rumah Sakit", time: "SORE", light: "Paket lampu LED 2 titik", ext: false },
  { slug: "EXT. DERMAGA PELABUHAN - SUBUH", name: "Dermaga Pelabuhan", time: "SUBUH", light: "Paket lampu malam (HMI)", ext: true },
  { slug: "INT. KAFE TUA - MALAM", name: "Kafe Tua", time: "MALAM", light: "Paket lampu malam (HMI)", ext: false },
];

const SCENARIOS = [
  {
    genre: "Thriller Kriminal",
    props: ["Borgol besi", "Pistol revolver", "Koper dokumen rahasia"],
    crowd: "3 anggota polisi bersenjata",
    crowdQty: 3,
    action: (c1, c2, p, crowd) => `${c1} membanting ${p[0].toLowerCase()} ke atas meja. ${c2} terpojok dengan napas memburu. Di pintu belakang, ${crowd} berjaga waspada sambil memegang ${p[1].toLowerCase()}.`,
    dialog: (c1, c2) => `${c1}\nKatakan siapa yang menyuruhmu mengambil ${c2}!\n\n${c2}\nAku tidak tahu apa-apa!`,
  },
  {
    genre: "Drama Medis Emosional",
    props: ["Stetoskop", "Papan rekam medis", "Jarum suntik"],
    crowd: "4 perawat berlalu-lalang",
    crowdQty: 4,
    action: (c1, c2, p, crowd) => `${c1} memeriksa detak jantung pasien dengan ${p[0].toLowerCase()}. ${c2} mencatat kondisi darurat pada ${p[1].toLowerCase()}. ${crowd} bergegas mendorong brankar pasien.`,
    dialog: (c1, c2) => `${c1}\nTekanan darahnya menurun drastis, siapkan obat sekarang!\n\n${c2}\nBaik Dok, segera dilaksanakan!`,
  },
  {
    genre: "Drama Keluarga",
    props: ["Cangkir kopi panas", "Foto usang dalam bingkai", "Kunci rumah tua"],
    crowd: "2 tetangga melintas",
    crowdQty: 2,
    action: (c1, c2, p, crowd) => `${c1} duduk termenung memegang ${p[0].toLowerCase()}. ${c2} meletakkan ${p[1].toLowerCase()} di depan meja sambil menghela napas panjang. Dari jendela luar, tampak ${crowd}.`,
    dialog: (c1, c2) => `${c1}\nSudah sepuluh tahun kita tidak membicarakan hal ini...\n\n${c2}\nTapi hari ini kita harus menyelesaikannya.`,
  },
  {
    genre: "Aksi Kejar-kejaran",
    props: ["Sepeda motor bebek", "Tas ransel hitam", "Helm lecet"],
    crowd: "5 pedagang kaki lima panik",
    crowdQty: 5,
    action: (c1, c2, p, crowd) => `${c1} melajukan ${p[0].toLowerCase()} menerobos jalanan padat. ${c2} mengejar dari belakang sambil menggenggam ${p[1].toLowerCase()}. Di pinggir jalan, ${crowd} berhamburan menyelamatkan dagangan mereka.`,
    dialog: (c1, c2) => `${c1}\nMenyingkir semuanya!\n\n${c2}\nBerhenti di sana, jangan lari!`,
  },
];

function generateCombinatorialDataset(targetCount = 50) {
  console.log(`⚡ Menghasilkan ${targetCount} data training naskah sintetis (Instant Mode)...`);
  let created = 0;

  for (let i = 0; i < targetCount; i++) {
    const chars = CHARACTERS[i % CHARACTERS.length];
    const loc = LOCATIONS[i % LOCATIONS.length];
    const scen = SCENARIOS[i % SCENARIOS.length];

    const c1 = chars[0];
    const c2 = chars[1];
    const script = `${loc.slug}\n\n${scen.action(c1, c2, scen.props, scen.crowd)}\n\n${scen.dialog(c1, c2)}`;

    const elements = [
      { category: "cast", name: c1, quantity: 1, notes: "Pemeran utama" },
      { category: "cast", name: c2, quantity: 1, notes: "Pemeran pendukung" },
      { category: "cast", name: "Figuran", quantity: scen.crowdQty, notes: scen.crowd },
      { category: "location", name: loc.name, quantity: 1, notes: loc.ext ? "Eksterior" : "Interior" },
      { category: "lighting", name: loc.light, quantity: 1, notes: `Pencahayaan ${loc.time}` },
      { category: "sound", name: "Boom mic + recorder", quantity: 1, notes: "Perekaman dialog" },
      ...scen.props.map((p) => ({ category: "prop", name: p, quantity: 1, notes: "Properti aksi di naskah" })),
    ];

    const dataRow = {
      instruction: "Ekstrak semua elemen kebutuhan produksi (breakdown) dari adegan naskah film berikut ke dalam format JSON terstruktur.",
      input: script,
      output: JSON.stringify({ elements }),
    };

    fs.appendFileSync(OUTPUT_FILE, JSON.stringify(dataRow) + "\n", "utf-8");
    created++;
  }

  console.log(`✅ Berhasil membuat ${created} data naskah di: ${OUTPUT_FILE}`);
}

// ==========================================
// 2. GENERATOR DENGAN GEMINI AI (JIKA DIMINTA)
// ==========================================
async function generateWithGemini(count = 10) {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn("⚠️ API Key tidak ditemukan, beralih ke Instant Generator...");
    generateCombinatorialDataset(count);
    return;
  }

  console.log(`🤖 Meng-generate ${count} data menggunakan Google Gemini...`);
  const ai = new GoogleGenAI({ apiKey });

  let done = 0;
  for (let i = 0; i < count; i++) {
    const chars = CHARACTERS[i % CHARACTERS.length];
    const loc = LOCATIONS[i % LOCATIONS.length];
    const prompt = `Buatkan 1 adegan naskah film pendek Indonesia di setting ${loc.slug} dengan tokoh ${chars.join(" dan ")}. Ekstrak elemennya ke format JSON: {"script_text": "...", "elements": [{"category": "cast|prop|costume|location|lighting|sound|makeup|other", "name": "...", "quantity": 1}]}`;

    try {
      const res = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" },
      });
      const parsed = JSON.parse(res.text || "{}");
      if (parsed.script_text && parsed.elements) {
        fs.appendFileSync(
          OUTPUT_FILE,
          JSON.stringify({
            instruction: "Ekstrak semua elemen kebutuhan produksi (breakdown) dari adegan naskah film berikut ke dalam format JSON terstruktur.",
            input: parsed.script_text,
            output: JSON.stringify({ elements: parsed.elements }),
          }) + "\n",
        );
        done++;
        console.log(`  ✓ [${done}/${count}] Berhasil diekstrak via Gemini`);
      }
    } catch {
      console.log(`  ⚠️ Panggilan API terhambat, menghasilkan sampel terstruktur otomatis...`);
      generateCombinatorialDataset(1);
      done++;
    }
  }
}

// Parse argumen CLI
const arg = process.argv[2];
const count = Number(arg) || 50;
const useAi = process.argv.includes("--ai");

if (useAi) {
  generateWithGemini(count);
} else {
  generateCombinatorialDataset(count);
}
