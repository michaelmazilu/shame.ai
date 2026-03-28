/**
 * Browser client for shame.ai multiplayer: calls same-origin `/api/mp/*` routes.
 * Supabase URL + publishable key live server-side only (`SUPABASE_*` in .env.local).
 */

export type MultiplayerEnvStatus = {
  ok: boolean;
  hasUrl: boolean;
  hasKey: boolean;
};

/** Resolves env used by `/api/mp/*` (503 body still includes hasUrl/hasKey). */
export async function fetchMultiplayerEnvStatus(): Promise<MultiplayerEnvStatus> {
  try {
    const res = await fetch("/api/mp/status", { cache: "no-store" });
    const data = (await res.json()) as {
      ok?: boolean;
      hasUrl?: boolean;
      hasKey?: boolean;
    };
    return {
      ok: data.ok === true,
      hasUrl: data.hasUrl === true,
      hasKey: data.hasKey === true,
    };
  } catch {
    return { ok: false, hasUrl: false, hasKey: false };
  }
}

export async function getMultiplayerServerReady(): Promise<boolean> {
  const s = await fetchMultiplayerEnvStatus();
  return s.ok;
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
  const obj = data as {
    error?: string;
    detail?: string;
    ready_within_seconds?: number;
  };
  if (!res.ok) {
    if (
      obj.error === "no_eligible_players_ready" &&
      obj.ready_within_seconds != null
    ) {
      throw new Error(
        `No active players in the last ${obj.ready_within_seconds}s (heartbeats). Wait a few seconds after joining, then try again — the page refreshes presence automatically.`,
      );
    }
    if (obj.error === "no_deed_templates") {
      throw new Error(
        "Server has no deed deck yet. Run Supabase migrations / seed (deed_templates) on your project.",
      );
    }
    if (obj.error === "no_other_player_with_ig") {
      throw new Error(
        obj.detail ||
          "Need at least two players with Instagram usernames in the room for this deed.",
      );
    }
    throw new Error(obj.detail || obj.error || `http_${res.status}`);
  }
  return data as T;
}
