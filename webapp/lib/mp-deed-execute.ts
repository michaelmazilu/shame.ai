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
  const data = (await res.json()) as {
    profile?: { id?: string };
    error?: string;
  };
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

  // ── DM rituals (10 types from punishments.ts) ──
  const dmRitualTypes = [
    "love_declaration",
    "fan_account",
    "wrong_number",
    "time_traveler",
    "job_interview",
    "conspiracy",
    "breakup",
    "life_advice",
    "roommate",
    "prophet",
  ];
  if (dmRitualTypes.includes(t)) {
    const prompt =
      typeof p.prompt === "string"
        ? p.prompt
        : `Write a funny DM. 2-3 sentences max.`;
    const victim = targetUsername || "someone";
    const genRes = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ritualPrompt: prompt, targetUsername: victim }),
    });
    const genData = (await genRes.json()) as {
      message?: string;
      error?: string;
    };
    if (!genRes.ok)
      return {
        ok: false,
        detail: genData.error || "Message generation failed",
      };

    if (targetUsername) {
      const resolved = await resolveTargetUserId(targetUsername);
      if ("error" in resolved) return { ok: false, detail: resolved.error };
      const res = await fetch("/api/dm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: resolved.userId,
          text: genData.message,
        }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success)
        return { ok: false, detail: data.error || "DM failed" };
    }
    return {
      ok: true,
      detail: `DM sent: "${(genData.message || "").slice(0, 60)}..."`,
    };
  }

  // ── Love confession (AI-generated) ──
  if (t === "love_confession") {
    const resolved = targetUsername
      ? await resolveTargetUserId(targetUsername)
      : null;
    const genRes = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ritualPrompt:
          "Write a short, flirty love confession DM. 2 sentences max.",
        targetUsername: targetUsername || "someone",
      }),
    });
    const genData = (await genRes.json()) as {
      message?: string;
      error?: string;
    };
    if (!genRes.ok)
      return { ok: false, detail: genData.error || "Generation failed" };
    if (resolved && !("error" in resolved)) {
      const res = await fetch("/api/dm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: resolved.userId,
          text: genData.message,
        }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success)
        return { ok: false, detail: data.error || "DM failed" };
    }
    return {
      ok: true,
      detail: `Confession sent: "${(genData.message || "").slice(0, 60)}..."`,
    };
  }

  // ── Comment on random reel ──
  if (t === "reel_comment") {
    const res = await fetch("/api/reels/comment", { method: "POST" });
    const data = (await res.json()) as {
      success?: boolean;
      comment?: string;
      reel?: { username?: string };
      error?: string;
    };
    if (!res.ok || !data.success)
      return { ok: false, detail: data.error || "Reel comment failed" };
    return {
      ok: true,
      detail: `Commented on @${data.reel?.username}'s reel: "${(data.comment || "").slice(0, 50)}..."`,
    };
  }

  // ── Send random reel via DM ──
  if (t === "send_reel") {
    const reelRes = await fetch("/api/reels", { method: "POST" });
    const reelData = (await reelRes.json()) as {
      success?: boolean;
      reel?: { shortcode?: string };
      error?: string;
    };
    if (!reelRes.ok || !reelData.success)
      return { ok: false, detail: "No reels found" };
    const reelUrl = `https://www.instagram.com/reel/${reelData.reel?.shortcode}/`;
    if (targetUsername) {
      const resolved = await resolveTargetUserId(targetUsername);
      if ("error" in resolved) return { ok: false, detail: resolved.error };
      const res = await fetch("/api/dm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: resolved.userId, text: reelUrl }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success)
        return { ok: false, detail: data.error || "DM failed" };
    }
    return { ok: true, detail: `Reel sent via DM: ${reelUrl}` };
  }

  // ── AI image to story ──
  if (t === "story_upload") {
    const victim = targetUsername || "someone";
    const imgRes = await fetch("/api/image-gen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: `A funny meme about @${victim}` }),
    });
    const imgData = (await imgRes.json()) as {
      success?: boolean;
      imageB64?: string;
      error?: string;
    };
    if (!imgRes.ok || !imgData.success)
      return { ok: false, detail: imgData.error || "Image generation failed" };
    const storyRes = await fetch("/api/story", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "photo", imageB64: imgData.imageB64 }),
    });
    const storyData = (await storyRes.json()) as {
      success?: boolean;
      error?: string;
    };
    if (!storyRes.ok || !storyData.success)
      return { ok: false, detail: storyData.error || "Story upload failed" };
    return { ok: true, detail: "AI image posted to story!" };
  }

  // ── Repost reel to story ──
  if (t === "reel_to_story") {
    const reelRes = await fetch("/api/reels", { method: "POST" });
    const reelData = (await reelRes.json()) as {
      success?: boolean;
      reel?: { shortcode?: string };
      error?: string;
    };
    if (!reelRes.ok || !reelData.success)
      return { ok: false, detail: "No reels found" };
    const storyRes = await fetch("/api/story", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "repost_reel",
        shortcode: reelData.reel?.shortcode,
      }),
    });
    const storyData = (await storyRes.json()) as {
      success?: boolean;
      error?: string;
    };
    if (!storyRes.ok || !storyData.success)
      return { ok: false, detail: storyData.error || "Story repost failed" };
    return { ok: true, detail: "Reel reposted to story!" };
  }

  // ── AI video to story (async — fire and forget) ──
  if (t === "ai_video_story") {
    const victim = targetUsername || "someone";
    const vidRes = await fetch("/api/video-gen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: `A funny short video about @${victim}` }),
    });
    const vidData = (await vidRes.json()) as {
      success?: boolean;
      jobId?: string;
      error?: string;
    };
    if (!vidData.success)
      return { ok: false, detail: vidData.error || "Video gen failed" };
    return {
      ok: true,
      detail: `Video generation started (job: ${vidData.jobId})`,
    };
  }

  return {
    ok: false,
    detail: `Unknown deed type "${t}" — use Mark done if you did it manually.`,
  };
}

const EXECUTABLE_TYPES = new Set([
  "dm_random",
  "follow_user",
  "unfollow_user",
  "love_declaration",
  "fan_account",
  "wrong_number",
  "time_traveler",
  "job_interview",
  "conspiracy",
  "breakup",
  "life_advice",
  "roommate",
  "prophet",
  "love_confession",
  "reel_comment",
  "send_reel",
  "story_upload",
  "reel_to_story",
  "ai_video_story",
]);

export function deedNeedsInstagramAction(type: string): boolean {
  return EXECUTABLE_TYPES.has(type);
}
