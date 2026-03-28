import { NextRequest, NextResponse } from "next/server";
import { generateRitualMessage } from "@/lib/azure";

export async function POST(req: NextRequest) {
  const { ritualPrompt, profile } = await req.json();

  if (!ritualPrompt || !profile) {
    return NextResponse.json(
      { error: "ritualPrompt and profile required" },
      { status: 400 },
    );
  }

  try {
    const message = await generateRitualMessage(ritualPrompt, profile);
    return NextResponse.json({ ok: true, message });
  } catch (e) {
    console.error("[API] Message generation failed:", e);
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 },
    );
  }
}
