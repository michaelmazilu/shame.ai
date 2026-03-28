import { NextResponse } from "next/server";
import { getIGSession } from "@/lib/session";
import { pythonFetch } from "@/lib/python-api";

export async function POST() {
  const igSession = await getIGSession();
  if (!igSession) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  try {
    const resp = await pythonFetch("/profile/mutuals");
    const data = await resp.json();

    if (!resp.ok) {
      return NextResponse.json(
        { error: data.error || "Failed to load profiles" },
        { status: 500 },
      );
    }

    const profiles = (data.mutuals || []).map(
      (m: {
        id: string;
        username: string;
        fullName?: string;
        isPrivate?: boolean;
      }) => ({
        id: m.id,
        username: m.username,
        fullName: m.fullName || "",
        isPrivate: m.isPrivate || false,
      }),
    );

    return NextResponse.json({ profiles });
  } catch (e) {
    console.error("[API] Profile loading failed:", e);
    return NextResponse.json(
      { error: "Failed to load profiles" },
      { status: 500 },
    );
  }
}
