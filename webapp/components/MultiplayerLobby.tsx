"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  deedNeedsInstagramAction,
  executeDeedOnInstagram,
} from "@/lib/mp-deed-execute";
import {
  getPunishmentById,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  type PunishmentCategory,
} from "@/lib/punishments";
import { mpFetch, fetchMultiplayerEnvStatus } from "@/lib/multiplayer-api";
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

const POLL_MS = 2500;
const HEARTBEAT_MS = 12000;

/** Numeric-only = IG pk when handle hydration failed — avoid misleading @ prefix. */
function IgAccountInline({ handle }: { handle: string }) {
  const t = handle.trim();
  if (/^\d+$/.test(t)) {
    return (
      <>
        IG account <strong className="text-zinc-700">{t}</strong>
      </>
    );
  }
  return <strong className="text-zinc-700">@{t}</strong>;
}

type Props = {
  igUsername: string;
};

export default function MultiplayerLobby({ igUsername }: Props) {
  const [serverLive, setServerLive] = useState<boolean | null>(null);
  const [mpEnv, setMpEnv] = useState<{
    hasUrl: boolean;
    hasKey: boolean;
  } | null>(null);
  const [session, setSession] = useState<MpSession | null>(null);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [runBusy, setRunBusy] = useState(false);

  const [createName, setCreateName] = useState(igUsername);
  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState(igUsername);
  const [secondName, setSecondName] = useState(`${igUsername} (2)`);

  const igBody = { ig_username: igUsername };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const st = await fetchMultiplayerEnvStatus();
      if (cancelled) return;
      setMpEnv({ hasUrl: st.hasUrl, hasKey: st.hasKey });
      setServerLive(st.ok);
      if (st.ok) setSession(loadSession());
    })();
    return () => {
      cancelled = true;
    };
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

  const refreshState = useCallback(
    async (s: MpSession) => {
      const tok = myPlayerToken(s);
      if (!tok) return;
      try {
        const data = await mpFetch<RoomState>("room-state", {
          room_id: s.room_id,
          player_token: tok,
        });
        setRoomState(data);
        await pulseHeartbeat(s);
      } catch {
        /* ignore poll errors */
      }
    },
    [pulseHeartbeat],
  );

  useEffect(() => {
    if (!session) return;
    refreshState(session);
    const poll = window.setInterval(() => refreshState(session), POLL_MS);
    return () => clearInterval(poll);
  }, [session, refreshState]);

  useEffect(() => {
    if (!session) return;
    pulseHeartbeat(session);
    const hb = window.setInterval(() => pulseHeartbeat(session), HEARTBEAT_MS);
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
      }>("create-room", {
        display_name: createName.trim() || igUsername,
        ...igBody,
      });
      const s: MpSession = {
        room_id: r.room_id,
        short_code: r.short_code,
        invite_token: r.invite_token,
        host_secret: r.host_secret,
        host_player_token: r.player_token,
        host_player_id: r.host_player_id,
        role: "host",
        display_name: createName.trim() || igUsername,
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
        display_name: secondName.trim() || `${igUsername} (2)`,
        ...igBody,
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
        display_name: joinName.trim() || igUsername,
        ...igBody,
      });
      const prev = loadSession();
      const s = applyJoinToSession(prev, r, joinName.trim() || igUsername);
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
      await pulseHeartbeat(session);
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

  async function runPunishmentOnInstagram() {
    if (!session || !roomState?.latest_round) return;
    const lr = roomState.latest_round;
    if (lr.status !== "assigned") return;
    const tok = tokenForVictim(session, lr.victim_player_id);
    if (!tok) {
      setErr("You are not the victim for this round.");
      return;
    }
    setRunBusy(true);
    setErr("");
    try {
      const r = await executeDeedOnInstagram({
        type: lr.deed.type,
        params: (lr.deed.params || {}) as Record<string, unknown>,
      });
      if (r.ok) {
        await onSubmit("ok", r.detail);
      } else {
        setErr(r.detail);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Instagram action failed");
    } finally {
      setRunBusy(false);
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

  if (serverLive === null) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center text-sm text-zinc-500">
        Loading room…
      </div>
    );
  }

  if (!serverLive) {
    const hu = mpEnv?.hasUrl === true;
    const hk = mpEnv?.hasKey === true;
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
        <p className="text-zinc-600 text-sm font-medium">
          Multiplayer server not configured
        </p>
        <p className="text-zinc-500 text-xs leading-relaxed">
          Signed in as <IgAccountInline handle={igUsername} />.
        </p>
        {mpEnv ? (
          <p className="text-xs text-zinc-500">
            URL {hu ? "ok" : "missing"} · key {hk ? "ok" : "missing"}
          </p>
        ) : null}
        <p className="text-zinc-500 text-xs leading-relaxed max-w-sm mx-auto">
          Put <code className="text-[10px]">SUPABASE_URL</code> and{" "}
          <code className="text-[10px]">SUPABASE_PUBLISHABLE_KEY</code> in repo
          root <code className="text-[10px]">.env.local</code> (or uncomment them
          in <code className="text-[10px]">webapp/.env.local</code>), save, then
          restart <code className="text-[10px]">npm run dev</code>.
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
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">
            Group <span className="text-rose">room</span>
          </h1>
          <p className="text-xs text-zinc-500">
            Signed in as <IgAccountInline handle={igUsername} /> — punishments
            use this Instagram account.
          </p>
          <p className="text-sm text-zinc-500 mt-2">
            Live room synced via Supabase (same API as{" "}
            <code className="text-xs bg-beige px-1 rounded">
              scripts/shame-mp
            </code>
            ).
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
      <header className="flex items-center justify-between gap-3">
        <div>
          <Link href="/" className="text-sm font-bold text-zinc-900">
            shame<span className="text-rose">.ai</span>
          </Link>
          <p className="text-[10px] text-zinc-400 mt-0.5">
            {/^\d+$/.test(igUsername.trim()) ? (
              <>IG {igUsername.trim()}</>
            ) : (
              <>@{igUsername.trim()}</>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onLeave}
          className="text-xs text-zinc-400 hover:text-zinc-900 shrink-0"
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
                Same device — add a 2nd player (two heartbeats, same IG account
                is ok for testing)
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
          const dp = (lr.deed.params || {}) as Record<string, unknown>;
          const punishment = getPunishmentById(lr.deed.type);
          const emoji =
            (dp.emoji as string) || punishment?.emoji || "\u{1F3B2}";
          const deedName =
            (dp.name as string) || punishment?.name || lr.deed.type;
          const description =
            (dp.description as string) || punishment?.description || "";
          const category = ((dp.category as string) ||
            punishment?.category ||
            "dm") as PunishmentCategory;
          const targetUsername = dp.target_username as string | undefined;
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
                <p className="text-xl font-bold text-zinc-900">{deedName}</p>
                {description && (
                  <p className="text-sm text-zinc-600">{description}</p>
                )}
              </div>

              {targetUsername && (
                <p className="text-sm font-medium text-zinc-800 text-center">
                  Target: <span className="text-rose">@{targetUsername}</span>
                </p>
              )}

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

              {imVictim ? (
                <div className="space-y-3 pt-1">
                  {deedNeedsInstagramAction(lr.deed.type) ? (
                    <button
                      type="button"
                      disabled={busy || runBusy}
                      onClick={() => void runPunishmentOnInstagram()}
                      className="w-full py-3 rounded-full bg-rose text-white text-sm font-semibold disabled:opacity-50"
                    >
                      {runBusy ? "Executing..." : "Execute the Shame"}
                    </button>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy || runBusy}
                      onClick={() => onSubmit("ok", "done manually")}
                      className="py-2 px-4 rounded-full bg-zinc-900 text-white text-sm"
                    >
                      Mark done (manual)
                    </button>
                    <button
                      type="button"
                      disabled={busy || runBusy}
                      onClick={() => onSubmit("skipped", "skipped")}
                      className="py-2 px-4 rounded-full border border-beige text-sm"
                    >
                      Skip
                    </button>
                  </div>
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
                {p.ig_username ? (
                  <span className="text-zinc-400 text-xs">
                    {" "}
                    @{p.ig_username}
                  </span>
                ) : null}
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
        Victims can use{" "}
        <strong className="text-zinc-500">Run on Instagram</strong> (uses your
        shame.ai login) or do it in the app / extension and tap Mark done.
      </p>
    </div>
  );
}
