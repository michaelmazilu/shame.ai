import { NextResponse } from "next/server";
import { launchInstagramLogin } from "@/lib/browser-auth";
import { hydrateInstagramUsername } from "@/lib/instagram";
import { getSession } from "@/lib/session";

export const maxDuration = 300; // allow up to 5 minutes

export async function POST() {
  try {
    const result = await launchInstagramLogin();

    if (!result.success || !result.session) {
      return NextResponse.json({ error: result.error || "Login failed" }, { status: 401 });
    }

    const session = await getSession();
    session.ig = result.session;
    await hydrateInstagramUsername(result.session);
    await session.save();

    return NextResponse.json({
      success: true,
      userId: result.session.userId,
      username: result.session.username?.trim() || result.session.userId,
    });
  } catch (e) {
    console.error("[BrowserAuth] Error:", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
