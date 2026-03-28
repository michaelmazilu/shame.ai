import { NextRequest, NextResponse } from "next/server";
import { generateMessage } from "@/lib/azure";

export async function POST(req: NextRequest) {
  const { tone = "casual" } = await req.json();

  try {
    const message = await generateMessage(tone);
    return NextResponse.json({ ok: true, message });
  } catch (e) {
    console.error("[API] Message generation failed:", e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
