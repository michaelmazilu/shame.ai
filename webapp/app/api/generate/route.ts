import { NextRequest, NextResponse } from "next/server";
import { generateRitualMessage } from "@/lib/azure";

export async function POST(req: NextRequest) {
  const { ritualPrompt, username, targetUsername } = await req.json();
  const target = username || targetUsername;

  if (!ritualPrompt || !target) {
    return NextResponse.json(
      { error: "ritualPrompt and username required" },
      { status: 400 },
    );
  }

  try {
    const message = await generateRitualMessage(ritualPrompt, target);
    return NextResponse.json({ ok: true, message });
  } catch (e) {
    console.error("[API] Message generation failed:", e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
