import { NextRequest, NextResponse } from "next/server";
import { getIGSession } from "@/lib/session";
import { generateImage } from "@/lib/ai-gen";

export async function POST(req: NextRequest) {
  const igSession = await getIGSession();
  if (!igSession) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const { prompt } = await req.json();
  if (!prompt) {
    return NextResponse.json({ error: "prompt required" }, { status: 400 });
  }

  try {
    const result = await generateImage(prompt);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[API] Image gen failed:", e);
    return NextResponse.json(
      { error: "Image generation failed" },
      { status: 500 },
    );
  }
}
