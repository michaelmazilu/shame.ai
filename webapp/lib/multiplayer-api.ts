/**
 * Browser client for shame.ai Supabase Edge Functions (multiplayer server).
 * Uses NEXT_PUBLIC_* env vars (publishable key is expected to be public).
 */

export function getMultiplayerConfig(): { url: string; key: string } | null {
  const url = (
    process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  ).replace(/\/$/, "");
  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  ).trim();
  if (!url || !key) return null;
  return { url, key };
}

export async function mpFetch<T = unknown>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<T> {
  const cfg = getMultiplayerConfig();
  if (!cfg) {
    throw new Error("missing_multiplayer_config");
  }
  const reqUrl = `${cfg.url}/functions/v1/${functionName}`;
  const res = await fetch(reqUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.key}`,
      apikey: cfg.key,
      "Content-Type": "application/json",
    },
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
