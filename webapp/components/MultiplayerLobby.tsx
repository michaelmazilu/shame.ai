"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { mpFetch, getMultiplayerServerReady } from "@/lib/multiplayer-api";
import {
  loadSession,
  saveSession,
  clearSession,
  myPlayerToken,
  applyJoinToSession,
  tokenForVictim,
  type MpSession,
} from "@/lib/multiplayer-session";

type RoomState = {
  room: { id: string; short_code: string; status: string; created_at: string };
  you: {
    id: string;
    role: string;
    display_name: string | null;
    last_seen_at: string;
  };
  players: Array<{
    id: string;
    role: string;
    display_name: string | null;
    last_seen_at: string;
    joined_at: string;
  }>;
  latest_round: {
    id: string;
    round_index: number;
    victim_player_id: string;
    deed: { type: string; params: Record<string, unknown>; template_id?: string };
    status: string;
    result_status?: string | null;
    result_detail?: string | null;
    created_at: string;
    completed_at?: string | null;
  } | null;
};

export default function MultiplayerLobby() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<MpSession | null>(null);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const [createName, setCreateName] = useState("Host");
  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState("Guest");
  const [secondName, setSecondName] = useState("Guest2");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await getMultiplayerServerReady();
      if (!cancelled) setReady(ok);
    })();
    setSession(loadSession());
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshState = useCallback(async (s: MpSession) => {
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
  }, []);

  const pulseHeartbeat = useCallback(async (s: MpSession) => {
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
  }, []);

  useEffect(() => {
    if (!session) return;
    refreshState(session);
    const poll = window.setInterval(() => refreshState(session), 4000);
    return () => clearInterval(poll);
  }, [session, refreshState]);

  useEffect(() => {
    if (!session) return;
    pulseHeartbeat(session);
    const hb = window.setInterval(() => pulseHeartbeat(session), 35000);
    return () => clearInterval(hb);
  }, [session, pulseHeartbeat]);

  async function onCreate() {
    setErr("");
    setBusy(true);
    try {
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
      const r = await mpFetch<{
        room_id: string;
        short_code: string;
        player_token: string;
        player_id: string;
      }>("join-room", {
        short_code: session.short_code,
        display_name: secondName.trim() || "Guest2",
      });
      const prev = loadSession();
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
      const r = await mpFetch<{
        room_id: string;
        short_code: string;
        player_token: string;
        player_id: string;
      }>("join-room", {
        short_code: code,
        display_name: joinName.trim() || "Guest",
      });
      const prev = loadSession();
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

  async function onSubmit(
    result: "ok" | "skipped" | "error",
    detail: string,
  ) {
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

  function onLeave() {
    clearSession();
    setSession(null);
    setRoomState(null);
    setErr("");
  }

  if (!ready) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
        <p className="text-zinc-600 text-sm leading-relaxed">
          Add Supabase keys (server-only, not exposed in the browser) to{" "}
          <code className="bg-beige px-1.5 py-0.5 rounded text-xs">
            webapp/.env.local
          </code>
          :
        </p>
        <pre className="text-left text-xs bg-zinc-900 text-zinc-100 p-4 rounded-xl overflow-x-auto">
          {`SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...`}
        </pre>
        <p className="text-xs text-zinc-400">
          Supabase → Settings → API. If keys live in repo root{" "}
          <code>.env.local</code> only, that file is loaded automatically when you
          run dev from <code>webapp/</code>. You can also use{" "}
          <code>NEXT_PUBLIC_SUPABASE_*</code> in <code>webapp/.env.local</code>{" "}
          (server reads them; the lobby still calls <code>/api/mp</code> only).
          Restart <code>npm run dev</code> after changing env.
        </p>
        <Link href="/" className="text-rose text-sm font-medium inline-block">
          ← Back home
        </Link>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="max-w-xl mx-auto px-4 py-10 space-y-10">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">
            Group <span className="text-rose">room</span>
          </h1>
          <p className="text-sm text-zinc-500 mt-2">
            Realtime punishments via Supabase — same API as{" "}
            <code className="text-xs bg-beige px-1 rounded">scripts/shame-mp</code>
          </p>
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

      {lr && lr.status === "assigned" && (
        <div className="bg-cream-light border border-rose/30 rounded-2xl p-5 space-y-3">
          <p className="text-xs font-semibold text-rose uppercase tracking-wider">
            Active round #{lr.round_index}
          </p>
          <p className="text-lg font-semibold text-zinc-900">{lr.deed.type}</p>
          <p className="text-sm text-zinc-600">
            {String(
              (lr.deed.params as { hint?: string })?.hint ||
                JSON.stringify(lr.deed.params),
            )}
          </p>
          <p className="text-xs text-zinc-400">
            Victim player id: {lr.victim_player_id.slice(0, 8)}…
          </p>
          {imVictim ? (
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => onSubmit("ok", "done from web")}
                className="py-2 px-4 rounded-full bg-zinc-900 text-white text-sm"
              >
                Mark done
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onSubmit("skipped", "skipped")}
                className="py-2 px-4 rounded-full border border-beige text-sm"
              >
                Skip
              </button>
            </div>
          ) : (
            <p className="text-sm text-zinc-500 italic">
              Waiting for the victim to complete the deed…
            </p>
          )}
        </div>
      )}

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
              <span className="text-xs text-zinc-400">
                {p.id.slice(0, 6)}…
              </span>
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
