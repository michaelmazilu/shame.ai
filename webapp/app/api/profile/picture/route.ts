import { NextRequest, NextResponse } from "next/server";
import { getIGSession } from "@/lib/session";
import { changeProfilePicture } from "@/lib/instagram";

export async function POST(req: NextRequest) {
  const igSession = await getIGSession();
  if (!igSession) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("profile_pic") as File | null;

  if (!file) {
    return NextResponse.json({ error: "profile_pic file required" }, { status: 400 });
  }

  try {
    const imageData = await file.arrayBuffer();
    const result = await changeProfilePicture(igSession, imageData, file.name);
    return NextResponse.json({ success: result.success, data: result.data });
  } catch (e) {
    console.error("[API] Profile picture change failed:", e);
    return NextResponse.json({ error: "Failed to change profile picture" }, { status: 500 });
  }
}
