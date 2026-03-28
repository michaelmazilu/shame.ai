"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { mpFetch, getMultiplayerServerReady } from "@/lib/multiplayer-api";
import {
  demoCreateRoom,
  demoJoinByCode,
  demoJoinSecondPlayer,
  demoRoomStateFromSession,
  demoStartRound,
  demoSubmitResult,
} from "@/lib/multiplayer-demo";
import type { RoomState } from "@/lib/multiplayer-types";
import {
  loadSession,
  saveSession,
  clearSession,
  myPlayerToken,
  applyJoinToSession,
  tokenForVictim,
  type MpSession,
} from "@/lib/multiplayer-session";
import {
  getPunishmentById,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  type PunishmentCategory,
} from "@/lib/punishments";

function PreviewBanner() {
  return (
    <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200/80 rounded-xl px-3 py-2 text-center leading-relaxed">
      <strong>Preview mode</strong> — you&apos;re seeing the same room UI
      locally. Add Supabase keys (see{" "}
      <code className="text-[10px]">webapp/.env.example</code>) for a real
      synced room with others.
    </p>
  );
}

export default function MultiplayerLobby() {
  const [serverLive, setServerLive] = useState<boolean | null>(null);
  const [session, setSession] = useState<MpSession | null>(null);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const [createName, setCreateName] = useState("Host");
  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState("Guest");
  const [secondName, setSecondName] = useState("Guest2");
  const [executing, setExecuting] = useState(false);
  const [execResult, setExecResult] = useState<{
    success: boolean;
    detail: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await getMultiplayerServerReady();
      if (cancelled) return;
      setServerLive(ok);
      setSession(loadSession({ demo: !ok }));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const preview = serverLive === false;

  const refreshState = useCallback(
    async (s: MpSession) => {
      if (preview) {
        setRoomState((prev) => {
          if (prev?.room.id === s.room_id) return prev;
          return demoRoomStateFromSession(s);
        });
        return;
      }
      const tok = myPlayerToken(s);
      if (!tok) return;
      try {
        const data = await mpFetch<RoomState>("room-state", {
          room_id: s.room_id,
          player_token: tok,
        });
        setRoomState(data);
      } catch {
        /* ignore poll errors */
      }
    },
    [preview],
  );

  const pulseHeartbeat = useCallback(
    async (s: MpSession) => {
      if (preview) return;
      const tasks: Promise<unknown>[] = [];
      if (s.host_player_token) {
        tasks.push(
          mpFetch("heartbeat", {
            room_id: s.room_id,
            player_token: s.host_player_token,
          }),
        );
      }
      if (s.guest_player_token) {
        tasks.push(
          mpFetch("heartbeat", {
            room_id: s.room_id,
            player_token: s.guest_player_token,
          }),
        );
      }
      if (tasks.length === 0 && myPlayerToken(s)) {
        tasks.push(
          mpFetch("heartbeat", {
            room_id: s.room_id,
            player_token: myPlayerToken(s)!,
          }),
        );
      }
      try {
        await Promise.all(tasks);
      } catch {
        /* non-fatal */
      }
    },
    [preview],
  );

  useEffect(() => {
    if (!session) return;
    refreshState(session);
    if (preview) return;
    const poll = window.setInterval(() => refreshState(session), 4000);
    return () => clearInterval(poll);
  }, [session, refreshState, preview]);

  useEffect(() => {
    if (!session || preview) return;
    pulseHeartbeat(session);
    const hb = window.setInterval(() => pulseHeartbeat(session), 35000);
    return () => clearInterval(hb);
  }, [session, pulseHeartbeat, preview]);

  async function onCreate() {
    setErr("");
    setBusy(true);
    try {
      if (preview) {
        const { session: s, roomState: rs } = demoCreateRoom(createName);
        saveSession(s, { demo: true });
        setSession(s);
        setRoomState(rs);
        return;
      }
      const r = await mpFetch<{
        room_id: string;
        short_code: string;
        invite_token: string;
        host_secret: string;
        player_token: string;
        host_player_id: string;
      }>("create-room", { display_name: createName.trim() || "Host" });
      const s: MpSession = {
        room_id: r.room_id,
        short_code: r.short_code,
        invite_token: r.invite_token,
        host_secret: r.host_secret,
        host_player_token: r.player_token,
        host_player_id: r.host_player_id,
        role: "host",
        display_name: createName.trim() || "Host",
      };
      saveSession(s);
      setSession(s);
      await refreshState(s);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "create failed");
    } finally {
      setBusy(false);
    }
  }

  async function onJoinSecondDevice() {
    if (!session?.short_code) return;
    setErr("");
    setBusy(true);
    try {
      if (preview) {
        if (!roomState) return;
        const { session: s, roomState: rs } = demoJoinSecondPlayer(
          session,
          roomState,
          secondName,
        );
        saveSession(s, { demo: true });
        setSession(s);
        setRoomState(rs);
        return;
      }
      const r = await mpFetch<{
        room_id: string;
        short_code: string;
        player_token: string;
        player_id: string;
      }>("join-room", {
        short_code: session.short_code,
        display_name: secondName.trim() || "Guest2",
      });
      const prev = loadSession({ demo: false });
      const s = applyJoinToSession(prev, r, secondName.trim() || "Guest2");
      saveSession(s);
      setSession(s);
      await refreshState(s);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "join failed");
    } finally {
      setBusy(false);
    }
  }

  async function onJoin() {
    setErr("");
    setBusy(true);
    try {
      const code = joinCode.trim().toUpperCase();
      if (code.length < 4) {
        setErr("Enter a room code");
        return;
      }
      if (preview) {
        const { session: s, roomState: rs } = demoJoinByCode(code, joinName);
        saveSession(s, { demo: true });
        setSession(s);
        setRoomState(rs);
        return;
      }
      const r = await mpFetch<{
        room_id: string;
        short_code: string;
        player_token: string;
        player_id: string;
      }>("join-room", {
        short_code: code,
        display_name: joinName.trim() || "Guest",
      });
      const prev = loadSession({ demo: false });
      const s = applyJoinToSession(prev, r, joinName.trim() || "Guest");
      saveSession(s);
      setSession(s);
      await refreshState(s);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "join failed");
    } finally {
      setBusy(false);
    }
  }

  async function onStartRound() {
    if (!session?.host_secret) {
      setErr("Only the host can start a round (need host session).");
      return;
    }
    setErr("");
    setBusy(true);
    try {
      if (preview) {
        if (!roomState) return;
        setRoomState(demoStartRound(session, roomState));
        return;
      }
      await mpFetch("start-round", {
        room_id: session.room_id,
        host_secret: session.host_secret,
      });
      await refreshState(session);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "start failed");
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(result: "ok" | "skipped" | "error", detail: string) {
    if (!session || !roomState?.latest_round) return;
    const lr = roomState.latest_round;
    if (lr.status !== "assigned") return;
    const tok = tokenForVictim(session, lr.victim_player_id);
    if (!tok) {
      setErr("You are not the victim for this round.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      if (preview && roomState) {
        setRoomState(demoSubmitResult(roomState, result, detail));
        return;
      }
      await mpFetch("submit-result", {
        room_id: session.room_id,
        player_token: tok,
        round_id: lr.id,
        result_status: result,
        result_detail: detail || undefined,
      });
      await refreshState(session);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "submit failed");
    } finally {
      setBusy(false);
    }
  }

  async function onCloseRoom() {
    if (!session?.host_secret) return;
    setBusy(true);
    setErr("");
    try {
      if (preview) {
        clearSession({ demo: true });
        setSession(null);
        setRoomState(null);
        return;
      }
      await mpFetch("close-room", {
        room_id: session.room_id,
        host_secret: session.host_secret,
      });
      clearSession();
      setSession(null);
      setRoomState(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "close failed");
    } finally {
      setBusy(false);
    }
  }

  async function onExecutePunishment() {
    if (!session || !roomState?.latest_round) return;
    const lr = roomState.latest_round;
    const deed = lr.deed;
    const deedType = deed.type;
    const params = (deed.params || {}) as Record<string, unknown>;
    const category = (params.category as string) || "dm";
    const victimPlayer = roomState.players.find(
      (p) => p.id === lr.victim_player_id,
    );
    const victimUsername =
      victimPlayer?.ig_username || victimPlayer?.display_name || "someone";

    setExecuting(true);
    setExecResult(null);
    setErr("");

    try {
      let result: { success: boolean; detail: string };

      switch (category) {
        case "dm": {
          // Generate message then send DM
          const prompt =
            (params.prompt as string) ||
            `Write a funny DM to @${victimUsername}. 2-3 sentences max.`;
          const genResp = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ritualPrompt: prompt,
              targetUsername: victimUsername,
            }),
          });
          const genData = await genResp.json();
          if (!genResp.ok)
            throw new Error(genData.error || "Message generation failed");

          const dmResp = await fetch("/api/dm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: victimPlayer?.id,
              text: genData.message,
            }),
          });
          const dmData = await dmResp.json();
          result = {
            success: dmData.success,
            detail: `DM sent: "${genData.message?.slice(0, 60)}..."`,
          };
          break;
        }

        case "comment": {
          const resp = await fetch("/api/reels/comment", { method: "POST" });
          const data = await resp.json();
          result = {
            success: data.success,
            detail: data.success
              ? `Commented on @${data.reel?.username}'s reel: "${data.comment?.slice(0, 60)}..."`
              : data.error || "Comment failed",
          };
          break;
        }

        case "story": {
          if (deedType === "story_upload") {
            // Generate AI image then upload as story
            const imgResp = await fetch("/api/image-gen", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                prompt: `A funny meme about @${victimUsername}`,
              }),
            });
            const imgData = await imgResp.json();
            if (!imgData.success)
              throw new Error(imgData.error || "Image generation failed");

            const storyResp = await fetch("/api/story", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "photo",
                imageB64: imgData.imageB64,
              }),
            });
            const storyData = await storyResp.json();
            result = {
              success: storyData.success,
              detail: "AI image posted to story",
            };
          } else if (deedType === "reel_to_story") {
            // Find random reel and repost to story
            const reelResp = await fetch("/api/reels", { method: "POST" });
            const reelData = await reelResp.json();
            if (!reelData.success) throw new Error("No reels found");

            const storyResp = await fetch("/api/story", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "repost_reel",
                shortcode: reelData.reel.shortcode,
              }),
            });
            const storyData = await storyResp.json();
            result = {
              success: storyData.success,
              detail: "Reel reposted to story",
            };
          } else if (deedType === "ai_video_story") {
            // Submit video generation job (async — fire and forget for now)
            const vidResp = await fetch("/api/video-gen", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                prompt: `A funny short video about @${victimUsername}`,
              }),
            });
            const vidData = await vidResp.json();
            result = {
              success: vidData.success,
              detail: vidData.success
                ? `Video generation started (job: ${vidData.jobId})`
                : vidData.error || "Video gen failed",
            };
          } else {
            result = {
              success: false,
              detail: `Unknown story deed: ${deedType}`,
            };
          }
          break;
        }

        case "reel": {
          // Find random reel and send via DM
          const reelResp = await fetch("/api/reels", { method: "POST" });
          const reelData = await reelResp.json();
          if (!reelData.success) throw new Error("No reels found");

          const reelUrl = `https://www.instagram.com/reel/${reelData.reel.shortcode}/`;
          const dmResp = await fetch("/api/dm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: victimPlayer?.id, text: reelUrl }),
          });
          const dmData = await dmResp.json();
          result = {
            success: dmData.success,
            detail: `Reel sent via DM: ${reelUrl}`,
          };
          break;
        }

        case "profile": {
          if (deedType === "embarrassing_bio") {
            // Generate cringe bio then set it
            const bioPrompt =
              (params.prompt as string) ||
              "Write an embarrassing Instagram bio as a dare. 1-2 lines, funny and cringe, not offensive. No hashtags.";
            const genResp = await fetch("/api/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ritualPrompt: bioPrompt,
                targetUsername: victimUsername,
              }),
            });
            const genData = await genResp.json();
            if (!genResp.ok)
              throw new Error(genData.error || "Bio generation failed");

            const editResp = await fetch("/api/profile-edit", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ biography: genData.message }),
            });
            const editData = await editResp.json();
            result = {
              success: editData.success,
              detail: `Bio changed to: "${genData.message?.slice(0, 60)}..."`,
            };
          } else if (deedType === "pfp_swap") {
            // Generate embarrassing image prompt, create image, set as pfp
            const pfpPrompt =
              (params.prompt as string) ||
              "Generate an embarrassing profile picture. Funny and absurd, NOT a real face. A potato with googly eyes, MS Paint portrait, or cursed image. Under 20 words.";
            const genResp = await fetch("/api/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ritualPrompt: pfpPrompt,
                targetUsername: victimUsername,
              }),
            });
            const genData = await genResp.json();
            if (!genResp.ok) throw new Error("Prompt generation failed");

            const imgResp = await fetch("/api/image-gen", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ prompt: genData.message }),
            });
            const imgData = await imgResp.json();
            if (!imgData.success) throw new Error("Image generation failed");

            const pfpResp = await fetch("/api/pfp", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ imageB64: imgData.imageB64 }),
            });
            const pfpData = await pfpResp.json();
            result = {
              success: pfpData.success,
              detail: `Profile pic changed to AI-generated: "${genData.message?.slice(0, 40)}..."`,
            };
          } else {
            result = {
              success: false,
              detail: `Unknown profile deed: ${deedType}`,
            };
          }
          break;
        }

        case "feed": {
          // Generate meme image and post to feed
          const memePrompt = `A funny meme image about a friendship between two people. Awkward couple photo recreation or over-the-top romantic movie poster parody. No text or real names in the image.`;
          const imgResp = await fetch("/api/image-gen", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: memePrompt }),
          });
          const imgData = await imgResp.json();
          if (!imgData.success) throw new Error("Image generation failed");

          const caption = `me and @${victimUsername} be like 💀`;
          const postResp = await fetch("/api/feed-post", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageB64: imgData.imageB64, caption }),
          });
          const postData = await postResp.json();
          result = {
            success: postData.success,
            detail: `Meme posted to feed with caption: "${caption}"`,
          };
          break;
        }

        default:
          result = { success: false, detail: `Unknown category: ${category}` };
      }

      // Handle special deed types within existing categories
      if (deedType === "cringe_comment" && category === "comment") {
        // Override: comment on victim's post specifically
        const enrichResp = await fetch("/api/enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: victimUsername }),
        });
        const enrichData = await enrichResp.json();
        const posts = enrichData?.recentPosts || [];
        if (posts.length === 0) {
          result = {
            success: false,
            detail: "Victim has no posts to comment on",
          };
        } else {
          const post = posts[0];
          const commentPrompt =
            (params.prompt as string) ||
            `Write an embarrassing comment on @${victimUsername}'s post. Sound like an overly obsessed fan. 1-2 sentences, funny and cringe.`;
          const genResp = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ritualPrompt: commentPrompt,
              targetUsername: victimUsername,
            }),
          });
          const genData = await genResp.json();
          if (!genResp.ok) throw new Error("Comment generation failed");

          const commentResp = await fetch("/api/comment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mediaId: post.id,
              text: genData.message,
            }),
          });
          const commentData = await commentResp.json();
          result = {
            success: commentData.success,
            detail: `Cringe comment on @${victimUsername}'s post: "${genData.message?.slice(0, 50)}..."`,
          };
        }
      }

      if (deedType === "mass_confession" && category === "dm") {
        // Override: send to 3 random mutuals
        const profilesResp = await fetch("/api/profiles");
        const profilesData = await profilesResp.json();
        const mutuals = profilesData?.mutuals || profilesData?.profiles || [];
        const targets = mutuals.sort(() => Math.random() - 0.5).slice(0, 3);

        if (targets.length === 0) {
          result = { success: false, detail: "No mutuals found" };
        } else {
          const results: string[] = [];
          for (const target of targets) {
            const genResp = await fetch("/api/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ritualPrompt:
                  "Write a love confession DM. 2 sentences max. Casual, confident, cheesy but not cringe.",
                targetUsername: target.username,
              }),
            });
            const genData = await genResp.json();
            const dmResp = await fetch("/api/dm", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userId: target.id,
                text: genData.message,
              }),
            });
            const dmData = await dmResp.json();
            results.push(`@${target.username}: ${dmData.success ? "✓" : "✗"}`);
          }
          result = {
            success: results.some((r) => r.includes("✓")),
            detail: `Mass confession: ${results.join(", ")}`,
          };
        }
      }

      if (deedType === "thirst_story" && category === "story") {
        // Override: dramatic "I miss you" story
        const thirstPrompt = `Aesthetic sad Instagram story image with dramatic lighting, rainy window, city lights at night, large stylized handwritten text saying 'I miss you', melancholic lo-fi vibes, soft purple and blue tones`;
        const imgResp = await fetch("/api/image-gen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: thirstPrompt }),
        });
        const imgData = await imgResp.json();
        if (!imgData.success) throw new Error("Image generation failed");

        const storyResp = await fetch("/api/story", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "photo",
            imageB64: imgData.imageB64,
          }),
        });
        const storyData = await storyResp.json();
        result = {
          success: storyData.success,
          detail: `Thirst trap story posted: "i miss you @${victimUsername} 💔"`,
        };
      }

      setExecResult(result);
      if (result.success) {
        await onSubmit("ok", result.detail);
      }
    } catch (e) {
      const detail = e instanceof Error ? e.message : "Execution failed";
      setExecResult({ success: false, detail });
    } finally {
      setExecuting(false);
    }
  }

  function onLeave() {
    clearSession({ demo: preview });
    setSession(null);
    setRoomState(null);
    setErr("");
    setExecResult(null);
  }

  if (serverLive === null) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center text-sm text-zinc-500">
        Loading room…
      </div>
    );
  }

  if (!session) {
    return (
      <div className="max-w-xl mx-auto px-4 py-10 space-y-10">
        <div className="text-center space-y-3">
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">
            Group <span className="text-rose">room</span>
          </h1>
          <p className="text-sm text-zinc-500 mt-2">
            {preview ? (
              <>
                Try create / join below — same screen as the live room. Real
                multiplayer uses Supabase (
                <code className="text-xs bg-beige px-1 rounded">
                  scripts/shame-mp
                </code>
                ).
              </>
            ) : (
              <>
                Realtime punishments via Supabase — same API as{" "}
                <code className="text-xs bg-beige px-1 rounded">
                  scripts/shame-mp
                </code>
              </>
            )}
          </p>
          {preview && <PreviewBanner />}
        </div>

        {err && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {err}
          </p>
        )}

        <div className="bg-white border border-beige rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="text-xs font-semibold text-gold uppercase tracking-wider">
            Create room
          </h2>
          <input
            className="w-full border border-beige rounded-lg px-3 py-2 text-sm"
            placeholder="Your display name"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
          />
          <button
            type="button"
            disabled={busy}
            onClick={onCreate}
            className="w-full py-2.5 rounded-full bg-rose text-white text-sm font-semibold disabled:opacity-50"
          >
            Create &amp; I&apos;m the host
          </button>
        </div>

        <div className="bg-cream-light border border-blush/40 rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="text-xs font-semibold text-gold uppercase tracking-wider">
            Join room
          </h2>
          <input
            className="w-full border border-beige rounded-lg px-3 py-2 text-sm uppercase"
            placeholder="Room code (e.g. ZXVYMH)"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
          />
          <input
            className="w-full border border-beige rounded-lg px-3 py-2 text-sm"
            placeholder="Your display name"
            value={joinName}
            onChange={(e) => setJoinName(e.target.value)}
          />
          <button
            type="button"
            disabled={busy}
            onClick={onJoin}
            className="w-full py-2.5 rounded-full bg-zinc-900 text-white text-sm font-semibold disabled:opacity-50"
          >
            Join with code
          </button>
        </div>

        <p className="text-center text-xs text-zinc-400">
          <Link href="/" className="text-rose">
            Home
          </Link>
          {" · "}
          <Link href="/app" className="text-zinc-500">
            Solo roulette
          </Link>
        </p>
      </div>
    );
  }

  const lr = roomState?.latest_round;
  const imVictim =
    lr?.status === "assigned" &&
    lr &&
    session &&
    tokenForVictim(session, lr.victim_player_id);

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-sm font-bold text-zinc-900">
          shame<span className="text-rose">.ai</span>
        </Link>
        <button
          type="button"
          onClick={onLeave}
          className="text-xs text-zinc-400 hover:text-zinc-900"
        >
          Leave session
        </button>
      </header>

      {err && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {err}
        </p>
      )}

      {preview && <PreviewBanner />}

      <div className="bg-white border border-beige rounded-2xl p-5 shadow-sm space-y-3">
        <p className="text-xs font-semibold text-gold uppercase tracking-wider">
          Room
        </p>
        <p className="text-2xl font-bold tracking-widest text-zinc-900">
          {session.short_code || roomState?.room.short_code || "······"}
        </p>
        {session.invite_token && (
          <p className="text-[10px] text-zinc-400 break-all font-mono">
            Invite token (long): {session.invite_token.slice(0, 24)}…
            <button
              type="button"
              className="ml-2 text-rose"
              onClick={() =>
                navigator.clipboard.writeText(session.invite_token!)
              }
            >
              Copy full
            </button>
          </p>
        )}
        <p className="text-sm text-zinc-500">
          You: <strong>{session.display_name}</strong> (
          {session.host_secret ? "host" : "guest"}
          {session.guest_player_token && session.host_secret
            ? " + 2nd player on device"
            : ""}
          )
        </p>
      </div>

      {session.host_secret && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onStartRound}
              className="flex-1 min-w-[140px] py-3 rounded-full bg-rose text-white text-sm font-semibold disabled:opacity-50"
            >
              Start round
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onCloseRoom}
              className="py-3 px-4 rounded-full border border-red-200 text-sm text-red-700"
            >
              Close room
            </button>
          </div>
          {!session.guest_player_token && (
            <div className="bg-beige/40 border border-beige rounded-xl p-4 space-y-2">
              <p className="text-xs font-medium text-zinc-600">
                Same device — add a 2nd player (tests two heartbeats)
              </p>
              <input
                className="w-full border border-beige rounded-lg px-3 py-2 text-sm"
                value={secondName}
                onChange={(e) => setSecondName(e.target.value)}
                placeholder="2nd player name"
              />
              <button
                type="button"
                disabled={busy}
                onClick={onJoinSecondDevice}
                className="w-full py-2 rounded-lg bg-zinc-800 text-white text-sm"
              >
                Join as 2nd player (this browser)
              </button>
            </div>
          )}
        </div>
      )}

      {!session.host_secret && session.short_code && (
        <p className="text-xs text-zinc-400">
          Share the code above with the host so they can start rounds.
        </p>
      )}

      {lr &&
        lr.status === "assigned" &&
        (() => {
          const deedParams = (lr.deed.params || {}) as Record<string, unknown>;
          const punishment = getPunishmentById(lr.deed.type);
          const emoji =
            (deedParams.emoji as string) || punishment?.emoji || "\u{1F3B2}";
          const name =
            (deedParams.name as string) || punishment?.name || lr.deed.type;
          const description =
            (deedParams.description as string) || punishment?.description || "";
          const category = ((deedParams.category as string) ||
            punishment?.category ||
            "dm") as PunishmentCategory;
          const victimPlayer = roomState?.players.find(
            (p) => p.id === lr.victim_player_id,
          );

          return (
            <div className="bg-cream-light border border-rose/30 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-rose uppercase tracking-wider">
                  Round #{lr.round_index}
                </p>
                <span
                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-white"
                  style={{
                    backgroundColor:
                      CATEGORY_COLORS[category] || CATEGORY_COLORS.dm,
                  }}
                >
                  {CATEGORY_LABELS[category] || category}
                </span>
              </div>

              <div className="text-center space-y-2">
                <p className="text-4xl">{emoji}</p>
                <p className="text-xl font-bold text-zinc-900">{name}</p>
                {description && (
                  <p className="text-sm text-zinc-600">{description}</p>
                )}
              </div>

              <div className="text-center text-xs text-zinc-400">
                Victim:{" "}
                <strong className="text-zinc-700">
                  {victimPlayer?.display_name ||
                    lr.victim_player_id.slice(0, 8)}
                </strong>
                {victimPlayer?.ig_username && (
                  <span className="text-rose ml-1">
                    @{victimPlayer.ig_username}
                  </span>
                )}
              </div>

              {execResult && (
                <div
                  className={`text-sm rounded-lg px-3 py-2 ${execResult.success ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}
                >
                  {execResult.success ? "Done! " : "Failed: "}
                  {execResult.detail}
                </div>
              )}

              {imVictim ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    disabled={busy || executing}
                    onClick={onExecutePunishment}
                    className="flex-1 py-3 rounded-full bg-rose text-white text-sm font-semibold disabled:opacity-50"
                  >
                    {executing ? "Executing..." : "Execute the Shame"}
                  </button>
                  <button
                    type="button"
                    disabled={busy || executing}
                    onClick={() => onSubmit("skipped", "skipped")}
                    className="py-3 px-5 rounded-full border border-beige text-sm text-zinc-600"
                  >
                    Skip
                  </button>
                  {execResult && !execResult.success && (
                    <button
                      type="button"
                      disabled={busy || executing}
                      onClick={onExecutePunishment}
                      className="py-3 px-5 rounded-full border border-rose text-sm text-rose"
                    >
                      Retry
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-zinc-500 italic text-center">
                  Waiting for the victim to execute the deed...
                </p>
              )}
            </div>
          );
        })()}

      {lr && lr.status !== "assigned" && (
        <div className="text-sm text-zinc-500 bg-beige/30 rounded-xl px-4 py-3">
          Latest round #{lr.round_index}: {lr.status}
          {lr.result_detail ? ` — ${lr.result_detail}` : ""}
        </div>
      )}

      <div className="bg-white border border-beige rounded-2xl p-5">
        <p className="text-xs font-semibold text-gold uppercase tracking-wider mb-3">
          Players
        </p>
        <ul className="space-y-2">
          {(roomState?.players || []).map((p) => (
            <li
              key={p.id}
              className="flex justify-between text-sm border-b border-beige/50 pb-2 last:border-0"
            >
              <span>
                {p.display_name || "Anonymous"}{" "}
                <span className="text-zinc-400">({p.role})</span>
              </span>
              <span className="text-xs text-zinc-400">{p.id.slice(0, 6)}…</span>
            </li>
          ))}
          {!roomState?.players?.length && (
            <li className="text-sm text-zinc-400">Syncing…</li>
          )}
        </ul>
      </div>

      <p className="text-center text-xs text-zinc-400">
        Extension: use Instagram for real actions; this page is the lobby only.
      </p>
    </div>
  );
}
