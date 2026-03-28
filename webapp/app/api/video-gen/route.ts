import { NextRequest, NextResponse } from "next/server";
import { getIGSession } from "@/lib/session";
import { submitVideoJob, checkVideoStatus } from "@/lib/ai-gen";

export async function POST(req: NextRequest) {
  const igSession = await getIGSession();
  if (!igSession) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const { prompt, duration } = await req.json();
  if (!prompt) {
    return NextResponse.json({ error: "prompt required" }, { status: 400 });
  }

  try {
    const result = await submitVideoJob(prompt, duration || 5);
    return NextResponse.json(result, { status: result.success ? 202 : 500 });
  } catch (e) {
    console.error("[API] Video gen submit failed:", e);
    return NextResponse.json(
      { error: "Video generation failed" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  const igSession = await getIGSession();
  if (!igSession) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  try {
    const result = await checkVideoStatus(jobId);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[API] Video status check failed:", e);
    return NextResponse.json({ error: "Status check failed" }, { status: 500 });
  }
}
