/**
 * Run a multiplayer round deed using the logged-in IG session (same-origin API routes).
 */

export type DeedPayload = {
  type: string;
  params: Record<string, unknown>;
};

function cleanUsername(u: string): string {
  return u.trim().replace(/^@/, "");
}

async function resolveTargetUserId(
  targetUsername: string,
): Promise<{ userId: string } | { error: string }> {
  const username = cleanUsername(targetUsername);
  if (!username) return { error: "Missing target Instagram username in deed." };
  const res = await fetch("/api/enrich", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
  const data = (await res.json()) as { profile?: { id?: string }; error?: string };
  if (!res.ok) {
    return { error: data.error || `Could not load @${username}` };
  }
  const id = data.profile?.id;
  if (!id) return { error: `Could not resolve @${username}` };
  return { userId: id };
}

export async function executeDeedOnInstagram(
  deed: DeedPayload,
): Promise<{ ok: boolean; detail: string }> {
  const t = deed.type;
  const p = deed.params || {};
  const targetUsername =
    typeof p.target_username === "string" ? p.target_username : "";

  if (t === "dm_random") {
    const resolved = await resolveTargetUserId(targetUsername);
    if ("error" in resolved) return { ok: false, detail: resolved.error };
    const text =
      typeof p.dm_text === "string" && p.dm_text.trim()
        ? p.dm_text.trim()
        : "👋 from shame.ai group room";
    const res = await fetch("/api/dm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: resolved.userId, text }),
    });
    const data = (await res.json()) as { success?: boolean; error?: string };
    if (!res.ok || !data.success) {
      return { ok: false, detail: data.error || "DM failed" };
    }
    return { ok: true, detail: "DM sent." };
  }

  if (t === "follow_user") {
    const resolved = await resolveTargetUserId(targetUsername);
    if ("error" in resolved) return { ok: false, detail: resolved.error };
    const res = await fetch("/api/follow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: resolved.userId, action: "follow" }),
    });
    const data = (await res.json()) as { success?: boolean; error?: string };
    if (!res.ok || !data.success) {
      return { ok: false, detail: data.error || "Follow failed" };
    }
    return { ok: true, detail: "Followed." };
  }

  if (t === "unfollow_user") {
    const resolved = await resolveTargetUserId(targetUsername);
    if ("error" in resolved) return { ok: false, detail: resolved.error };
    const res = await fetch("/api/follow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: resolved.userId, action: "unfollow" }),
    });
    const data = (await res.json()) as { success?: boolean; error?: string };
    if (!res.ok || !data.success) {
      return { ok: false, detail: data.error || "Unfollow failed" };
    }
    return { ok: true, detail: "Unfollowed." };
  }

  return {
    ok: false,
    detail: `Unknown deed type "${t}" — use Mark done if you did it manually.`,
  };
}

export function deedNeedsInstagramAction(type: string): boolean {
  return ["dm_random", "follow_user", "unfollow_user"].includes(type);
}
