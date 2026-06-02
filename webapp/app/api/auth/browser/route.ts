import { NextRequest, NextResponse } from "next/server";
import { launchInstagramLogin } from "@/lib/browser-auth";
import { hydrateInstagramUsername } from "@/lib/instagram";
import { getSession } from "@/lib/session";
import type { IGSession } from "@/lib/types";

export const maxDuration = 300; // allow up to 5 minutes

type BrowserLoginResult = {
  success: boolean;
  session?: IGSession;
  error?: string;
};

function getPlaywrightServerConfig() {
  const serverUrl = process.env.PLAYWRIGHT_SERVER_URL?.trim().replace(/\/$/, "");
  const apiSecret = process.env.PLAYWRIGHT_API_SECRET;
  return { serverUrl, apiSecret };
}

function isHostedRuntime() {
  return Boolean(
    process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.K_SERVICE ||
      process.env.CLOUD_RUN_JOB ||
      process.env.GOOGLE_CLOUD_PROJECT,
  );
}

async function loginViaPlaywrightServer(
  username: string,
  password: string,
): Promise<BrowserLoginResult> {
  const { serverUrl, apiSecret } = getPlaywrightServerConfig();
  if (!serverUrl || !apiSecret) {
    return { success: false, error: "Playwright server not configured" };
  }

  try {
    const res = await fetch(`${serverUrl}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiSecret}`,
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message =
        typeof data.message === "string"
          ? data.message
          : typeof data.error === "string"
            ? data.error
            : "Remote Playwright login failed";
      return { success: false, error: message };
    }
    return data as BrowserLoginResult;
  } catch (e) {
    return {
      success: false,
      error:
        e instanceof Error
          ? `Could not reach Playwright server: ${e.message}`
          : "Could not reach Playwright server",
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      username?: string;
      password?: string;
    };
    const username = body.username?.trim();
    const password = body.password ?? "";
    const hasCredentials = Boolean(username && password);
    const hasRemoteServer = Boolean(
      getPlaywrightServerConfig().serverUrl &&
        getPlaywrightServerConfig().apiSecret,
    );

    let result: BrowserLoginResult;

    if (hasCredentials) {
      if (hasRemoteServer) {
        result = await loginViaPlaywrightServer(username!, password);
      } else if (isHostedRuntime()) {
        return NextResponse.json(
          { error: "Playwright server not configured" },
          { status: 503 },
        );
      } else {
        result = await launchInstagramLogin();
      }
    } else {
      if (hasRemoteServer || isHostedRuntime()) {
        return NextResponse.json(
          {
            credentialsRequired: true,
            error: "username and password required for remote login",
          },
          { status: 400 },
        );
      }
      // Local dev: launch a visible Playwright browser and let the user log in there.
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
