/**
 * Client for the Python/FastAPI backend (deployed on Railway).
 */

import type { IGSession } from "./types";

const PYTHON_API_URL = process.env.PYTHON_API_URL || "http://localhost:8000";

export async function pythonFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const url = `${PYTHON_API_URL}${path}`;
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

/** Safely parse a Python backend response — handles non-JSON errors */
export async function pythonJson(resp: Response): Promise<Record<string, any>> {
  const text = await resp.text();
  try {
    return JSON.parse(text);
  } catch {
    return { success: false, error: text || `HTTP ${resp.status}` };
  }
}

/**
 * Forward the IG session from iron-session to the Python server
 * so it can make Instagram API calls with the same credentials.
 */
export async function syncSessionToPython(session: IGSession): Promise<void> {
  try {
    await pythonFetch("/auth/session", {
      method: "POST",
      body: JSON.stringify({
        cookies: session.cookies,
        csrf_token: session.csrfToken,
        user_id: session.userId,
        username: session.username || "",
        fb_dtsg: session.fbDtsg || null,
        lsd: session.lsd || null,
      }),
    });
  } catch (e) {
    console.error("[PythonAPI] Failed to sync session:", e);
  }
}
