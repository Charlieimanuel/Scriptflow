import mammoth from "mammoth";
import { extractText } from "unpdf";

export async function parseDocumentBuffer(
  buffer: Buffer,
  filename: string,
): Promise<{ text: string; error?: string }> {
  const ext = filename.split(".").pop()?.toLowerCase() || "";

  try {
    // 1. Dokumen Word (.docx, .doc)
    if (ext === "docx" || ext === "doc") {
      const result = await mammoth.extractRawText({ buffer });
      const text = (result.value || "").trim();
      return { text };
    }

    // 2. Dokumen PDF (.pdf)
    if (ext === "pdf") {
      const uint8 = new Uint8Array(buffer);
      const { text } = await extractText(uint8);
      // unpdf text can be array of pages or string
      const parsedText = Array.isArray(text) ? text.join("\n\n") : text || "";
      return { text: parsedText.trim() };
    }

    // 3. Plain text / Fountain / Markdown
    const text = buffer.toString("utf-8").trim();
    return { text };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Gagal mengekstrak teks dari file ${filename}:`, err);
    return {
      text: "",
      error: `Gagal membaca file ${filename}: ${message}`,
    };
  }
}
