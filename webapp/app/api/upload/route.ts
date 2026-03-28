import { NextRequest, NextResponse } from "next/server";
import { getIGSession } from "@/lib/session";
import { uploadPhoto, publishPost } from "@/lib/instagram";

export async function POST(req: NextRequest) {
  const igSession = await getIGSession();
  if (!igSession) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("photo") as File | null;
  const caption = (formData.get("caption") as string) || "";

  if (!file) {
    return NextResponse.json({ error: "photo file required" }, { status: 400 });
  }

  try {
    const jpegData = await file.arrayBuffer();
    const uploadResult = await uploadPhoto(igSession, jpegData);
    if (!uploadResult.success || !uploadResult.uploadId) {
      return NextResponse.json({ error: uploadResult.error || "Upload failed" }, { status: 500 });
    }

    const postResult = await publishPost(igSession, uploadResult.uploadId, caption);
    return NextResponse.json({
      success: postResult.success,
      mediaId: postResult.mediaId,
      code: postResult.code,
      url: postResult.code ? `https://www.instagram.com/p/${postResult.code}/` : null,
    });
  } catch (e) {
    console.error("[API] Upload/post failed:", e);
    return NextResponse.json({ error: "Failed to upload and publish" }, { status: 500 });
  }
}
