import { NextResponse } from "next/server";
import { parseDocumentBuffer } from "@/lib/document-parser";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: "File tidak ditemukan atau format tidak valid." },
        { status: 400 },
      );
    }

    const filename = (file as File).name || "naskah.txt";
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await parseDocumentBuffer(buffer, filename);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    return NextResponse.json({
      text: result.text,
      filename,
      charCount: result.text.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Error pada /api/parse-document:", err);
    return NextResponse.json(
      { error: `Terjadi kesalahan saat memproses file: ${message}` },
      { status: 500 },
    );
  }
}
