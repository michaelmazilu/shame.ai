/**
 * Browser client for shame.ai multiplayer: calls same-origin `/api/mp/*` routes.
 * Supabase URL + publishable key live server-side only (`SUPABASE_*` in .env.local).
 */

export async function getMultiplayerServerReady(): Promise<boolean> {
  try {
    const res = await fetch("/api/mp/status", { cache: "no-store" });
    if (!res.ok) return false;
    const data = (await res.json()) as { ok?: boolean };
    return data.ok === true;
  } catch {
    return false;
  }
}

export async function mpFetch<T = unknown>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`/api/mp/${functionName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(text || `http_${res.status}`);
  }
  const obj = data as { error?: string; detail?: string };
  if (!res.ok) {
    throw new Error(obj.detail || obj.error || `http_${res.status}`);
  }
  return data as T;
}
