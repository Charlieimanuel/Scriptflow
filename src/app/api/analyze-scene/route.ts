import { NextResponse } from "next/server";
import { analyzeSceneWithGemini } from "@/lib/ai/gemini";
import type { ParsedScene } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const scene: ParsedScene = body.scene;
    const apiKey: string | undefined = body.apiKey;

    if (!scene || !scene.heading) {
      return NextResponse.json({ error: "Invalid scene data" }, { status: 400 });
    }

    const result = await analyzeSceneWithGemini(scene, apiKey);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in /api/analyze-scene:", error);
    return NextResponse.json(
      { error: "Internal server error analyzing scene" },
      { status: 500 },
    );
  }
}
