import { NextRequest, NextResponse } from "next/server";
import { launchInstagramLogin } from "@/lib/browser-auth";
import { hydrateInstagramUsername } from "@/lib/instagram";
import { getSession } from "@/lib/session";

export const maxDuration = 300; // allow up to 5 minutes

async function loginViaPlaywrightServer(username: string, password: string) {
  const serverUrl = process.env.PLAYWRIGHT_SERVER_URL;
  const apiSecret = process.env.PLAYWRIGHT_API_SECRET;
  if (!serverUrl || !apiSecret) {
    return { success: false, error: "Playwright server not configured" };
  }

  const res = await fetch(`${serverUrl}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiSecret}`,
    },
    body: JSON.stringify({ username, password }),
  });

  const data = await res.json();
  if (!res.ok) {
    return { success: false, error: data.error || "Remote login failed" };
  }
  return data as {
    success: boolean;
    session: Record<string, unknown>;
  };
}

export async function POST(request: NextRequest) {
  try {
    let result: any;

    if (process.env.VERCEL) {
      // On Vercel, proxy to Railway Playwright server
      const body = await request.json().catch(() => ({}));
      if (!body.username || !body.password) {
        return NextResponse.json(
          { error: "username and password required for remote login" },
          { status: 400 },
        );
      }
      result = await loginViaPlaywrightServer(body.username, body.password);
    } else {
      // Local: launch Playwright directly
      result = await launchInstagramLogin();
    }

    if (!result.success || !result.session) {
      return NextResponse.json(
        { error: result.error || "Login failed" },
        { status: 401 },
      );
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
