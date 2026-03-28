import { NextRequest, NextResponse } from "next/server";
import { getIGSession } from "@/lib/session";
import { editProfile, getProfileFormData } from "@/lib/instagram";

export async function GET() {
  const igSession = await getIGSession();
  if (!igSession) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  try {
    const formData = await getProfileFormData(igSession);
    return NextResponse.json({ formData });
  } catch (e) {
    console.error("[API] Profile form data fetch failed:", e);
    return NextResponse.json({ error: "Failed to fetch profile data" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const igSession = await getIGSession();
  if (!igSession) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const fields = await req.json();
  if (!fields || typeof fields !== "object") {
    return NextResponse.json({ error: "fields object required" }, { status: 400 });
  }

  try {
    const result = await editProfile(igSession, fields);
    return NextResponse.json({ success: result.success, data: result.data });
  } catch (e) {
    console.error("[API] Profile edit failed:", e);
    return NextResponse.json({ error: "Failed to edit profile" }, { status: 500 });
  }
}
