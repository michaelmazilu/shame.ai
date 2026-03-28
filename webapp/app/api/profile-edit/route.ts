import { NextRequest, NextResponse } from "next/server";
import { getIGSession } from "@/lib/session";
import { editProfile, getProfileFormData } from "@/lib/instagram";

export async function POST(req: NextRequest) {
  const igSession = await getIGSession();
  if (!igSession) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const { biography } = await req.json();
  if (typeof biography !== "string") {
    return NextResponse.json({ error: "biography required" }, { status: 400 });
  }

  try {
    // Get current bio first
    const formData = await getProfileFormData(igSession);
    const oldBio = formData?.biography || "";

    const result = await editProfile(igSession, { biography });
    return NextResponse.json({
      success: result.success,
      oldBio,
      newBio: biography,
    });
  } catch (e) {
    console.error("[API] Profile edit failed:", e);
    return NextResponse.json({ error: "Profile edit failed" }, { status: 500 });
  }
}
